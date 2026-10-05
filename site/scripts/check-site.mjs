/**
 * Crawls a running build of the site and checks what a reader would see.
 *
 *   node scripts/check-site.mjs [base-url] [--external]
 *
 *  - every internal page reachable from / and /docs returns 200;
 *  - every internal #anchor exists on its target page;
 *  - every link into github.com/Tally-Network/Tally/(blob|tree)/main/ names a
 *    file or directory that exists in this repository;
 *  - both trust-statement sentences appear verbatim on the landing page and on
 *    the docs trust-statement page, and the positioning sentence on / and /docs;
 *  - with --external, every other external link answers (reported; 401, 403,
 *    429 and 999 from bot-blocking hosts are listed as unchecked, not failed).
 *
 * Exit 1 on any failure.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3123").replace(/\/$/, "");
const EXTERNAL = args.includes("--external");
const ROOT = join(new URL("../", import.meta.url).pathname, "..");
const REPO_PREFIX = /^https:\/\/github\.com\/Tally-Network\/Tally\/(?:blob|tree)\/main\/([^#?]+)/;

const decode = (s) =>
  s.replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;|&#160;/g, " ").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
const text = (html) =>
  decode(html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ");

const errors = [];
const unchecked = [];
const pages = new Map(); // path -> { status, html, ids }
const links = []; // { from, href }

async function load(path) {
  if (pages.has(path)) return pages.get(path);
  const res = await fetch(BASE + path, { redirect: "manual" });
  const html = res.status === 200 ? await res.text() : "";
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => decode(m[1])));
  const page = { status: res.status, html, ids };
  pages.set(path, page);
  return page;
}

const queue = ["/", "/docs"];
const seen = new Set(queue);
while (queue.length) {
  const path = queue.shift();
  const page = await load(path);
  if (page.status !== 200) { errors.push(`${path} returned ${page.status}`); continue; }
  for (const m of page.html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
    const href = decode(m[1]);
    links.push({ from: path, href });
    if (href.startsWith("/") && !href.startsWith("//")) {
      const p = href.split("#")[0].split("?")[0] || path;
      if (!seen.has(p) && !p.startsWith("/_next") && !p.startsWith("/api")) { seen.add(p); queue.push(p); }
    }
  }
}

const external = new Map();
for (const { from, href } of links) {
  if (href.startsWith("#")) {
    if (href.length > 1 && !pages.get(from).ids.has(decodeURIComponent(href.slice(1)))) errors.push(`${from}: anchor ${href} does not exist`);
  } else if (href.startsWith("/") && !href.startsWith("//")) {
    const [p, hash] = href.split("#");
    const target = pages.get(p.split("?")[0] || from);
    if (!target || target.status !== 200) continue; // already reported
    if (hash && !target.ids.has(decodeURIComponent(hash))) errors.push(`${from}: ${href}: anchor #${hash} does not exist on ${p}`);
  } else if (REPO_PREFIX.test(href)) {
    const file = decodeURIComponent(REPO_PREFIX.exec(href)[1]).replace(/\/$/, "");
    if (!existsSync(join(ROOT, file))) errors.push(`${from}: ${href}: ${file} does not exist in the repository`);
  } else if (/^https?:\/\//.test(href)) {
    if (!external.has(href)) external.set(href, from);
  } else if (!/^(mailto:|tel:)/.test(href)) {
    errors.push(`${from}: unrecognised link ${href}`);
  }
}

/* ---------------------------------------------------- verbatim statements */

const trust = readFileSync(join(ROOT, "docs/TRUST-STATEMENT.md"), "utf8")
  .split("\n").filter((l) => l.startsWith("> ") && l.length > 3)
  .map((l) => l.slice(2).replace(/\*\*/g, "").replace(/\s+/g, " ").trim());
if (trust.length !== 2) errors.push(`expected two trust-statement sentences in docs/TRUST-STATEMENT.md, found ${trust.length}`);
const POSITIONING =
  "Tally is the disclosure and audit service for Stellar's privacy tokens: confidential payouts to many recipients, with totals an outside party can verify, and auditor access that no single party controls.";
const norm = (s) => s.replace(/[’‘]/g, "'").replace(/\s+/g, " ");
for (const [path, required] of [["/", [...trust, POSITIONING]], ["/docs/security/trust-statement", trust], ["/docs", [POSITIONING]]]) {
  const page = await load(path);
  const t = norm(text(page.html));
  for (const s of required) if (!t.includes(norm(s))) errors.push(`${path}: missing verbatim: "${s.slice(0, 70)}…"`);
}

/* --------------------------------------------------------------- external */

const extResults = [];
if (EXTERNAL) {
  const check = async (url) => {
    const opts = { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "user-agent": "Mozilla/5.0 tally-link-check" } };
    try {
      let r = await fetch(url, { ...opts, method: "HEAD" });
      if (r.status === 405 || r.status === 404 || r.status >= 500) r = await fetch(url, { ...opts, method: "GET" });
      return r.status;
    } catch (e) { return `error: ${e.cause?.code ?? e.name}`; }
  };
  const urls = [...external.keys()];
  for (let i = 0; i < urls.length; i += 8) {
    const batch = urls.slice(i, i + 8);
    const res = await Promise.all(batch.map(check));
    batch.forEach((u, j) => extResults.push([u, res[j]]));
  }
  for (const [u, s] of extResults) {
    if (typeof s === "number" && s < 400) continue;
    if ([401, 403, 429, 999].includes(s)) unchecked.push(`${u} (${s}, bot-blocked)`);
    else errors.push(`${external.get(u)}: external link ${u} answered ${s}`);
  }
}

console.log(`check-site: ${pages.size} pages crawled, ${links.length} links checked${EXTERNAL ? `, ${extResults.length} external URLs fetched` : `, ${external.size} external URLs not fetched (pass --external)`}`);
if (unchecked.length) console.log("unchecked:\n" + unchecked.map((u) => `  - ${u}`).join("\n"));
if (errors.length) {
  console.error(`check-site: ${errors.length} problem(s)\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("check-site: all internal links, anchors, repository paths and verbatim statements OK");
