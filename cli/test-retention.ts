/**
 * The expiry path is the one an outsider hits on day eight, so it is tested
 * rather than assumed. Waiting a week is not a test strategy; the decision is
 * a pure function and is exercised directly.
 */
import { retentionVerdict } from "./tally.js";
const pass = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m: string) => { console.log(`  \x1b[31m✗\x1b[0m ${m}`); process.exitCode = 1; };
const eq = (a: unknown, b: unknown, m: string) => JSON.stringify(a) === JSON.stringify(b) ? pass(m) : fail(`${m} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

const OLDEST = 4_142_938;   // a real testnet value

console.log("\nretention verdict\n");
eq(retentionVerdict(OLDEST - 1, OLDEST), { state: "expired", agedBy: 1 },
   "one ledger too old -> expired (the boundary, not an approximation)");
eq(retentionVerdict(OLDEST - 120_960, OLDEST), { state: "expired", agedBy: 120_960 },
   "a full window too old -> expired, with the distance reported");
eq(retentionVerdict(OLDEST, OLDEST), { state: "expiring", ledgersLeft: 0 },
   "exactly at the boundary -> still verifiable, but expiring");
eq(retentionVerdict(OLDEST + 17_279, OLDEST), { state: "expiring", ledgersLeft: 17_279 },
   "just under a day of margin -> expiring");
eq(retentionVerdict(OLDEST + 17_280, OLDEST), { state: "ok", ledgersLeft: 17_280 },
   "a day of margin -> ok");
eq(retentionVerdict(OLDEST + 120_000, OLDEST), { state: "ok", ledgersLeft: 120_000 },
   "a fresh round -> ok");

console.log("\n  a round is 'expired' only when the EVIDENCE aged out — never when a proof is bad.\n");
