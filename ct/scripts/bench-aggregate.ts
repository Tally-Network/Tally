/**
 * `pnpm bench:aggregate` — zero-knowledge prove / verify time and proof size for
 * each committed aggregate circuit (circuits/aggregate_n*\/circuit.json), on
 * synthetic but fully valid witnesses spanning 5 sender accounts. Local only.
 */
import { readFileSync } from "node:fs";
import { Noir, type CompiledCircuit } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
import { addressToField } from "../sdk/src/crypto/address.js";
import { randomScalar } from "../sdk/src/crypto/field.js";
import { H, scalarMul } from "../sdk/src/crypto/grumpkin.js";
import { syntheticAggregate } from "./synthetic.js";

const ROOT = new URL("../..", import.meta.url).pathname;
const addrF = addressToField("CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC");
const kAud = scalarMul(randomScalar(), H);
for (const n of [8, 16, 64]) {
  const circuit = JSON.parse(readFileSync(`${ROOT}circuits/aggregate_n${n}/circuit.json`, "utf8")) as CompiledCircuit;
  const backend = new UltraHonkBackend(circuit.bytecode);
  const noir = new Noir(circuit);
  const run = async () => {
    const { witness } = await noir.execute(syntheticAggregate(n, kAud, addrF) as never);
    const t0 = Date.now(); const p = await backend.generateProof(witness, { keccakZK: true }); const prove = Date.now() - t0;
    const t1 = Date.now(); const ok = await backend.verifyProof(p, { keccakZK: true }); const verify = Date.now() - t1;
    return { prove, verify, ok, size: p.proof.length, pis: p.publicInputs.length };
  };
  await run();                       // warm-up
  const r = await run();
  console.log(`n=${n}  prove ${r.prove} ms  verify ${r.verify} ms  proof ${r.size} B  public inputs ${r.pis}  verified=${r.ok}`);
  await backend.destroy();
}
