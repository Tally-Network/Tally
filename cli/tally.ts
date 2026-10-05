#!/usr/bin/env tsx
/**
 * tally — independent verification of a confidential disbursement round.
 *
 *   tally challenge                                  donor issues a challenge
 *   tally prove    --funder G… --round <id> …        funder answers it
 *   tally verify   --funder G… --round <id> …        donor verifies, alone
 *
 * `verify` is the point of this tool. The trust statement says a donor is
 * assured of something; if verification only runs inside our own demo script,
 * no donor can perform it and the assurance is theoretical.
 *
 * THE TRUST BOUNDARY (OZ v0.9.0 docs/selective-disclosure/protocol.md)
 * --------------------------------------------------------------------
 * The verifier constructs every public input itself, from chain state and from
 * its own challenge. From the funder's bundle it takes EXACTLY THREE VALUES:
 *
 *     π          the proof bytes
 *     R_disc     the disclosure ephemeral public key
 *     ṽ_disc     the sealed total
 *
 * Nothing else in the bundle is read. If a funder could supply a public input,
 * it could prove a statement about a set of transfers it chose rather than the
 * set the chain records — which is the whole attack this layer exists to stop.
 *
 * Public-input ORDER is derived from the circuit's own ABI rather than
 * hardcoded, so it cannot drift from the circuit when the circuit changes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { rpc, xdr, Address, TransactionBuilder, Contract, BASE_FEE, Networks, Keypair, scValToNative } from "@stellar/stellar-sdk";
import { UltraHonkBackend } from "@aztec/bb.js";

import { ChainClient } from "../ct/sdk/src/chain/client.js";
import { addressToField } from "../ct/sdk/src/crypto/address.js";
import { randomScalar, frSub } from "../ct/sdk/src/crypto/field.js";
import { scalarMul, pointCoords, H, Grumpkin, type Point } from "../ct/sdk/src/crypto/grumpkin.js";
import { poseidonWithDomain, deriveEphemeralRE, encryptAmount, vkFromSk } from "../ct/sdk/src/crypto/poseidon2.js";
import { DOMAIN } from "../ct/sdk/src/crypto/constants.js";
import { ecdh } from "../ct/sdk/src/crypto/grumpkin.js";
import { fetchEvents } from "../ct/sdk/src/chain/events.js";

/** δ_disc_bind = 15 — OpenZeppelin v0.9.0 docs/protocol/domain-separators.md. */
const DISC_BIND = 15n;
/** Disclosure proofs are zero-knowledge. See demo/zk-prover.ts. */
const ZK = { keccakZK: true } as const;

const hex = (x: bigint) => "0x" + x.toString(16).padStart(64, "0");
const un0x = (h: string) => BigInt(h.startsWith("0x") ? h : "0x" + h);

// ---------------------------------------------------------------- args

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf("--" + name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  die(`missing --${name}`);
}
function die(msg: string): never { console.error(`\n  error: ${msg}\n`); process.exit(1); }
const ok   = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const info = (m: string) => console.log(`  \x1b[2m·\x1b[0m ${m}`);
const bad  = (m: string) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);

interface Deployment {
  rpcUrl: string; deployedAtLedger: number;
  contracts: { token: string; verifier: string; auditor: string; registry?: string };
}
function loadDeployment(): Deployment {
  const d = JSON.parse(readFileSync(arg("deployment", new URL("../demo/deployment.testnet.json", import.meta.url).pathname), "utf8"));
  d.rpcUrl = arg("rpc", process.env.TALLY_RPC ?? d.rpcUrl);   // archive nodes have longer windows
  return d;
}
function registryId(): string {
  const fromDeployment = loadDeployment().contracts.registry;
  const id = arg("registry", process.env.TALLY_REGISTRY ?? fromDeployment ?? "");
  if (!id) die("no round registry: pass --registry or use a deployment file that names one");
  return id;
}

// ---------------------------------------------------------------- chain

