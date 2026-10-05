/**
 * Decides whether the published round needs republishing: prints how many
 * ledgers it has left before it ages out of the RPC's event window, and
 * `refresh=true|false` in GitHub Actions output format.
 *
 *   tsx scripts/evidence-margin.ts [--days 2] [--force]
 */
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const json = (p: string) => JSON.parse(readFileSync(root + p, "utf8"));
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const latest = json("evidence/latest.json");
const round = json(`evidence/${latest.dir}/round.json`);
const dep = json("demo/deployment.testnet.json");
const res = await fetch(dep.rpcUrl, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestLedger" }),
});
const ledger = Number((await res.json()).result?.sequence);
if (!ledger) throw new Error("RPC did not return the latest ledger");

const left = round.verifiable_until_ledger - ledger;
const days = (left * 5) / 86400;
const threshold = Number(arg("days", "2"));
const force = process.argv.includes("--force");
const refresh = force || days < threshold;
console.error(`${latest.dir}: verifiable until ledger ${round.verifiable_until_ledger}; RPC is at ${ledger}; ` +
  `${left} ledgers (~${days.toFixed(1)} days) left. ${refresh ? (force ? "Refreshing (forced)." : `Refreshing: under ${threshold} days.`) : "No refresh needed."}`);
console.log(`refresh=${refresh}`);
console.log(`round=${latest.dir}`);
console.log(`days_left=${days.toFixed(1)}`);
