# §4 Demonstration targets — honest status

**Corrected 21 Aug 2026.** An earlier report claimed "four of five targets covered." That was wrong: it counted the reproducible demo as discharging target 4, which it does not — **nothing built so far touches Grainlify.**

| # | Target | Status |
|:--|:---|:---|
| 1 | Funder disburses to ≥10 recipients in one flow on testnet | ✅ **Covered** |
| 2 | Block explorer shows transactions with no individual amounts visible | ✅ **Covered** — [`evidence/explorer-view.md`](../evidence/explorer-view.md) |
| 3 | Auditor script proves the total, and it matches | ✅ **Covered** — standalone `tally verify` CLI |
| 4 | **Grainlify calls the SDK for a real contributor payout on testnet** | ❌ **Not built** |
| 5 | Live landing page | ✅ **Deployed** — <https://tally-network.github.io/Tally/> |
| **6** | **Independent third party verifies a published round** *(added)* | 🔄 **Ready to run** — [`evidence/`](../evidence/) |
| **7** | **Small round with real independent contributors, non-custodial** *(added)* | ❌ **Not built** — [sketch](TARGET4-SKETCH.md) |

**Targets 6 and 7 are separate targets, not substitutes for target 4.** Target 4 stays ❌ until a platform actually integrates Tally into its payout path. An honest ❌ beside two well-described additional targets reads better than a ✅ with an asterisk — and a reviewer who notices the asterisk trusts nothing else on the page.

### Target 6 — independent verification *(added 22 Aug 2026)*

Every verification before this was performed by whoever generated the proof, which is not evidence of anything. [`evidence/`](../evidence/) publishes a real testnet round — funder address, round id, and the disclosure bundle — such that anyone with only the repository and those values runs `pnpm verify:evidence` and gets `TOTAL DISBURSED: 3160`. Refreshed 22 Aug 2026; `pnpm evidence:refresh` republishes it.

**Ready, with one honest limit:** Soroban RPC retains ~7 days of events, and `verify` deliberately enumerates transfers from chain rather than from anything we supply, so the published round stops being verifiable around ledger 4410007. Durable verification needs the event archive `INDEXER.md` specifies, which we have not built.

The target completes when an **outside person** runs it and reports their output. Nothing internal substitutes for that.

### Target 7 — a small round with real contributors *(added 22 Aug 2026)*

n ≥ 5 independent contributors registering **non-custodially** — their keys never leave their devices, so not even we can decrypt their amounts. Shape in [TARGET4-SKETCH.md](TARGET4-SKETCH.md); the registration page is the only substantial unbuilt piece.

**Real people, real wallets, real keys, real verification — nominal value.** The round runs on Stellar testnet, where the asset has no monetary worth; what is real is that independent contributors hold their own keys, that no platform can decrypt their amounts, and that anyone can verify the total.

---

## 1 — ✅ Covered

`pnpm demo` pays **16 recipients across 5 lanes** on testnet in one round. Exceeds the "at least 10" bar. Reproducible from a clean clone; both upstream submodules pinned.

## 2 — ✅ Covered

[`evidence/explorer-view.md`](../evidence/explorer-view.md) shows a real transfer decoded from the ledger: `from` and `to` in the clear as indexed topics, and **no amount field anywhere** — only 32-byte ciphertexts. It links the transaction on stellar.expert so a reviewer can open the same event.

Published as regenerable output (`npx tsx cli/explorer-view.ts`) rather than a screenshot, deliberately: a screenshot shows the same thing but cannot be checked, and re-running the command against the chain is a stronger claim than an image.

## 3 — ✅ Covered

`pnpm demo` step [5] has the donor verify the aggregate and match the exact total. Caveats, both already documented:

- **"Using the viewing key" was the wrong model** and was corrected to challenge–response — the donor holds its own disclosure keypair and nonce, never a funder secret ([TRUST-STATEMENT.md](TRUST-STATEMENT.md)). The brief's §3.3 wording was updated.
- ~~Verification is embedded in the demo script~~ — **done.** [`cli/`](../cli/) is a standalone `tally challenge` / `prove` / `verify`, with the trust boundary enforced in code and three rejection cases verified.

## 4 — ❌ Not built. This is the gap that matters.