async function simulateRead(server: rpc.Server, contractId: string, method: string, args: xdr.ScVal[]): Promise<unknown> {
  // A read needs a source account only to shape the envelope; any funded
  // account works and nothing is submitted.
  const probe = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7));
  let source;
  try { source = await server.getAccount(probe.publicKey()); }
  catch { source = await server.getAccount(arg("source", probe.publicKey())); }
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(contractId).call(method, ...args)).setTimeout(60).build();
  const sim: any = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    // Map the registry's contract errors to something a donor can act on,
    // rather than echoing a page of diagnostic events.
    const e = String(sim.error);
    if (/Error\(Contract, #2\)/.test(e)) {
      die(`no round with that id is declared by that funder.\n` +
          `         Rounds are namespaced by funder, so check the --funder address as well as --round.`);
    }
    if (/Error\(Contract, #1\)/.test(e)) die("that round id is already declared by this funder");
    die(`${method} failed: ${e.split("\n")[0]}`);
  }
  return scValToNative(sim.result.retval);
}

interface Round { funder: string; lanes: string[]; opened_at: number; closed_at: number | null }

/**
 * A round is verified by enumerating its transfers FROM CHAIN EVENTS, and
 * Soroban RPC serves only a rolling window of them. Past that window the
 * enumeration returns nothing — which, unexplained, looks exactly like a
 * broken proof to someone who has no reason to know retention windows exist.
 *
 * So detect it explicitly and say what actually happened. This is not a
 * verification failure: the proof is untouched, the evidence aged out.
 */
export type RetentionVerdict =
  | { state: "ok"; ledgersLeft: number }
  | { state: "expiring"; ledgersLeft: number }
  | { state: "expired"; agedBy: number };

/**
 * Pure decision, separated from the formatting so it can be tested without
 * waiting a week for a round to age out.
 */
export function retentionVerdict(openedAt: number, oldest: number, warnBelow = 17280): RetentionVerdict {
  if (openedAt < oldest) return { state: "expired", agedBy: oldest - openedAt };
  const ledgersLeft = openedAt - oldest;
  return ledgersLeft < warnBelow ? { state: "expiring", ledgersLeft } : { state: "ok", ledgersLeft };
}

async function assertWithinRetention(server: rpc.Server, round: Round): Promise<void> {
  let health: any;
  try { health = await (server as any).getHealth(); } catch { return; }  // older RPC: skip
  const oldest = Number(health?.oldestLedger ?? 0);
  const latest = Number(health?.latestLedger ?? 0);
  if (!oldest || !latest) return;

  const verdict = retentionVerdict(round.opened_at, oldest);
  if (verdict.state === "expired") {
    const agedBy = verdict.agedBy;
    console.log();
    bad(`this round has aged out of the RPC's event retention window.`);
    console.log(`
    round opened at ledger  ${round.opened_at}
    RPC serves from ledger  ${oldest}   (${agedBy.toLocaleString()} ledgers ≈ ${(agedBy * 5 / 86400).toFixed(1)} days too old)

  [1mThis is not a proof failure.[0m The proof is untouched and would still verify.
  Verification enumerates the round's transfers from chain events — deliberately,
  so a funder cannot choose which transfers the total covers — and this RPC no
  longer serves events that far back (retention ≈ ${((Number(health.ledgerRetentionWindow) || 120960) * 5 / 86400).toFixed(0)} days).

  Options:
    · point --rpc at an archive node with a longer window
    · ask whoever published this round to refresh it:  pnpm evidence:refresh
    · durable verification needs a persistent event archive; the confidential-token
      specification defines one (INDEXER.md). Tally has not built it — see
      docs/SDK-SAFETY-INVARIANTS.md, Milestone U2.
`);
    process.exit(3);
  }

  if (verdict.state === "expiring") {
    bad(`this round leaves the retention window in ~${(verdict.ledgersLeft * 5 / 86400).toFixed(1)} days — refresh the evidence soon (pnpm evidence:refresh)`);
  } else {
    info(`inside the retention window, ~${(verdict.ledgersLeft * 5 / 86400).toFixed(1)} days of margin`);
  }
}

async function readRound(server: rpc.Server, funder: string, roundId: Buffer): Promise<Round> {
  return await simulateRead(server, registryId(), "get_round",
    [new Address(funder).toScVal(), xdr.ScVal.scvBytes(roundId)]) as Round;
}

/** Every transfer out of the declared lanes, inside the declared window. */
async function roundEvents(client: ChainClient, round: Round, fromLedger: number) {
  const lanes = new Set(round.lanes);
  const { events } = await fetchEvents(client, { startLedger: fromLedger });
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
    if (seen.has(k)) die(`duplicate event in round: ${k}`);
    seen.add(k);
  }
  return inRound.sort((a, b) => a.ledger - b.ledger || String(a.txHash).localeCompare(String(b.txHash)));
}

