# Phase 0 — Investigation Findings

**Project:** Confidential Disbursement on Stellar
**Investigator:** Claude (for Jagadeesh B)
**Date:** 21 August 2026
**Status:** Complete. No code written, per §2 and §5 of the MVP brief.

---

## 0. Headline findings

Five things decide the architecture. Three of them change the scope.

1. **Q4 — There is no batch primitive, and there cannot be one at the transaction layer.** `confidential_transfer` is strictly pairwise, and Stellar permits **exactly one `InvokeHostFunctionOp` per transaction**. ⛔ **The batch-size estimate originally given here (7–8 per transaction) was wrong** — Phase 1 measured **N = 1**, bound by CPU instructions, not size. See [PHASE1-MEASUREMENTS.md](PHASE1-MEASUREMENTS.md).

2. **Q5 — Aggregate proving is NOT implemented, but it IS fully specified.** This is the best possible version of this answer. OpenZeppelin's `SELECTIVE_DISCLOSURE.md` §10 specifies the exact constraint system for aggregate disclosure, and the demo repo ships a *working, tested single-event* `disclose_sender` circuit. Our differentiator is real and unclaimed, and the cryptographic design work is already done. The job is vectorising an existing circuit over *n* events — bounded, well-specified work, not open-ended research.

3. **Q1 — The primitive is an unmerged feature branch with an open PR.** Not on crates.io, not audited, MIT licensed. It is consumed as a git dependency pinned to a branch. Rework risk is real and should be priced in.

4. **Recipients must pre-register with a ZK proof before they can receive anything.** This is not in the brief and it materially changes the demo: 10 recipients means 10 registration transactions, each with its own client-side proof, before any disbursement happens.

5. **Both protocols matter, and both are already live.** Protocol 25 (X-Ray) introduced the BN254 host functions that make UltraHonk verification *possible* on Soroban; CAP-80 in Protocol 26 (Yardstick) added the `g1_msm` and `Fr` arithmetic that make it *cheap*, and is the effective minimum for this suite. Yardstick reached mainnet on 6 May 2026. The protocol dependency is satisfied today on both testnet and mainnet — this de-risks the timeline more than expected.

---

## Q1 — What shipped, and where does it live?

