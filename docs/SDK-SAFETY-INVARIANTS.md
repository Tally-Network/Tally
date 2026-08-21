# Tally SDK — Safety Invariants

> See also [`CONTRIBUTING.md`](../CONTRIBUTING.md) — *an inherited default is true in its original context and can be false one level away*. Both cryptographic errors this project has shipped had that shape, including a false claim about the core guarantee that reached a public page.

These are the properties whose violation **cannot be detected from chain data**. Each fails silently: the system keeps working, the proofs keep verifying, and the guarantee is gone. They are grouped here because they share that failure mode and therefore need the same treatment — enforced in code, covered by a hard test, and never left to caller discipline.

Ordinary bugs surface. These do not. Treat them as a distinct class.

---

## I1 — Deterministic ephemeral scalar (`r_e`)

**Invariant.** Every transfer Tally originates MUST derive its ephemeral scalar as

```
r_e = poseidon_with_domain(δ_eph, [vk, σ_E])        δ_eph = 14
```

and MUST NOT supply a random one.

**Why.** The funder's ability to prove anything about a past transfer depends on recovering `r_e` at disclosure time. Deterministic derivation means `r_e` is recomputable from the master secret plus the on-chain salt, so aggregates stay provable retroactively over any historical round, and losing local state costs nothing. A random `r_e` is unrecoverable the moment it leaves memory.

**Why it is silent.** OZ `SDK.md` §10.5, third consequence:

> "Disclosability is unverifiable from chain data. No on-chain value distinguishes an ephemeral this derivation produced from one it did not… Transfers predating this specification may not be disclosable by their sender."

The transfer succeeds. The event looks identical. The funds move correctly. The transfer is simply **permanently unprovable**, and nothing anywhere says so until a donor asks for an aggregate that can no longer be produced.

**The specific hazard.** The reference SDK's transfer witness builder takes `r_e` as an *optional override*:

```ts
// packages/sdk/src/witness/transfer.ts
const rE = p.rE ?? deriveEphemeralRE(keys.vk, sigma);
```

The default is correct. The override is a loaded gun: passing `p.rE` is a one-token change that silently destroys disclosability for that transfer, forever.

**Enforcement.**
1. Tally's transfer path MUST NOT expose an `rE` parameter at all. Not defaulted — **absent**.
2. A test MUST assert that a transfer's emitted `R_e` equals `deriveEphemeralRE(vk, σ)·H`.
3. The auditor CLI MUST **test** disclosability per event rather than assume it (`SDK.md` §12.2), and report any event it cannot prove.

---

## I2 — Minimum anonymity set for aggregates

**Invariant.** An aggregate disclosure MUST NOT be produced over fewer than `MIN_ACTIVE` events (default **5**), and the effective set size MUST be visible to the disclosure recipient.

**Why.** An aggregate conceals individual amounts only insofar as it sums several of them.

| Events in aggregate | What the donor learns |
|---:|:---|
| 1 | **The amount itself.** The "aggregate" is the transfer. |
| 2 | Either amount, given the other. One subtraction. |
| 5 | A sum over five — meaningful concealment begins |
| 16 | Comfortable for a disbursement round |

**Why it is silent.** A proof over one event is a *perfectly valid proof*. It verifies. Nothing in the bundle, the chain, or the verifier's output announces that the privacy guarantee has collapsed to zero. This is exactly how the K-lane fan-out nearly shipped a full disclosure: splitting 10 recipients across 10 lanes yields ten one-event "aggregates", which is simply publishing every amount. See [PHASE1-MEASUREMENTS.md](../PHASE1-MEASUREMENTS.md) §5.

**Enforcement — in the circuit, not just the SDK.**

1. **The floor is a constraint.** `aggregate_nN` asserts `n_active >= MIN_ACTIVE`. Bypassing the SDK does not bypass the floor; an under-sized aggregate is *unprovable*, not merely discouraged.
2. **The set size is a public input.** `n_active` is bound into the proof, so the disclosure recipient reads the exact number of events the total was taken over and can apply a stricter floor of their own. The anonymity set is a cryptographic fact, not an SDK claim.
3. **Family capacity respects the floor.** A circuit with `N < MIN_ACTIVE` can never prove, so `circuits/scripts/generate.sh` refuses to emit one. This is why the family starts at `n = 8`.
4. **The SDK MUST surface the effective set size to the caller** before producing a disclosure, and MUST refuse below the floor with a typed error rather than a generic proof failure.

