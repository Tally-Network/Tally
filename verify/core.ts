/**
 * Verification of a published round, shared by `tally verify` (Node) and the
 * site's /verify page (browser). Nothing here touches the filesystem or the
 * process: circuits, pinned keys and bb.js are passed in by the caller.
 *
 * THE TRUST BOUNDARY (OZ v0.9.0 docs/selective-disclosure/protocol.md)
 * The verifier constructs every public input itself, from chain state and
 * from its own challenge. From the funder's bundle it takes EXACTLY THREE
 * VALUES:
 *
 *     π          the proof bytes
 *     R_disc     the disclosure ephemeral public key
 *     ṽ_disc     the sealed total
 *
 * Nothing else in the bundle is read. If a funder could supply a public input,
 * it could prove a statement about a set of transfers it chose rather than the
 * set the chain records, which is the attack this layer exists to stop.
 *
 * Public-input ORDER is derived from the circuit's own ABI rather than
 * hardcoded, so it cannot drift from the circuit when the circuit changes.
 */
import { rpc, Address, TransactionBuilder, Contract, BASE_FEE, Networks, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";

import { ChainClient } from "../ct/sdk/src/chain/client.js";
import { fetchEvents } from "../ct/sdk/src/chain/events.js";
import { addressToField } from "../ct/sdk/src/crypto/address.js";
import { frSub } from "../ct/sdk/src/crypto/field.js";
import { scalarMul, pointCoords, Grumpkin, type Point } from "../ct/sdk/src/crypto/grumpkin.js";
import { poseidonWithDomain } from "../ct/sdk/src/crypto/poseidon2.js";

/** δ_disc_bind = 15 (OpenZeppelin v0.9.0 docs/protocol/domain-separators.md). */
export const DISC_BIND = 15n;
/** Disclosure proofs are zero-knowledge. See demo/zk-prover.ts. */
export const ZK = { keccakZK: true } as const;
/** The circuit refuses to prove over fewer transfers (SDK-SAFETY-INVARIANTS.md §I2). */
export const MIN_ACTIVE = 5;
export const CAPACITIES = [8, 16, 64] as const;

/**
 * A read needs a source account only to shape the envelope; nothing is
 * submitted. This is the funded testnet account whose ed25519 seed is 32 bytes
 * of 0x07, written as its address so that no Buffer is needed in a browser.
 */
const PROBE_ACCOUNT = "GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57";

export const hex = (x: bigint) => "0x" + x.toString(16).padStart(64, "0");
export const un0x = (h: string) => BigInt(h.startsWith("0x") ? h : "0x" + h);

export interface Deployment {
  rpcUrl: string;
  deployedAtLedger: number;
  contracts: { token: string; verifier: string; auditor: string; registry?: string };
}
export interface Challenge { p_r_x: string; p_r_y: string; nu: string; secret_r_R?: string }
/** Only these four fields of a bundle are ever read. */
export interface Bundle { proof: string; r_disc_x: string; r_disc_y: string; v_tilde_disc: string }
export interface Round { funder: string; lanes: string[]; opened_at: number; closed_at: number | null }

/** A stop that is not a proof failure. `code` is the CLI's exit code. */
export class VerifyError extends Error {
  constructor(message: string, readonly code: 1 | 3 = 1) { super(message); }
}

export type StepKind = "ok" | "info" | "warn";
export type StepId = "round" | "retention" | "transfers" | "circuit" | "inputs" | "vk" | "proof" | "total";
export interface Step { id: StepId; kind: StepKind; text: string }

// ------------------------------------------------------------- retention

/**
 * A round is verified by enumerating its transfers FROM CHAIN EVENTS, and
 * Soroban RPC serves only a rolling window of them. Past that window the
 * enumeration returns nothing, which unexplained looks exactly like a broken
 * proof. So it is detected explicitly: the evidence aged out, the proof did not
 * fail.
 */
export type RetentionVerdict =
  | { state: "ok"; ledgersLeft: number }
  | { state: "expiring"; ledgersLeft: number }
  | { state: "expired"; agedBy: number };

/** Pure decision, separated so it can be tested without waiting a week. */
export function retentionVerdict(openedAt: number, oldest: number, warnBelow = 17280): RetentionVerdict {
  if (openedAt < oldest) return { state: "expired", agedBy: oldest - openedAt };
  const ledgersLeft = openedAt - oldest;
  return ledgersLeft < warnBelow ? { state: "expiring", ledgersLeft } : { state: "ok", ledgersLeft };
}

export const ledgersToDays = (n: number) => (n * 5) / 86400;

/** The RPC's own window, or null when the RPC does not report it. */
export async function rpcWindow(server: rpc.Server): Promise<{ oldest: number; latest: number; retention: number } | null> {
  let health: any;
  try { health = await (server as any).getHealth(); } catch { return null; }
  const oldest = Number(health?.oldestLedger ?? 0);
  const latest = Number(health?.latestLedger ?? 0);
  if (!oldest || !latest) return null;
  return { oldest, latest, retention: Number(health?.ledgerRetentionWindow) || 120960 };
}

// ------------------------------------------------------------------ chain

async function simulateRead(server: rpc.Server, contractId: string, method: string, args: xdr.ScVal[]): Promise<unknown> {
  const source = await server.getAccount(PROBE_ACCOUNT);
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(contractId).call(method, ...args)).setTimeout(60).build();
  const sim: any = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    // Map the registry's contract errors to something a donor can act on.
    const e = String(sim.error);
    if (/Error\(Contract, #2\)/.test(e)) {
      throw new VerifyError("no round with that id is declared by that funder.\n" +
        "         Rounds are namespaced by funder, so check the funder address as well as the round id.");
    }
    if (/Error\(Contract, #1\)/.test(e)) throw new VerifyError("that round id is already declared by this funder");
    throw new VerifyError(`${method} failed: ${e.split("\n")[0]}`);
  }
  return scValToNative(sim.result.retval);
}

const hexToBytes = (h: string) => {
  const s = h.replace(/^0x/, "");
  return Uint8Array.from({ length: s.length / 2 }, (_, i) => parseInt(s.slice(2 * i, 2 * i + 2), 16));
};

export async function readRound(server: rpc.Server, registry: string, funder: string, roundIdHex: string): Promise<Round> {
  return await simulateRead(server, registry, "get_round",
    [new Address(funder).toScVal(), nativeToScVal(hexToBytes(roundIdHex), { type: "bytes" })]) as Round;
}

/**
 * Every transfer out of the declared lanes, inside the declared window.
 * Enumeration starts at the round's own opening ledger: nothing earlier can be
 * in the round, and an earlier start would fail once it leaves the RPC window.
 */
export async function roundEvents(client: ChainClient, round: Round) {
  const lanes = new Set(round.lanes);
  const { events } = await fetchEvents(client, { startLedger: round.opened_at });
  const inRound = (events as any[]).filter(e =>
    (e.type === "transfer" || e.type === "spender_transfer") &&
    lanes.has(e.from) &&
    e.ledger >= round.opened_at &&
    (round.closed_at === null || e.ledger <= round.closed_at));

  // The circuit cannot see duplicates; counting one event twice inflates the
  // total, so the verifier must reject them (SDK-SAFETY-INVARIANTS.md §I2).
  const seen = new Set<string>();
  for (const e of inRound) {
    const k = `${e.txHash}:${e.ledger}:${e.from}:${e.to}`;
    if (seen.has(k)) throw new VerifyError(`duplicate event in round: ${k}`);
    seen.add(k);
  }
  return inRound.sort((a, b) => a.ledger - b.ledger || String(a.txHash).localeCompare(String(b.txHash)));
}

// ---------------------------------------------------- public inputs, from the ABI

export function capacityFor(n: number): number {
  const cap = CAPACITIES.find(c => n <= c);
  if (!cap) throw new VerifyError(`round of ${n} transfers exceeds the largest circuit (64)`);
  return cap;
}

/** Build the public-input vector in the circuit's own declared order. */
export function publicInputsFromAbi(circuit: any, values: Record<string, string | string[]>): string[] {
  const out: string[] = [];
  for (const p of circuit.abi.parameters) {
    if (p.visibility !== "public") continue;
    const v = values[p.name];
    if (v === undefined) throw new VerifyError(`ABI expects public input "${p.name}" and it was not supplied`);
    if (p.type.kind === "array") {
      const arr = v as string[];
      if (arr.length !== p.type.length) throw new VerifyError(`"${p.name}": ABI wants ${p.type.length} elements, got ${arr.length}`);
      out.push(...arr);
    } else {
      out.push(v as string);
    }
  }
  return out;
}

/** Pad to capacity by repeating slot 0's PUBLIC data with active = 0. */
export const padded = (vals: string[], capacity: number, padWith: string) =>
  [...vals, ...Array(capacity - vals.length).fill(padWith)];

/**
 * Every per-event public input, from chain: PVK_A from e.from, PVK_B from e.to
 * (§5.3 step 2), R_e, σ and ṽ from the event itself.
 */
export async function perEventInputs(client: ChainClient, events: any[], capacity: number) {
  // Each account's key is read once; the reads are independent, so a few run at a time.
  const addrs = [...new Set(events.flatMap(e => [e.from as string, e.to as string]))];
  const keys = new Map<string, Point>();
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(6, addrs.length) }, async () => {
    while (next < addrs.length) {
      const addr = addrs[next++];
      const acct = await client.confidentialBalance(addr);
      if (!acct) throw new VerifyError(`account ${addr} is not registered, so a round that references it cannot be verified`);
      keys.set(addr, acct.viewingPublicKey);
    }
  }));
  const pvk = async (addr: string): Promise<Point> => keys.get(addr)!;
  const F: Record<string, string[]> = { active: [], pvk_a_x: [], pvk_a_y: [], pvk_b_x: [], pvk_b_y: [], r_e_x: [], r_e_y: [], sigma: [], v_tilde: [] };
  for (const e of events) {
    const A = pointCoords(await pvk(e.from));
    const B = pointCoords(await pvk(e.to));
    const R = pointCoords(e.rE);
    F.active.push(hex(1n));
    F.pvk_a_x.push(hex(A.x)); F.pvk_a_y.push(hex(A.y));
    F.pvk_b_x.push(hex(B.x)); F.pvk_b_y.push(hex(B.y));
    F.r_e_x.push(hex(R.x));   F.r_e_y.push(hex(R.y));
    F.sigma.push(hex(e.sigma)); F.v_tilde.push(hex(e.vTilde));
  }
  for (const k of Object.keys(F)) F[k] = padded(F[k], capacity, k === "active" ? hex(0n) : F[k][0]);
  return F;
}

