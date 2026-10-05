/**
 * Writes circuits/aggregate_n*\/vk.zk.bin: the zero-knowledge verification key
 * of each compiled aggregate circuit. `tally verify` refuses to verify when the
 * locally derived key differs from this pinned file, so a change to the circuit
 * or the toolchain shows up as a reviewable diff here.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { UltraHonkBackend } from "@aztec/bb.js";

const dir = new URL("..", import.meta.url).pathname;
for (const d of readdirSync(dir).filter((n) => /^aggregate_n\d+$/.test(n)).sort()) {
  const circuit = JSON.parse(readFileSync(`${dir}${d}/circuit.json`, "utf8"));
  const backend = new UltraHonkBackend(circuit.bytecode);
  const vk = await backend.getVerificationKey({ keccakZK: true });
  writeFileSync(`${dir}${d}/vk.zk.bin`, vk);
  console.log(`pinned ${d}/vk.zk.bin (${vk.length} B)`);
  await backend.destroy();
}