**Verifier obligations** (beyond `SELECTIVE_DISCLOSURE.md` §5.3), since the circuit cannot see these:

- **Reject duplicate event references among active slots.** The circuit cannot detect that the same event was supplied twice; counting one event twice inflates the total.
- Resolve every `PVK_A,ᵢ` from `Eᵢ.from` and `PVK_B,ᵢ` from `Eᵢ.to` — never from the bundle.
- Apply any stricter floor on `n_active` the recipient's own policy requires.

---

## I3 — Pinned upstream revision (build invariant)

**Invariant.** Circuits, contracts, and SDK crypto MUST all be built against **the same** `OpenZeppelin/stellar-contracts` revision — currently `539968f`, pinned as a git submodule at `vendor/stellar-contracts`.

**Why it is silent — and why this one is not hypothetical.** It bit during development. Between the demo's pinned `539968f` and the branch tip `98090b3`, the shared Noir library changed `ecdh`:

```rust
// 539968f — what the deployed contracts and the TS SDK use
pub fn ecdh(scalar: Field, point: EmbeddedCurvePoint) -> Field {
    scalar_mul(scalar, point).x
}

// 98090b3 — branch tip: Poseidon2 funnel over BOTH coordinates
pub fn ecdh(scalar: Field, point: EmbeddedCurvePoint) -> Field {
    let s = scalar_mul(scalar, point);
    poseidon_with_domain(domain::ECDH_SHARED_SECRET, [s.x, s.y])
}
```

A circuit compiled against the tip cannot reconstruct amounts from events produced by contracts built at `539968f` — the shared secret differs. Here it surfaced loudly as an unsatisfiable constraint, which is the *lucky* outcome; `SDK.md` §8.1 warns of the quiet version, where drift yields verification keys that differ from the deployed ones "while every local test passes."

**Note.** The tip's change is a *security hardening* — the Poseidon funnel removes the `(P, −P)` negation invariance of x-only extraction. Tally must adopt it. It is tracked as a named milestone, not an intention:

### Milestone U1 — Upstream revision uplift

**Move `vendor/stellar-contracts` from `539968f` to the then-current upstream revision, in one coordinated change.**

Everything below moves together or not at all; a partial uplift is the silent-failure case this invariant exists to prevent.

| Component | Action |
|:---|:---|
| Contracts | Rebuild + redeploy the token, verifier, and auditor contracts |
| On-chain VKs | Regenerate all six core circuit VKs; re-register in the verifier |
| Tally circuits | Recompile the aggregate family against the new lib (`ecdh` changes shape) |
| Disclosure VKs | Regenerate; re-pin |
| SDK crypto | Update `ecdh` to the Poseidon2 funnel; re-run the parity vectors (`SDK.md` §6) |
| Domain tags | Adopt `δ_disc = 16` / `δ_disc_bind = 15` (see the upstream note below) |
| Evidence | Re-run every Phase 1 measurement — instruction costs will move |

**Exit criteria.** Full testnet e2e green; disclosure e2e green; the §6.8 on-chain capacity numbers re-measured; `PHASE1-MEASUREMENTS.md` updated.

**Why it is scheduled rather than deferred.** SCF expects the most recent stable Stellar stack, and a reviewer who notices we are pinned to an older revision of an unmerged branch will ask. The answer should already be written down: we pin deliberately because the deployed contracts, VKs, and SDK crypto must agree, we have demonstrated what breaks when they don't (§6.6), and the uplift is a scheduled milestone with defined exit criteria — not drift.

**Sequencing.** Best run *after* the demo evidence is captured and *before* submission, so the recorded transaction hashes and the pinned revision describe the same system.

---

## Related upstream defect (not a Tally invariant)

The reference demo's single-event disclosure circuits hardcode `δ_disc = 13`, which is `δ_ecdh`'s value in the normative table (`DESIGN_cont.md` §13, which assigns `δ_disc = 16` and `δ_disc_bind = 15`). That table states all sixteen values "MUST still be distinct and each MUST be confined to a single sponge mode."

Tally's aggregate circuit uses the specified `δ_disc_bind = 15`. To be reported upstream.
