# Confidential Disbursement on Stellar — MVP Brief

**Owner:** Jagadeesh B
**Target:** Stellar Community Fund (SCF), Open Track, Build Award
**Status:** pre-build. Phase 0 (investigation) must complete before any code is written.

---

## 1. What we are building

A **confidential disbursement contract and SDK on Soroban**: one funder pays many recipients in a single flow, where **individual recipient amounts are private**, but the **aggregate total is cryptographically provable on demand** to a donor or auditor — who verifies it using **their own disclosure keypair and a challenge nonce they issue**, never by holding any secret of the funder's.

Built on Stellar's **Confidential Tokens** primitive (developer preview, released 29 June 2026), which gives any SEP-41 token private balances and private transfer amounts via zero-knowledge proofs, with addresses remaining visible for compliance.

### Why this, and why now

- Stellar shipped the confidential-token primitive weeks ago. SDF wants reference implementations that prove it works.
- Stellar's institutional identity is cross-border payments, aid, and remittances. Public per-recipient amounts are a real barrier there — they expose vulnerable recipients and can make them targets.
- Nobody has claimed the one-to-many disbursement shape on Stellar yet.

### What this is NOT

- Not a payroll product. Payroll is a commodity; every ecosystem has three.
- Not an enterprise treasury/compliance layer. **Arcane** already won $150K in SCF #42 for exactly that. Our lane is **one-to-many disbursement for grant programs, bounty platforms, and public-goods funding**, where auditability runs to *donors and the public*, not to regulators.
- Not multi-chain — yet. Chain adapters come after the SCF award lands.

### First user

**Grainlify** — our own funded open-source contribution platform — will consume this SDK for contributor payouts. This is the adoption story for the application: not a hypothetical user, a tool we ship and then use ourselves.

---

## 2. Phase 0 — Investigation (do this first, write no code)

The confidential-token release is a **developer preview**. Its actual shape determines the entire architecture, and we cannot scope the MVP until we know it. **Investigate and report back before writing anything.**

Deliverable: a written findings report answering the questions below, with links to source and code excerpts where relevant. No implementation, no scaffolding, no "I went ahead and started" — findings only.

### Q1 — What exactly shipped, and where does it live?
- Locate the confidential tokens developer preview: repo, docs, release notes, any CAP/SEP it references.
- Is it a deployable wrapper contract we call, a reference implementation we fork, or a library we build against?
- What is the license?
- What is its stability status — is the interface expected to change, and is there a published roadmap to mainnet?

### Q2 — What is the contract interface?
- Full function signatures for the confidential wrapper: wrap/unwrap, deposit, confidential transfer, balance query.
- What is encrypted and what is public, precisely? (Amounts encrypted, addresses visible — confirm and document exactly which fields.)
- What does a confidential transfer look like end to end, at the call level?

### Q3 — Where does proof generation happen? ⚠️ high impact
- Client-side or server-side?
- What tooling exists — is there a JS/TS SDK, or is it Rust-only, or do we generate proofs ourselves?
- What are proof generation times, and what is the proof size?
- What are the on-chain verification costs per transfer (instructions, reads, writes)?

### Q4 — Does it support one-to-many in a single transaction? ⚠️ **this decides the architecture**
- Can a single transaction carry N confidential transfers, or is it strictly pairwise?
- If pairwise only: what is the realistic **maximum N per transaction** given Soroban's limits — 200 reads per transaction, plus instruction, memory, and write-entry caps? Get an actual measured number, not an estimate.
- What does the batching strategy have to look like as a result?

> This is the same class of constraint we hit on the Aptos payout work. Assume it bites until proven otherwise.

### Q5 — Viewing keys and selective disclosure
- Does the preview provide a selective-disclosure / viewing-key mechanism natively, or must we build it?
- Can a third party be granted view access to a *set* of transfers (our aggregate-total requirement), or only to a single account's history?
- **If aggregate proving is not supported natively, what would we have to build?** This is our core differentiator — if the primitive doesn't give it to us, it becomes the bulk of the engineering work and needs to be scoped as such.

### Q6 — Prior art
- Review **sub-rosa** (`@sub-rosa/sdk`) on Stellar — sealed-bid auctions, confidential proposal rounds, SAC escrow. How close does it come to our shape? Does it already solve any of the above?
- Search for any other Soroban project doing confidential batch transfers or aggregate proving.
- Look at how **Arcane** is scoped in public materials, and note precisely where our boundary sits.

### Q7 — Toolchain
- Which Soroban SDK / CLI versions are required? (SCF expects the most recent stable release of the Stellar tech stack.)
- Does the preview work on testnet today? Any futurenet-only pieces?
- Note any BN254 / Poseidon host-function dependencies from Protocol 25 (X-Ray).

---

## 3. MVP scope (post-investigation, subject to Phase 0 findings)

Three pieces. Testnet only. Deliberately small.

### 3.1 Disbursement contract (Soroban, Rust)
- Wraps a SEP-41 token using the confidential-token pattern.
- A funder deposits a total pool.
- A disbursement call accepts a recipient set with **encrypted per-recipient amounts**.
- Recipients claim or receive; individual amounts never appear in plaintext on-chain.
- Batching strategy per Q4 findings.

