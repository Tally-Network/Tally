/**
 * Every figure the landing page shows comes from content/generated/facts.json,
 * which `pnpm site:facts` (repo root) builds from the repository's own files.
 * scripts/check-claims.mjs re-checks those values against the sources at build.
 */
import facts from "./generated/facts.json";
import type { PublishedRound } from "../../scripts/round-docs";

export { facts };

export const REPO = "https://github.com/Tally-Network/Tally";
export const repoFile = (path: string) => `${REPO}/blob/main/${path}`;
export const explorer = (kind: "contract" | "tx" | "account", id: string) =>
  `https://stellar.expert/explorer/testnet/${kind}/${id}`;

export const n = (x: number) => x.toLocaleString("en-US");
export const pct = (x: number, of: number) => `${((x / of) * 100).toFixed(1)} %`;
export const short = (id: string, head = 6, tail = 4) => `${id.slice(0, head)}…${id.slice(-tail)}`;

export const cap = facts.measurements.limits.txMaxInstructions;
export const sizeCap = facts.measurements.limits.txMaxSizeBytes;
export const batch = facts.measurements.batching;
export const largest = batch.rows.find((r) => r.k === batch.largestThatFits)!;
export const aggRows = facts.measurements.aggregate.rows as Array<{
  n: number; publicInputs: number; instructions: number; txSizeBytes: number; verified: boolean;
}>;
export const ozRev = facts.openZeppelin.match(/@ ([0-9a-f]{7})/)?.[1] ?? "";
export const round = facts.round;
export const transfers = round.chain.transfers;

/** The published round with its demo-run figures, for the shared renderers in scripts/round-docs.ts. */
export const published: PublishedRound = {
  dir: round.dir, published: round.published, funder: round.funder, round_id: round.round_id,
  verifiable_until_ledger: round.verifiable_until_ledger, run: round.run, vkBytes: round.vkBytes,
};
export { verifyOutput, demoDonorOutput, demoSummary, tamperCommands, tamperAlter, tamperReplay, expiredExample } from "../../scripts/round-docs";