| Item | Finding |
|:---|:---|
| **Contract suite** | [`OpenZeppelin/stellar-contracts`](https://github.com/OpenZeppelin/stellar-contracts), branch **`feat/confidential-verifier-ultrahonk`**, path `packages/tokens/src/confidential/` |
| **Verifier backend** | [`NethermindEth/rs-soroban-ultrahonk`](https://github.com/NethermindEth/rs-soroban-ultrahonk) |
| **Reference demo** | [`brozorec/stellar-confidential-token-demo`](https://github.com/brozorec/stellar-confidential-token-demo) |
| **License** | **MIT** (both OZ contracts and the Nethermind verifier) |
| **Form** | A **deployable wrapper contract suite we build against** — not a fork target, not a library we call from a host chain |

**Shape of a deployment — three contracts, not one:**

1. A `ConfidentialToken` contract (wraps one SEP-41 asset)
2. A `ConfidentialAuditor` registry (Grumpkin auditor public keys, reusable across tokens)
3. A `ConfidentialVerifier` registry (one UltraHonk VK per circuit type, reusable across tokens)

**Stability — this is the risk to watch.** The code lives on a feature branch, **not `main`**. There is an open PR titled *"Confidential Token: wire up Ultrahonk verifier"*, still unmerged. Last commit on the branch: **31 July 2026**; demo: **4 August 2026**. The crates are **not published to crates.io** — the demo consumes them as git dependencies with `Cargo.lock` pinning rev `539968f`.

The repo carries an explicit warning:

> ⚠️ **Not Production Ready** — The verifier module's UltraHonk backend is still under development and has **not been audited**. Do **not** deploy a contract built on this trait to mainnet or any environment that handles real value.

**Roadmap to mainnet:** SDF states audits are underway and it is "not yet approved for mainnet." **No published mainnet date.** This is unresolved and directly threatens the SCF Build expectation of a mainnet launch in 3–5 months. Flagging as the top project risk — see §Risk register.

---

## Q2 — Contract interface

Confirmed from source (`packages/tokens/src/confidential/mod.rs`). The full `ConfidentialToken` trait:

```rust
fn register(e: &Env, account: Address, auditor_id: u32, data: Bytes);
fn deposit(e: &Env, from: Address, to: Address, amount: i128);
fn merge(e: &Env, account: Address);
fn withdraw(e: &Env, from: Address, to: Address, amount: i128, data: Bytes);
fn confidential_transfer(e: &Env, from: Address, to: Address, data: Bytes);
fn confidential_transfer_from(e: &Env, spender: Address, from: Address, to: Address, data: Bytes);
fn set_spender(e: &Env, account: Address, spender: Address, data: Bytes);
fn revoke_spender(e: &Env, account: Address, spender: Address, data: Bytes);
fn confidential_balance(e: &Env, account: Address) -> ConfidentialAccount;
fn is_spender(e: &Env, account: Address, spender: Address) -> bool;
fn get_spender_delegation(e: &Env, account: Address, spender: Address) -> SpenderDelegation;
```

The `data: Bytes` parameter is an XDR-encoded payload carrying the proof, the new commitments, the ephemeral public key, the salt, and the ciphertexts.

### What is encrypted vs. public — precisely

| Field | Visibility |
|:---|:---|
| Sender address | **Public** |
| Recipient address | **Public** |
| Transfer amount | **Encrypted** (Pedersen commitment on Grumpkin + ECDH ciphertext) |
| Account balances | **Encrypted** (Pedersen commitment) |
| **Deposit amount** | **PUBLIC** — crosses the confidential boundary |
| **Withdrawal amount** | **PUBLIC** — crosses the confidential boundary |
| Existence of a transfer between A and B | **Public** |

The protocol provides **confidentiality, not anonymity**. That the funder paid a given recipient is public; how much is not.

> **Design consequence:** the funder's pool deposit is publicly visible. For our use case this is a *feature* — the total inflow is publicly auditable by construction, and only the split is private. Worth stating plainly on the landing page.

### Account model — two balances and a merge step

Each account holds a **spendable balance** and a **receiving balance**. Incoming deposits and transfers land in the receiving balance. An owner-authorised **`merge`** (homomorphic point addition, **no proof required**, cheap) folds receiving into spendable. Funds cannot be spent until merged.

### Confidential transfer, end to end

1. Sender's wallet generates a ZK proof covering: balance sufficiency, balance conservation, ECDH-derived blinding for the recipient, dual-auditor ciphertexts, and range validity (balance and amount both in `[0, 2^127)`).
2. Wallet encrypts the amount under an ephemeral ECDH shared secret with the recipient's public viewing key, plus ciphertexts for both the sender's and recipient's auditors.
3. Submits `confidential_transfer(from, to, data)`.
4. Contract `require_auth`s the sender, decodes the payload, runs hooks, assembles public inputs from on-chain state, calls `verifier.verify_proof(...)` cross-contract.
5. On success: replaces the sender's spendable commitment, homomorphically adds the transfer commitment to the recipient's **receiving** balance, emits the event.
6. Recipient's wallet observes the event, does ECDH with the ephemeral pubkey, decrypts the amount, updates local state.

### ⚠️ Registration is mandatory and proof-carrying

**A recipient must call `register` — which requires its own ZK proof — before it can receive anything.** `deposit` and `confidential_transfer` both fail against an unregistered account.

This is not mentioned in the brief and it changes the demo materially: **10 recipients = 10 registration transactions, each with a client-side proof**, before disbursement can begin. It also means the SDK needs a recipient-onboarding path, and Grainlify contributors cannot be paid without first registering a confidential account for that token.

---

## Q3 — Where does proof generation happen?

**Client-side.** Unambiguously. Contracts cannot generate proofs; the spending key, all blinding factors, and all salts are client-held by design.

### Tooling

| Component | Version | Note |
|:---|:---|:---|
| `@aztec/bb.js` | `0.87.0` | Proving backend (WASM) |
| `@noir-lang/noir_js` | `1.0.0-beta.9` | Witness solving |
| `@stellar/stellar-sdk` | `^14.2.0` | Chain adapter |
| `@noble/curves`, `@noble/hashes` | `^1.9.4`, `^1.8.0` | Grumpkin / hashing |
| `@zkpassport/poseidon2` | `^0.6.0` | Poseidon2 |

**There is a TypeScript SDK — but it is `"private": true`.** `@ctd/sdk` in the demo repo is not published to npm. It is demo code, not a distributable dependency. **We must vendor or fork it.** It is genuinely substantial (crypto core, witness assembly, proving, chain adapter, state engine, disclosure, auditor client), so forking is a real head start — but it is our maintenance burden the moment we take it.

`SDK.md` in the OZ repo is a **specification, not an implementation**: *"This document specifies obligations, not an API. It does not prescribe function signatures, module names, package layout, or class design."*

### Two mandatory non-default flags

Getting either wrong produces proofs that **verify locally and fail on-chain**:

- **Keccak Fiat-Shamir transcript is mandatory.** Backends commonly default to Poseidon2.
- **Zero-knowledge mode MUST NOT be enabled** — the verifier implements only the non-zk flavour.

### Proof size — measured, and it is the binding constraint

**456 BN254 field elements × 32 bytes = 14,592 bytes per proof.** This is a fixed canonical encoding, independent of circuit size. Only the proof bytes travel on the wire; public inputs are read from on-chain state.

### Proof generation time

OZ targets **"single-digit seconds on modern hardware."** The circuits are small — `Transfer` is 133 ACIR opcodes, 8 scalar multiplications. **No independently measured figure is published.** Given the circuit sizes this claim is plausible, but it is unverified and should be measured in the first week of build.

### ⚠️ On-chain verification cost — UNKNOWN

**I could not find any published figure for CPU instructions consumed per UltraHonk verification on Soroban.** I checked the Nethermind verifier repo, the Noir community discussions, the indextree verifier milestone reports, and the ProofBridge verifier documentation. The Nethermind repo *has* a cost-measurement harness that records CPU instructions against a localnet deployment, but **the results are not published**.

Per §5 of the brief, I am flagging this rather than estimating. **This is the single most important number to measure before committing to a batch architecture** — it may bind tighter than transaction size (see Q4).

What is known: the verifier makes exactly two host calls — `bn254::g1_msm` and `bn254::pairing_check` — both native host functions as of Protocol 25/26.

---

## Q4 — One-to-many in a single transaction? ⚠️ ARCHITECTURE-DECIDING

> ### ⛔ SUPERSEDED BY PHASE 1 MEASUREMENT
> The size-derived estimate below (**9 hard / 7–8 realistic**) is **wrong**. Measured on testnet 21 Aug 2026: a single `confidential_transfer` costs **~93M CPU instructions against a 100M per-transaction cap**, so **N = 1** — batching is impossible, and transaction size never binds (24% utilisation). Transfers from one funder are also strictly **sequential**. See [PHASE1-MEASUREMENTS.md](PHASE1-MEASUREMENTS.md). The reasoning below is kept as the record of how the estimate was derived and why it failed.


**No. Strictly pairwise, at two independent levels.**

### Level 1 — the contract has no batch entrypoint

`confidential_transfer(e, from, to, data)` takes **one** `to` and **one** proof. I grepped the entire confidential module for `Vec<Address>`, `batch`, `multi_`, and `recipients`. **Zero matches.** The only occurrence of "multi" is `multi_scalar_mul`, an unrelated circuit primitive. Each transfer needs its own proof because each proof binds one amount to one recipient's viewing key via ECDH.

### Level 2 — Stellar allows one Soroban operation per transaction

From the Stellar docs, verbatim:

> **"There is only a single `InvokeHostFunctionOp` allowed per transaction."**

So batching cannot be done at the transaction layer by stacking operations. The documented workaround is exactly what we intended to build anyway:

> "Contracts should be used to perform multiple actions atomically."

**Therefore: one-to-many requires a wrapper contract that loops internally over N pairwise transfers.** This confirms §3.1 of the brief is the right shape — it is now a requirement, not a design choice.

### Maximum N per transaction

Current Soroban limits (SLP-0004, status *Final*, created 2026-01-12):

| Resource | Current | Proposed in SLP-0004 |
|:---|---:|---:|
| **Transaction size (bytes)** | **132,096** | **132,096** (unchanged) |
| Instructions per transaction | 100,000,000 | 400,000,000 |
| Disk read entries | 100 | 200 |
| Write entries | 50 | 200 |
| Write bytes | 132,096 | 132,096 |

**The binding constraint is transaction size, and SLP-0004 does not relax it.**

```
132,096 bytes ÷ 14,592 bytes per proof = 9.05
```

**Hard ceiling: 9 proofs per transaction.** After the transaction envelope, signatures, auth entries, the footprint declaration, and per-transfer payload fields beyond the proof (ephemeral pubkey, salt, commitments, four ciphertexts — all 32–64 bytes each, so roughly 250–350 bytes per transfer), **the realistic working figure is 7–8 transfers per transaction.**

The instruction budget is the **unknown second constraint**. At 100M instructions per transaction, if a single UltraHonk verification costs more than ~12M instructions, *instructions* bind before *size* and N drops further — potentially to 3–5. **This must be measured first.** If SLP-0004's 400M lands, instructions almost certainly stop binding and size becomes the sole limit at 7–9.

Note the brief's assumption of "200 reads per transaction" is the *proposed* SLP-0004 figure; **the current limit is 100**. Not binding for us either way — a chunk of 8 transfers reads roughly 8 recipient accounts + sender + VK + auditor keys ≈ 12 entries.

> The brief predicted this: *"This is the same class of constraint we hit on the Aptos payout work. Assume it bites until proven otherwise."* It bites.

### Required batching strategy

- **Chunk size 8**, made configurable, with the value confirmed by measurement before the demo.
- Wrapper contract exposes `disburse_chunk(round_id, funder, Vec<(recipient, payload)>)`, looping `confidential_transfer` internally so each chunk is **atomic**.
- Proofs are generated client-side **in parallel** (they are independent), then submitted sequentially.
- A **round registry** on-chain groups chunks under one `round_id` and records the event references — this is what makes the later aggregate proof well-defined over a known event set.
- 10 recipients = **2 transactions**. 100 recipients = 13 transactions.

**Consequence for the demo:** demonstration target #1 must be described as "one disbursement **flow**" (2 transactions, one atomic round), not "one transaction." The brief already says "in one flow" — that wording holds up. Do not let it drift to "one transaction" in the SCF submission.

---

## Q5 — Viewing keys and aggregate proving ⚠️ THE DIFFERENTIATOR

### What the primitive gives natively

**A per-account auditor model** — and it is not what we need.

- Each account binds an immutable `auditor_id` **at registration**.
- Every transfer emits **dual-auditor ciphertexts** — to the sender's auditor and the recipient's auditor — enforced by the ZK proof, so they cannot be omitted or malformed.
- The sender's auditor sees **the amount and the sender's post-transfer balance**. The recipient's auditor sees **the amount and the per-transfer Pedersen randomness**.

**This is the opposite of our requirement.** The native auditor sees *every individual amount in plaintext*. We need an auditor who can verify the **aggregate total** while seeing **no individual amounts**. Native auditing is blanket forward-only visibility, granted per account, and it is not selective.

### Selective disclosure — specified, partially implemented

`SELECTIVE_DISCLOSURE.md` describes an **off-chain** disclosure layer (the on-chain contract is untouched; proofs are verified off-chain against the on-chain event log). It defines four circuit families:

| Circuit | Purpose | **Implemented?** |
|:---|:---|:---|
| `disclose_recipient` | "this transfer paid me exactly X" | ✅ **Yes** — demo repo, with `nargo test` covering the happy path + 7 tamper cases |
| `disclose_sender` | "I sent this transfer for exactly X" | ✅ **Yes** — demo repo, tested |
| `disclose_auditor` | auditor discloses a transfer | ❌ No |
| `disclose_balance` | balance ≥ / ≤ / = threshold | ❌ No |
| **Aggregate forms (§10)** | **"total over n events"** | ❌ **No** |

Verified directly: the OZ circuits directory contains exactly six circuits (`register`, `withdraw`, `transfer`, `spender_transfer`, `set_spender`, `revoke_spender`) with six matching pinned VKs. **No `disclose_*` circuit exists in the OpenZeppelin repo at all.** The two that exist live only in the demo repo.

The demo's own README states it plainly:

> "Remaining disclosure variants (D-auditor §8, D-balance §9, **aggregates §10**) belong here as sibling circuit packages with their own artifact pairs."

### ✅ The good news: §10 is fully specified, and it is our exact shape

`SELECTIVE_DISCLOSURE.md` §10 "Aggregate Disclosures" gives the complete constraint system for vectorising a disclosure circuit over *n* events:

| # | Constraint |
|:--|:---|
| D1, D2 | Key derivation and binding (as §6) |
| For each *i*: D3ᵢ | `sᵢ = ECDH(vk_A, R_e,ᵢ)` |
| For each *i*: D4ᵢ | `v_transfer,ᵢ = ṽᵢ − Poseidon(δ_transfer_amount, sᵢ, σ_E,ᵢ)` |
| For each *i*: D5ᵢ | `v_transfer,ᵢ ∈ [0, 2^127)` |
| **AGG** | **`V_total = Σᵢ v_transfer,ᵢ`** |
| THRESH *(optional)* | `V_total ≥ V_threshold` |
| U1–U3 | Encrypt **`V_total` only** — not the individual `v_transfer,ᵢ` — to the disclosure recipient |

And critically, on the outbound (funder) direction, §10 says:

> "Aggregate disclosures over outbound transfers use the **D-sender** constraint block per event."

**That is precisely our use case:** a funder proving the total it disbursed across *n* recipients, to a donor, without revealing the split. The spec even notes the recipient "learns the aggregate `V_total` but not the individual amounts."

§15.1 gives the implementation guidance:

> "The aggregate forms can be implemented as a single parameterised circuit per role with a compile-time event-count bound, or as a family of circuits at *n* ∈ {1, 4, 16, 64} to balance proving time against generality."

### What we have to build

**Vectorise the existing, tested `disclose_sender` circuit over *n* events, per §10.** Concretely:

1. A `disclose_sender_aggregate` Noir circuit, as a family at *n* ∈ {4, 16, 64} (fixed *n* per circuit — Noir needs a compile-time bound), padding unused slots.
2. Witness assembly + proving in the SDK (extend `src/witness/disclose-sender.ts` and `src/disclosure/prove.ts`).
3. An off-chain verifier that resolves the *n* event references against the round registry, reconstructs public inputs from chain state, and checks the proof.
4. The auditor CLI of §3.3.

**This is bounded, well-specified engineering — not research.** We are handed the constraint system, a working single-event implementation of the same constraint block, a test methodology (7 tamper cases), and an explicit invitation to add it as a sibling package. Scope grows, but nothing like the "roughly doubles" worst case the brief feared.

### ⚠️ One honest limitation to state publicly

§1.4 of the spec is explicit, and it applies to us:

> "This layer proves **positive** statements ('this event paid me X'). It does not prove negatives ('I have no other transfers from Y'). **Completeness**, where required, continues to route through the auditor or through a future Merkle-accumulator extension that is out of scope here."

So our aggregate proof proves: *"these n specific transfers total exactly X."* It does **not** prove *"and there were no other transfers in this round."* Completeness comes from the **on-chain round registry** — the wrapper contract records which transfers belong to a round, so the set is publicly enumerable from chain state, and the auditor verifies the proof covers exactly that set.

**This is a genuine strength of putting the round registry on-chain, and it should be stated openly on the landing page rather than glossed.** A delegate panel with a cryptographer on it will ask this question.

---

## Q5-followup — Does the funder's aggregate depend on recipient-side auditor selection?

**Question posed:** registration binds an immutable `auditor_id` chosen by the *recipient*, and auditor keys live in a separate registry contract. If our aggregate proof depends on which auditor each recipient picked, the donor-verification story breaks.

### Answer: **No. The funder's aggregate is fully auditor-independent.** ✅

Verified from the D-sender circuit source (`demo/packages/disclosure/circuits/disclose_sender/src/main.nr`) and §5.3 of the disclosure spec. Three independent confirmations:

**1. The circuit never touches auditor material.** D-sender takes **15 public inputs** and **4 private witnesses**:

| | Values |
|:---|:---|
| **Public** | `addr_f`, `PVK_A` (originator), `R_e`, `σ`, `ṽ`, `PVK_B` (recipient), `P_R`, `ν`, `R_disc`, `ṽ_disc` |
| **Private** | `sk` (originator's spending secret), `r_e`, `v_tx`, `r_disc` |

**No `auditor_id`, no auditor public key, and none of the four auditor ciphertexts (`ṽ_aud,r`, `r̃_aud,r`, `ṽ_aud,s`, `b̃_aud,s`) appear anywhere** — not as inputs, not as witnesses, not in any constraint.

**2. The amount is reconstructed entirely from sender-side material.** Constraints DS3–DS5:

```
DS3   R_e = r_e · H                                  prover knows the ephemeral scalar
DS4   S_B = r_e · PVK_B                              sender-side ECDH to the recipient
DS5   v_tx = ṽ − Poseidon2(δ_tx_amount, S_B.x, σ)    recovers the amount
```

The funder decrypts its own outbound transfer using **its own ephemeral scalar** against the **recipient's public viewing key** — which is public on-chain data. The auditor channel is a *parallel, independent* encryption of the same amount. Ignoring it changes nothing.

**3. §5.3 confirms it at the verifier level.** Step 3 resolves auditor keys **only for D-auditor**:

> "For **D-auditor**, look up the auditor key for the disclosing account's `auditor_id` at the version active at the event's ledger."

D-sender's lookups (step 2) are only: `PVK_A` from `E.from`, `PVK_B` from `E.to`. **No auditor resolution occurs on the D-sender path at all.**

**Conclusion:** a funder can prove `Σ vᵢ = X` over its own outbound transfers regardless of what auditor each recipient chose — or whether those auditors ever cooperate. The donor-verification story holds. Circuit work is unblocked.

### ⚠️ But this forces a correction to §3.3 of the brief

The brief says *"a donor/auditor **holding the viewing key** can verify the aggregate total."* **That model is unsafe and must not be built.** SDK.md §10.5 is explicit:

> "**`vk` carries more authority than balance decryption.** Recomputing `r_e` yields the recipient shared scalar, hence `r_transfer`, hence **a full Pedersen opening of every transfer commitment the account created — retroactively**, and reaching commitments that sit inside recipients' receiving balances."

Handing a donor the funder's viewing key would expose **every individual recipient amount, retroactively, for all time** — the exact opposite of the product. It would also leak into recipients' balances.

**Correct model (what §5 of the disclosure spec actually specifies):** the **donor** generates their own disclosure keypair `(r_R, P_R)` and issues a challenge nonce `ν`. The funder produces a proof sealed to `P_R`, revealing **only** the aggregate `V_total`. The donor never sees the funder's viewing key, and the nonce makes each disclosure fresh and non-replayable.

This is strictly better for the pitch: it's a challenge–response the donor controls, not a secret the funder must trust them with. ✅ **Applied** — §1, §3.3 and §3.4 of the brief were reworded on 21 Aug 2026; the challenge-nonce model is now the only one described in any project document.

### Three further constraints found

**a) `r_e` is deterministic — no per-transfer secret storage required.** SDK.md §10.5 mandates:

```
r_e = poseidon_with_domain(δ_eph, [vk, σ_E])
```

The funder recomputes `r_e` at disclosure time from its viewing key plus the on-chain salt. **A disbursement service needs only its master secret** — no secret database, and aggregates can be proven retroactively over any historical round. Operationally significant for Grainlify.

*(Note: the circuit's header comment says wallets "retain `(r_e, v_tx)` per outgoing transfer." SDK.md §10.5 and §15.2 both mandate derivation instead. The comment describes one valid implementation; the spec is normative. We derive.)*

**b) Deterministic derivation is mandatory, and its absence is undetectable.** SDK.md §10.5, third consequence:

> "**Disclosability is unverifiable from chain data.** No on-chain value distinguishes an ephemeral this derivation produced from one it did not... Transfers predating this specification may not be disclosable by their sender."

If our SDK ever samples `r_e` randomly, those transfers become **permanently unprovable by the funder**, with no on-chain signal that anything is wrong. **The disbursement SDK must enforce deterministic derivation on every transfer**, and the auditor CLI must *test* disclosability rather than assume it. Add to the test suite as a hard invariant.

**c) Recipients must still be registered at verification time.** §5.3 step 4: the verifier "MUST reject" if a referenced account is not registered, since `PVK_B` is read from the recipient's on-chain account. Accounts are not deletable, so this is low-risk — but it means the aggregate proof is not verifiable against a recipient set that never completed registration.

### 🔎 A gap in §10 we will have to close ourselves

§10's public-input table lists per-event `(R_e,ᵢ, σ_E,ᵢ, ṽᵢ)` — **that is the D-recipient shape.** For a D-sender aggregate, every event has a *different recipient*, so each event also needs **`PVK_B,ᵢ` (2 field elements)**, which §10's table omits.

Per-event public inputs for our circuit are therefore **6 fields, not 4**:

```
R_e,ᵢ (2)  ·  σᵢ (1)  ·  ṽᵢ (1)  ·  PVK_B,ᵢ (2)
```

with `r_e,ᵢ` and `v_tx,ᵢ` as private witnesses per event. §10 says outbound aggregates "use the D-sender constraint block per event" but does not update its input table to match. **We are extending the spec slightly, not merely implementing it** — worth stating openly. ✅ **Filed upstream 21 Aug 2026 as [OpenZeppelin/stellar-contracts#849](https://github.com/OpenZeppelin/stellar-contracts/issues/849)**, which also asks whether multi-account outbound aggregates are in scope (see Phase 1 §5). Public, dated evidence of the extension for the SCF application's "build in the open" story.

**Estimated circuit cost.** Per event: 2 scalar multiplications (DS3, DS4) plus a `PVK_B` on-curve check. Fixed overhead: ~4 (D1, D2, U1, U2). So `n=16` ≈ **36 scalar muls** against `Transfer`'s 8 — roughly 4–5× the transfer circuit. Proving time should scale near-linearly; to be measured alongside the Phase 1 numbers before fixing the `n` family.

---

## Q6 — Prior art

### sub-rosa — **no overlap**

- npm `@sub-rosa/sdk` **v0.2.2**, MIT, published. Repo: [`karagozemin/Sub-Rosa`](https://github.com/karagozemin/Sub-Rosa). Live on **mainnet** (`CDQOFNCJE5Z4ZZL76DU5652FOUKJVEIZWHFGCZVWH63UYBGPSZIPC325`) and testnet.
- **Mechanism: Drand BLS12-381 timelock encryption.** Not ZK proofs. Not commitments-with-ZK.
- **Confidentiality is temporary** — payloads stay sealed until a configured Drand round, then *anyone* can advance the lifecycle and reveal them.
- **Does not use Stellar's Confidential Tokens primitive.** Handles non-confidential settlement with separate escrow/SAC custody.
- **No aggregate proving, no confidential transfers.**

**Boundary:** sub-rosa hides *bids before a deadline, then reveals them*. We hide *amounts permanently, while proving their sum*. Different primitive (drand vs. ZK), different guarantee (temporary vs. permanent), different shape (many-to-one auction vs. one-to-many disbursement). Cleanly defensible. Worth noting they share our sector (grants, bounties, RFPs), so a delegate may pattern-match — lead with "permanent confidentiality + provable aggregate" to separate immediately.

### Arcane — adjacent, different customer

$150K, SCF #42, announced May 2026: *"enterprise private compliant layer... confidential compliant transactions with built-in auditability and selective disclosure."*

**Boundary:** Arcane's auditability runs to **regulators and enterprise compliance desks** — the native per-account auditor model, extended. Ours runs to **donors and the public**, and needs the *inverse* disclosure property: prove a sum while hiding the parts. Their customer is a bank or a treasury; ours is a grant program. Real risk of a delegate conflating them — the differentiator to lead with is **one-to-many disbursement + aggregate proving**, neither of which Arcane addresses.

### Other Soroban confidential batch / aggregate work

**None found.** I searched for Soroban confidential batch transfers, aggregate proving, and disbursement. The adjacent ZK work is verifier infrastructure, not applications:

- `NethermindEth/rs-soroban-ultrahonk` — the verifier the primitive uses.
- `indextree/ultrahonk_soroban_contract` — an SCF-funded alternative UltraHonk verifier (arkworks-based, milestone reports published).
- `stellar/rs-soroban-poseidon` — Poseidon host-function bindings.

**The one-to-many confidential disbursement shape appears genuinely unclaimed**, as the brief assumed. That assumption survives investigation.

---

## Q7 — Toolchain

| Tool | Pinned version | Source |
|:---|:---|:---|
| `soroban-sdk` | **26.0.0** | demo workspace `Cargo.toml` |
| `stellar-cli` | **≥ 25.2.0** | required — see warning below |
| Rust toolchain | `stable`, target **`wasm32v1-none`** | `rust-toolchain.toml` |
| `nargo` (contracts) | **1.0.0-beta.11** | `circuits/vks/README.md` |
| `bb` (contracts) | **0.87.0** | `circuits/vks/README.md` |
| `nargo` (demo disclosure) | **1.0.0-beta.9** | ⚠️ demo `packages/disclosure/README.md` |
| `@noir-lang/noir_js` | **1.0.0-beta.9** | demo SDK |
| `@aztec/bb.js` | **0.87.0** | demo SDK |
| Minimum protocol | **26** (CAP-80) | `DESIGN_cont.md` §10.7 |

### ⚠️ Build must use `stellar contract build`, not `cargo build`

Verbatim from the demo workspace manifest:

> "`stellar-tokens` pulls in soroban-sdk's `experimental_spec_shaking_v2` feature transitively, which is why these contracts **MUST** be compiled with `stellar contract build` (stellar-cli >= 25.2.0), not plain `cargo build`."

### ⚠️ Toolchain drift between the two repos

The OZ contracts pin **nargo 1.0.0-beta.11**; the demo's disclosure circuits pin **nargo 1.0.0-beta.9**. Since we are building a *new disclosure circuit* using the *contract's* library, we sit exactly on this seam. §8.1 of `SDK.md` warns precisely about this failure mode:

> "Version drift between a client's vendored artifacts and the deployment's pinned toolchain produces verification keys that differ from the deployed ones **while every local test passes**."

Resolve which nargo version to standardise on **before writing the first circuit**. This is a silent-failure class of bug and will cost days if hit late.

### Protocol dependency — spans 25 and 26, both satisfied ✅

`DESIGN_cont.md` §10.7 states CAP-80 spans two protocols and **"protocol 26 is the effective minimum"**. The two do different jobs:

| Protocol | Host functions | Role |
|:---|:---|:---|
| **25 (X-Ray)** | `bn254_g1_{add,mul}`, `bn254_multi_pairing_check` | **Makes UltraHonk verification possible on Soroban.** SDF's preview post credits these for confidential-token verification. |
| **26 (Yardstick)** | `bn254_g1_msm`, `bn254_g1_is_on_curve`, `bn254_fr_{add,sub,mul,inv,pow}` | **Makes that verification cheap.** `g1_msm` collapses the verifier's multi-scalar multiplication into one host call, and the `Fr` arithmetic underpins on-chain Grumpkin point operations. |

The Nethermind verifier makes **exactly two host calls** — `bn254::g1_msm` and `bn254::pairing_check` — one from each protocol. That is the clearest statement of the split: X-Ray supplies the pairing check, Yardstick supplies the cheap MSM.

Timeline confirmed: Protocol 26 testnet **16 April 2026**, mainnet **6 May 2026**. Protocol 27 hit testnet 18 June 2026.

**Public-facing framing (landing page, SCF submission):** name **both**, and frame CAP-80/Protocol 26 as the **cost reduction** rather than as a correction to Protocol 25. X-Ray is what made ZK verification viable on Stellar at all and is the headline primitive SDF itself points to; Yardstick is what made it economical enough to batch. Saying only "Protocol 25" understates the dependency; saying only "Protocol 26" erases the primitive SDF is promoting. A reviewer who knows CAP-80 will check that we understand the difference.

**Does it work on testnet today?** Yes. The contracts are live on testnet, the demo deploys there, and no component is futurenet-only.

---

## Impact on MVP scope

### Confirmed as scoped
- §3.1 disbursement contract — shape confirmed correct; the looping wrapper is now *required*, not optional.
- §3.2 TypeScript funder SDK — viable, with a substantial fork head start.
- §3.4 landing page — unchanged.

### Newly required (not in the brief)
1. **Recipient registration flow** — every recipient needs a proof-carrying `register` before receiving. Add to SDK and to the demo script.
2. **Round registry in the wrapper contract** — groups chunks into one auditable round. This is what makes aggregate disclosure well-defined *and* supplies the completeness property the disclosure layer explicitly does not provide.
3. **Fork/vendor `@ctd/sdk`** — it is `private: true` and unpublishable as a dependency.
4. **A `disclose_sender_aggregate` Noir circuit family** — the real engineering, per §10.
5. **Merge handling** — recipients must merge before spending; the SDK should surface this.

### Revised demonstration targets
- Target #1: "10 recipients in one **flow**" = **2 transactions** at chunk size 8. Achievable. Do not claim one transaction.
- Targets #2–#5: unchanged and achievable.

### Recommended build order (revised)

**Week 1 is measurement, not construction.** Before committing to the batch architecture:

1. **Measure the per-verification instruction cost** on testnet or localnet. Deploy the demo, submit one `confidential_transfer`, read the CPU instruction count. This single number sets the chunk size and is currently unpublished anywhere.
2. **Measure real proof generation time** on target hardware.
3. **Resolve the nargo version seam** (beta.9 vs beta.11).
4. Then: wrapper contract + round registry → SDK fork + chunked submission → aggregate circuit → auditor CLI → landing page.

---

## Risk register (revised)

| Risk | Status after Phase 0 | Action |
|:---|:---|:---|
| **Preview not mainnet-ready in 3–5 months** | ⬆️ **ELEVATED — top risk.** Unmerged branch, open PR, unaudited, no published mainnet date. | Ask SDF directly for a mainnet target. Frame the SCF submission around a testnet MVP with a mainnet path gated on OZ's audit — do not promise a mainnet date we do not control. |
| **Aggregate proving not native** | ⬇️ **REDUCED.** Not implemented, but fully specified, with a tested single-event circuit to vectorise. | Build `disclose_sender_aggregate` per §10. Scope as ~2–3 weeks, not "double the project." |
| **Batch size limits** | ✅ **QUANTIFIED.** Hard ceiling 9/tx from proof size; working figure 7–8. | Chunk at 8, configurable. Say "flow," not "transaction." |
| **Instruction cost unknown** | 🆕 **NEW, UNRESOLVED.** No published figure anywhere. Could bind tighter than size. | **Measure in week 1.** Highest-priority unknown. |
| **Recipient pre-registration** | 🆕 **NEW.** Every recipient needs a proof-carrying register tx. | Build into SDK + demo. Affects Grainlify onboarding UX. |
| **Preview interface may change** | ⬆️ Elevated — git dep on a moving branch. | Pin the exact rev (`539968f` validated). Re-test on every bump. |
| **Toolchain drift (nargo beta.9 vs beta.11)** | 🆕 **NEW.** Silent-failure class. | Standardise before writing circuit code. |
| **Overlap with Arcane / sub-rosa** | ⬇️ **REDUCED.** Both confirmed clearly distinct. | Lead with "one-to-many + aggregate proving." |

### Single-developer assessment

Realistic for one developer, **with one caveat**: the aggregate circuit requires Noir/ZK circuit competence, not just Rust and TypeScript. If that is unfamiliar ground, budget learning time or line up a reviewer — a soundness bug in a disclosure circuit is not the kind of defect that surfaces in testing. Everything else (wrapper contract, SDK fork, CLI, landing page) is ordinary work for one person.

---

## Sources

- [Developer Preview: Confidential Tokens on Stellar](https://stellar.org/blog/developers/developer-preview-confidential-tokens-on-stellar)
- [OpenZeppelin/stellar-contracts @ `feat/confidential-verifier-ultrahonk`](https://github.com/OpenZeppelin/stellar-contracts/tree/feat/confidential-verifier-ultrahonk/packages/tokens/src/confidential) — read at rev `98090b3`
- [brozorec/stellar-confidential-token-demo](https://github.com/brozorec/stellar-confidential-token-demo)
- [NethermindEth/rs-soroban-ultrahonk](https://github.com/NethermindEth/rs-soroban-ultrahonk)
- [SLP-0004 — Soroban limits](https://github.com/stellar/stellar-protocol/blob/master/limits/slp-0004.md)
- [CAP-80](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0080.md), [CAP-74](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md), [CAP-75](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0075.md)
- [Stellar transaction docs — one InvokeHostFunctionOp per transaction](https://developers.stellar.org/docs/learn/fundamentals/contract-development/contract-interactions/stellar-transaction)
- [ZK Proofs on Stellar](https://developers.stellar.org/docs/build/apps/zk)
- [Yardstick, Protocol 26 Upgrade Guide](https://stellar.org/blog/foundation-news/stellar-yardstick-protocol-26-upgrade-guide)
- [Soroban UltraHonk verifier internals — ProofBridge](https://docs.pfbridge.xyz/reference/soroban-verifier) (proof encoding: 456 field elements)
- [karagozemin/Sub-Rosa](https://github.com/karagozemin/Sub-Rosa) · [@sub-rosa/sdk on npm](https://www.npmjs.com/package/@sub-rosa/sdk)
- [SCF #42 Round Recap](https://medium.com/stellar-community/scf-42-round-recap-2400da87b250) (Arcane award)
