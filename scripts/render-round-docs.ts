/**
 * Rewrites the round-specific blocks of evidence/README.md and demo/README.md
 * (between `<!-- round:NAME -->` and `<!-- /round:NAME -->`) from the
 * published round: evidence/latest.json, its round.json and run.json.
 *
 *   pnpm round-docs           rewrite the blocks
 *   pnpm round-docs --check   exit 1 if any block is out of date (CI)
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { verifyOutput, expiredExample, tamperCommands, demoSummary, type PublishedRound } from "./round-docs.ts";

const root = new URL("..", import.meta.url).pathname;
const json = (p: string) => JSON.parse(readFileSync(root + p, "utf8"));

export function loadPublishedRound(): PublishedRound {
  const latest = json("evidence/latest.json");
  const round = json(`evidence/${latest.dir}/round.json`);
  const run = json(`evidence/${latest.dir}/run.json`);
  const cap = [8, 16, 64].find(c => run.inWindow <= c)!;
  return {
    dir: latest.dir, published: latest.published, funder: round.funder, round_id: round.round_id,
    verifiable_until_ledger: round.verifiable_until_ledger, run,
    vkBytes: statSync(`${root}circuits/aggregate_n${cap}/vk.zk.bin`).size,
  };
}

const fence = (body: string, lang = "") => "```" + lang + "\n" + body + "\n```";
const short = (id: string) => `${id.slice(0, 8)}…${id.slice(-4)}`;

function evidenceBlocks(r: PublishedRound, dep: any): Record<string, string> {
  const x = r.run;
  return {
    "verify-output": fence(verifyOutput(r)),
    expiry: `**The current round (\`${r.dir}\`, published ${r.published} by \`pnpm evidence:refresh\`) is verifiable until ledger ${r.verifiable_until_ledger} — about seven days later.** A scheduled job publishes the next round before then. The exact figure is in [\`latest.json\`](latest.json) and the round's own \`round.json\`.`,
    "expired-example": fence(expiredExample(r)),
    tamper: fence(tamperCommands(r), "bash"),
    current: [
      `| | |`,
      `|:---|:---|`,
      `| Network | Stellar testnet |`,
      `| Funder | \`${r.funder}\` |`,
      `| Round id | \`${r.round_id}\` |`,
      `| Registry | [\`${short(dep.contracts.registry)}\`](https://stellar.expert/explorer/testnet/contract/${dep.contracts.registry}) |`,
      `| Token | [\`${short(dep.contracts.token)}\`](https://stellar.expert/explorer/testnet/contract/${dep.contracts.token}) (OpenZeppelin v0.9.0) |`,
      `| Window | ledgers ${x.openedAt} – ${x.closedAt} |`,
      `| Transfers | ${x.inWindow}, across ${x.lanes} lanes |`,
      `| Total | ${x.donorTotal} stroops — **real people are not involved; see the note below** |`,
    ].join("\n"),
  };
}

function demoBlocks(r: PublishedRound): Record<string, string> {
  return {
    "last-run": `${r.run.date}, OpenZeppelin v0.9.0 deployment, from \`main\` at \`${r.run.commit}\` (\`pnpm evidence:refresh\`, which runs this demo and published \`evidence/${r.dir}\`). The figures are recorded in [\`evidence/${r.dir}/run.json\`](../evidence/${r.dir}/run.json):\n\n` + fence(demoSummary(r)),
  };
}

function render(text: string, blocks: Record<string, string>, file: string): string {
  for (const [name, body] of Object.entries(blocks)) {
    const re = new RegExp(`<!-- round:${name} -->\\n[\\s\\S]*?\\n<!-- /round:${name} -->`);
    if (!re.test(text)) throw new Error(`${file} has no <!-- round:${name} --> block`);
    text = text.replace(re, () => `<!-- round:${name} -->\n${body}\n<!-- /round:${name} -->`);
  }
  return text;
}

const isEntry = import.meta.url === new URL(process.argv[1], "file://").href || process.argv[1]?.endsWith("render-round-docs.ts");
if (isEntry) {
  const check = process.argv.includes("--check");
  const r = loadPublishedRound();
  const dep = json("demo/deployment.testnet.json");
  let stale = 0;
  for (const [file, blocks] of [["evidence/README.md", evidenceBlocks(r, dep)], ["demo/README.md", demoBlocks(r)]] as const) {
    const before = readFileSync(root + file, "utf8");
    const after = render(before, blocks, file);
    if (before === after) continue;
    if (check) { console.error(`round-docs: ${file} is out of date for ${r.dir}; run \`pnpm round-docs\``); stale++; }
    else { writeFileSync(root + file, after); console.log(`round-docs: rewrote ${file} for ${r.dir}`); }
  }
  if (stale) process.exit(1);
  if (check) console.log(`round-docs: evidence/README.md and demo/README.md match ${r.dir}`);
}
