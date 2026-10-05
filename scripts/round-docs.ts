/**
 * One source for every round-specific text block: the expected output of
 * `pnpm verify:evidence` and `pnpm demo`, the tampering commands, and the
 * aged-out example. Used by the site (landing page and docs), by
 * scripts/render-round-docs.ts (the READMEs) and by the site's claims check.
 *
 * Plain, erasable TypeScript with no imports, so Node 24 can load it directly.
 */

/** Figures from the `pnpm demo` run that produced a round (evidence/round-NNN/run.json). */
export interface DemoRun {
  openedAt: number; closedAt: number; lanes: number;
  allTime: number; inWindow: number; excluded: number;
  proofBytes: number; proofMs: number; senders: number;
  donorTotal: number; expectedTotal: number;
}

/** What the renderers need to know about the published round. */
export interface PublishedRound {
  dir: string;                    // round-NNN
  published: string;              // YYYY-MM-DD
  funder: string;
  round_id: string;
  verifiable_until_ledger: number;
  run: DemoRun & { date: string; commit: string };
  vkBytes: number;                // size of the pinned vk.zk.bin for the round's circuit
}

// ------------------------------------------------------------------- parse

const num = (re: RegExp, text: string, what: string): number => {
  const m = re.exec(text);
  if (!m) throw new Error(`demo output has no ${what}`);
  return Number(m[1]);
};

/** Parses demo/run-round.ts output. Throws if anything it needs is missing. */
export function parseDemoRun(raw: string): DemoRun {
  const text = raw.replace(/\x1b\[[0-9;]*m/g, "");
  const run: DemoRun = {
    openedAt: num(/opened_at (\d+)/, text, "opened_at"),
    closedAt: num(/closed_at (\d+)/, text, "closed_at"),
    lanes: num(/resolved from chain: (\d+) lanes/, text, "lane count"),
    allTime: num(/transfers from declared lanes \(all time\) : (\d+)/, text, "all-time transfer count"),
    inWindow: num(/inside the declared window\s+: (\d+)/, text, "in-window transfer count"),
    excluded: num(/excluded by the window\s+: (\d+)/, text, "excluded count"),
    proofBytes: num(/proof\s+(\d+)B in \d+ms/, text, "proof size"),
    proofMs: num(/proof\s+\d+B in (\d+)ms/, text, "proof time"),
    senders: num(/spans (\d+) sender accounts/, text, "sender count"),
    donorTotal: num(/donor total = (\d+)/, text, "donor total"),
    expectedTotal: num(/expected (\d+)\s+MATCH/, text, "expected total (or the totals did not match)"),
  };
  if (!/=== ROUND VERIFIED ===/.test(text)) throw new Error("demo output does not end in ROUND VERIFIED");
  return run;
}

// ------------------------------------------------------------------ render

/** `pnpm verify:evidence`, as `tally verify` prints it for this round. */
export function verifyOutput(r: PublishedRound): string {
  const { openedAt: a, closedAt: b, lanes, inWindow, donorTotal } = r.run;
  return [
    `✓ round found: ${lanes} lanes, window [${a}, ${b}]`,
    `✓ ${inWindow} transfers from the declared lanes inside the window`,
    `✓ public inputs reconstructed from chain state only`,
    `✓ verification key matches the pinned artifact (${r.vkBytes} B)`,
    `✓ proof verified (${r.run.proofBytes} B, zero-knowledge)`,
    ``,
    `TOTAL DISBURSED: ${donorTotal}  (stroops of the wrapped asset)`,
    `over ${inWindow} transfers from ${lanes} declared lanes, ledgers ${a}–${b}`,
    `no individual amount was revealed.`,
  ].join("\n");
}

/** The donor part of `pnpm demo`, exactly as the script prints it. */
export function demoDonorOutput(r: PublishedRound): string {
  const x = r.run;
  return [
    `[4] DONOR — given only the funder address and round id`,
    `  resolved from chain: ${x.lanes} lanes, window [${x.openedAt}, ${x.closedAt}]`,
    `  transfers from declared lanes (all time) : ${x.allTime}`,
    `  inside the declared window               : ${x.inWindow}`,
    `  excluded by the window                   : ${x.excluded}  <- the pre-round transfer`,
    ``,
    `[5] aggregate proof + donor verification`,
    `  proof     ${x.proofBytes}B in ${x.proofMs}ms, spans ${x.senders} sender accounts`,
    `  verified  yes`,
    `  donor total = ${x.donorTotal}   expected ${x.expectedTotal}   MATCH`,
    `  pre-round 999 correctly NOT counted: yes`,
    ``,
    `=== ROUND VERIFIED ===`,
  ].join("\n");
}

/** The shorter excerpt shown on the landing page. */
export function demoSummary(r: PublishedRound): string {
  const x = r.run;
  return [
    `resolved from chain: ${x.lanes} lanes, window [${x.openedAt}, ${x.closedAt}]`,
    `transfers from declared lanes (all time) : ${x.allTime}`,
    `inside the declared window               : ${x.inWindow}`,
    `excluded by the window                   : ${x.excluded}  <- the pre-round transfer`,
    `proof     ${x.proofBytes}B in ${x.proofMs}ms, spans ${x.senders} sender accounts`,
    `donor total = ${x.donorTotal}   expected ${x.expectedTotal}   MATCH`,
    `=== ROUND VERIFIED ===`,
  ].join("\n");
}

/** Tampering case 1: the sealed total altered by one. */
export function tamperAlter(r: PublishedRound): string {
  return [
    `python3 -c "import json;b=json.load(open('evidence/${r.dir}/bundle.json'));b['v_tilde_disc']=hex(int(b['v_tilde_disc'],16)+1);json.dump(b,open('/tmp/t.json','w'))"`,
    `npx tsx cli/tally.ts verify --funder ${r.funder} \\`,
    `  --round ${r.round_id} \\`,
    `  --challenge evidence/${r.dir}/challenge.json --bundle /tmp/t.json        # expect PROOF FAILED, exit 2`,
  ].join("\n");
}

/** Tampering case 2: the bundle replayed against a challenge it was not built for. */
export function tamperReplay(r: PublishedRound): string {
  return [
    `npx tsx cli/tally.ts challenge --out /tmp/c2.json`,
    `npx tsx cli/tally.ts verify --funder ${r.funder} \\`,
    `  --round ${r.round_id} \\`,
    `  --challenge /tmp/c2.json --bundle evidence/${r.dir}/bundle.json          # expect PROOF FAILED, exit 2`,
  ].join("\n");
}

/** Both tampering cases from evidence/README.md, for this round. */
export function tamperCommands(r: PublishedRound): string {
  return [
    `# inflate the sealed total by one`, tamperAlter(r), ``,
    `# replay the bundle against a challenge it was not built for`, tamperReplay(r),
  ].join("\n");
}

/** What `tally verify` prints for an aged-out round, using this round's opening ledger. */
export function expiredExample(r: PublishedRound): string {
  const gap = 10349;
  return [
    `✗ this round has aged out of the RPC's event retention window.`,
    ``,
    `    round opened at ledger  ${r.run.openedAt}`,
    `    RPC serves from ledger  ${r.run.openedAt + gap}   (${gap.toLocaleString("en-US")} ledgers ≈ ${((gap * 5) / 86400).toFixed(1)} days too old)`,
    ``,
    `  This is not a proof failure. The proof is untouched and would still verify.`,
  ].join("\n");
}