**Nothing in the repository touches Grainlify.** It is the adoption story the submission rests on, and it is worth more to a delegate panel than any of the cryptography, because it is the difference between a reference implementation and a tool someone actually uses.

Scoping it surfaced **three prerequisites that were not previously visible**:

### Prerequisite A — `@tally-network/sdk` does not exist yet

Everything so far runs against the **vendored reference demo SDK** (`@ctd/sdk`, `private: true`, not publishable — Phase 0 Q3). "Grainlify calls the SDK" cannot be true until there is an SDK to call.

The good news: the logic already exists in [`demo/run-round.ts`](../demo/run-round.ts). Extraction, not new invention. Five entry points:

```ts
openRound(funder, roundId, lanes)         // registry
registerRecipient(recipient)              // proof-carrying; required before receiving
disburse(round, [{ recipient, amount }])  // lane assignment, chaining, submission
proveAggregate(round, discloseTo, nonce)  // one proof over the round
verifyDisclosure(bundle)                  // donor side, resolves everything from chain
```

### Prerequisite B — a language boundary nobody had flagged

**`Grainlify-Backend` is Go. Proof generation is `bb.js` — WASM, JavaScript-only.** There is no Go prover for UltraHonk, and writing one is not a side quest. So the SDK **cannot be called in-process from Grainlify's backend.**

Smallest bridge: a small **Node payout worker** that Go invokes over HTTP or a job queue. This is a real architectural constraint on the integration, not a packaging detail.

> **Superseded in part.** The claim that Grainlify stores no contributor addresses was **wrong** — see [GRAINLIFY-ROUND-SIZING.md](GRAINLIFY-ROUND-SIZING.md). It does, with verification and supersede history. The real blocker is that the payout path is wired for **Aptos**, and whether a Grainlify settlement lands on Stellar is an open Grainlify decision. Target 4 is blocked on that decision, not on missing storage.

### Prerequisite C — contributors need confidential accounts

Every recipient must complete a proof-carrying `register` before it can receive anything (Phase 0, Q2). Two paths:

| | Model | Fit |
|:---|:---|:---|
| **Custodial** | Grainlify derives a confidential keypair per contributor from a master secret and registers on their behalf | ✅ MVP. Simple, no contributor action. **Grainlify can decrypt contributor amounts** — must be stated plainly, and is acceptable on testnet only |
| Self-custody | Contributor's wallet registers and holds its own keys | Correct long-term; needs frontend + wallet UX. Out of MVP scope |

### Smallest real integration

1. **Extract `@tally-network/sdk`** from `demo/run-round.ts` — the five entry points above.
2. **`grainlify-tally-payout`**, a Node worker exposing `POST /payout { bountyIds[] }`, which: opens a round → registers any unregistered contributors (custodial) → runs the fan-out → closes the round → returns `{ roundId, funderAddress, txHashes[] }`.
3. **Go backend calls it** for one real testnet bounty payout, replacing the amount-revealing leg of `release_funds(bounty_id, contributor)`.
4. **Grainlify stores `(roundId, funderAddress)`** against the payout batch — the two values a donor needs and the only ones they need.
5. **Public verification** via the standalone verify CLI from target 3.

### What this needs from Grainlify's side

- A testnet funder account plus K lane accounts, with keys reachable by the worker.
- Contributor Stellar addresses for one real bounty (Grainlify already holds these for the current payout path).
- Somewhere to persist `(roundId, funderAddress)` per batch.
- Agreement to run the **custodial registration model on testnet**, understanding Grainlify can decrypt contributor amounts under it.
- One real bounty to pay.

### Effort, single developer

| | |
|:---|:---|
| SDK extraction | ~2–3 days (mostly moving working code) |
| Payout worker | ~1–2 days |
| Grainlify-side wiring + one real payout | ~1–2 days, needs Grainlify repo access |
| Standalone verify CLI (target 3 caveat) | ~0.5 day |

**Target 4 is the critical path to submission, not the landing page.** The page can be built and deployed now against real evidence from targets 1–3; it simply must not claim a Grainlify integration that does not exist yet.

## 5 — ✅ Deployed

**<https://tally-network.github.io/Tally/>** — GitHub Pages, built from `site/` on push. Carries both trust-statement sentences verbatim, a headline that asserts nothing, and only evidence that exists. Every outbound link was checked and resolves.