/** The full vector: chain data, the donor's own challenge, and the bundle's three values. */
export function assemblePublicInputs(circuit: any, token: string, nActive: number, F: Record<string, string[]>, challenge: Challenge, bundle: Bundle): string[] {
  return publicInputsFromAbi(circuit, {
    addr_f: hex(addressToField(token)),
    n_active: hex(BigInt(nActive)),
    ...F,
    p_r_x: challenge.p_r_x, p_r_y: challenge.p_r_y, nu: challenge.nu,
    // The ONLY values taken from the funder:
    r_disc_x: bundle.r_disc_x, r_disc_y: bundle.r_disc_y, v_tilde_disc: bundle.v_tilde_disc,
  });
}

/** Decrypt the total with the donor's OWN key: S_disc = r_R · R_disc. */
export function decryptTotal(challenge: Challenge, bundle: Bundle): bigint {
  if (!challenge.secret_r_R) throw new VerifyError("the challenge has no secret_r_R, so only its issuer can read the total");
  const rR = un0x(challenge.secret_r_R);
  const Rdisc = Grumpkin.fromAffine({ x: un0x(bundle.r_disc_x), y: un0x(bundle.r_disc_y) });
  const sDisc = pointCoords(scalarMul(rR, Rdisc));
  return frSub(un0x(bundle.v_tilde_disc), poseidonWithDomain(DISC_BIND, [sDisc.x, un0x(challenge.nu)]));
}

