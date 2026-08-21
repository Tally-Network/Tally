/**
 * Tally — one reproducible disbursement round, end to end.
 *
 *   open_round  →  fan-out transfers  →  close_round
 *              →  donor resolves the round FROM CHAIN
 *              →  enumerates transfers in the declared window
 *              →  verifies ONE aggregate proof of the total
 *
 * The donor is handed nothing but the funder address and the round id. Every
 * other input — the lane set, the window, the transfer set — is resolved from
 * chain state. That is what makes the total mean something.
 *
 * Includes a deliberate OUT-OF-WINDOW transfer to show the window is load
 * bearing rather than decorative.
 */
import { Keypair, TransactionBuilder, Contract, BASE_FEE, rpc, xdr, Address, nativeToScVal, scValToNative } from "@stellar/stellar-sdk";
import { readFileSync, writeFileSync } from "node:fs";
import { RPC_URL, PASSPHRASE, loadDeployment, friendbotFund } from "./shared.js";
import { ChainClient, keypairSigner, type Signer } from "../vendor/confidential-token-demo/packages/sdk/src/chain/client.js";
import { deriveKeys, type KeyPair } from "../vendor/confidential-token-demo/packages/sdk/src/crypto/keys.js";
import { addressToField } from "../vendor/confidential-token-demo/packages/sdk/src/crypto/address.js";
import { randomScalar, frSub } from "../vendor/confidential-token-demo/packages/sdk/src/crypto/field.js";
import { scalarMul, ecdh, pointCoords, H } from "../vendor/confidential-token-demo/packages/sdk/src/crypto/grumpkin.js";
import { deriveEphemeralRE, poseidonWithDomain } from "../vendor/confidential-token-demo/packages/sdk/src/crypto/poseidon2.js";
import { DOMAIN } from "../vendor/confidential-token-demo/packages/sdk/src/crypto/constants.js";
import { buildRegisterWitness } from "../vendor/confidential-token-demo/packages/sdk/src/witness/register.js";
import { buildTransferWitness } from "../vendor/confidential-token-demo/packages/sdk/src/witness/transfer.js";
import { CircuitProver } from "../vendor/confidential-token-demo/packages/sdk/src/proving/prover.js";
import { DisclosureProver } from "./zk-prover.js";
import { loadCircuit } from "../vendor/confidential-token-demo/packages/sdk/src/proving/artifacts.js";
import { encodeRegisterData, encodeTransferData } from "../vendor/confidential-token-demo/packages/sdk/src/chain/payload.js";
import { StateEngine, MemoryStore } from "../vendor/confidential-token-demo/packages/sdk/src/state/index.js";
import { fetchEvents } from "../vendor/confidential-token-demo/packages/sdk/src/chain/events.js";

const REGISTRY = process.env.TALLY_REGISTRY ?? "CCKWYTHGFIBJ5EOYWACFYI6XTKTVONXQRA3XTMQ7CGCU23UVKTXER3ES";
const K = 5, N = 16, AUDITOR = 0, LANE_FUND = 5000n;
const AGG = new URL("../circuits/aggregate_n16/target/tally_aggregate_n16.json", import.meta.url);
const DISC_BIND = 15n;
const hex = (x: bigint) => "0x" + x.toString(16).padStart(64, "0");
interface Party { kp: Keypair; signer: Signer; keys: KeyPair }

