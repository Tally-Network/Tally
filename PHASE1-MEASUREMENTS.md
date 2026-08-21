# Phase 1 — Week-1 Measurements (testnet)

**Date:** 21 August 2026
**Network:** Stellar testnet (Protocol 27)
**Status:** Complete. **Do not commit the batch architecture — the result invalidates it.**

---

## 0. The headline

**A single `confidential_transfer` consumes 93% of the entire per-transaction instruction budget.**

```
confidential_transfer : ~92,973,000 instructions
Soroban limit         : 100,000,000 instructions per transaction
                        ─────────────────────────────────────────
Maximum N per transaction : 1
```

**Batching is not possible.** Not "limited to 7–8" as Phase 0 derived from proof size — **two confidential transfers cannot fit in one transaction at all** (2 × 93M = 186M, nearly double the cap). The Phase 0 estimate was wrong because it assumed transaction size would bind. It doesn't; size never gets close.

A second finding compounds it: **transfers from one funder are strictly sequential** (§4). They cannot be generated or submitted in parallel.

---

## 1. Method

Deployed the OpenZeppelin confidential-token suite to testnet from the reference demo at rev `539968f`, then ran an instrumented harness that mirrors `ChainClient.invoke()` but captures the simulation response before assembling — so `SorobanResources` is observable — and records wall-clock proof time and final signed envelope size.

Every figure below is from a **real transaction that succeeded on testnet**, not from simulation alone. Declared resources were re-read from the on-chain envelope afterwards to confirm they match.

**Deployment**

| Contract | Address |
|:---|:---|
| Token | `CCDZ52D7ERL4AC4COSLCAUZF442CS7XTV2OXT5YPHLLE23W2IXDKJYHD` |
| Verifier | `CBWGTNURCFB3SGXAYPYS3WWYK4NZC2LETFGP45FGCFXWVZPDOXE73GID` |
| Auditor | `CBBPNS6MGLEGJU7NM3FCL2Y6YKFXSR35GFYOKNXQZBQHNFSZD32LV3ED` |
| Underlying | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` (native SAC) |

**Verified transactions** (all `SUCCESS`, [stellar.expert testnet](https://stellar.expert/explorer/testnet)):

| Op | Tx hash |
|:---|:---|
| `register` | `f2fb7a9a2329ef1cee7b1cee14415af8166a04c49f5c965613d6b21049fafadf` |
| `register` | `cde8bff66d2d8ebb6b151642693d86cd90cb8c915457fd8f6747c089efcd4758` |
| `deposit` | `151b0c7c2d4d853c2eddd93d550eb2cf1486677d6150e1b8b0c0e15a67439e79` |
| `merge` | `8ac696a8066d1933691a948dd01001927847c2263225d742cebba94d5f2b3f17` |
| `confidential_transfer` | `089fc19321826f936cb9ad36edf6c7f03d4bbb0bfa8cc095394db2d544f3d4a3` |
| `confidential_transfer` | `19679870b22d390d620f75a3ac7b8f60f65ccf43a0c8e5f351b01a9b3bc3a701` |
| `confidential_transfer` | `410412bf61e2e1abf83ebca7b7961a4ce6b1d5578fb71461c6f5af841b4560f8` |

---

## 2. Measured results

| Operation | CPU instructions | % of 100M cap | Tx size | Proof gen | Write B | RW / RO entries | Fee (stroops) |
|:---|---:|---:|---:|---:|---:|:---:|---:|
| `register` | 87,995,074 | **88.0%** | 30,536 B | 672 ms | 560 | 1 / 7 | 286,812 |
| `deposit` | 6,581,100 | 6.6% | 1,104 B | — | 928 | 3 / 3 | 351,267 |
| `merge` | 2,389,079 | 2.4% | 612 B | — | 560 | 1 / 2 | 18,839 |
| `confidential_transfer` #1 | 92,814,477 | **92.8%** | 31,724 B | 5,188 ms* | 1,120 | 2 / 7 | 444,736 |
| `confidential_transfer` #2 | 93,037,488 | **93.0%** | 31,724 B | 1,271 ms | 1,120 | 2 / 7 | 236,244 |
| `confidential_transfer` #3 | 93,067,956 | **93.1%** | 31,724 B | 1,250 ms | 1,120 | 2 / 7 | 236,265 |

\* first run includes WASM prover warm-up; steady state is ~1.26 s.

### Derived limits

| Constraint | Limit | Per transfer | **Max N** |
|:---|---:|---:|---:|
| **Instructions** | 100,000,000 | 92,973,307 (mean) | **1** |
| Transaction size | 132,096 B | 31,724 B | 4 |
| Write entries | 50 | 2 | 25 |
| Read entries | 100 | 7 | 14 |

**Instructions bind, and they bind at N = 1.** Every other limit is slack by an order of magnitude.

---

## 3. What this overturns from Phase 0

| Phase 0 said | Reality | Why the estimate failed |
|:---|:---|:---|
| Max 9/tx hard, **7–8 realistic** | **1** | Assumed transaction size binds. It doesn't — size is at 24% utilisation while instructions are at 93%. |
| Proof size drives the limit (14,592 B) | Instruction cost drives it | Proof size is real but irrelevant; verification *compute* is the wall. |
| "Chunk at 8, configurable" | **No chunking is possible** | The looping wrapper contract cannot execute more than one transfer. |
| Proof gen "single-digit seconds," unverified | **~1.26 s** steady state | OZ's claim was conservative. This is the one number that came in *better* than expected. |

**Also measured:** transaction size is 31,724 B against a 14,592 B proof — a 17,132 B gap. The most likely cause is that the Soroban auth entry carries the full invocation arguments, duplicating the `data` payload. Not confirmed, and moot while instructions bind, but it would matter if the instruction cap were ever raised.

---

## 4. Second finding: transfers are strictly sequential

Each `confidential_transfer` **replaces** the sender's spendable-balance commitment `C_spend → C_spend'`, and the next proof must open the *new* commitment. So proof *i+1* cannot be built until transfer *i* has landed.

