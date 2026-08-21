/**
 * `pnpm verify:evidence` — verify whichever round is currently published.
 *
 * Reads evidence/latest.json rather than hardcoding a round, so refreshing the
 * pack does not require editing package.json, and whatever we link is always
 * the round that is actually inside the retention window.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const latest = JSON.parse(readFileSync(`${root}evidence/latest.json`, "utf8"));
const dir = `evidence/${latest.dir}`;
const meta = JSON.parse(readFileSync(`${root}${dir}/round.json`, "utf8"));

console.log(`\n  verifying ${dir}  (published ${latest.published})`);
const r = spawnSync("npx", ["tsx", "cli/tally.ts", "verify",
  "--funder", meta.funder, "--round", meta.round_id,
  "--challenge", `${dir}/challenge.json`, "--bundle", `${dir}/bundle.json`],
  { cwd: root, stdio: "inherit" });
process.exit(r.status ?? 1);
