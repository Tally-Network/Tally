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

## ⚠️ RETRACTED: "Grainlify has no contributor address storage"

**That claim was wrong, and the way it was wrong matters more than the claim.**

I read it from `Grainlify-Docs/docs/reference/payout-path.md` — a documentation table dated **18 August 2026** listing "Contributor payout address: *No such column or table*". I did not read the schema.

The schema says otherwise. `Grainlify-Backend`, branch `main`, rev **`1464b75`** (2026-08-21):

- `migrations/000080_contributor_addresses.up.sql` creates `contributor_addresses` with `verified_at`, `verified_nonce`, `chain_id`, and `superseded_at` history.
- The design is careful: payout destinations are held **separate from sign-in wallets** ("a wallet somebody added to sign in silently becomes somewhere money gets sent"), addresses are written only after a verified signature, and `auth_nonces.purpose` distinguishes `signin` from `payout_address` so a sign-in challenge cannot be replayed to register a destination.
- `migrations/000086_one_account_per_payout_address.up.sql` adds one-account-per-address and notes that **production holds one live row** — so the flow has been exercised.

The documentation was three days stale relative to the code. **This is the [inherited-defaults failure](../CONTRIBUTING.md) in another form: a claim sourced from a document rather than from the thing the document describes.** The rule now says to cite the file and revision actually read; this is why.

## ⚠️ The real blocker: the payout path is Aptos, not Stellar

Reading the schema instead of the docs surfaces the actual problem, which is bigger than the one I reported.

**Grainlify's payout path is wired for Aptos.**

| Evidence | Source |
|:---|:---|
| `address TEXT CHECK (address ~ '^0x[0-9a-f]{64}$')` | `000080` — Aptos address format. **A Stellar `G…` strkey fails this constraint.** |
| `chain_id` example: `'aptos-testnet'` | `000080` |
| `auth_nonces.wallet_type` gains `'aptos_ed25519'`, with the comment *"Aptos joins here and NOT in wallets.wallet_type: nothing signs in with an Aptos wallet"* | `000080` |
| `internal/chain/aptos_fixture_drift_test.go` cross-checks Merkle vectors against Move literals in the sibling `Aptos-Contracts` repo | backend |

**But it is not architecturally committed to Aptos.** `internal/chain/chain.go`:

> "Four implementations will eventually sit behind this interface (**Soroban**, Starknet, Flare, Solana) and they must stay behaviourally identical, so the abstraction is built and proven first — against mocks — before any real chain exists."

And `Grainlify/Stellar-Contracts` already exists: *"GrainHack escrow for Soroban. Merkle claim roots, pull claims only. The cross-implementation counterpart to the Aptos contract."*

### So: does the Founding Pool settle on Aptos?

**Today, that is the only wired path — but the decision is open, not foreclosed.** The chain layer is deliberately chain-agnostic, Soroban is explicitly named as a planned implementation, and a Soroban escrow contract is already written. What does not exist is a Stellar settlement wired end to end.

**This is a Grainlify product decision and must be made before any integration scoping.** "Grainlify calls the Tally SDK" is not a scheduling question until Grainlify decides a settlement lands on Stellar.

If it does, the concrete work on Grainlify's side is smaller than I implied and well-shaped by what already exists:

1. A migration admitting Stellar addresses — the `^0x[0-9a-f]{64}$` CHECK is Aptos-only, and the table is already per-chain by design (`UNIQUE (user_id, chain_id)`), so this is an extension rather than a redesign.
2. A `stellar_ed25519` payout-address registration path — `auth_nonces` already supports `stellar_ed25519` for sign-in, and the `purpose` column already separates the two uses.
3. A Soroban implementation behind `chain.Chain`, which the interface was built to receive.

Tally's non-custodial onboarding composes with (2): one contributor flow does wallet connect, address capture and confidential registration together. But it **extends** Grainlify's existing, well-designed address handling rather than replacing an absence.

## Revised shape of the integration — *conditional on decision 1 below*

1. Contributor onboarding (Tally-supplied) — wallet connect → address captured → confidential account registered client-side, extending Grainlify's existing `contributor_addresses` flow rather than replacing it.
2. Grainlify stores the Stellar address against the contributor under a Stellar `chain_id`.
3. Founding-pool settlement calls the payout worker: `open_round` → fan-out → `close_round`.
4. Grainlify stores `(roundId, funderAddress)` against the settlement.
5. Anyone verifies with `tally verify --funder <G…> --round <id>`.

**Two blocking decisions before starting**, in order:

1. **Does a Grainlify settlement land on Stellar?** Until answered, there is no integration to scope.
2. **When is the Founding Contributor Pool?** It is a one-time event and the flagship demonstration depends on it.
