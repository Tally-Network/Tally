# Tally aggregate-disclosure circuits

`tally_aggregate_nN` — a **multi-sender** D-sender aggregate disclosure circuit. It proves to a designated disclosure recipient that a set of on-chain confidential transfers, originated by accounts the prover controls, sums to exactly `V_total` — **without revealing any individual amount**.

Verified entirely **off-chain**. These circuits do not register with the on-chain verifier, so their verification keys never go on-chain.

## How it extends the spec

`SELECTIVE_DISCLOSURE.md` §10 sketches aggregate disclosure but is written for the D-recipient shape. Tally extends it twice — both raised upstream in [OpenZeppelin/stellar-contracts#849](https://github.com/OpenZeppelin/stellar-contracts/issues/849):

| | §10 as written | Tally |
|:---|:---|:---|
| `PVK_B` | absent from the per-event list | **per-event** — outbound aggregates have a different recipient per event |
| `PVK_A` / `sk` | **common** — pins an aggregate to one sender account | **per-event** — one proof spans every funder account in a round |
| `n_active` | not present | **public input** — the anonymity set is cryptographically bound, not asserted by the SDK |
| floor | not present | **in-circuit** `n_active >= MIN_ACTIVE` |

Vectorising `PVK_A` is what makes concurrency safe. Sends from a single account serialise (each spend replaces `C_spend`), so parallelism requires a fan-out across accounts — and one-proof-per-account leaks per-account subtotals, which at small per-account counts approaches full per-recipient disclosure. Spanning accounts in one proof decouples concurrency from privacy entirely.

## Measured

Proved and locally verified with `bb.js` 0.87.0 in **zero-knowledge mode** (`keccakZK`), witnesses spanning **5 distinct sender accounts** round-robin across events.

Disclosure circuits are verified off-chain by the donor, so the on-chain verifier's non-zk-only limitation (OZ `SDK.md` §8.1) does not bind them — and must not, since a non-zk proof is succinct but not witness-hiding, and the whole claim is that the artifact reveals only the total.

| n | ACIR opcodes | Prove | Verify | Proof size | Public inputs |
|---:|---:|---:|---:|---:|---:|
| 8 | 323 | 1,261 ms | 379 ms | 16,224 B | 80 |
| 16 | 619 | 1,942 ms | 589 ms | 16,224 B | 152 |
| 64 | 2,395 | 6,088 ms | 1,459 ms | 16,224 B | 584 |

Scaling is linear: ~**35 ACIR opcodes** and ~**70 ms** per event, over a fixed base. Public inputs are `9n + 8`.

**Proof size is constant at 16,224 B regardless of `n`** — a 64-recipient round proves in the same bytes as an 8-recipient one. That is the property that makes this practical. (Non-zk would be 14,592 B; zero-knowledge costs +1,632 B and ~50 ms, and is not optional here.)

## Safety

`MIN_ACTIVE` (default 5) is enforced **as a circuit constraint**, so an under-sized aggregate is unprovable rather than merely discouraged, and `n_active` is a public input so the disclosure recipient sees the true set size. See [docs/SDK-SAFETY-INVARIANTS.md](../docs/SDK-SAFETY-INVARIANTS.md) §I2.

A circuit with `N < MIN_ACTIVE` can never prove, so the generator refuses to emit one — which is why the family starts at `n = 8`.

## Building

Requires `nargo 1.0.0-beta.9` and the pinned submodule.

```bash
git submodule update --init          # vendor/stellar-contracts @ 539968f
bash circuits/scripts/generate.sh    # regenerate the family from _template.nr
cd circuits/aggregate_n16 && nargo compile
```

`MIN_ACTIVE` and `SIZES` are environment overrides on the generator:

```bash
MIN_ACTIVE=8 SIZES="16 32" bash circuits/scripts/generate.sh
```

**Do not edit `aggregate_n*/src/main.nr` directly** — they are generated. Edit `_template.nr`.

The upstream revision is pinned deliberately; see [docs/SDK-SAFETY-INVARIANTS.md](../docs/SDK-SAFETY-INVARIANTS.md) §I3 for what breaks otherwise.
