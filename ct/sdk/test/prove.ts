/**
 * Local proving check against the OpenZeppelin v0.9.0 circuits compiled into
 * ct/sdk/circuits: build a register and a transfer witness with this SDK,
 * solve each with noir_js (every circuit constraint is checked here), prove
 * with bb.js (keccak transcript, as the on-chain verifier requires) and verify
 * locally. On-chain acceptance is exercised separately by `pnpm demo`.
 */
import { Keypair } from "@stellar/stellar-sdk";

import { deriveKeys } from "../src/crypto/keys.js";
import { addressToField } from "../src/crypto/address.js";
import { randomScalar } from "../src/crypto/field.js";
import { H, scalarMul } from "../src/crypto/grumpkin.js";
import { buildRegisterWitness } from "../src/witness/register.js";
import { buildTransferWitness } from "../src/witness/transfer.js";
import { CircuitProver } from "../src/proving/prover.js";
import { loadCircuit } from "../src/proving/artifacts.js";

// Any well-formed contract strkey works for addr_f in a local check.
const TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

async function main() {
  const addrF = addressToField(TOKEN);
  const alice = deriveKeys(randomScalar(), addrF);
  const bob = deriveKeys(randomScalar(), addrF);
  const kAud = scalarMul(randomScalar(), H);
  let ok = true;

  const reg = new CircuitProver(loadCircuit("register"));
  const t0 = Date.now();
  const rp = await reg.prove(buildRegisterWitness(alice, Keypair.random().publicKey()).inputs);
  const regOk = await reg.verify(rp);
  console.log(`register: proof ${rp.proof.length}B, ${rp.publicInputs.length} public inputs, ${Date.now() - t0}ms, verified=${regOk}`);
  ok &&= regOk && rp.publicInputs.length === 6;
  const t0w = Date.now();
  await reg.prove(buildRegisterWitness(bob, Keypair.random().publicKey()).inputs);
  console.log(`register: warm proof ${Date.now() - t0w}ms`);
  await reg.destroy();

  const tx = new CircuitProver(loadCircuit("transfer"));
  const w = buildTransferWitness({ keys: alice, v: 1000n, r: randomScalar(), amount: 100n, pvkB: bob.PVK, kAudR: kAud, kAudS: kAud });
  const t1 = Date.now();
  const tp = await tx.prove(w.inputs);
  const txOk = await tx.verify(tp);
  console.log(`transfer: proof ${tp.proof.length}B, ${tp.publicInputs.length} public inputs, ${Date.now() - t1}ms, verified=${txOk}`);
  ok &&= txOk && tp.publicInputs.length === 25;
  const t1w = Date.now();
  await tx.prove(buildTransferWitness({ keys: alice, v: 900n, r: w.next.r, amount: 50n, pvkB: bob.PVK, kAudR: kAud, kAudS: kAud }).inputs);
  console.log(`transfer: warm proof ${Date.now() - t1w}ms`);
  await tx.destroy();

  console.log(ok ? "prove: OK" : "prove: FAILED");
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
