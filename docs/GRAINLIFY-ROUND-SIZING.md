# Grainlify payout sizing — what the real distribution is

**Asked:** if typical Grainlify rounds are 1–5 contributors, the aggregate is unprovable by design and the flagship integration never produces the proof the product is about.

**Answer: there is no distribution, because Grainlify has never made a payout.** Its own docs say so, in the strongest terms:

> **Nothing on the platform disburses funds.** No payout has ever been made on any chain. Nothing in this codebase can currently move money, and several things that look like they can, cannot.
> — `Grainlify-Docs`, *Payout path — what exists today*, 18 Aug 2026

So the question cannot be answered from history. It can be answered from the two payout shapes Grainlify has actually designed, and they point in opposite directions.

## First, a correction to the premise

**The floor is `MIN_ACTIVE = 5`, not 8.** `N = 8` is the smallest circuit *capacity*; a round of 5, 6, 7 or 8 recipients pads into `aggregate_n8` and proves normally. Only rounds of **1–4** are unprovable. That materially narrows the problem.

## Shape 1 — Founding Contributor Pool ✅ the flagship

> "One fixed amount of USDC, set aside and announced up front, divided once at the end of the first GrainHack." — `rewards.md`

- **Inherently many-recipient.** Every contributor who earned shares receives a line; `founding.DryRun` already computes all of them and asserts the lines sum to the pool exactly.
- Shares accrue at 5 per merged PR, uncapped, and the leaderboard tiers run to "500+" — the contributor base is designed for hundreds, not single digits.
- **One dated event**, which maps exactly onto a round: `open_round` → disburse → `close_round`.

This is a large-`n` single round. The aggregate is meaningful by construction, with no batching gymnastics.

## Shape 2 — Bounty escrow ⚠️ n = 1 per call

`release_funds(bounty_id, contributor)` takes **one** contributor. Per-bounty releases are n = 1 and can never be aggregated as-is — this is the case the question was worried about, and it is real.

## Recommendation

**Target the Founding Contributor Pool as the flagship integration.** It is the payout Grainlify actually intends to make first, it is inherently large-`n`, and it is a single dated event that maps cleanly onto a round.

**For bounty releases, batch on a fixed weekly cadence** rather than per bounty. Grainlify is already moving this way for its own reasons — its `bulk-release-optimization` work exists because per-entry releases are expensive, and it reports storage ops dropping from 101 to 2 for a 50-milestone batch. A weekly settlement round therefore aligns with a direction they already have, rather than imposing one on them.

Weeks with fewer than 5 recipients carry forward into the next round. That is a product rule worth stating openly rather than hiding: **a round too small to hide anything does not get an aggregate disclosure**, because a "total" over two payments is one subtraction away from both of them. The circuit enforces this rather than trusting the caller (`MIN_ACTIVE` is a constraint, not a policy check), which is the behaviour we want.

## ⚠️ The blocking prerequisite nobody has surfaced

Grainlify's own payout-path table reports:

| Component | State |
|:---|:---|
| Soroban escrow contract | **never deployed** |
| `internal/chain` adapter | **only a MockAdapter implements it** |
| Signer service | **does not exist** |
| Chain configuration | **no environment sets it** |
| **Contributor payout address** | **no such column or table** |

**Grainlify does not store contributor payout addresses at all.** So "Grainlify calls the SDK for a real contributor payout on testnet" is further away than §4 target 4 implies: before any Tally work matters, someone has to collect and store contributor Stellar addresses, and that is a schema change plus a contributor-facing flow.

This is not a reason to change the target — it is a reason to sequence it correctly. Two options:

1. **Grainlify builds its rails first.** Out of our control; timeline risk lands on us.
2. **Tally supplies the rails.** Our non-custodial registration flow already collects a contributor's address *and* registers their confidential account in one step — the address column falls out of it. This is more work for us, but it removes the dependency and makes a stronger story: Tally is not integrated *into* Grainlify's payout path, Tally *is* Grainlify's payout path.

**Recommend option 2**, and note that it composes with the non-custodial decision: one contributor-facing flow does wallet connect, address capture, and confidential registration together.

## Revised shape of the integration

1. Contributor onboarding page (Tally-supplied) — wallet connect → address captured → confidential account registered client-side.
2. Grainlify stores the address against the contributor.
3. Founding-pool settlement calls the payout worker: `open_round` → fan-out → `close_round`.
4. Grainlify stores `(roundId, funderAddress)` against the settlement.
5. Anyone verifies with `tally verify --funder <G…> --round <id>`.

**Do not start until the Founding Contributor Pool date is known**, since it is a one-time event and the flagship demonstration depends on it.