### 3.2 Funder-side flow (TypeScript SDK)
- Takes a recipient list with amounts.
- Handles encryption and proof generation per Q3 findings.
- Submits the disbursement, chunked per the measured batch limit.
- Returns transaction references.

### 3.3 Aggregate disclosure verification
- A donor/auditor verifies the **aggregate total disbursed** without seeing individual amounts, via a **challenge–response**: the donor generates their own disclosure keypair `(r_R, P_R)` and issues a fresh nonce `ν`; the funder returns a zero-knowledge proof sealed to `P_R` that reveals **only** the aggregate.
- ⚠️ **The donor must never receive the funder's viewing key.** `vk` recomputes every ephemeral scalar the funder ever used, and therefore opens **every individual transfer amount, retroactively and permanently** — including commitments sitting inside recipients' balances (OZ `SDK.md` §10.5). The challenge-nonce model is the only one to build. See [PHASE0-FINDINGS.md](PHASE0-FINDINGS.md) §Q5-followup.
- Minimal CLI or script is fine — this needs to be *demonstrable*, not pretty.

### 3.4 Frontend landing page (required)

The SCF Interest Form asks for a project website, so this is a **submission blocker, not a nice-to-have**. It ships with the MVP.

Single-page site. Static, deployable to any host. Must cover:

- **What it is**, in one sentence a non-engineer understands — private recipient amounts, publicly provable totals.
- **The problem**, concretely: on a public ledger, every recipient's amount is visible forever, which exposes vulnerable people and blocks organisations from paying on-chain at all.
- **How it works** — a simple diagram: funder → confidential disbursement contract → recipients, with an auditor off to one side verifying the total by **issuing a challenge and checking the returned proof** (the auditor holds only their own keypair, never the funder's).
- **Built on Stellar**, naming the Confidential Tokens primitive and **both protocol dependencies** explicitly: **Protocol 25 (X-Ray)**, whose BN254 host functions make UltraHonk verification possible on Soroban, and **CAP-80 in Protocol 26 (Yardstick, mainnet 6 May 2026)**, which makes that verification cheap enough to batch. Frame CAP-80 as the cost reduction, not as a correction to Protocol 25. Reviewers should see immediately that this is Stellar-native, not a port.
- **Live demo evidence** — link the testnet transactions from §4, the block explorer view showing no visible amounts, and the auditor verification output.
- **Open source** — link the repo, state the license.
- **Who it's for** — grant programs, bounty platforms, public-goods funders, aid disbursement.

Design direction: clean, technical, credible. This is read by a delegate panel and by community voters, so favour clarity and evidence over marketing language. No fake testimonials, no invented metrics, no "trusted by" logos. If a number isn't real, it doesn't go on the page.

### Explicitly out of scope for MVP
- No application dashboard or funder web UI (the landing page in §3.4 is separate and *is* in scope)
- No mainnet deployment
- No multi-chain adapters
- No KYC integration
- No production key management

---

## 4. Demonstration target

By the end of the MVP we must be able to show:

1. A funder disburses to **at least 10 recipients** in one flow on testnet.
2. A block explorer shows the transactions with **no individual amounts visible**.
3. An auditor script uses the viewing key to prove the total, and the total **matches** what was actually disbursed.
4. Grainlify calls the SDK for a real contributor payout on testnet.
5. A live landing page is deployed, linking the repo and the demo evidence above.

That is the whole demo. If it does those five things, it is enough to submit.

---

## 5. Constraints and working rules

- **Investigate and report before any code is written.** Phase 0 findings first; scope gets revised against them.
- **Build in the open**, permissive license — SCF weighs this.
- Use the most recent stable Stellar tech stack.
- Assume a **single developer**. Scope accordingly; flag anything that realistically needs a team.
- Where a Phase 0 answer is unknown or ambiguous, **say so explicitly**. Do not fill gaps with plausible-sounding assumptions — a wrong assumption about Q4 or Q5 invalidates the whole architecture.

---

## 6. Open risks to track

| Risk | Why it matters |
|---|---|
| Confidential tokens is a **developer preview** | SCF Build expects mainnet launch in 3–5 months. If the primitive isn't mainnet-ready in that window, the timeline breaks. Needs an answer from Q1. |
| **Aggregate proving may not be native** (Q5) | This is the differentiator. If we have to build it, the scope roughly doubles. |
| **Batch size limits** (Q4) | If N per transaction is small, "one-to-many" becomes a UX and cost problem, not just an implementation detail. |
| Preview interface may change | Rework risk mid-build. |
| Overlap with Arcane / sub-rosa | Differentiation has to be defensible to a delegate panel, not just to us. |

---

## 7. Sequencing

The SCF Interest Form requires a **finished MVP and a project website**. Both are prerequisites to submitting, which makes §3.4 a hard blocker rather than polish.

Order of work:

1. **Phase 0 investigation** → findings report → revise scope below against it.
2. Build §3.1–3.3 on testnet.
3. Run the demonstration in §4 and capture the evidence (transaction hashes, explorer screenshots, auditor output).
4. Build and deploy §3.4, wiring in that evidence.
5. Obtain a **referral code** before submitting — 28 of 46 awarded projects in SCF #44 came through referrals.
6. Submit the Interest Form.

Build Award rounds run every six weeks, so there is no single deadline to race — but the referral should be lined up in parallel with the build, not left until step 5.