**One-to-many from a single funder account is therefore serialized end to end:**

```
per recipient ≈ 1.26 s (proof) + ~5 s (ledger close)  ≈  6.3 s
10 recipients ≈ 63 s   ·   100 recipients ≈ 10.5 min
```

Plus one-off registration per recipient (~88M instructions, 672 ms proof, one transaction each).

**A 10-recipient demo is 20 transactions**: 10 registrations + 10 transfers.

This is the more damaging of the two findings. N=1 costs fees; sequencing costs wall-clock, and it scales linearly with recipient count with no way to amortise.

---

## 5. ⚠️ Does fan-out fragment the aggregate proof? — answer first

**Asked before writing any fan-out code, because a bad answer invalidates the approach.**

### Short answer: **yes, under §10 as written it fragments — and the damage is worse than "K proofs to sum."**

The D-sender circuit binds to **exactly one sender**. From the source (`disclose_sender/src/main.nr`): a single private witness `sk`, a single derived `vk`, and a single public `(pvk_a_x, pvk_a_y)` pair asserted against it:

```
D1   vk   = Poseidon2(δ_vk, sk, addr_f)      ← one sk
D2   PVK_A = vk · H                          ← one PVK_A, public input
```

§10's aggregate table confirms this is structural, not incidental — it lists `PVK_A` under **"Common"**, alongside `addr_f`, `P_R`, `ν`. Only `(R_e,ᵢ, σ_ᵢ, ṽᵢ)` are per-event.

**So one §10 aggregate proof covers exactly one funder account.** K lanes ⇒ K proofs, each revealing its own subtotal `V_j`, with the donor computing `V_total = Σ V_j`.

