/**
 * `pnpm evidence:refresh` — run a fresh round and republish the evidence pack.
 *
 * A published round stops being verifiable once its ledgers leave the RPC's
 * event retention window (~7 days). Rather than let whatever we link quietly
 * rot, this regenerates it in one command. Run it before any submission.
 *
 * Takes several minutes: it runs a real testnet round.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const sh = (cmd: string, args: string[]) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  if (r.status !== 0) { console.error(`\n  failed: ${cmd} ${args.join(" ")}\n`); process.exit(1); }
};
const step = (n: number, m: string) => console.log(`\n\x1b[1m[${n}/4] ${m}\x1b[0m`);

// Next round number, so history is kept rather than overwritten.
const existing = readdirSync(`${root}evidence`).filter(d => /^round-\d+$/.test(d)).sort();
const next = String(existing.length ? Number(existing.at(-1)!.slice(6)) + 1 : 1).padStart(3, "0");
const dir = `evidence/round-${next}`;

step(1, "running a fresh round on testnet (several minutes)");
sh("npx", ["tsx", "demo/run-round.ts"]);

step(2, "donor issues a challenge");
mkdirSync(`${root}${dir}`, { recursive: true });
sh("npx", ["tsx", "cli/tally.ts", "challenge", "--out", `${dir}/challenge.json`]);

const manifest = JSON.parse(readFileSync(`${root}demo/last-round.json`, "utf8"));

step(3, "funder answers it");
sh("npx", ["tsx", "cli/tally.ts", "prove",
  "--funder", manifest.funder, "--round", manifest.round,
  "--keys", "demo/last-round.json",
  "--challenge", `${dir}/challenge.json`, "--out", `${dir}/bundle.json`]);

step(4, "publishing");
// Annotate, and above all do NOT copy lane spending keys into evidence/.
const ch = JSON.parse(readFileSync(`${root}${dir}/challenge.json`, "utf8"));
ch.note = "PUBLISHED DELIBERATELY. secret_r_R is the DONOR's key, not the funder's. Publishing it makes " +
          "everyone the donor for this demonstration round. It reveals nothing about individual amounts " +
          "and nothing about the funder. A real donor keeps r_R private.";
writeFileSync(`${root}${dir}/challenge.json`, JSON.stringify(ch, null, 2) + "\n");

const bu = JSON.parse(readFileSync(`${root}${dir}/bundle.json`, "utf8"));
bu.note = "The funder's answer. `tally verify` reads ONLY proof, r_disc_x, r_disc_y and v_tilde_disc from this file.";
writeFileSync(`${root}${dir}/bundle.json`, JSON.stringify(bu, null, 2) + "\n");

const health = JSON.parse(spawnSync("curl", ["-s", "-X", "POST", "https://soroban-testnet.stellar.org",
  "-H", "Content-Type: application/json",
  "-d", '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'], { encoding: "utf8" }).stdout).result;

writeFileSync(`${root}${dir}/round.json`, JSON.stringify({
  round_id: manifest.round, funder: manifest.funder, registry: manifest.registry,
  network: "Stellar testnet",
  published_at_ledger: Number(health.latestLedger),
  retention_window_ledgers: Number(health.ledgerRetentionWindow),
  verifiable_until_ledger: Number(health.latestLedger) + Number(health.ledgerRetentionWindow),
  note: "Soroban RPC retains a rolling window of events. Past verifiable_until_ledger this round is no " +
        "longer verifiable from RPC alone — `tally verify` detects that and says so rather than reporting " +
        "an empty transfer set. Re-run `pnpm evidence:refresh` to republish.",
}, null, 2) + "\n");

writeFileSync(`${root}evidence/latest.json`, JSON.stringify({
  dir: `round-${next}`, published: new Date().toISOString().slice(0, 10),
}, null, 2) + "\n");

// Guard: the pack must never contain a lane spending key.
const blob = readdirSync(`${root}${dir}`).map(f => readFileSync(`${root}${dir}/${f}`, "utf8")).join("");
const leaked = Object.values(manifest.lanes as Record<string, string>).filter(k => blob.toLowerCase().includes(k.toLowerCase()));
if (leaked.length) { console.error(`\n  ABORT: ${leaked.length} lane spending key(s) leaked into ${dir}\n`); process.exit(1); }

console.log(`\n  published ${dir}`);
console.log(`  verifiable until ledger ${Number(health.latestLedger) + Number(health.ledgerRetentionWindow)}`);
console.log(`  check it with:  pnpm verify:evidence\n`);