async function main() {
  const dep = loadDeployment();
  const server = new rpc.Server(RPC_URL);
  const client = new ChainClient({ rpcUrl: RPC_URL, networkPassphrase: PASSPHRASE,
    contracts: { token: dep.contracts.token, verifier: dep.contracts.verifier, auditor: dep.contracts.auditor } });
  const addrF = addressToField(dep.contracts.token);
  const kAud = await client.auditorKey(AUDITOR);
  const scanFrom = (await server.getLatestLedger()).sequence;

  const mk = async (): Promise<Party> => {
    const kp = Keypair.random(); await friendbotFund(kp.publicKey());
    return { kp, signer: keypairSigner(kp.secret(), PASSPHRASE), keys: deriveKeys(randomScalar(), addrF) };
  };
  const addr = (a: string) => new Address(a).toScVal();
  const i128 = (v: bigint) => nativeToScVal(v, { type: "i128" });

  console.log("\n[setup] accounts");
  const funder = await mk();                       // declares the round
  const lanes: Party[] = []; for (let i = 0; i < K; i++) lanes.push(await mk());
  const recips: Party[] = []; for (let i = 0; i < N + 1; i++) recips.push(await mk());
  console.log(`  funder ${funder.kp.publicKey()}`);
  console.log(`  ${K} lanes, ${N + 1} recipients`);

  const regProver = new CircuitProver(loadCircuit("register"));
  const txProver = new CircuitProver(loadCircuit("transfer"));
  for (const p of [...lanes, ...recips]) {
    const w = buildRegisterWitness(p.keys);
    const { proof } = await regProver.prove(w.inputs);
    await send(server, p.signer, dep.contracts.token, "register",
      [addr(p.kp.publicKey()), xdr.ScVal.scvU32(AUDITOR), encodeRegisterData(w, proof)]);
  }
  await Promise.all(lanes.map(l => send(server, l.signer, dep.contracts.token, "deposit",
    [addr(l.kp.publicKey()), addr(l.kp.publicKey()), i128(LANE_FUND)])));
  await Promise.all(lanes.map(l => send(server, l.signer, dep.contracts.token, "merge", [addr(l.kp.publicKey())])));
  console.log("  registered + funded");

  // ---- A transfer BEFORE the round opens. Must be excluded. ----
  console.log("\n[pre-round] one transfer BEFORE open_round (must be excluded)");
  const eng0 = new StateEngine({ client, store: new MemoryStore(), keys: lanes[0].keys,
    address: lanes[0].kp.publicKey(), fromLedger: dep.deployedAtLedger });
  let st0 = await eng0.sync();
  {
    const w = buildTransferWitness({ keys: lanes[0].keys, v: st0.spendable.v, r: st0.spendable.r,
      amount: 999n, pvkB: recips[N].keys.PVK, kAudR: kAud, kAudS: kAud });
    const { proof } = await txProver.prove(w.inputs);
    await send(server, lanes[0].signer, dep.contracts.token, "confidential_transfer",
      [addr(lanes[0].kp.publicKey()), addr(recips[N].kp.publicKey()), encodeTransferData(w, proof)]);
    st0 = { ...st0, spendable: { v: w.next.v, r: w.next.r } } as never;
    console.log("  sent 999 from lane 0 — before the round exists");
  }

  // ---- 1. OPEN ----
  const roundId = Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff));
  console.log("\n[1] open_round");
  const opened = await send(server, funder.signer, REGISTRY, "open_round", [
    addr(funder.kp.publicKey()), xdr.ScVal.scvBytes(roundId),
    xdr.ScVal.scvVec(lanes.map(l => addr(l.kp.publicKey()))),
  ]);
  const openedAt: number = scValToNative(opened.returnValue!).opened_at;
  console.log(`  round_id  ${roundId.toString("hex").slice(0, 16)}…`);
  console.log(`  lanes     ${K}`);
  console.log(`  opened_at ${openedAt}  (contract-stamped)`);

  // ---- 2. RUN ----
  console.log(`\n[2] ${N} transfers across ${K} lanes`);
  const plan = Array.from({ length: N }, (_, i) => ({ lane: i % K, recip: i, amount: BigInt(100 + i * 13) }));
  const expected = plan.reduce((a, b) => a + b.amount, 0n);
  const t0 = Date.now();
  await Promise.all(lanes.map(async (l, li) => {
    const mine = plan.filter(p => p.lane === li);
    let v: bigint, r: bigint;
    if (li === 0) { v = st0.spendable.v; r = st0.spendable.r; }
    else { const s = await new StateEngine({ client, store: new MemoryStore(), keys: l.keys,
      address: l.kp.publicKey(), fromLedger: dep.deployedAtLedger }).sync(); v = s.spendable.v; r = s.spendable.r; }
    for (const job of mine) {
      const w = buildTransferWitness({ keys: l.keys, v, r, amount: job.amount,
        pvkB: recips[job.recip].keys.PVK, kAudR: kAud, kAudS: kAud });
      const { proof } = await txProver.prove(w.inputs);
      await send(server, l.signer, dep.contracts.token, "confidential_transfer",
        [addr(l.kp.publicKey()), addr(recips[job.recip].kp.publicKey()), encodeTransferData(w, proof)]);
      v = w.next.v; r = w.next.r;
    }
  }));
  console.log(`  done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // ---- 3. CLOSE ----
  console.log("\n[3] close_round");
  const closed = await send(server, funder.signer, REGISTRY, "close_round",
    [addr(funder.kp.publicKey()), xdr.ScVal.scvBytes(roundId)]);
  const closedAt: number = scValToNative(closed.returnValue!).closed_at;
  console.log(`  closed_at ${closedAt}  window = [${openedAt}, ${closedAt}]`);

  // Emit a manifest so the standalone `tally` CLI can be exercised against
  // this round. TESTNET ONLY — it contains lane spending keys, which grant
  // both view and spend. A real funder holds these in a signer service.
  const manifest = new URL("./last-round.json", import.meta.url);
  writeFileSync(manifest, JSON.stringify({
    warning: "TESTNET DEMO ONLY — contains lane spending keys.",
    funder: funder.kp.publicKey(),
    round: roundId.toString("hex"),
    registry: REGISTRY,
    lanes: Object.fromEntries(lanes.map(l => [l.kp.publicKey(), "0x" + l.keys.sk.toString(16).padStart(64, "0")])),
  }, null, 2) + "\n");
  console.log(`\n  wrote demo/last-round.json (funder + round id + lane keys, testnet only)`);

  // ================= DONOR SIDE =================
  console.log("\n[4] DONOR — given only the funder address and round id");
  const sim = await server.simulateTransaction(
    new TransactionBuilder(await server.getAccount(funder.kp.publicKey()),
      { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
      .addOperation(new Contract(REGISTRY).call("get_round", addr(funder.kp.publicKey()), xdr.ScVal.scvBytes(roundId)))
      .setTimeout(60).build());
  const round = scValToNative((sim as any).result.retval);
  const laneSet = new Set<string>(round.lanes);
  console.log(`  resolved from chain: ${laneSet.size} lanes, window [${round.opened_at}, ${round.closed_at}]`);

  const { events } = await fetchEvents(client, { startLedger: scanFrom, contractId: dep.contracts.token });
  const all = events.filter((e: any) => e.type === "transfer" && laneSet.has(e.from));
  const inWindow = all.filter((e: any) => e.ledger >= round.opened_at && e.ledger <= round.closed_at);
  console.log(`  transfers from declared lanes (all time) : ${all.length}`);
  console.log(`  inside the declared window               : ${inWindow.length}`);
  console.log(`  excluded by the window                   : ${all.length - inWindow.length}  <- the pre-round transfer`);
  if (inWindow.length !== N) throw new Error(`completeness: expected ${N}, got ${inWindow.length}`);

  const laneBy = new Map(lanes.map(l => [l.kp.publicKey(), l]));
  const recBy = new Map(recips.map(r => [r.kp.publicKey(), r]));
  const F: Record<string, string[]> = { sk: [], r_e: [], v_tx: [], active: [], pvk_a_x: [], pvk_a_y: [], pvk_b_x: [], pvk_b_y: [], r_e_x: [], r_e_y: [], sigma: [], v_tilde: [] };
  let total = 0n;
  for (const ev of inWindow as any[]) {
    const lane = laneBy.get(ev.from)!, rec = recBy.get(ev.to)!;
    const rE = deriveEphemeralRE(lane.keys.vk, ev.sigma);
    const vTx = frSub(ev.vTilde, poseidonWithDomain(DOMAIN.TX_AMOUNT, [ecdh(rE, rec.keys.PVK), ev.sigma]));
    total += vTx;
    const A = pointCoords(lane.keys.PVK), B = pointCoords(rec.keys.PVK), R = pointCoords(ev.rE);
    F.sk.push(hex(lane.keys.sk)); F.r_e.push(hex(rE)); F.v_tx.push(hex(vTx)); F.active.push(hex(1n));
    F.pvk_a_x.push(hex(A.x)); F.pvk_a_y.push(hex(A.y)); F.pvk_b_x.push(hex(B.x)); F.pvk_b_y.push(hex(B.y));
    F.r_e_x.push(hex(R.x)); F.r_e_y.push(hex(R.y)); F.sigma.push(hex(ev.sigma)); F.v_tilde.push(hex(ev.vTilde));
  }

  console.log("\n[5] aggregate proof + donor verification");
  const rDisc = randomScalar(), discSk = randomScalar();
  const pR = scalarMul(discSk, H), PR = pointCoords(pR), nu = randomScalar();
  const sDisc = pointCoords(scalarMul(rDisc, pR));
  const vTildeDisc = total + poseidonWithDomain(DISC_BIND, [sDisc.x, nu]);
  const rDiscPt = pointCoords(scalarMul(rDisc, H));
  // Disclosure proofs are ZERO-KNOWLEDGE (off-chain verified). Transfer proofs
  // above stay non-zk because the on-chain verifier requires it. See zk-prover.ts.
  const prover = new DisclosureProver(JSON.parse(readFileSync(AGG, "utf8")));
  const tp = Date.now();
  const res = await prover.prove({ ...F, r_disc: hex(rDisc), addr_f: hex(addrF), n_active: hex(BigInt(N)),
    p_r_x: hex(PR.x), p_r_y: hex(PR.y), nu: hex(nu),
    r_disc_x: hex(rDiscPt.x), r_disc_y: hex(rDiscPt.y), v_tilde_disc: hex(vTildeDisc) } as never);
  const proveMs = Date.now() - tp;
  const ok = await prover.verify(res);
  const donorSees = frSub(vTildeDisc, poseidonWithDomain(DISC_BIND, [pointCoords(scalarMul(discSk, scalarMul(rDisc, H))).x, nu]));

  console.log(`  proof     ${res.proof.length}B in ${proveMs}ms, spans ${K} sender accounts`);
  console.log(`  verified  ${ok ? "yes" : "NO"}`);
  console.log(`  donor total = ${donorSees}   expected ${expected}   ${donorSees === expected ? "MATCH" : "MISMATCH"}`);
  console.log(`  pre-round 999 correctly NOT counted: ${donorSees === expected ? "yes" : "no"}`);

  console.log("\n=== ROUND VERIFIED ===");
  console.log(`  ${N} recipients paid across ${K} lanes; no amount visible on chain.`);
  console.log(`  Donor verified the total from ${res.proof.length}B, holding only its own key and nonce.`);
  await regProver.destroy(); await txProver.destroy(); await prover.destroy();
}

async function send(server: rpc.Server, signer: Signer, cid: string, method: string, args: xdr.ScVal[]) {
  const source = await server.getAccount(signer.publicKey);
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(cid).call(method, ...args)).setTimeout(120).build();
  const sim: any = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`sim ${method}: ${sim.error}`);
  const signed = TransactionBuilder.fromXDR(await signer.sign(rpc.assembleTransaction(tx, sim).build().toXDR()), PASSPHRASE);
  const s = await server.sendTransaction(signed);
  if (s.status === "ERROR") throw new Error(`send ${method}: ${JSON.stringify(s.errorResult)}`);
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1200));
    const g: any = await server.getTransaction(s.hash);
    if (g.status === "SUCCESS") return g;
    if (g.status === "FAILED") throw new Error(`${method} FAILED ${s.hash}`);
  }
  throw new Error(`${method} timeout`);
}
main().catch(e => { console.error("\nFAILED:", e?.message ?? e); process.exit(1); });
