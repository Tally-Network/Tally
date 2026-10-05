/**
 * Generates site/content/generated/facts.json from the repository's own files
 * and, for the published round's transfer events, from Stellar testnet RPC.
 * Run from the repo root:  pnpm site:facts
 *
 * The output is committed. The site never computes a figure itself; it renders
 * this file, and site/scripts/check-claims.mjs re-checks it against the sources
 * on every build.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { rpc, xdr, scValToNative, Contract, TransactionBuilder, BASE_FEE, Networks, Address } from "@stellar/stellar-sdk";

const R = new URL("../../", import.meta.url).pathname;
const json = (p: string) => JSON.parse(readFileSync(R + p, "utf8"));
const OUT = R + "site/content/generated/facts.json";

const dep = json("demo/deployment.testnet.json");
const meas = json("ct/measurements.testnet.json");
const latest = json("evidence/latest.json");
const round = json(`evidence/${latest.dir}/round.json`);
const lock = readFileSync(R + ".gitmodules", "utf8");

async function roundEvents() {
  const server = new rpc.Server(dep.rpcUrl);
  const src = await server.getAccount(round.funder);
  const tx = new TransactionBuilder(src, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(round.registry).call("get_round", new Address(round.funder).toScVal(),
      xdr.ScVal.scvBytes(Buffer.from(round.round_id, "hex")))).setTimeout(60).build();
  const sim: any = await server.simulateTransaction(tx);
  const r = scValToNative(sim.result.retval);
  const res = await server.getEvents({ startLedger: Number(r.opened_at) - 60,
    filters: [{ type: "contract", contractIds: [dep.contracts.token] }], limit: 200 });
  const transfers: unknown[] = [];
  for (const e of res.events as any[]) {
    if (xdr.ScVal.fromXDR(e.topic[0].toXDR()).sym().toString() !== "transfer") continue;
    if (e.ledger < Number(r.opened_at) || e.ledger > Number(r.closed_at)) continue;
    const d: any = scValToNative(e.value);
    transfers.push({ from: scValToNative(e.topic[1]), to: scValToNative(e.topic[2]), ledger: e.ledger,
      txHash: e.txHash, vTilde: Buffer.from(d.v_tilde).toString("hex") });
  }
  return { openedAt: Number(r.opened_at), closedAt: Number(r.closed_at), lanes: r.lanes.length,
    transfers, readAt: new Date().toISOString(), readFrom: dep.rpcUrl };
}

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
let chain;
try { chain = await roundEvents(); }
catch (e) {
  if (!prev?.round?.chain) throw e;
  console.warn(`RPC read failed (${(e as Error).message}); keeping the committed snapshot from ${prev.round.chain.readAt}`);
  chain = prev.round.chain;
}

const facts = {
  generatedAt: new Date().toISOString(),
  network: dep.network,
  openZeppelin: dep.openZeppelin,
  contracts: dep.contracts,
  deployedAtLedger: dep.deployedAtLedger,
  measurements: {
    measuredAt: meas.measuredAt, protocolVersion: meas.protocolVersion, latestLedger: meas.latestLedger,
    limits: meas.limits, register: meas.register, confidentialTransfer: meas.confidentialTransfer,
    batching: meas.batching, aggregate: meas.aggregateOnChainVerification,
  },
  round: { dir: latest.dir, published: latest.published, ...round, chain },
  submodule: /url = (.*)/.exec(lock)?.[1] ?? null,
};
writeFileSync(OUT, JSON.stringify(facts, null, 2) + "\n");
console.log(`wrote ${OUT}: ${chain.transfers.length} transfers, window [${chain.openedAt}, ${chain.closedAt}]`);
