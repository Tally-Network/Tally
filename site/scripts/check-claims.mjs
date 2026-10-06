/**
 * Build gate for the site's statements of fact. Runs before `next build`.
 *
 *  1. content/generated/facts.json must match the repository files it was built
 *     from (deployment, measurements, published round).
 *  2. Every claim in content/claims/*.json must still appear on its page, and
 *     every source file must exist and still contain its quoted string.
 *  3. Contract ids on the site must belong to the deployment or the measurement
 *     contracts.
 *  4. Banned phrasing (adoption, audit, production claims) must not appear.
 *
 * It also writes CLAIMS.md, the readable list of claims and sources.
 * Exit 1 on any failure.
 *
 * The site application lives in a private repository; this repository keeps
 * its content (docs, claims, generated facts). Two modes:
 *   node site/scripts/check-claims.mjs              public: facts, sources,
 *       docs claims and phrasing; landing page text is not available here.
 *   node site/scripts/check-claims.mjs --site DIR   the private build: also
 *       checks every landing claim against the application in DIR. Sources
 *       written as "site/..." resolve inside DIR.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, resolve } from "node:path";

const SITE = new URL("../", import.meta.url).pathname;
const ROOT = join(SITE, "..");
const siteArg = process.argv.indexOf("--site");
const APP = siteArg > 0 ? resolve(process.argv[siteArg + 1]) : null;
let skipped = 0;
const read = (p) => readFileSync(p, "utf8");
const repo = (p) => join(ROOT, p);
const json = (p) => JSON.parse(read(p));
const norm = (s) => s.replace(/\s+/g, " ").trim();

const errors = [];
const fail = (msg) => errors.push(msg);

/* ------------------------------------------------ 1. facts vs repository */

const facts = json(join(SITE, "content/generated/facts.json"));
const dep = json(repo("demo/deployment.testnet.json"));
const meas = json(repo("ct/measurements.testnet.json"));
const proving = json(repo("ct/measurements.proving.json"));
const latest = json(repo("evidence/latest.json"));
const round = json(repo(`evidence/${latest.dir}/round.json`));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const factChecks = [
  ["openZeppelin", facts.openZeppelin, dep.openZeppelin],
  ["contracts", facts.contracts, dep.contracts],
  ["measurements.protocolVersion", facts.measurements.protocolVersion, meas.protocolVersion],
  ["measurements.limits", facts.measurements.limits, meas.limits],
  ["measurements.register", facts.measurements.register, meas.register],
  ["measurements.confidentialTransfer", facts.measurements.confidentialTransfer, meas.confidentialTransfer],
  ["measurements.batching", facts.measurements.batching, meas.batching],
  ["measurements.aggregate", facts.measurements.aggregate, meas.aggregateOnChainVerification],
  ["measurements.proving", facts.measurements.proving, proving],
  ["round.dir", facts.round.dir, latest.dir],
];
for (const k of Object.keys(round)) factChecks.push([`round.${k}`, facts.round[k], round[k]]);
const run = json(repo(`evidence/${latest.dir}/run.json`));
factChecks.push(["round.run", facts.round.run, run]);
const cap = [8, 16, 64].find(c => run.inWindow <= c);
factChecks.push(["round.vkBytes", facts.round.vkBytes, statSync(repo(`circuits/aggregate_n${cap}/vk.zk.bin`)).size]);
if (run.inWindow !== facts.round.chain.transfers.length) fail(`run.json counts ${run.inWindow} transfers in the window; the chain snapshot has ${facts.round.chain.transfers.length}`);
if (run.donorTotal !== run.expectedTotal) fail(`run.json donor total ${run.donorTotal} differs from the expected ${run.expectedTotal}`);

// The READMEs' round blocks are generated; they must match the published round.
{
  const r = spawnSync(process.execPath, [repo("scripts/render-round-docs.ts"), "--check"], { encoding: "utf8" });
  if (r.status !== 0) fail((r.stderr || r.stdout).trim() || "scripts/render-round-docs.ts --check failed");
}
for (const [k, got, want] of factChecks) if (!same(got, want)) fail(`facts.json ${k} differs from the repository; run \`pnpm site:facts\``);
// ct/measurements.proving.json transcribes MEASUREMENTS.md's proving table; the two must agree.
{
  const md = readFileSync(repo("MEASUREMENTS.md"), "utf8");
  const ms = (x) => (x == null ? "—" : `${x.toLocaleString("en-US")} ms`);
  for (const [name, c] of Object.entries(proving.circuits)) {
    const cells = `| ${ms(c.firstMs)} | ${ms(c.warmMs)} | ${c.proofBytes.toLocaleString("en-US")} B |`;
    if (!md.includes(cells)) fail(`MEASUREMENTS.md has no proving row ${cells} for ${name} (ct/measurements.proving.json)`);
  }
  if (!md.includes(proving.machine)) fail(`MEASUREMENTS.md does not name the proving machine "${proving.machine}"`);
}

