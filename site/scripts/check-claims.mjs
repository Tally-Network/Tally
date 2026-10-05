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
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SITE = new URL("../", import.meta.url).pathname;
const ROOT = join(SITE, "..");
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
  ["round.dir", facts.round.dir, latest.dir],
];
for (const k of Object.keys(round)) factChecks.push([`round.${k}`, facts.round[k], round[k]]);
for (const [k, got, want] of factChecks) if (!same(got, want)) fail(`facts.json ${k} differs from the repository; run \`pnpm site:facts\``);

// The chain snapshot must agree with the published evidence's own summary line.
const ev = read(repo("evidence/README.md"));
const m = /over (\d+) transfers from (\d+) declared lanes, ledgers (\d+)–(\d+)/.exec(ev);
const c = facts.round.chain;
if (!m) fail("evidence/README.md has no 'over N transfers from L declared lanes' line");
else if (+m[1] !== c.transfers.length || +m[2] !== c.lanes || +m[3] !== c.openedAt || +m[4] !== c.closedAt)
  fail(`facts.json chain snapshot (${c.transfers.length} transfers, ${c.lanes} lanes, [${c.openedAt}, ${c.closedAt}]) disagrees with evidence/README.md (${m.slice(1).join(", ")})`);
for (const t of c.transfers) if (!/^[0-9a-f]{64}$/.test(t.vTilde) || !/^[0-9a-f]{64}$/.test(t.txHash)) fail(`malformed transfer in facts.json: ${t.txHash}`);

/* ------------------------------------------------------------ 2. claims */

const checkSources = (where, sources) => {
  for (const s of sources) {
    const p = repo(s.file);
    if (!existsSync(p)) { fail(`${where}: source ${s.file} does not exist`); continue; }
    if (s.exists) continue;
    if (s.contains && !norm(read(p)).includes(norm(s.contains))) fail(`${where}: ${s.file} no longer contains "${s.contains}"`);
  }
};

const landing = json(join(SITE, "content/claims/landing.json"));
const landingSrc = norm(landing.siteFiles.map((f) => read(join(SITE, f))).join("\n"));
let landingCount = 0;
for (const sec of landing.sections) {
  for (const cl of sec.claims) {
    landingCount++;
    const where = `landing #${sec.id}`;
    if (cl.site !== "TRUST_STATEMENT_VERBATIM" && !landingSrc.includes(norm(cl.site))) fail(`${where}: page text not found: "${cl.site}"`);
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
const pageFiles = [...docFiles, ...landing.siteFiles.map((f) => join(SITE, f))];

const known = new Set([
  ...Object.values(dep.contracts),
  meas.batching?.benchContract,
  meas.aggregateOnChainVerification?.benchVerifier,
].filter(Boolean));
for (const f of pageFiles) {
  for (const id of read(f).match(/\bC[A-Z2-7]{55}\b/g) ?? []) {
    if (!known.has(id)) fail(`${relative(SITE, f)}: contract id ${id} is not in demo/deployment.testnet.json or ct/measurements.testnet.json`);
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
    for (const [re, why] of BANNED) if (re.test(l)) fail(`${relative(SITE, f)}:${i + 1}: ${why}: "${l.trim().slice(0, 120)}"`);
    // "audited" is allowed only in a negated sentence ("Nothing in Tally has been audited", "unaudited").
    for (const sentence of l.split(/(?<=[.?!])\s+/)) {
      if (/(?<!un)audited\b/i.test(sentence) && !/\b(not|no|nothing|never|neither|nor|without)\b|\?/i.test(sentence))
        fail(`${relative(SITE, f)}:${i + 1}: audit claim: "${sentence.trim().slice(0, 120)}"`);
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

| Section | Agenforce component | Claim on the page | Source |
|:---|:---|:---|:---|
`;
for (const sec of landing.sections)
  for (const cl of sec.claims)
    md += `| ${sec.title} | ${esc(sec.agenforce)} | ${cl.site === "TRUST_STATEMENT_VERBATIM" ? "Both trust-statement sentences, verbatim" : esc(cl.site)}${cl.fact ? ` (facts: \`${cl.fact}\`)` : ""}${cl.note ? `. ${esc(cl.note)}` : ""} | ${srcs(cl)} |\n`;
md += `\n## Docs\n\n| Group | Page | Claim | Source |\n|:---|:---|:---|:---|\n`;
for (const g of docs.groups)
  for (const cl of g.claims)
    md += `| ${g.title} | \`${cl.page}\` | ${cl.site === "TRUST_STATEMENT_VERBATIM" ? "Both trust-statement sentences, verbatim" : esc(cl.site)} | ${srcs(cl)} |\n`;
writeFileSync(join(SITE, "CLAIMS.md"), md);

if (errors.length) {
  console.error(`check-claims: ${errors.length} problem(s)\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`check-claims: facts match the repository; ${landingCount} landing and ${docsCount} docs claims verified; ${pageFiles.length} files scanned`);