// ------------------------------------------------- public inputs, from the ABI

/**
 * Build the public-input vector in the circuit's own declared order.
 *
 * Reading the order from the ABI rather than hardcoding it means a change to
 * the circuit's signature cannot silently produce a verifier that checks the
 * right proof against the wrong vector.
 */
function publicInputsFromAbi(circuit: any, values: Record<string, string | string[]>): string[] {
  const out: string[] = [];
  for (const p of circuit.abi.parameters) {
    if (p.visibility !== "public") continue;
    const v = values[p.name];
    if (v === undefined) die(`ABI expects public input "${p.name}" and it was not supplied`);
    if (p.type.kind === "array") {
      const arr = v as string[];
      if (arr.length !== p.type.length) die(`"${p.name}": ABI wants ${p.type.length} elements, got ${arr.length}`);
      out.push(...arr);
    } else {
      out.push(v as string);
    }
  }
  return out;
}

function circuitFor(n: number): { circuit: any; capacity: number } {
  for (const cap of [8, 16, 64]) {
    if (n <= cap) {
      const path = new URL(`../circuits/aggregate_n${cap}/circuit.json`, import.meta.url);
      return { circuit: JSON.parse(readFileSync(path, "utf8")), capacity: cap };
    }
  }
  die(`round of ${n} transfers exceeds the largest circuit (64)`);
}

/** Pad to capacity by repeating slot 0's PUBLIC data with active = 0. */
function padded(vals: string[], capacity: number, padWith: string): string[] {
  return [...vals, ...Array(capacity - vals.length).fill(padWith)];
}

// ---------------------------------------------------------------- commands

async function cmdChallenge() {
  const rR = randomScalar();
  const pR = scalarMul(rR, H);
  const nu = randomScalar();
  const { x, y } = pointCoords(pR);
  const out = arg("out", "challenge.json");
  writeFileSync(out, JSON.stringify({
    note: "Donor-issued challenge. Keep r_R secret; give the funder only p_r and nu.",
    p_r_x: hex(x), p_r_y: hex(y), nu: hex(nu),
    secret_r_R: hex(rR),
  }, null, 2) + "\n");
  console.log(`\n  challenge written to ${out}`);
  ok(`disclosure key P_R = ${hex(x).slice(0, 18)}…`);
  ok(`nonce ν = ${hex(nu).slice(0, 18)}…`);
  info("send the funder p_r_x, p_r_y and nu — never secret_r_R");
  console.log();
}

