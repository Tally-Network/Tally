# §4 Demonstration targets — honest status

**Corrected 21 Aug 2026.** An earlier report claimed "four of five targets covered." That was wrong: it counted the reproducible demo as discharging target 4, which it does not — **nothing built so far touches Grainlify.**

| # | Target | Status |
|:--|:---|:---|
| 1 | Funder disburses to ≥10 recipients in one flow on testnet | ✅ **Covered** |
| 2 | Block explorer shows transactions with no individual amounts visible | ⚠️ **Property holds; evidence artifact not captured** |
| 3 | Auditor script proves the total, and it matches | ✅ **Covered in substance**, two caveats |
| 4 | **Grainlify calls the SDK for a real contributor payout on testnet** | ❌ **Not built** |
| 5 | Live landing page | ❌ **Not built** |

**Two covered, one partial, two not built.**

---

## 1 — ✅ Covered

`pnpm demo` pays **16 recipients across 5 lanes** on testnet in one round. Exceeds the "at least 10" bar. Reproducible from a clean clone; both upstream submodules pinned.

## 2 — ⚠️ Property holds, artifact missing

The property is real and checkable: `Transfer` events carry `from`/`to` as **topics** while every amount appears only as `BytesN<32>` — a Pedersen commitment or an ECDH ciphertext. Real testnet hashes exist ([PHASE1-MEASUREMENTS.md](../PHASE1-MEASUREMENTS.md) §1) and the demo prints more on each run.

**What is missing is the evidence artifact**: a captured explorer view showing a transfer with addresses visible and no amount, ready to link from the landing page. That is a capture task, not a build task, but it is not done and should not be counted as done.

## 3 — ✅ Covered in substance, with two caveats

`pnpm demo` step [5] has the donor verify the aggregate and match the exact total. Caveats, both already documented:

- **"Using the viewing key" was the wrong model** and was corrected to challenge–response — the donor holds its own disclosure keypair and nonce, never a funder secret ([TRUST-STATEMENT.md](TRUST-STATEMENT.md)). The brief's §3.3 wording was updated.
- **Verification is embedded in the demo script, not a standalone CLI.** §3.3 asks for "a minimal CLI or script"; the script exists, a separable `tally verify --funder <G…> --round <id>` does not. Small, but not done.

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

## 5 — ❌ Not built

Next. It must carry both trust-statement sentences verbatim, a headline that asserts nothing, and only evidence that exists.
