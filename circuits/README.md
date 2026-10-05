# Tally aggregate-disclosure circuits

`tally_aggregate_nN` — a **multi-sender** D-sender aggregate disclosure circuit. It proves to a designated disclosure recipient that a set of on-chain confidential transfers, originated by accounts the prover controls, sums to exactly `V_total` — **without revealing any individual amount**.

Verified entirely **off-chain**. These circuits do not register with the on-chain verifier, so their verification keys never go on-chain. (They *would* fit under today's 400M instruction cap — n = 64 uses 37.7 % — but on-chain verification would publish that a disclosure happened and would force non-zk proofs; see [MEASUREMENTS.md](../MEASUREMENTS.md).)

Built against OpenZeppelin stellar-contracts **v0.9.0** (`df602b6`), whose shared Noir library binds the ECDH shared secret to the full point (`Poseidon2(δ_ecdh, S.x, S.y)`, #778).

## How it extends the spec

OpenZeppelin's aggregate disclosure (`docs/selective-disclosure/circuits/aggregate.md` at v0.9.0; `SELECTIVE_DISCLOSURE.md` §10 when this was written) is written for the D-recipient shape. Tally extends it twice — both raised upstream in [OpenZeppelin/stellar-contracts#849](https://github.com/OpenZeppelin/stellar-contracts/issues/849):

| | Upstream as written | Tally |
|:---|:---|:---|
| `PVK_B` | absent from the per-event list | **per-event** — outbound aggregates have a different recipient per event |
| `PVK_A` / `sk` | **common** — pins an aggregate to one sender account | **per-event** — one proof spans every funder account in a round |
| `n_active` | not present | **public input** — the anonymity set is cryptographically bound, not asserted by the SDK |
| floor | not present | **in-circuit** `n_active >= MIN_ACTIVE` |

Vectorising `PVK_A` is what makes concurrency safe. Sends from a single account serialise (each spend replaces `C_spend`), so parallelism requires a fan-out across accounts — and one-proof-per-account leaks per-account subtotals, which at small per-account counts approaches full per-recipient disclosure. Spanning accounts in one proof decouples concurrency from privacy entirely.

## Measured

Proved and locally verified with `bb.js` 0.87.0 in **zero-knowledge mode** (`keccakZK`), witnesses spanning **5 distinct sender accounts** round-robin across events.

Disclosure circuits are verified off-chain by the donor, so the on-chain verifier's non-zk-only limitation (OZ v0.9.0 `circuits/vks/README.md`: "Do not pass `--zk`") does not bind them — and must not, since a non-zk proof is succinct but not witness-hiding, and the whole claim is that the artifact reveals only the total.

Re-measured 2026-10-05 on v0.9.0 (`nargo info`; `pnpm bench:aggregate` on an Apple M4 Pro, second run after warm-up):

| n | ACIR opcodes | Prove | Verify | Proof size | Public inputs |
|---:|---:|---:|---:|---:|---:|
| 8 | 332 | 1,163 ms | 380 ms | 16,224 B | 80 |
| 16 | 636 | 1,891 ms | 581 ms | 16,224 B | 152 |
| 64 | 2,460 | 5,983 ms | 1,472 ms | 16,224 B | 584 |

Scaling is linear: ~**38 ACIR opcodes** and ~**85 ms** per event, over a fixed base. Public inputs are `9n + 8`. (The August figures were 323 / 619 / 2,395 opcodes; the difference is the extra Poseidon2 per ECDH in v0.9.0.)

**Proof size is constant at 16,224 B regardless of `n`** — a 64-recipient round proves in the same bytes as an 8-recipient one. That is the property that makes this practical. (Non-zk would be 14,592 B; zero-knowledge costs +1,632 B and ~50 ms, and is not optional here.)

## Safety

`MIN_ACTIVE` (default 5) is enforced **as a circuit constraint**, so an under-sized aggregate is unprovable rather than merely discouraged, and `n_active` is a public input so the disclosure recipient sees the true set size. See [docs/SDK-SAFETY-INVARIANTS.md](../docs/SDK-SAFETY-INVARIANTS.md) §I2.

A circuit with `N < MIN_ACTIVE` can never prove, so the generator refuses to emit one — which is why the family starts at `n = 8`.

## Building

Requires `nargo 1.0.0-beta.11` (the version OpenZeppelin v0.9.0 pins) and the submodule.

```bash
git submodule update --init          # vendor/stellar-contracts @ df602b6 (v0.9.0)
pnpm build:circuits                  # generate from _template.nr, compile, copy circuit.json, re-pin vk.zk.bin
```

The compiled `aggregate_n*/circuit.json` and `vk.zk.bin` are committed, so verifying a round needs no Noir toolchain. CI rebuilds both and fails on any difference.

`MIN_ACTIVE` and `SIZES` are environment overrides on the generator:

```bash
MIN_ACTIVE=8 SIZES="16 32" bash circuits/scripts/generate.sh
```

**Do not edit `aggregate_n*/src/main.nr` directly** — they are generated. Edit `_template.nr`.

The upstream revision is pinned deliberately; see [docs/SDK-SAFETY-INVARIANTS.md](../docs/SDK-SAFETY-INVARIANTS.md) §I3 for what breaks otherwise.