async function cmdVerify() {
  const dep = loadDeployment();
  const server = new rpc.Server(dep.rpcUrl);
  const client = new ChainClient({ rpcUrl: dep.rpcUrl, networkPassphrase: Networks.TESTNET, contracts: dep.contracts });
  const funder = arg("funder");
  const roundId = Buffer.from(arg("round").replace(/^0x/, ""), "hex");
  const challenge = JSON.parse(readFileSync(arg("challenge", "challenge.json"), "utf8"));
  const bundle = JSON.parse(readFileSync(arg("bundle", "bundle.json"), "utf8"));

  console.log(`\n  tally verify — resolving everything from chain\n`);
  info(`registry ${registryId()}`);
  info(`token    ${dep.contracts.token}`);

  // 1. The round, from the registry — never from the bundle.
  const round = await readRound(server, funder, roundId);
  ok(`round found: ${round.lanes.length} lanes, window [${round.opened_at}, ${round.closed_at ?? "OPEN"}]`);
  if (round.closed_at === null) bad("round is still open — its window can still move; treat the result as provisional");
  if (round.funder !== funder) die(`registry returned a round owned by ${round.funder}`);

  // 2. The transfer set, from chain events.
  await assertWithinRetention(server, round);

  const evs = await roundEvents(client, round, Math.min(round.opened_at, dep.deployedAtLedger));
  ok(`${evs.length} transfers from the declared lanes inside the window`);
  if (evs.length === 0) {
    die("the round is inside the retention window but contains no transfers from its declared lanes.\n" +
        "         That is an empty or mis-declared round, not an expired one.");
  }

  const { circuit, capacity } = circuitFor(evs.length);
  const minActive = 5;
  if (evs.length < minActive) die(`round has ${evs.length} transfers; the circuit floor is ${minActive}. A total over fewer is not an aggregate.`);
  info(`using aggregate_n${capacity} (${evs.length} active, ${capacity - evs.length} padded)`);

  // 3. Account keys, from chain — PVK_A from e.from, PVK_B from e.to (§5.3 step 2).
  const pvkCache = new Map<string, Point>();
  const pvk = async (addr: string): Promise<Point> => {
    if (!pvkCache.has(addr)) {
      const acct = await client.confidentialBalance(addr);
      if (!acct) die(`account ${addr} is not registered — cannot verify a round that references it`);
      pvkCache.set(addr, acct.viewingPublicKey);
    }
    return pvkCache.get(addr)!;
  };

  const F: Record<string, string[]> = { active: [], pvk_a_x: [], pvk_a_y: [], pvk_b_x: [], pvk_b_y: [], r_e_x: [], r_e_y: [], sigma: [], v_tilde: [] };
  for (const e of evs as any[]) {
    const A = pointCoords(await pvk(e.from));
    const B = pointCoords(await pvk(e.to));
    const R = pointCoords(e.rE);
    F.active.push(hex(1n));
    F.pvk_a_x.push(hex(A.x)); F.pvk_a_y.push(hex(A.y));
    F.pvk_b_x.push(hex(B.x)); F.pvk_b_y.push(hex(B.y));
    F.r_e_x.push(hex(R.x));   F.r_e_y.push(hex(R.y));
    F.sigma.push(hex(e.sigma)); F.v_tilde.push(hex(e.vTilde));
  }
  for (const k of Object.keys(F)) {
    F[k] = padded(F[k], capacity, k === "active" ? hex(0n) : F[k][0]);
  }
  ok("public inputs reconstructed from chain state only");

  // 4. Assemble in the circuit's own ABI order.
  const publicInputs = publicInputsFromAbi(circuit, {
    addr_f: hex(addressToField(dep.contracts.token)),
    n_active: hex(BigInt(evs.length)),
    ...F,
    p_r_x: challenge.p_r_x, p_r_y: challenge.p_r_y, nu: challenge.nu,
    // The ONLY three values taken from the funder:
    r_disc_x: bundle.r_disc_x, r_disc_y: bundle.r_disc_y, v_tilde_disc: bundle.v_tilde_disc,
  });
  info(`${publicInputs.length} public inputs (expected ${9 * capacity + 8})`);

  // 5. Verify the VK is the one we pinned — the off-chain trust anchor (§5.5).
  const backend = new UltraHonkBackend(circuit.bytecode);
  const derivedVk = await backend.getVerificationKey(ZK);
  const pinnedPath = new URL(`../circuits/aggregate_n${capacity}/vk.zk.bin`, import.meta.url);
  try {
    const pinned = new Uint8Array(readFileSync(pinnedPath));
    if (Buffer.compare(Buffer.from(pinned), Buffer.from(derivedVk)) !== 0) die("verification key does not match the pinned artifact — refusing to verify");
    ok(`verification key matches the pinned artifact (${derivedVk.length} B)`);
  } catch (e: any) {
    if (e?.code === "ENOENT") bad(`no pinned VK at ${pinnedPath.pathname} — verifying against a locally derived key`);
    else throw e;
  }

  // 6. Verify.
  const proof = Buffer.from(bundle.proof, "base64");
  const verified = await backend.verifyProof({ proof: new Uint8Array(proof), publicInputs }, ZK);
  await backend.destroy();
  if (!verified) { bad("PROOF FAILED"); console.log(); process.exit(2); }
  ok(`proof verified (${proof.length} B, zero-knowledge)`);

  // 7. Decrypt the total with the donor's OWN key. S_disc = r_R · R_disc.
  const rR = un0x(challenge.secret_r_R);
  const Rdisc = { x: un0x(bundle.r_disc_x), y: un0x(bundle.r_disc_y) };
  const sDisc = pointCoords(scalarMul(rR, pointFrom(Rdisc)));
  const total = frSub(un0x(bundle.v_tilde_disc), poseidonWithDomain(DISC_BIND, [sDisc.x, un0x(challenge.nu)]));

  console.log(`\n  \x1b[1mTOTAL DISBURSED: ${total}\x1b[0m  (stroops of the wrapped asset)`);
  console.log(`  over ${evs.length} transfers from ${round.lanes.length} declared lanes, ledgers ${round.opened_at}–${round.closed_at}`);
  console.log(`  no individual amount was revealed.\n`);
}

