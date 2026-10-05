# Tally contracts

## `round-registry`

The on-chain half of the completeness story. It records **which sender accounts count** for a disbursement round and **over what ledger window** — and nothing else.

Deployed (testnet, soroban-sdk 28.0.0, 2026-10-05): [`CDWIXFBOR5DB4UVQXYL3VY7OQZNUAWAVEPSKKTNH3R5XI6CJ2IS7BK7W`](https://stellar.expert/explorer/testnet/contract/CDWIXFBOR5DB4UVQXYL3VY7OQZNUAWAVEPSKKTNH3R5XI6CJ2IS7BK7W). The August deployment `CCKWYTHG…R3ES` (soroban-sdk 26) is retired.

```
open_round(funder, round_id, lanes[])  -> Round    // stamps opened_at from the ledger
close_round(funder, round_id)          -> Round    // stamps closed_at
get_round(funder, round_id)            -> Round
is_lane(funder, round_id, who)         -> bool
```

### It records the lane set, not the transfers

Per-transfer registration would be worse than useless: a funder could simply decline to record one, which is the cherry-picking it appears to prevent. It is also unnecessary — `Transfer.from`/`.to` are **topic-indexed** and emission is unconditional inside `confidential_transfer`, so a donor enumerates the round's transfers straight from chain events and a withheld transfer surfaces as a set mismatch. See [PHASE1-MEASUREMENTS.md](../PHASE1-MEASUREMENTS.md) §6.9.

### Enforced, not documented

The constraint that matters is that **a declaration cannot be backdated, extended, or revised after the fact** — otherwise cherry-picking moves one level up: run the round, then declare only the flattering lanes.

| Constraint | Enforcement |
|:---|:---|
| `opened_at` is the true ledger | Stamped from `e.ledger().sequence()`. Not a parameter — a caller cannot supply or backdate it. |
| Lane set is immutable | Written once; no mutator exists. |
| A round is declared once | `open_round` rejects a `round_id` already used **by that funder**. |
| A round id cannot be squatted | Rounds are **namespaced by funder**. Round ids are meant to be published, so they are predictable by construction; under a global namespace an adversary could occupy an announced id for one transaction fee and deny it to the funder permanently. Namespacing also makes ownership structural — resolving under a funder's namespace cannot return another account's round, so correctness no longer depends on a donor remembering to check `round.funder`. |
| A round closes once, by its funder | `close_round` resolves the caller's own namespace and rejects a second close. A foreign caller finds nothing. |
| Lanes distinct and non-empty | Rejected at declaration; a duplicate would let one transfer be counted twice. |

Because both ends of the window are contract-stamped and the lane set is immutable, the donor's rule — *reject any covered event outside `[opened_at, closed_at]` or from a sender not in `lanes`* — is sound against a funder who controls every other input.

### What it cannot do

It cannot observe the token, so it cannot stop a funder transferring from an **undeclared** account. That limit is inherent and is stated in [docs/TRUST-STATEMENT.md](../docs/TRUST-STATEMENT.md) rather than papered over.

### Tests

16 tests, **10 of them negative** — every enforced constraint has a test proving it *rejects* the violation, not merely that the happy path works.

```bash
cd contracts && cargo test -p tally_round_registry
stellar contract build          # -> target/wasm32v1-none/release/tally_round_registry.wasm
```
