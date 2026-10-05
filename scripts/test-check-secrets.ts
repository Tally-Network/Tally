/**
 * Negative tests for check-secrets: each planted secret, alone in a throwaway
 * git repository, must make the guard exit non-zero; a clean repository must
 * pass. Fixtures are generated at runtime so no secret is ever committed.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";

const guard = new URL("./check-secrets.ts", import.meta.url).pathname;
const tsx = new URL("../node_modules/.bin/tsx", import.meta.url).pathname;
const pem = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
const cases: Array<[string, string, boolean]> = [
  ["clean file passes", `{"keyXHex": "0x${randomBytes(32).toString("hex")}"}`, true],
  ["Stellar seed is caught", `const s = "${Keypair.random().secret()}";`, false],
  ["named hex secret is caught", `{"secretHex": "0x${randomBytes(32).toString("hex")}"}`, false],
  ["PEM private key is caught", `${pem}\nabc\n`, false],
];

let failed = 0;
for (const [name, body, shouldPass] of cases) {
  const dir = mkdtempSync(join(tmpdir(), "tally-secrets-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    writeFileSync(join(dir, "f.txt"), body);
    execFileSync("git", ["add", "f.txt"], { cwd: dir });
    const r = spawnSync(tsx, [guard], { cwd: dir, encoding: "utf8" });
    const passed = r.status === 0;
    const ok = passed === shouldPass;
    console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
    if (!ok) failed++;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
process.exit(failed ? 1 : 0);