### The real damage is the subtotal leak, not the proof count

K proofs the donor must sum is a minor UX wrinkle. **Per-lane subtotals are a privacy failure**, because an aggregate only conceals individual amounts insofar as it sums several of them. Splitting `n` transfers across `K` lanes shrinks each proof's anonymity set to `n/K`:

| Lanes K | n = 10 | n = 50 | n = 100 |
|---:|:---|:---|:---|
| 1 | 10 per proof ✅ | 50 ✅ | 100 ✅ |
| 2 | 5 ✅ | 25 ✅ | 50 ✅ |
| 5 | 2 ⚠️ | 10 ✅ | 20 ✅ |
| **10** | **1 — every amount disclosed 🔴** | 5 ⚠️ | 10 ✅ |

**At K = n the aggregate degenerates into full per-recipient disclosure.** The K=10 fan-out I proposed for the 10-recipient demo is exactly this case: ten "aggregates" of one transfer each — which is simply publishing all ten amounts to the donor. It would have destroyed the differentiator precisely in the configuration we planned to demo.

**Your instinct was right, and Option A as written in §5 of the previous draft must not be built.**

### Two ways forward

**Option A′ — keep K small relative to n.** No new circuit work; the round registry pins the lane set on-chain so the donor can tell no lane was omitted. But it caps concurrency at `K ≪ n` (rule of thumb `n/K ≥ 10`), still leaks K subtotals, and gives **no speed-up at all for a 10-recipient round** — the exact demo case. Insufficient on its own.

**Option D — multi-sender aggregate circuit. ✅ Recommended.** Vectorise `PVK_A` too, not just `PVK_B`. Move `sk` and `PVK_A` from common inputs to **per-event** inputs, so a single proof spans every lane in the round:

| | Per event | Common |
|:---|:---|:---|
| **Public** | `PVK_A,ᵢ` (2) · `PVK_B,ᵢ` (2) · `R_e,ᵢ` (2) · `σᵢ` (1) · `ṽᵢ` (1) = **8 fields** | `addr_f`, `P_R`, `ν`, `R_disc`, `ṽ_disc` |
| **Private** | `skᵢ`, `r_e,ᵢ`, `v_tx,ᵢ` | `r_disc` |

The statement becomes: *"I hold the spending keys for these accounts, and these n transfers from them total exactly X."* Soundness is unchanged — the verifier still resolves every `PVK_A,ᵢ` from `E_ᵢ.from` and every `PVK_B,ᵢ` from `E_ᵢ.to` per §5.3 step 2, never from the bundle. The funder legitimately knows all `skᵢ` because it controls all lanes.

**Cost:** ~3 scalar multiplications per event (D2, DS3, DS4) plus a Poseidon for D1, against 2/event for the single-sender form. At n=16 that is ~50 muls versus ~36 — a ~40% circuit-size increase for **complete decoupling of concurrency from privacy**. K becomes a pure latency knob with no privacy cost, and the round yields **exactly one proof** regardless of lane count.

*(Possible refinement, not required: if all K lane keys derive from one master secret, constrain `skᵢ = KDF(master, laneᵢ)` and witness the master once. Smaller circuit, but it hard-codes a key-derivation scheme. Defer until the base version is measured.)*