// The chain snapshot must agree with the published evidence's own summary line.
const ev = read(repo("evidence/README.md"));
const m = /over (\d+) transfers from (\d+) declared lanes, ledgers (\d+)–(\d+)/.exec(ev);
const c = facts.round.chain;
if (!m) fail("evidence/README.md has no 'over N transfers from L declared lanes' line");
else if (+m[1] !== c.transfers.length || +m[2] !== c.lanes || +m[3] !== c.openedAt || +m[4] !== c.closedAt)
  fail(`facts.json chain snapshot (${c.transfers.length} transfers, ${c.lanes} lanes, [${c.openedAt}, ${c.closedAt}]) disagrees with evidence/README.md (${m.slice(1).join(", ")})`);
for (const t of c.transfers) if (!/^[0-9a-f]{64}$/.test(t.vTilde) || !/^[0-9a-f]{64}$/.test(t.txHash)) fail(`malformed transfer in facts.json: ${t.txHash}`);

/* ------------------------------------------------------------ 2. claims */

// Values that change with every published round. A claim that quotes one of them
// would pass today and fail on the next scheduled refresh.
const roundSpecific = [run.openedAt, run.closedAt, facts.round.verifiable_until_ledger, facts.round.funder, latest.dir].map(String);

const checkSources = (where, sources) => {
  for (const s of sources) {
    const quoted = roundSpecific.find(v => (s.contains ?? "").includes(v));
    if (quoted) fail(`${where}: source quote contains "${quoted}", which changes with every round; quote a field name or put the file under evidence/{latest}`);
    // {latest} is the published round's directory, so claims follow each refresh.
    const file = s.file.replace("{latest}", latest.dir);
    // Files under site/ (other than its content) belong to the private application.
    const inApp = file.startsWith("site/") && !file.startsWith("site/content/") && !file.startsWith("site/scripts/");
    if (inApp && !APP) { skipped++; continue; }
    const p = inApp ? join(APP, file.slice("site/".length)) : repo(file);
    if (!existsSync(p)) { fail(`${where}: source ${s.file} does not exist`); continue; }
    if (s.exists) continue;
    if (s.contains && !norm(read(p)).includes(norm(s.contains))) fail(`${where}: ${s.file} no longer contains "${s.contains}"`);
  }
};

const landing = json(join(SITE, "content/claims/landing.json"));
const landingSrc = APP ? norm(landing.siteFiles.map((f) => read(join(APP, f))).join("\n")) : null;
let landingCount = 0;
for (const sec of landing.sections) {
  for (const cl of sec.claims) {
    landingCount++;
    const where = `landing #${sec.id}`;
    if (landingSrc && cl.site !== "TRUST_STATEMENT_VERBATIM" && !landingSrc.includes(norm(cl.site))) fail(`${where}: page text not found: "${cl.site}"`);
    if (cl.fact && cl.fact.split(".").reduce((o, k) => o?.[k], facts) === undefined) fail(`${where}: fact ${cl.fact} missing from facts.json`);
    checkSources(where, cl.sources);
  }
}

const DOCS = join(SITE, "content/docs");
const docs = json(join(SITE, "content/claims/docs.json"));
let docsCount = 0;
for (const g of docs.groups) {
  for (const cl of g.claims) {
    docsCount++;
    const where = `docs ${cl.page}`;
    const p = join(DOCS, cl.page);
    if (!existsSync(p)) { fail(`${where}: page does not exist`); continue; }
    if (cl.site !== "TRUST_STATEMENT_VERBATIM" && !norm(read(p)).includes(norm(cl.site))) fail(`${where}: page text not found: "${cl.site}"`);
    checkSources(where, cl.sources);
  }
}

/* ------------------------------------------------ 3. contract ids, phrasing */

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const docFiles = walk(DOCS).filter((f) => f.endsWith(".mdx"));
const pageFiles = [...docFiles, ...(APP ? landing.siteFiles.map((f) => join(APP, f)) : [])];

