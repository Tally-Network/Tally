/**
 * Copies what the /verify page loads into public/verify-data, from the same
 * commit the site is built from:
 *   - the published round (evidence/latest.json and its directory),
 *   - the deployment (contract ids and RPC),
 *   - the aggregate circuits and their pinned verification keys.
 * The page reads the round and its transfers from Soroban RPC itself; these
 * files only say which round to check and with what.
 */
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const SITE = new URL("../", import.meta.url).pathname;
const ROOT = join(SITE, "..");
const OUT = join(SITE, "public/verify-data");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "circuits"), { recursive: true });
const latest = JSON.parse(readFileSync(join(ROOT, "evidence/latest.json"), "utf8"));
cpSync(join(ROOT, "evidence/latest.json"), join(OUT, "latest.json"));
for (const f of ["round.json", "challenge.json", "bundle.json"]) {
  mkdirSync(join(OUT, latest.dir), { recursive: true });
  cpSync(join(ROOT, "evidence", latest.dir, f), join(OUT, latest.dir, f));
}
cpSync(join(ROOT, "demo/deployment.testnet.json"), join(OUT, "deployment.json"));
for (const n of [8, 16, 64]) {
  cpSync(join(ROOT, `circuits/aggregate_n${n}/circuit.json`), join(OUT, `circuits/aggregate_n${n}.json`));
  cpSync(join(ROOT, `circuits/aggregate_n${n}/vk.zk.bin`), join(OUT, `circuits/aggregate_n${n}.vk.zk.bin`));
}
console.log(`copy-verify-data: ${latest.dir}, deployment, 3 circuits and pinned keys → public/verify-data`);
