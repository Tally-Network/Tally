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
import { rpc, Networks } from "@stellar/stellar-sdk";
import { UltraHonkBackend } from "@aztec/bb.js";

import { ChainClient } from "../ct/sdk/src/chain/client.js";
import { addressToField } from "../ct/sdk/src/crypto/address.js";
import { randomScalar, frSub } from "../ct/sdk/src/crypto/field.js";
import { scalarMul, pointCoords, H, Grumpkin, type Point } from "../ct/sdk/src/crypto/grumpkin.js";
import { poseidonWithDomain, deriveEphemeralRE, encryptAmount, vkFromSk } from "../ct/sdk/src/crypto/poseidon2.js";
import { DOMAIN } from "../ct/sdk/src/crypto/constants.js";
import { ecdh } from "../ct/sdk/src/crypto/grumpkin.js";
import {
  DISC_BIND, ZK, hex, un0x, padded, capacityFor, ledgersToDays,
  readRound, roundEvents, verifyRound, VerifyError,
} from "../verify/core.js";

// Kept exported from here: cli/test-retention.ts imports it.
export { retentionVerdict, type RetentionVerdict } from "../verify/core.js";

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

// ---------------------------------------------------------------- circuits

function loadCircuitFile(capacity: number): { circuit: any; pinnedVk: Uint8Array | null } {
  const circuit = JSON.parse(readFileSync(new URL(`../circuits/aggregate_n${capacity}/circuit.json`, import.meta.url), "utf8"));
  let pinnedVk: Uint8Array | null = null;
  try { pinnedVk = new Uint8Array(readFileSync(new URL(`../circuits/aggregate_n${capacity}/vk.zk.bin`, import.meta.url))); }
  catch (e: any) { if (e?.code !== "ENOENT") throw e; }
  return { circuit, pinnedVk };
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
  const funder = arg("funder");
  const roundIdHex = arg("round").replace(/^0x/, "");
  const challenge = JSON.parse(readFileSync(arg("challenge", "challenge.json"), "utf8"));
  const bundle = JSON.parse(readFileSync(arg("bundle", "bundle.json"), "utf8"));

  console.log(`\n  tally verify — resolving everything from chain\n`);
  info(`registry ${registryId()}`);
  info(`token    ${dep.contracts.token}`);

  const result = await verifyRound({
    deployment: dep, registry: registryId(), funder, roundIdHex, challenge, bundle,
    loadCircuit: async cap => loadCircuitFile(cap),
    makeBackend: bytecode => new UltraHonkBackend(bytecode),
    onStep: s => (s.kind === "ok" ? ok : s.kind === "info" ? info : bad)(s.text),
  });

  if (result.state === "expired") {
    const { round, oldest, agedBy } = result;
    console.log();
    bad(`this round has aged out of the RPC's event retention window.`);
    console.log(`
    round opened at ledger  ${round.opened_at}
    RPC serves from ledger  ${oldest}   (${agedBy.toLocaleString()} ledgers ≈ ${ledgersToDays(agedBy).toFixed(1)} days too old)

  \x1b[1mThis is not a proof failure.\x1b[0m The proof is untouched and would still verify.
  Verification enumerates the round's transfers from chain events — deliberately,
  so a funder cannot choose which transfers the total covers — and this RPC no
  longer serves events that far back.

  Options:
    · point --rpc at an archive node with a longer window
    · ask whoever published this round to refresh it:  pnpm evidence:refresh
    · durable verification needs a persistent event archive; the confidential-token
      specification defines one (INDEXER.md). Tally has not built it — see
      docs/SDK-SAFETY-INVARIANTS.md, Milestone U2.
`);
    process.exit(3);
  }
  if (result.state === "rejected") { bad("PROOF FAILED"); console.log(); process.exit(2); }

  if (result.total === null) {
    info("the challenge has no secret_r_R, so the total stays sealed to whoever holds it");
  } else {
    console.log(`\n  \x1b[1mTOTAL DISBURSED: ${result.total}\x1b[0m  (stroops of the wrapped asset)`);
  }
  console.log(`  over ${result.transfers} transfers from ${result.lanes} declared lanes, ledgers ${result.round.opened_at}–${result.round.closed_at}`);
  console.log(`  no individual amount was revealed.\n`);
}

function pointFrom({ x, y }: { x: bigint; y: bigint }): Point {
  return Grumpkin.fromAffine({ x, y });
}

async function cmdProve() {
  const dep = loadDeployment();
  const server = new rpc.Server(dep.rpcUrl);
  const client = new ChainClient({ rpcUrl: dep.rpcUrl, networkPassphrase: Networks.TESTNET, contracts: dep.contracts as any });
  const funder = arg("funder");
  const roundId = Buffer.from(arg("round").replace(/^0x/, ""), "hex");
  const challenge = JSON.parse(readFileSync(arg("challenge", "challenge.json"), "utf8"));
  const keys = JSON.parse(readFileSync(arg("keys"), "utf8")) as { lanes: Record<string, string> };

  console.log(`\n  tally prove — answering the donor's challenge\n`);
  const round = await readRound(server, registryId(), funder, roundId.toString("hex"));
  const evs = await roundEvents(client, round);
  ok(`${evs.length} transfers in round`);
  const capacity = capacityFor(evs.length);
  const { circuit } = loadCircuitFile(capacity);

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
  run().catch(e => { console.error(`\n  error: ${e?.message ?? e}\n`); process.exit(e instanceof VerifyError ? e.code : 1); });
}