const known = new Set([
  ...Object.values(dep.contracts),
  meas.batching?.benchContract,
  meas.aggregateOnChainVerification?.benchVerifier,
].filter(Boolean));
const rel = (f) => (APP && f.startsWith(APP) ? relative(APP, f) : relative(SITE, f));
for (const f of pageFiles) {
  for (const id of read(f).match(/\bC[A-Z2-7]{55}\b/g) ?? []) {
    if (!known.has(id)) fail(`${rel(f)}: contract id ${id} is not in demo/deployment.testnet.json or ct/measurements.testnet.json`);
  }
}

const BANNED = [
  [/production[- ]ready/i, "production claim"],
  [/mainnet[- ]ready|live on mainnet/i, "mainnet claim"],
  [/battle[- ]tested|bank[- ]grade|military[- ]grade|enterprise[- ]grade/i, "unbacked quality claim"],
  [/trusted by|used by (\d|many|teams|projects|companies|leading|thousands)|our (customers|users|partners|clients)/i, "adoption claim"],
  [/in partnership with|partnered with|backed by|endorsed by/i, "partnership claim"],
  [/(?<!")provably disbursed(?! [\d,]+ from the declared lanes)/i, "unscoped guarantee (TRUST-STATEMENT.md rule)"],
  [/fully (compliant|private|anonymous)/i, "absolute claim"],
  [/plaintext amount(s)? (is|are) (stored|visible|published) on[- ]chain/i, "plaintext-on-chain implication"],
];
for (const f of pageFiles) {
  const lines = read(f).split("\n");
  lines.forEach((l, i) => {
    for (const [re, why] of BANNED) if (re.test(l)) fail(`${rel(f)}:${i + 1}: ${why}: "${l.trim().slice(0, 120)}"`);
    // "audited" is allowed only in a negated sentence ("Nothing in Tally has been audited", "unaudited").
    for (const sentence of l.split(/(?<=[.?!])\s+/)) {
      if (/(?<!un)audited\b/i.test(sentence) && !/\b(not|no|nothing|never|neither|nor|without)\b|\?/i.test(sentence))
        fail(`${rel(f)}:${i + 1}: audit claim: "${sentence.trim().slice(0, 120)}"`);
    }
  });
}

// The operator service must never appear without its status nearby.
for (const f of docFiles.filter((f) => f.includes("/operator/"))) {
  if (!/designed, not built/i.test(read(f))) fail(`${relative(SITE, f)}: operator page does not say "designed, not built"`);
}

/* ------------------------------------------------------------ CLAIMS.md */

const esc = (s) => s.replace(/\|/g, "\\|").replace(/\n\s*/g, " ");
const srcs = (cl) => cl.sources.map((s) => `\`${s.file}\`${s.contains ? `: "${esc(s.contains)}"` : ""}`).join("<br>");
let md = `# Site claims

Generated by \`site/scripts/check-claims.mjs\` from \`content/claims/*.json\`. Do not edit by hand.
Every row is checked on each build: the text must be on the page and each source must still contain the quoted string.
Figures rendered from \`content/generated/facts.json\` are re-derived from the repository's JSON files.

Facts snapshot: generated ${facts.generatedAt}; chain read ${c.readAt} from ${c.readFrom}.

## Landing page

| Section | Template block or component | Claim on the page | Source |
|:---|:---|:---|:---|
`;
for (const sec of landing.sections)
  for (const cl of sec.claims)
    md += `| ${sec.title} | ${esc(sec.component ?? sec.agenforce)} | ${cl.site === "TRUST_STATEMENT_VERBATIM" ? "Both trust-statement sentences, verbatim" : esc(cl.site)}${cl.fact ? ` (facts: \`${cl.fact}\`)` : ""}${cl.note ? `. ${esc(cl.note)}` : ""} | ${srcs(cl)} |\n`;
md += `\n## Docs\n\n| Group | Page | Claim | Source |\n|:---|:---|:---|:---|\n`;
for (const g of docs.groups)
  for (const cl of g.claims)
    md += `| ${g.title} | \`${cl.page}\` | ${cl.site === "TRUST_STATEMENT_VERBATIM" ? "Both trust-statement sentences, verbatim" : esc(cl.site)} | ${srcs(cl)} |\n`;
writeFileSync(join(SITE, "CLAIMS.md"), md);

if (errors.length) {
  console.error(`check-claims: ${errors.length} problem(s)\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`check-claims: facts match the repository; ${landingCount} landing and ${docsCount} docs claims verified; ${pageFiles.length} files scanned` +
  (APP ? "" : `; landing page text and ${skipped} application source(s) not checked here (run with --site in the site repository)`));