const base64ToBytes = (b64: string) => {
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

// ------------------------------------------------------------------ verify

export interface Backend {
  getVerificationKey(opts: typeof ZK): Promise<Uint8Array>;
  verifyProof(p: { proof: Uint8Array; publicInputs: string[] }, opts: typeof ZK): Promise<boolean>;
  destroy(): Promise<void>;
}

export interface VerifyOptions {
  deployment: Deployment;
  registry: string;
  funder: string;
  roundIdHex: string;
  challenge: Challenge;
  bundle: Bundle;
  /** Loads circuits/aggregate_n{cap}/circuit.json and its pinned vk.zk.bin (null if absent). */
  loadCircuit(capacity: number): Promise<{ circuit: any; pinnedVk: Uint8Array | null }>;
  /** new UltraHonkBackend(bytecode, …) from whichever bb.js build the caller uses. */
  makeBackend(bytecode: string): Backend | Promise<Backend>;
  onStep?(step: Step): void;
}

export type VerifyResult =
  | { state: "verified"; total: bigint | null; transfers: number; lanes: number; round: Round; proofBytes: number }
  | { state: "rejected"; transfers: number; round: Round }
  | { state: "expired"; round: Round; oldest: number; agedBy: number };

export async function verifyRound(o: VerifyOptions): Promise<VerifyResult> {
  const step = (id: StepId, kind: StepKind, text: string) => o.onStep?.({ id, kind, text });
  const server = new rpc.Server(o.deployment.rpcUrl);
  const client = new ChainClient({ rpcUrl: o.deployment.rpcUrl, networkPassphrase: Networks.TESTNET, contracts: o.deployment.contracts as any });

  // 1. The round, from the registry, never from the bundle.
  const round = await readRound(server, o.registry, o.funder, o.roundIdHex);
  step("round", "ok", `round found: ${round.lanes.length} lanes, window [${round.opened_at}, ${round.closed_at ?? "OPEN"}]`);
  if (round.closed_at === null) step("round", "warn", "round is still open, so its window can still move; treat the result as provisional");
  if (round.funder !== o.funder) throw new VerifyError(`registry returned a round owned by ${round.funder}`);

  // 2. Retention: an aged-out round is reported as such, never as a failed proof.
  const win = await rpcWindow(server);
  if (win) {
    const v = retentionVerdict(round.opened_at, win.oldest);
    if (v.state === "expired") return { state: "expired", round, oldest: win.oldest, agedBy: v.agedBy };
    if (v.state === "expiring") step("retention", "warn", `this round leaves the retention window in ~${ledgersToDays(v.ledgersLeft).toFixed(1)} days, so refresh the evidence soon (pnpm evidence:refresh)`);
    else step("retention", "info", `inside the retention window, ~${ledgersToDays(v.ledgersLeft).toFixed(1)} days of margin`);
  }

  // 3. The transfer set, from chain events.
  const events = await roundEvents(client, round);
  step("transfers", "ok", `${events.length} transfers from the declared lanes inside the window`);
  if (events.length === 0) {
    throw new VerifyError("the round is inside the retention window but contains no transfers from its declared lanes.\n" +
      "         That is an empty or mis-declared round, not an expired one.");
  }
  if (events.length < MIN_ACTIVE) throw new VerifyError(`round has ${events.length} transfers; the circuit floor is ${MIN_ACTIVE}. A total over fewer is not an aggregate.`);
  const capacity = capacityFor(events.length);
  step("circuit", "info", `using aggregate_n${capacity} (${events.length} active, ${capacity - events.length} padded)`);

  // 4. Every public input from chain, the challenge, and three bundle values.
  const { circuit, pinnedVk } = await o.loadCircuit(capacity);
  const F = await perEventInputs(client, events, capacity);
  const publicInputs = assemblePublicInputs(circuit, o.deployment.contracts.token, events.length, F, o.challenge, o.bundle);
  step("inputs", "ok", "public inputs reconstructed from chain state only");
  step("inputs", "info", `${publicInputs.length} public inputs (expected ${9 * capacity + 8})`);

  // 5. The verification key must be the pinned one: the off-chain trust anchor (§5.5).
  const backend = await o.makeBackend(circuit.bytecode);
  try {
    const derivedVk = await backend.getVerificationKey(ZK);
    if (pinnedVk) {
      if (!sameBytes(pinnedVk, derivedVk)) throw new VerifyError("verification key does not match the pinned artifact, so verification is refused");
      step("vk", "ok", `verification key matches the pinned artifact (${derivedVk.length} B)`);
    } else {
      step("vk", "warn", "no pinned verification key, so verifying against a locally derived key");
    }

    // 6. Verify.
    const proof = base64ToBytes(o.bundle.proof);
    const verified = await backend.verifyProof({ proof, publicInputs }, ZK);
    if (!verified) return { state: "rejected", transfers: events.length, round };
    step("proof", "ok", `proof verified (${proof.length} B, zero-knowledge)`);

    // 7. The total, readable only with the donor's own key.
    const total = o.challenge.secret_r_R ? decryptTotal(o.challenge, o.bundle) : null;
    return { state: "verified", total, transfers: events.length, lanes: round.lanes.length, round, proofBytes: proof.length };
  } finally {
    await backend.destroy();
  }
}
