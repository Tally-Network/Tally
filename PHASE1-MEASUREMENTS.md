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

Still achievable and still honest — **one flow, 10 transactions**, ~13 s wall-clock at K=5 with the multi-sender circuit (or ~63 s single-lane). Note K=10 must **not** be used for a 10-recipient demo: it collapses the aggregate into per-recipient disclosure (§5). It must **not** be described as one transaction. Given the measurements, I'd state the transaction count openly on the landing page: a reviewer who tries it will find out anyway, and volunteering it reads as rigour.

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

## 7. Open items

| Item | Status |
|:---|:---|
| Build the **multi-sender aggregate circuit (Option D)** | **Now the gating task.** Fan-out code must not be written until this is sound — see §5. |
| Validate K-lane fan-out end to end | Blocked on Option D; K is only a latency knob once the circuit spans lanes |
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
