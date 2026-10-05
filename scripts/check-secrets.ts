/**
 * `pnpm check:secrets` — fails (exit 1) if a secret is present in any tracked
 * file. Runs in CI on every push and pull request.
 *
 * Detects:
 *   - Stellar secret seeds (S… strkeys that decode as ed25519 seeds)
 *   - PEM private-key blocks
 *   - a 32-byte-or-longer hex value assigned to a secret-looking name
 *     (secret*, *secretHex, private*, *_sk, sk, seed, mnemonic)
 *   - the retired demo auditor key exposed in commit 83f3f8c, matched by
 *     SHA-256 so this file does not itself contain it
 *
 * Deliberate exceptions live in .secret-allowlist as `<path-glob> <reason>`.
 * An allowlisted file is still scanned for the retired key and for seeds.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { StrKey } from "@stellar/stellar-sdk";

const RETIRED_SHA256 = new Set([
  // demo auditor secret from demo/deployment.testnet.json @ 83f3f8c — retired
  "2038a1462bb366e2e2f04d80d5ffc8260ed94e364f2d5b319383461e7ae03e90",
]);

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean)
  .filter((f) => !f.startsWith("vendor/") && !/\.(wasm|bin|png|jpg|ico|woff2?)$/.test(f) && f !== "pnpm-lock.yaml");

const allowText = (() => { try { return readFileSync(".secret-allowlist", "utf8"); } catch { return ""; } })();
const allow = allowText.split("\n")
  .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  .map((l) => { const [glob, ...why] = l.split(/\s+/); if (!why.length) throw new Error(`allowlist entry needs a reason: ${l}`); return glob!; });
const globRe = (g: string) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "§").replace(/\*/g, "[^/]*").replace(/§/g, ".*") + "$");
const allowed = (f: string) => allow.some((g) => globRe(g).test(f));

const SEED = /\bS[A-Z2-7]{55}\b/g;
const PEM = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const NAMED = /["']?([A-Za-z_]*(secret|private)[A-Za-z_]*|[a-z]+_sk|sk|seed|mnemonic)["']?\s*[:=]\s*["']?(0x)?([0-9a-fA-F]{64,})/gi;
const HEX64 = /\b(?:0x)?([0-9a-fA-F]{64})\b/g;

const findings: string[] = [];
for (const f of files) {
  let text: string;
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const at = `${f}:${i + 1}`;
    for (const m of line.matchAll(SEED)) if (StrKey.isValidEd25519SecretSeed(m[0])) findings.push(`${at}  Stellar secret seed`);
    if (PEM.test(line)) findings.push(`${at}  PEM private key`);
    for (const m of line.matchAll(HEX64)) {
      if (RETIRED_SHA256.has(createHash("sha256").update(Buffer.from(m[1]!, "hex")).digest("hex"))) {
        findings.push(`${at}  RETIRED auditor key (exposed in 83f3f8c)`);
      }
    }
    if (!allowed(f)) for (const m of line.matchAll(NAMED)) findings.push(`${at}  hex value assigned to "${m[1]}"`);
  });
}

if (findings.length) {
  console.error(`\n  check:secrets — ${findings.length} finding(s):\n`);
  for (const x of findings) console.error(`    ${x}`);
  console.error(`\n  Move the secret out of the repository, or, if it is deliberately public,\n  add the file to .secret-allowlist with a reason.\n`);
  process.exit(1);
}
console.log(`check:secrets — ${files.length} tracked files clean (${allow.length} allowlisted path patterns)`);
