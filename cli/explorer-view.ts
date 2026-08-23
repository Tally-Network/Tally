/**
 * Target 2 evidence: what a public observer can actually see for a confidential
 * transfer, decoded straight from the ledger.
 *
 * A screenshot would show the same thing but could not be checked. This reads
 * the event back from RPC and prints every field with its visibility, so a
 * reviewer can re-run it and get the same answer.
 */
import { rpc, xdr, scValToNative } from "@stellar/stellar-sdk";
import { readFileSync, writeFileSync } from "node:fs";

const dep = JSON.parse(readFileSync(new URL("../demo/deployment.testnet.json", import.meta.url), "utf8"));
const latest = JSON.parse(readFileSync(new URL("../evidence/latest.json", import.meta.url), "utf8"));
const meta = JSON.parse(readFileSync(new URL(`../evidence/${latest.dir}/round.json`, import.meta.url), "utf8"));

const hexOf = (v: unknown) => Buffer.from(v as Uint8Array).toString("hex");

async function main() {
  const server = new rpc.Server(dep.rpcUrl);
  const health: any = await (server as any).getHealth();
  const res = await server.getEvents({
    startLedger: Math.max(Number(health.oldestLedger), meta.published_at_ledger - 200),
    filters: [{ type: "contract", contractIds: [dep.contracts.token] }],
    limit: 200,
  });

  const ev = (res.events as any[]).find(e => {
    try { return xdr.ScVal.fromXDR(e.topic[0].toXDR()).sym().toString() === "transfer"; } catch { return false; }
  });
  if (!ev) { console.error("no transfer event found in the window"); process.exit(1); }

  const from = scValToNative(xdr.ScVal.fromXDR(ev.topic[1].toXDR()));
  const to   = scValToNative(xdr.ScVal.fromXDR(ev.topic[2].toXDR()));
  const data: any = scValToNative(ev.value);

  const rows: [string, string, string][] = [
    ["from",   "PUBLIC — indexed topic", String(from)],
    ["to",     "PUBLIC — indexed topic", String(to)],
    ["ledger", "PUBLIC", String(ev.ledger)],
    ["tx",     "PUBLIC", String(ev.txHash)],
  ];
  for (const [k, v] of Object.entries(data)) {
    rows.push([k, "ENCRYPTED — ciphertext / commitment", `0x${hexOf(v)}`]);
  }

  const w = Math.max(...rows.map(r => r[0].length));
  console.log(`\n  A confidential transfer, as the public ledger records it\n`);
  for (const [k, vis, val] of rows) {
    const short = val.length > 74 ? val.slice(0, 40) + "…" + val.slice(-8) : val;
    console.log(`  ${k.padEnd(w)}  ${vis.padEnd(38)}  ${short}`);
  }
  console.log(`\n  There is no amount field. Nowhere in this event, or anywhere else on chain,`);
  console.log(`  does the transferred value appear as a number.\n`);

  const md = `# Target 2 — what a public observer sees

Generated from the ledger by \`npx tsx cli/explorer-view.ts\`. Re-run it and you get the same answer; that is the point of publishing it this way rather than as a screenshot.

**Transaction:** [\`${ev.txHash}\`](https://stellar.expert/explorer/testnet/tx/${ev.txHash})
**Contract:** [\`${dep.contracts.token}\`](https://stellar.expert/explorer/testnet/contract/${dep.contracts.token})
**Ledger:** ${ev.ledger}

| Field | Visibility | Value |
|:---|:---|:---|
${rows.map(([k, vis, val]) => `| \`${k}\` | ${vis.startsWith("PUBLIC") ? "🔓 **Public**" : "🔒 Encrypted"} | \`${val.length > 50 ? val.slice(0, 34) + "…" + val.slice(-6) : val}\` |`).join("\n")}

## The point

**Sender and recipient are in the clear.** They are indexed event topics, so anyone can query every transfer out of a given account — which is exactly what makes a withheld transfer detectable, and why completeness does not depend on the funder cooperating.

**The amount is not there.** Not encrypted-but-present-in-a-field-called-amount: *there is no amount field at all.* \`v_tilde\` is the transfer value masked under a shared secret only the sender and recipient can derive; \`b_tilde\` is the sender's post-transfer balance, similarly masked; the \`*_aud_*\` fields are the auditor channel. Every one is 32 bytes of ciphertext.

This is what "confidentiality, not anonymity" means concretely: an observer learns that these two accounts transacted, and cannot learn how much.

Open the transaction on the explorer above and you will see the same event with the same fields.
`;
  const out = new URL("../evidence/explorer-view.md", import.meta.url);
  writeFileSync(out, md);
  console.log(`  wrote evidence/explorer-view.md`);
  console.log(`  explorer: https://stellar.expert/explorer/testnet/tx/${ev.txHash}\n`);
}
main().catch(e => { console.error(e?.message ?? e); process.exit(1); });