function pointFrom({ x, y }: { x: bigint; y: bigint }): Point {
  return Grumpkin.fromAffine({ x, y });
}

async function cmdProve() {
  const dep = loadDeployment();
  const server = new rpc.Server(dep.rpcUrl);
  const client = new ChainClient({ rpcUrl: dep.rpcUrl, networkPassphrase: Networks.TESTNET, contracts: dep.contracts });
  const funder = arg("funder");
  const roundId = Buffer.from(arg("round").replace(/^0x/, ""), "hex");
  const challenge = JSON.parse(readFileSync(arg("challenge", "challenge.json"), "utf8"));
  const keys = JSON.parse(readFileSync(arg("keys"), "utf8")) as { lanes: Record<string, string> };

  console.log(`\n  tally prove — answering the donor's challenge\n`);
  const round = await readRound(server, funder, roundId);
  const evs = await roundEvents(client, round, Math.min(round.opened_at, dep.deployedAtLedger));
  ok(`${evs.length} transfers in round`);
  const { circuit, capacity } = circuitFor(evs.length);

  const pvkCache = new Map<string, Point>();
  const pvk = async (a: string) => {
    if (!pvkCache.has(a)) { const acc = await client.confidentialBalance(a); if (!acc) die(`${a} unregistered`); pvkCache.set(a, acc.viewingPublicKey); }
    return pvkCache.get(a)!;
  };

  const W: Record<string, string[]> = { sk: [], r_e: [], v_tx: [], active: [], pvk_a_x: [], pvk_a_y: [], pvk_b_x: [], pvk_b_y: [], r_e_x: [], r_e_y: [], sigma: [], v_tilde: [] };
  let total = 0n;
  for (const e of evs as any[]) {
    const skHex = keys.lanes[e.from];
    if (!skHex) die(`no spending key supplied for lane ${e.from}`);
    const sk = un0x(skHex);
    const vk = vkFromSk(sk, addressToField(dep.contracts.token));
    const rE = deriveEphemeralRE(vk, e.sigma);            // re-derived, never stored
    const B = await pvk(e.to);
    const vTx = frSub(e.vTilde, poseidonWithDomain(DOMAIN.TRANSFER_AMOUNT, [ecdh(rE, B), e.sigma]));
    if (encryptAmount(vTx, ecdh(rE, B), e.sigma) !== e.vTilde) die(`event ${e.txHash} is not disclosable by this key`);
    total += vTx;
    const A = pointCoords(await pvk(e.from)), Bc = pointCoords(B), R = pointCoords(e.rE);
    W.sk.push(hex(sk)); W.r_e.push(hex(rE)); W.v_tx.push(hex(vTx)); W.active.push(hex(1n));
    W.pvk_a_x.push(hex(A.x)); W.pvk_a_y.push(hex(A.y)); W.pvk_b_x.push(hex(Bc.x)); W.pvk_b_y.push(hex(Bc.y));
    W.r_e_x.push(hex(R.x)); W.r_e_y.push(hex(R.y)); W.sigma.push(hex(e.sigma)); W.v_tilde.push(hex(e.vTilde));
  }
  for (const k of Object.keys(W)) {
    const pad = k === "active" || k === "v_tx" ? hex(0n) : k === "sk" || k === "r_e" ? hex(1n) : W[k][0];
    W[k] = padded(W[k], capacity, pad);
  }

  const rDisc = randomScalar();
  const pR = pointFrom({ x: un0x(challenge.p_r_x), y: un0x(challenge.p_r_y) });
  const sDisc = pointCoords(scalarMul(rDisc, pR));
  const vTildeDisc = total + poseidonWithDomain(DISC_BIND, [sDisc.x, un0x(challenge.nu)]);
  const rDiscPt = pointCoords(scalarMul(rDisc, H));

  const { Noir } = await import("@noir-lang/noir_js");
  const noir = new Noir(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode);
  const { witness } = await noir.execute({
    ...W, r_disc: hex(rDisc), addr_f: hex(addressToField(dep.contracts.token)),
    n_active: hex(BigInt(evs.length)),
    p_r_x: challenge.p_r_x, p_r_y: challenge.p_r_y, nu: challenge.nu,
    r_disc_x: hex(rDiscPt.x), r_disc_y: hex(rDiscPt.y), v_tilde_disc: hex(vTildeDisc),
  } as never);
  const { proof } = await backend.generateProof(witness, ZK);
  await backend.destroy();

  const out = arg("out", "bundle.json");
  writeFileSync(out, JSON.stringify({
    note: "Disclosure bundle. The verifier reads ONLY proof, r_disc_* and v_tilde_disc from this file.",
    funder, round: roundId.toString("hex"),
    proof: Buffer.from(proof).toString("base64"),
    r_disc_x: hex(rDiscPt.x), r_disc_y: hex(rDiscPt.y), v_tilde_disc: hex(vTildeDisc),
  }, null, 2) + "\n");
  ok(`bundle written to ${out} (${proof.length} B proof, zero-knowledge)`);
  console.log();
}

// ---------------------------------------------------------------- main

// Only dispatch when run directly. Without this guard, importing anything from
// this file (the retention tests do) executes the CLI and exits.
const isEntry = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
const cmd = process.argv[2];
const run = { challenge: cmdChallenge, prove: cmdProve, verify: cmdVerify }[cmd ?? ""];
if (!isEntry) {
  // imported as a module — export only
} else if (!run) {
  console.log(`
  tally — independent verification of a confidential disbursement round

    tally challenge [--out challenge.json]
    tally prove   --funder <G…> --round <hex> --keys <file> [--challenge f] [--out f]
    tally verify  --funder <G…> --round <hex> [--challenge f] [--bundle f]

  common:  --registry <C…>  --deployment <file>
`);
  process.exit(cmd ? 1 : 0);
} else {
  run().catch(e => { console.error(`\n  error: ${e?.message ?? e}\n`); process.exit(1); });
}