**Conclusion: fan-out does not have to destroy the differentiator — but only if we write the multi-sender variant.** Since we are writing an aggregate circuit from scratch regardless, this is the same class of work, not extra scope. It is also a genuinely novel contribution: it extends §10 twice (per-event `PVK_B`, then per-event `PVK_A`), and no published Soroban work does either. Both extensions are raised upstream in [OpenZeppelin/stellar-contracts#849](https://github.com/OpenZeppelin/stellar-contracts/issues/849).

**Decision required before fan-out code is written:** build Option D. Option A′ is the fallback only if the multi-sender circuit proves harder to get sound than expected.

### Fan-out cost, including the registrations

Lane registrations are **not free** and were omitted from the previous draft's timing. Each is a full proof operation:

```
register : 87,995,074 instructions  ·  672 ms proof  ·  1 transaction  ·  ~286,812 stroops
```

A K-lane fan-out therefore costs **K registrations up front**, plus per-lane funding. Honest accounting for a 10-recipient round at K=5 (testnet ledger close ≈ 5 s; independent accounts are parallelisable, a single source account is serialised by sequence number):

| Phase | Transactions | Instructions | Wall clock | Frequency |
|:---|---:|---:|---:|:---|
| Lane registration (K=5) | 5 | 440M | ~6 s (parallel) | **one-time**, reused across all rounds |
| Lane funding: deposit + merge | 10 | ~90M | ~50 s (serialised from one funder source account) | one-time if lanes hold float; per-round if topped up |
| Recipient registration (n=10) | 10 | 880M | ~6 s (parallel) | **one-time per recipient** |
| **Transfers (n=10, K=5)** | **10** | **930M** | **~13 s** | **per round** |
| **First round total** | **35** | **~2.34B** | **~75 s** | |
| **Steady-state round** | **10** | **930M** | **~13 s** | |

Two consequences worth designing around: **lane accounts should hold float across rounds** rather than being funded per round, since deposits sourced from one funder account serialise on sequence number and dominate the first-round cost; and **the one-time costs amortise well** — a programme running monthly rounds pays them once.

Fees: the three measured transfers cost 236,244–444,736 stroops each, so a 10-recipient round is roughly **0.24–0.44 XLM** in resource fees.

---

## 6. What this means for the project

**The premise still holds; the pitch gets sharper.**

The naive reading — "call `confidential_transfer` in a loop inside a wrapper contract" — is dead. But that was never the differentiator. What the measurements actually show is that **one-to-many disbursement on Stellar's confidential tokens is genuinely hard**, and nobody has solved it. That is a better position to apply from, not a worse one:

- The limitation is **measured, documented, and reproducible** — no other public source has these numbers. That alone is a contribution to the ecosystem and worth publishing.
- The engineering value moves from *batching* (impossible) to **orchestration plus a stronger circuit**: the multi-sender aggregate (§5), the sequential-chain state machine, retry/resume under partial failure, and the round registry.
- **Aggregate proving (Q5) remains the differentiator** — but §5 shows it is *not* automatically safe under concurrency. Preserving it while going parallel is itself a design contribution.


### SLP-0004 — the roadmap line for the SCF submission

Instructions bind at **93% of the cap**, and SLP-0004 (status *Final*) raises the per-transaction limit **100M → 400M**, a 4× increase, while leaving transaction size untouched at 132,096 B. Because our binding constraint is precisely the one that moves:

| | Today (measured, Protocol 27) | Under SLP-0004 |
|:---|:---|:---|
| Instruction cap | 100,000,000 | 400,000,000 |
| `confidential_transfer` cost | ~92,973,000 | unchanged |
| **Max N per transaction** | **1** | **4** |
| 10-recipient round, K=1 | 10 tx, ~63 s | 3 tx, ~19 s |

**This is worth stating explicitly in the SCF application.** It is a rare, credible roadmap claim: *measured today, materially faster on the network's own published protocol path, with no rewrite on our side* — the wrapper contract's loop simply executes 4 transfers instead of 1, and the fan-out `K` needed for a given latency target drops 4×. It also lands well with a delegate panel, because it shows we know where our design sits against Stellar's own roadmap rather than against a guess.

Not yet live: Protocol 27 on testnet still enforced 100M during these measurements. Confirm the ship date with SDF alongside the mainnet-timeline question.

### Revised architecture

The wrapper contract is no longer a batch executor. It becomes a **round registry**:

- `open_round(round_id, funder, recipient_count)`
- `record_transfer(round_id, tx_ref)` — or, better, derive membership from events and keep the contract minimal
- `close_round(round_id)`

This is what makes the aggregate proof well-defined over a known event set, and supplies the **completeness** property that the disclosure layer explicitly does not provide (Phase 0, Q5). Its value is unchanged by the N=1 result — arguably increased, since the transfers are now unambiguously separate transactions that need grouping.

### Revised demonstration target §4.1

> "A funder disburses to at least 10 recipients in one flow on testnet."

Superseded by §6.7: run the demo at **n = 16, K = 5** — 16 transactions, ~25 s of transfers, one 14,592 B aggregate proof. Note K must stay well below n; K = n collapses the aggregate into per-recipient disclosure (§5). It must **not** be described as one transaction. Given the measurements, I'd state the transaction count openly on the landing page: a reviewer who tries it will find out anyway, and volunteering it reads as rigour.

---

## 6.5 Disclosure-layer baseline (measured)

The existing single-event disclosure circuits were run end to end against a live testnet event, with the §5.3 verifier protocol executing in full:

| Step | Time | Notes |
|:---|---:|:---|
| `disclose_recipient` prove (n=1) | 853 ms | client-side |
| `disclose_recipient` verify | 2,412 ms | includes chain reads + VK derivation from bytecode |
| **`disclose_sender` prove (n=1)** | **860 ms** | **the baseline our aggregate extends** |
| `disclose_sender` verify | 1,941 ms | resolves `PVK_A` from `E.from`, `PVK_B` from `E.to` |
| Disclosure proof size | 14,592 B | same fixed UltraHonk encoding as transfer proofs |

Three Phase 0 findings were confirmed empirically rather than only from the spec:

- **`r_e` is re-derived from the event, not stored.** The run's own log: *"alice proves D-sender over the SAME event (r_e re-derived from the event)."* No per-transfer secret database is needed — the master secret suffices, and aggregates stay provable retroactively.
- **No auditor key is consulted on the D-sender path.** The verifier read `PVK_A` from the event's `from` and `PVK_B` from its `to`, and nothing else. Auditor-independence (Q5-followup) holds in running code.
- **The challenge-nonce model behaves as specified.** Replaying a bundle under a different request nonce was rejected at `verify-proof`; a `ref_E` pointing at a non-transfer event was rejected at `resolve-event`.

**Aggregate projection — deliberately not stated as a number.** At n=1 the 860 ms is dominated by fixed cost (witness solving, SRS load, UltraHonk's power-of-two padding), so extrapolating a per-event marginal from a single point would be exactly the kind of plausible-sounding guess this project has avoided. What can be said: the marginal cost per event is ~3 scalar multiplications in the multi-sender form (D2, DS3, DS4), against ~5–6 fixed for the common block, and UltraHonk proving steps at power-of-two circuit sizes — which is why §15.1 suggests an `n ∈ {4, 16, 64}` family. **Measure the family once the circuit exists; do not size it from this baseline.**

Verification at ~2 s is comfortably inside what an auditor CLI needs, and is unlikely to grow much with n since verification cost is near-constant in UltraHonk.

---

## 6.6 Multi-sender aggregate circuit — built and measured

Option D from §5 is implemented in [`circuits/`](circuits/) and measured. It resolves the fan-out fragmentation problem: **one proof spans every funder account in a round.**

| n | ACIR opcodes | Prove | Verify | Proof size | Public inputs |
|---:|---:|---:|---:|---:|---:|
| 8 | 323 | 996 ms | 379 ms | 14,592 B | 80 |
| 16 | 619 | **1,716 ms** | 589 ms | **14,592 B** | 152 |
| 64 | 2,395 | 4,887 ms | 1,459 ms | 14,592 B | 584 |

Witnesses spanned **5 distinct sender accounts** round-robin across events; every proof verified. Scaling is linear at ~35 ACIR opcodes and ~70 ms per event over a fixed base; public inputs are `9n + 8`.

**The load-bearing result: proof size is constant at 14,592 B for every n.** A 64-recipient round proves in the same bytes as an 8-recipient one, and the donor's verification cost barely moves. Aggregation is effectively free on the wire — which is what makes the differentiator practical rather than merely possible.

Three findings came out of building it:

**A circuit whose capacity is below the safety floor can never prove.** The first family was `n ∈ {4,16,64}` with `MIN_ACTIVE = 5`; `n=4` was structurally unprovable. The family now starts at 8 and the generator refuses to emit a sub-floor circuit. Caught by the negative test, not by reasoning.

**The safety floor belongs in the circuit, not the SDK.** `n_active >= MIN_ACTIVE` is a constraint and `n_active` is a public input, so bypassing the SDK cannot silently produce a one-event "aggregate", and the disclosure recipient reads the true set size rather than trusting a claim. See [docs/SDK-SAFETY-INVARIANTS.md](docs/SDK-SAFETY-INVARIANTS.md) §I2.

**The upstream lib changed `ecdh` under us — a live instance of the Phase 0 "interface may change" risk.** Between the demo's pinned `539968f` and branch tip `98090b3`:

```rust
// 539968f — deployed contracts + TS SDK
pub fn ecdh(scalar, point) -> Field { scalar_mul(scalar, point).x }

// 98090b3 — tip: Poseidon2 funnel over BOTH coordinates
pub fn ecdh(scalar, point) -> Field {
    let s = scalar_mul(scalar, point);
    poseidon_with_domain(domain::ECDH_SHARED_SECRET, [s.x, s.y])
}
```

A circuit compiled against the tip cannot recover amounts from events produced at the pinned rev. It surfaced as an unsatisfiable constraint — the loud failure. `SDK.md` §8.1 describes the quiet one, where drift yields mismatched verification keys "while every local test passes." Tally now pins upstream as a submodule at `539968f`. The tip's change is a genuine security hardening (it removes the `(P, −P)` negation invariance of x-only extraction) and should be adopted, but only as a coordinated move of contracts, VKs, and SDK crypto together.

**Separately:** the demo's single-event disclosure circuits hardcode `δ_disc = 13`, which is `δ_ecdh`'s value. The normative table (`DESIGN_cont.md` §13) assigns `δ_disc = 16` and `δ_disc_bind = 15`, and requires all sixteen tags be distinct and each confined to one sponge mode. Tally's circuit uses the specified `δ_disc_bind = 15`. To report upstream.

---

## 6.7 Demo sizing — proposed n = 16

The brief's "at least 10 recipients" was written when batch size was believed to be the binding constraint. It no longer is, and 10 is now the weakest defensible point of the whole demo: it is where the *privacy* claim is thinnest, not where the throughput claim is.

**Proposal: run the demo at n = 16.** It satisfies the brief literally ("at least 10") while fixing what changed underneath it.

| Candidate | Anonymity set | Circuit fit | Verdict |
|---:|:---|:---|:---|
| 1 | none — the aggregate **is** the amount | — | Below the floor; unprovable |
| 5 | minimum meaningful | `n=8`, 3 slots padded | The floor, not a target |
| **10** | workable but thin | `n=16`, **6 slots padded** | Meets the brief, weakest claim, wasteful padding |
| **16** ✅ | **3.2× the floor** | **`n=16`, exact fit, zero padding** | **Recommended** |
| 64 | strongest | `n=64`, exact fit | ~82 s of transfers; more setup than a demo needs |

**Why 16.**

- **3.2× the floor.** To pin any single recipient's amount, a donor must already know the other 15. At n=10 they need only 9, and at the K=10 fan-out we nearly shipped, zero.
- **Exact circuit fit.** 16 is a family size, so no slots are padded — the demo exercises the real path with nothing to explain away.
- **Realistic.** 16 contributors in a grant or bounty round is an ordinary number, which matters for a demo meant to read as a product rather than a benchmark.
- **Still comfortably fast.** See below.

### Round timing at n = 16, K = 5 lanes

| Phase | Transactions | Wall clock | Frequency |
|:---|---:|---:|:---|
| Recipient registration (16) | 16 | ~6 s (parallel — distinct source accounts) | one-time per recipient |
| Lane registration (5) | 5 | ~6 s (parallel) | one-time, reused every round |
| Lane funding (deposit + merge) | 10 | ~50 s (serialised on one funder source account) | one-time if lanes hold float |
| **Transfers (16 across 5 lanes)** | **16** | **~25 s** (⌈16/5⌉ = 4 waves × 6.3 s) | **per round** |
| Aggregate proof (n=16) | 0 | **1.7 s** | per disclosure |
| Donor verification | 0 | **0.6 s** | per disclosure |
| **Steady-state round + proof + verify** | **16** | **~27 s** | |

Cost: 16 × ~93M = **~1.49B instructions**, roughly **0.5 XLM** in resource fees.

The demo therefore shows: 16 recipients paid with no amounts visible on any explorer, one 14,592-byte proof, and a donor verifying the exact total in under a second — having handed over nothing but a public key and a nonce.

### Wording for the SCF submission

Say **"16 recipients in one disbursement round — 16 transactions"**. Not "one transaction": that is measurably false (§2), and a reviewer who tries it will find out. Volunteering the transaction count alongside the measured instruction cost is the stronger move — it is the number that makes the SLP-0004 roadmap line land (§6).

---

## 6.8 Is the aggregate proof ever verified ON-CHAIN? — measured

**Answer: no. Scope the product as off-chain donor verification.** The on-chain path is not merely expensive — at our demo size it lands within 0.017% of the transaction cap, which is not an engineering position anyone should build on.

Measured by registering each `tally_aggregate_nN` verification key into an unused circuit slot on the testnet verifier and simulating `verify_proof(slot, publicInputs, proof)`:

| n | Public inputs | Public-input bytes | CPU instructions | % of 100M cap | Tx size | Verifies? | Fits? |
|---:|---:|---:|---:|---:|---:|:---:|:---:|
| 8 | 80 | 2,560 B | 90,833,858 | **90.8%** | 17,452 B | ✅ true | barely |
| **16** | 152 | 4,864 B | **99,982,874** | **100.0%** | 19,756 B | ✅ true | **17,126 instructions of margin** |
| 64 | 584 | 18,688 B | 147,278,890 | **147.3%** | 33,580 B | ✅ true | ❌ **no** |

All three verified `true` on-chain, so the circuits and VKs are sound against the deployed Nethermind backend — this is a capacity result, not a correctness one.

**n = 16 has 17,126 instructions of headroom out of 100,000,000.** That is 0.017%. And this is the *bare* `verify_proof` call: a real on-chain consumer would also read the round registry, check state, and emit events — the `confidential_transfer` measurement (§2) shows the token contract's own logic costs ~9M instructions around a verification. Adding any of that pushes even **n = 8** over the cap.

### The cost model this yields

Fitting the three points gives a clean linear model for on-chain UltraHonk verification on Soroban:

```
instructions ≈ 81,000,000  +  ~120,000 per public input
```

(Marginal cost measured at ~127k/input over n=8→16 and ~109k/input over n=16→64.)

Cross-checking against §2: the `transfer` circuit has 24 real public inputs (its VK reports 40, of which 16 are fixed pairing-point inputs), predicting ~83.9M for verification. `confidential_transfer` measured 93.0M total, leaving ~9M for the token contract's state reads, Grumpkin point arithmetic and event emission — consistent with `merge` at 2.4M plus the extra work. The model holds.

**No public source states either figure.** Both are worth publishing.

### What this settles

- **Aggregate verification is off-chain, permanently** — not "for now". Even a 4× instruction cap (SLP-0004) only lifts n=64 from 147% to 37% of a larger budget, but the *architecture* has no reason to move on-chain: the disclosure layer is off-chain by design (`SELECTIVE_DISCLOSURE.md` §5.4), and putting it on-chain would publish the disclosure's existence, recipient, and timing — destroying the property that makes it useful.
- **The on-chain round registry is now load-bearing, not optional.** It is the only mechanism supplying **completeness** — the disclosure layer proves positive statements only (§1.4: "It does not prove negatives"). The registry makes the round's event set publicly enumerable from chain state, so the donor can verify the aggregate covers *exactly* that set. Without it, a funder could disclose a favourable subset.
- **The product boundary is now precise:** proofs verified **off-chain by the donor**, completeness anchored **on-chain by the registry**. Both halves are needed; neither is a fallback.

This is the answer to "is the aggregate ever verified on-chain" — asked before building fan-out, and it does not change the fan-out design, but it does fix the product scope.

---

## 7. Open items

| Item | Status |
|:---|:---|
| ~~Build the multi-sender aggregate circuit (Option D)~~ | ✅ **Done** — `circuits/`, measured in §6.6. One proof spans 5 sender accounts; 14,592 B at every n. |
| Validate K-lane fan-out end to end on testnet | **Next.** Unblocked — the circuit spans lanes, so K is now purely a latency knob. |
| ~~Decide on-chain vs off-chain aggregate verification~~ | ✅ **Off-chain, settled by measurement** — §6.8. n=16 leaves 0.017% headroom; n=64 needs 147% of the cap. |
| Wire the aggregate into an auditor CLI (§3.3 of the brief) | After fan-out |
| ~~Report the `δ_disc = 13` / `δ_ecdh` collision~~ | ✅ Filed — [demo#5](https://github.com/brozorec/stellar-confidential-token-demo/issues/5). Scoped accurately: correct at the pinned rev, becomes a real collision only on rebuild against the tip. |
| Confirm the 17 KB tx-size gap is auth-entry duplication | Low priority; moot while instructions bind |
| Track SLP-0004's 400M instruction limit | Would raise N from 1 → 4. Status *Final*; not yet live on testnet (Protocol 27 measured here still enforces 100M). Worth asking SDF when it ships. |
| Upstream spec gap filed | ✅ [OpenZeppelin/stellar-contracts#849](https://github.com/OpenZeppelin/stellar-contracts/issues/849) — §10 `PVK_B,i` omission, plus the multi-account question from §5 |
| ~~Measure `disclose_sender` proof time~~ | ✅ Done — **860 ms** at n=1 (§6.5) |
| Measure the aggregate family at n ∈ {4,16,64} | After the circuit exists; do not extrapolate from the n=1 baseline |
| Measure `set_spender` / `confidential_transfer_from` | Only if Option B is pursued |

---

## 8. Reproducing

```bash
git clone --branch feat/confidential-verifier-ultrahonk --single-branch \
  https://github.com/OpenZeppelin/stellar-contracts
git clone https://github.com/brozorec/stellar-confidential-token-demo demo
cd demo && pnpm install && pnpm build:contracts
stellar keys generate admin --network testnet --fund
pnpm deploy:contracts
pnpm --filter @ctd/sdk exec tsx ../../scripts/measure.ts
```

The harness (`scripts/measure.ts`) is throwaway instrumentation, kept in the scratchpad rather than the project repo. It should be reworked into a proper benchmark in our own repo, since these numbers need re-measuring on every OZ branch bump and on any protocol upgrade.

**Toolchain used:** rustc 1.97.1 · stellar-cli 27.1.0 · soroban-sdk 26.0.0 · node 24.11.1 · `@aztec/bb.js` 0.87.0 · `@noir-lang/noir_js` 1.0.0-beta.9 · target `wasm32v1-none`.
