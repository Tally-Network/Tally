# Tally

**Confidential disbursement on Stellar.** One funder pays many recipients; individual amounts stay private, while the round's **total is cryptographically provable** to a donor or auditor on demand.

Built on Stellar's [Confidential Tokens](https://stellar.org/blog/developers/developer-preview-confidential-tokens-on-stellar) developer preview (OpenZeppelin contract suite, Nethermind UltraHonk verifier), which gives any SEP-41 token private balances and private transfer amounts while keeping addresses visible.

> **Status: pre-MVP, testnet only.** The underlying confidential-token suite is an unaudited developer preview on an unmerged feature branch. Do not use with real value.

## The problem

On a public ledger, every recipient's amount is visible forever. For grant programs, bounty platforms, public-goods funding, and aid disbursement that is disqualifying — it exposes vulnerable recipients and makes them targets. But the alternative, paying off-chain, gives up the auditability that made on-chain funding attractive in the first place.

Tally keeps both: **amounts private, total provable.**

## How the proof works

The donor is never given a secret. They generate their own disclosure keypair `(r_R, P_R)`, issue a fresh challenge nonce `ν`, and receive a zero-knowledge proof sealed to their key that reveals **only** the aggregate.

> The funder's viewing key is **never** shared. It would recompute every ephemeral scalar the funder ever used, opening every individual amount retroactively — including commitments inside recipients' balances. Challenge–response is the only supported model.

## What the proof does and does not assure

**The donor is assured that** the confidential transfers sent from the lane accounts Tally declared on-chain before the round opened, within that round's declared ledger window, total exactly the disclosed amount and that none has been withheld — because every confidential transfer publishes its sender address on-chain whether or not the funder chooses to disclose it, so an omitted transfer is visible as one the proof fails to cover.

**This does not assure** that the funder made no other payments, nor that the recipients are independent of the funder: the guarantee is scoped to transfers from the accounts declared before the round, **not to the funder's total spend**, and it establishes what amounts moved, not who ultimately controls the accounts that received them.

See [docs/TRUST-STATEMENT.md](docs/TRUST-STATEMENT.md) for why it is worded this way and the rules for public copy.

## What's here

| Path | |
|:---|:---|
| [`circuits/`](circuits/) | Multi-sender aggregate disclosure circuits (Noir/UltraHonk), `n ∈ {8,16,64}` |
| [`contracts/round-registry`](contracts/) | On-chain lane set + window declaration — the completeness anchor |
| [`docs/TRUST-STATEMENT.md`](docs/TRUST-STATEMENT.md) | Exactly what the proof does and does not assure |
| [`docs/SDK-SAFETY-INVARIANTS.md`](docs/SDK-SAFETY-INVARIANTS.md) | Properties whose violation is invisible on-chain |
| [`PHASE0-FINDINGS.md`](PHASE0-FINDINGS.md) | Investigation of the confidential-token preview |
| [`PHASE1-MEASUREMENTS.md`](PHASE1-MEASUREMENTS.md) | Testnet measurements |
| `vendor/stellar-contracts` | OZ suite, pinned at `539968f` |

## Measured on testnet

Numbers we published because nobody else had. Full method and transaction hashes in [PHASE1-MEASUREMENTS.md](PHASE1-MEASUREMENTS.md).

| | |
|:---|---:|
| `confidential_transfer` CPU cost | **~93,000,000 instructions** (93% of the 100M per-tx cap) |
| **Max transfers per transaction** | **1** — batching is impossible today |
| Transfer proof generation | ~1.26 s |
| Aggregate proof over 16 transfers | 1.72 s, **14,592 B** |
| Fan-out: 16 transfers across 5 lanes | 41.6 s (2.4× vs serial), one proof |

Transaction size is *not* the constraint — instructions are, at 93% utilisation. [SLP-0004](https://github.com/stellar/stellar-protocol/blob/master/limits/slp-0004.md) raises that cap 4×, which would take max-N from 1 to 4 with no change on our side.

## Contributing upstream

- [OpenZeppelin/stellar-contracts#849](https://github.com/OpenZeppelin/stellar-contracts/issues/849) — `SELECTIVE_DISCLOSURE.md` §10's aggregate input table omits `PVK_B,ᵢ`, plus a scope question on multi-account aggregates.

## License

MIT. Built in the open.
