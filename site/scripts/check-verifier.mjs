/**
 * Drives the /verify page in headless Chromium against a running build:
 *   - the published round verifies and shows its total,
 *   - both tampering buttons end in a rejected proof (not an error),
 *   - an aged-out round (round-002, served in place of the latest) is reported
 *     as aged out, with no failed-proof marker.
 *
 *   node scripts/check-verifier.mjs [base-url]
 * Needs Playwright's Chromium (npx playwright install chromium). Exit 1 on failure.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = (process.argv[2] ?? "http://localhost:3123").replace(/\/$/, "");
const EVIDENCE = join(new URL("../", import.meta.url).pathname, "../evidence");
const errors = [];
const browser = await chromium.launch();

async function page(setup) {
  const p = await (await browser.newContext()).newPage();
  p.on("pageerror", e => errors.push(`page error: ${e.message}`));
  if (setup) await setup(p);
  await p.goto(`${BASE}/verify`, { waitUntil: "load" });
  await p.waitForFunction(() => !document.querySelector("button[disabled]"), null, { timeout: 30000 });
  return p;
}
const outcome = p => p.$eval("[aria-live] > div:last-child", d => d.innerText.replace(/\s+/g, " ").trim());

const p = await page();
for (const [button, want] of [
  ["Verify this round", /Total, decrypted with the donor's own key/i],
  ["Alter the sealed total by one", /Proof rejected, as it should be/],
  ["Replay against a new challenge", /Proof rejected, as it should be/],
]) {
  const t0 = Date.now();
  await p.getByRole("button", { name: button }).click();
  await p.waitForFunction(() => !document.querySelector("button[disabled]") && document.querySelector("[aria-live] > div:last-child")?.textContent, null, { timeout: 240000 });
  const text = await outcome(p);
  const ok = want.test(text);
  console.log(`${ok ? "✓" : "✗"} ${button}: ${text.slice(0, 110)} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (!ok) errors.push(`${button}: unexpected outcome "${text.slice(0, 200)}"`);
}

const old = await page(async q => {
  await q.route("**/verify-data/latest.json", r => r.fulfill({ json: { dir: "round-002", published: "2026-08-23" } }));
  await q.route("**/verify-data/round-002/*", r => r.fulfill({ body: readFileSync(join(EVIDENCE, "round-002", r.request().url().split("/").pop())), contentType: "application/json" }));
});
await old.getByRole("button", { name: "Verify this round" }).click();
await old.waitForFunction(() => !document.querySelector("button[disabled]") && document.querySelector("[aria-live] > div:last-child")?.textContent, null, { timeout: 120000 });
const text = await outcome(old);
const failedMarks = await old.$$eval('[aria-label="failed"]', e => e.length);
const ok = /aged out/.test(text) && /not a failed proof/.test(text) && failedMarks === 0;
console.log(`${ok ? "✓" : "✗"} aged-out round: ${text.slice(0, 110)}`);
if (!ok) errors.push(`aged-out round: "${text.slice(0, 200)}", failed markers: ${failedMarks}`);

await browser.close();
if (errors.length) { console.error(`check-verifier: ${errors.length} problem(s)\n` + errors.map(e => `  - ${e}`).join("\n")); process.exit(1); }
console.log("check-verifier: verified, both tampering cases rejected, aged-out round reported as aged out");
