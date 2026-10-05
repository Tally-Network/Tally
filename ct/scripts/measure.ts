/**
 * `pnpm measure` — re-measures Tally's on-chain costs on Stellar testnet
 * against the deployment in demo/deployment.testnet.json, and writes
 * ct/measurements.testnet.json.
 *
 *   1. register                    (one account)
 *   2. confidential_transfer       (one transfer)
 *   3. batching: k transfers from one sender inside ONE transaction, through
 *      the measurement-only bench-batch contract, for k = 1, 2, … until the
 *      simulation is rejected; the largest k that fits is then submitted.
 *   4. on-chain verification cost of the aggregate disclosure circuits
 *      (n = 8, 16, 64), on a SEPARATE measurement-only verifier so the demo
 *      deployment is untouched. Tally verifies aggregates off-chain; this is
 *      a capacity figure only, using non-zk proofs because the on-chain
 *      verifier implements only the non-zk flavour.
 *
 * Method: every figure is from `simulateTransaction` (the resources the RPC
 * reports in SorobanTransactionData plus minResourceFee); the transaction size
 * is that of the assembled envelope. Limits are read live from the network.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import {
  Address, BASE_FEE, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal, rpc, xdr,
} from "@stellar/stellar-sdk";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir, type CompiledCircuit } from "@noir-lang/noir_js";

import { ChainClient, keypairSigner } from "../sdk/src/chain/client.js";
import { deriveKeys, type KeyPair } from "../sdk/src/crypto/keys.js";
import { addressToField } from "../sdk/src/crypto/address.js";
import { randomScalar } from "../sdk/src/crypto/field.js";
import { H, pointCoords, scalarMul } from "../sdk/src/crypto/grumpkin.js";
import { poseidonWithDomain } from "../sdk/src/crypto/poseidon2.js";
import { buildRegisterWitness } from "../sdk/src/witness/register.js";
import { buildTransferWitness } from "../sdk/src/witness/transfer.js";
import { CircuitProver } from "../sdk/src/proving/prover.js";
import { loadCircuit } from "../sdk/src/proving/artifacts.js";
import { encodeRegisterData, encodeTransferData } from "../sdk/src/chain/payload.js";
import { syntheticAggregate } from "./synthetic.js";

const ROOT = new URL("../..", import.meta.url).pathname;
const dep = JSON.parse(readFileSync(`${ROOT}demo/deployment.testnet.json`, "utf8"));
const RPC = process.env.TALLY_RPC ?? dep.rpcUrl;
const PASS = Networks.TESTNET;
const server = new rpc.Server(RPC);
const client = new ChainClient({ rpcUrl: RPC, networkPassphrase: PASS,
  contracts: { token: dep.contracts.token, verifier: dep.contracts.verifier, auditor: dep.contracts.auditor } });
const addrF = addressToField(dep.contracts.token);
const hex = (x: bigint) => "0x" + x.toString(16).padStart(64, "0");
const addr = (a: string) => new Address(a).toScVal();

interface Party { kp: Keypair; keys: KeyPair }
interface Measured {
  ok: boolean; error?: string; instructions?: number; diskReadBytes?: number; writeBytes?: number;
  readOnlyEntries?: number; readWriteEntries?: number; minResourceFee?: string; txSizeBytes?: number;
}

async function fund(pub: string) {
  const r = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(pub)}`);
  if (!r.ok && r.status !== 400) throw new Error(`friendbot ${r.status}`);
}
async function party(): Promise<Party> {
  const kp = Keypair.random(); await fund(kp.publicKey());
  return { kp, keys: deriveKeys(randomScalar(), addrF) };
}

async function build(src: Keypair, cid: string, method: string, args: xdr.ScVal[]) {
  const acct = await server.getAccount(src.publicKey());
  return new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: PASS })
    .addOperation(new Contract(cid).call(method, ...args)).setTimeout(180).build();
}

async function measure(src: Keypair, cid: string, method: string, args: xdr.ScVal[]) {
  const tx = await build(src, cid, method, args);
  const sim: any = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) return { m: { ok: false, error: String(sim.error).split("\n")[0] } as Measured, tx, sim };
  const data = sim.transactionData.build();
  const res = data.resources();
  const assembled = rpc.assembleTransaction(tx, sim).build();
  const m: Measured = {
    ok: true,
    instructions: res.instructions(),
    diskReadBytes: res.diskReadBytes(),
    writeBytes: res.writeBytes(),
    readOnlyEntries: res.footprint().readOnly().length,
    readWriteEntries: res.footprint().readWrite().length,
    minResourceFee: String(sim.minResourceFee),
    txSizeBytes: assembled.toEnvelope().toXDR().length,
  };
  return { m, tx, sim };
}

async function submit(src: Keypair, cid: string, method: string, args: xdr.ScVal[]): Promise<string> {
  const { m, tx, sim } = await measure(src, cid, method, args);
  if (!m.ok) throw new Error(`${method}: ${m.error}`);
  const signer = keypairSigner(src.secret(), PASS);
  const signed = TransactionBuilder.fromXDR(await signer.sign(rpc.assembleTransaction(tx, sim).build().toXDR()), PASS);
  const s = await server.sendTransaction(signed);
  if (s.status === "ERROR") throw new Error(`send ${method}: ${JSON.stringify(s.errorResult)}`);
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1200));
    const g: any = await server.getTransaction(s.hash);
    if (g.status === "SUCCESS") return s.hash;
    if (g.status === "FAILED") throw new Error(`${method} FAILED ${s.hash}`);
  }
  throw new Error(`${method} timeout`);
}

function stellar(args: string[]) {
  return execFileSync("stellar", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

async function limits() {
  const out = stellar(["network", "settings", "--network", "testnet", "--output", "json"]);
  const all = JSON.parse(out);
  const find = (key: string) => {
    const s = JSON.stringify(all); const m = s.match(new RegExp(`"${key}"\\s*:\\s*"?(\\d+)`));
    return m ? Number(m[1]) : undefined;
  };
  return {
    txMaxInstructions: find("tx_max_instructions"),
    txMaxSizeBytes: find("tx_max_size_bytes"),
    txMaxDiskReadEntries: find("tx_max_disk_read_entries"),
    txMaxWriteLedgerEntries: find("tx_max_write_ledger_entries"),
    txMaxWriteBytes: find("tx_max_write_bytes"),
    txMemoryLimit: find("tx_memory_limit"),
  };
}

async function main() {
  const out: Record<string, unknown> = {
    network: "testnet", rpc: RPC, measuredAt: new Date().toISOString(),
    latestLedger: (await server.getLatestLedger()).sequence,
    protocolVersion: (await server.getLatestLedger()).protocolVersion,
    deployment: { token: dep.contracts.token, verifier: dep.contracts.verifier, openZeppelin: dep.openZeppelin },
    limits: await limits(),
  };
  console.log("limits", out.limits);

  const reg = new CircuitProver(loadCircuit("register"));
  const txp = new CircuitProver(loadCircuit("transfer"));
  const kAud = await client.auditorKey(0);

  // ---- 1. register ----
  const sender = await party();
  const MAX_K = 8;
  const recips: Party[] = [];
  for (let i = 0; i < MAX_K; i++) recips.push(await party());
  let registerM: Measured | undefined;
  for (const p of [sender, ...recips]) {
    const w = buildRegisterWitness(p.keys, p.kp.publicKey());
    const { proof } = await reg.prove(w.inputs);
    const args = [addr(p.kp.publicKey()), xdr.ScVal.scvU32(0), encodeRegisterData(w, proof)];
    if (!registerM) registerM = (await measure(p.kp, dep.contracts.token, "register", args)).m;
    await submit(p.kp, dep.contracts.token, "register", args);
  }
  out.register = registerM;
  console.log("register", registerM);

  const FUND = 1_000_000n;
  await submit(sender.kp, dep.contracts.token, "deposit",
    [addr(sender.kp.publicKey()), addr(sender.kp.publicKey()), nativeToScVal(FUND, { type: "i128" })]);
  await submit(sender.kp, dep.contracts.token, "merge", [addr(sender.kp.publicKey())]);

  // ---- 2. one confidential_transfer ----
  let v = FUND, r = 0n;   // a deposit commits a·G with zero blinding, merged into spendable
  const chain = async (k: number) => {
    const datas: xdr.ScVal[] = []; let cv = v, cr = r;
    for (let i = 0; i < k; i++) {
      const w = buildTransferWitness({ keys: sender.keys, v: cv, r: cr, amount: 100n + BigInt(i),
        pvkB: recips[i]!.keys.PVK, kAudR: kAud, kAudS: kAud });
      const { proof } = await txp.prove(w.inputs);
      datas.push(encodeTransferData(w, proof)); cv = w.next.v; cr = w.next.r;
    }
    return { datas, next: { v: cv, r: cr } };
  };
  {
    const { datas } = await chain(1);
    const single = await measure(sender.kp, dep.contracts.token, "confidential_transfer",
      [addr(sender.kp.publicKey()), addr(recips[0]!.kp.publicKey()), datas[0]!]);
    out.confidentialTransfer = single.m;
    console.log("confidential_transfer", single.m);
  }

  // ---- 3. batching through bench-batch ----
  const batchWasm = `${ROOT}ct/contracts/target/wasm32v1-none/release/bench_batch_contract.wasm`;
  const batch = stellar(["contract", "deploy", "--wasm", batchWasm, "--source", "tally-deployer", "--network", "testnet"])
    .split(/\s+/).filter(Boolean).pop()!;
  const batchRows: Array<{ k: number } & Measured> = [];
  let largest = 0;
  for (let k = 1; k <= MAX_K; k++) {
    const { datas } = await chain(k);
    const args = [addr(dep.contracts.token), addr(sender.kp.publicKey()),
      xdr.ScVal.scvVec(recips.slice(0, k).map((p) => addr(p.kp.publicKey()))), xdr.ScVal.scvVec(datas)];
    const { m } = await measure(sender.kp, batch, "transfer_many", args);
    const lim = out.limits as { txMaxInstructions: number; txMaxSizeBytes: number };
    const withinSize = m.ok && m.txSizeBytes! <= lim.txMaxSizeBytes;
    batchRows.push({ k, ...m, withinSizeLimit: withinSize } as never);
    console.log(`batch k=${k}`, m, `withinSizeLimit=${withinSize}`);
    if (!m.ok || !withinSize) break;
    largest = k;
  }
  let batchTx: string | undefined;
  if (largest > 0) {
    const { datas } = await chain(largest);
    batchTx = await submit(sender.kp, batch, "transfer_many", [addr(dep.contracts.token), addr(sender.kp.publicKey()),
      xdr.ScVal.scvVec(recips.slice(0, largest).map((p) => addr(p.kp.publicKey()))), xdr.ScVal.scvVec(datas)]);
    console.log(`submitted ${largest} transfers in one transaction: ${batchTx}`);
  }
  out.batching = { benchContract: batch, rows: batchRows, largestThatFits: largest, submittedTx: batchTx };
  await reg.destroy(); await txp.destroy();

  // ---- 4. aggregate verification capacity (measurement-only verifier) ----
  const deployer = stellar(["keys", "public-key", "tally-deployer"]);
  const benchVerifier = stellar(["contract", "deploy", "--wasm",
    `${ROOT}ct/contracts/target/wasm32v1-none/release/confidential_verifier_contract.wasm`,
    "--source", "tally-deployer", "--network", "testnet", "--", "--admin", deployer, "--manager", deployer])
    .split(/\s+/).filter(Boolean).pop()!;
  const depSigner = keypairSigner(stellar(["keys", "show", "tally-deployer"]), PASS);
  const depKp = Keypair.fromSecret(stellar(["keys", "show", "tally-deployer"]));
  const aggRows: unknown[] = [];
  let registered = false;
  for (const n of [8, 16, 64]) {
    const circuit = JSON.parse(readFileSync(`${ROOT}circuits/aggregate_n${n}/circuit.json`, "utf8")) as CompiledCircuit;
    const inputs = syntheticAggregate(n, kAud, addrF);
    const { witness } = await new Noir(circuit).execute(inputs as never);
    const backend = new UltraHonkBackend(circuit.bytecode);
    const { proof, publicInputs } = await backend.generateProof(witness, { keccak: true });
    let vk = await backend.getVerificationKey({ keccak: true });
    if (vk.length === 1764) vk = vk.slice(0, 1760);
    await backend.destroy();
    await client.invoke(benchVerifier, registered ? "update_verification_key" : "register_verification_key",
      [xdr.ScVal.scvU32(1), xdr.ScVal.scvBytes(Buffer.from(vk)), new Address(deployer).toScVal()], depSigner);
    registered = true;
    const pi = Buffer.concat(publicInputs.map((h) => Buffer.from(h.replace(/^0x/, "").padStart(64, "0"), "hex")));
    const { m, sim } = await measure(depKp, benchVerifier, "verify_proof",
      [xdr.ScVal.scvU32(1), xdr.ScVal.scvBytes(pi), xdr.ScVal.scvBytes(Buffer.from(proof))]);
    const verified = m.ok ? Boolean((sim as any).result?.retval?.b?.()) : false;
    aggRows.push({ n, publicInputs: publicInputs.length, verified, ...m });
    console.log(`aggregate n=${n}`, { verified, ...m });
  }
  out.aggregateOnChainVerification = { benchVerifier, slot: "Withdraw (1), measurement-only verifier", rows: aggRows };

  writeFileSync(`${ROOT}ct/measurements.testnet.json`, JSON.stringify(out, null, 2) + "\n");
  console.log("\nwrote ct/measurements.testnet.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
