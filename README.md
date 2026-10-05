# Tally

**Privacy compliance and selective disclosure for Stellar confidential tokens.**

The first use case is confidential one-to-many payouts:
- one funder pays many recipients;
- individual amounts stay private;
- the round's **total is cryptographically provable** to a donor or auditor on demand.

The broader service would cover auditor-key custody, scoped audit requests, selective-disclosure outputs, and allow/deny-list management, for OpenZeppelin Confidential Tokens and Nethermind's Stellar Private Payments. It is a **design only** at this stage: [docs/OPERATOR-DESIGN.md](docs/OPERATOR-DESIGN.md).

Tally builds on Stellar's [Confidential Tokens](https://stellar.org/blog/developers/developer-preview-confidential-tokens-on-stellar) developer preview:
- the OpenZeppelin contract suite at **v0.9.0** (`df602b6`);
- the Nethermind UltraHonk verifier.

The preview gives a SEP-41 token private balances and private transfer amounts, while addresses stay visible.

> **Status: testnet only. No users, no integrations.** The confidential-token suite is an unaudited developer preview, and v0.9.0 is a branch, not a tagged release. Nothing here has been audited. Do not use with real value.

```bash
git clone --recurse-submodules https://github.com/Tally-Network/Tally
cd Tally && pnpm install
pnpm verify:evidence      # check the published round (no Noir toolchain needed)
pnpm demo                 # run a fresh round on testnet
```

## A retired key, stated plainly

The commit "feat(demo): reproducible round" (2026-08-21; originally `83f3f8c`) put a **demo auditor secret key** in `demo/deployment.testnet.json`. The value has since been removed from the working tree and from history; [docs/HISTORY-REWRITE.md](docs/HISTORY-REWRITE.md) maps the old commit ids to the new ones.
- That key was generated for the testnet demo and guarded nothing of value.
- It has been **retired**. The deployment it belonged to (token `CCDZ52D7…JYHD`) is no longer used.

The current deployment was made on 2026-10-05 with a fresh auditor key.
- [`ct/scripts/deploy.ts`](ct/scripts/deploy.ts) writes that key only to `~/.config/tally/`, and refuses to write a secret inside the repository.
- `demo/deployment.testnet.json` now holds public data only.
- [`scripts/check-secrets.ts`](scripts/check-secrets.ts) runs first in CI. It fails the build if a secret appears in any tracked file, and specifically detects the retired key.

## The problem

On a public ledger, every recipient's amount is visible forever. For grant programs, bounty platforms, public-goods funding and aid disbursement, that is disqualifying: it exposes vulnerable recipients and makes them targets. The alternative, paying off-chain, gives up the auditability that made on-chain funding attractive in the first place.

Tally keeps both: **amounts private, total provable.**

## How the proof works

The donor is never given a secret.
1. The donor generates their own disclosure keypair `(r_R, P_R)` and issues a fresh challenge nonce `ν`.
2. The donor receives a zero-knowledge proof, sealed to their key, that reveals **only** the aggregate.

> The funder's viewing key is **never** shared. It would let the holder recompute every ephemeral scalar the funder ever used. That opens every individual amount retroactively, including commitments inside recipients' balances. Challenge–response is the only supported model.

## What the proof does and does not assure

**The donor is assured that** the confidential transfers sent from the lane accounts Tally declared on-chain before the round opened, within that round's declared ledger window, total exactly the disclosed amount and that none has been withheld — because every confidential transfer publishes its sender address on-chain whether or not the funder chooses to disclose it, so an omitted transfer is visible as one the proof fails to cover.

**This does not assure** that the funder made no other payments, nor that the recipients are independent of the funder: the guarantee is scoped to transfers from the accounts declared before the round, **not to the funder's total spend**, and it establishes what amounts moved, not who ultimately controls the accounts that received them.

See [docs/TRUST-STATEMENT.md](docs/TRUST-STATEMENT.md) for why it is worded this way, and for the rules on public copy.

## What's here

| Path | |
|:---|:---|
| [`circuits/`](circuits/) | Multi-sender aggregate disclosure circuits (Noir/UltraHonk), `n ∈ {8,16,64}`; compiled artifacts and pinned VKs committed |
| [`contracts/round-registry`](contracts/) | On-chain lane set and window declaration: the completeness anchor (soroban-sdk 28) |
| [`ct/`](ct/) | Tally's port of the confidential-token client SDK to OpenZeppelin v0.9.0, plus the v0.9.0 contract wrappers, the deploy script and the measurement harness |
| [`demo/`](demo/) | `pnpm demo`: one full round on testnet, donor-verified |
| [`cli/`](cli/) | `tally challenge` / `prove` / `verify`: independent round verification |
| [`registration/`](registration/) | Non-custodial key derivation and registration (headless; there is no browser page) |
| [`evidence/`](evidence/) | A published round anyone can verify: `pnpm verify:evidence` |
| [`site/`](site/) | The website's content: docs pages, generated facts and the claims map, with their checks (the application itself is in a private repository) |
| [`MEASUREMENTS.md`](MEASUREMENTS.md) | Current on-chain costs and limits (2026-10-05) |
| [`docs/DEMONSTRATION-STATUS.md`](docs/DEMONSTRATION-STATUS.md) | What is demonstrated and what is not |
| [`docs/OPERATOR-DESIGN.md`](docs/OPERATOR-DESIGN.md) | Design of the compliance and disclosure operator (not built) |
| [`docs/TRUST-STATEMENT.md`](docs/TRUST-STATEMENT.md) | Exactly what the proof does and does not assure |
| [`docs/SDK-SAFETY-INVARIANTS.md`](docs/SDK-SAFETY-INVARIANTS.md) | Properties whose violation is invisible on-chain |
| [`PHASE0-FINDINGS.md`](PHASE0-FINDINGS.md), [`PHASE1-MEASUREMENTS.md`](PHASE1-MEASUREMENTS.md) | August 2026 investigation and measurements (historical; superseded where marked) |
| `vendor/stellar-contracts` | OpenZeppelin suite, pinned at v0.9.0 `df602b6` |

## Measured on testnet

Re-measured 2026-10-05 on protocol 29, under the 400,000,000-instruction cap. Method, raw data and transaction hashes are in [MEASUREMENTS.md](MEASUREMENTS.md).

| | |
|:---|---:|
| `confidential_transfer` CPU cost | **91,193,854 instructions** (22.8 % of the cap) |
| `register` CPU cost | 88,344,016 instructions (22.1 %) |
| **Transfers per transaction, one sender** | **4**, through a batching wrapper; demonstrated on testnet. Instructions (90.8 %) and transaction size (95.1 %) bind together |
| Transfer proof generation | 1.32 s warm (Apple M4 Pro) |
| Aggregate proof over 16 transfers (zero-knowledge) | 1.89 s, **16,224 B** (proof size is constant from n = 8 to 64) |
| On-chain transfer proof (non-zk, verifier-mandated) | 14,592 B |
| Full round, donor-verified end to end | [`pnpm demo`](demo/) |

Two August figures are superseded: ~93M instructions per transfer against a 100M cap, and "one transfer per transaction". See [MEASUREMENTS.md](MEASUREMENTS.md#claims-corrected-by-this-re-measurement).

## Tests

```bash
pnpm test                 # secret guard + its negative tests, typecheck, OZ v0.9.0 conformance
                          # vectors, local register/transfer proving, retention logic, contract tests
pnpm test:registration    # live testnet: non-custodial key derivation and registration
pnpm demo                 # live testnet: a full round, donor-verified
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the secret guard first. It then runs the TypeScript tests, rebuilds the circuits (failing on VK drift), and builds and tests the contracts.

## Roadmap: verified recipient identity (future work, not v1)

**Self-dealing is the obvious attack on any aggregate.** A funder can pay accounts it controls and prove a perfectly valid total. The trust statement's second sentence says so plainly rather than leaving it implied. No amount-hiding primitive can settle this: the proof establishes what amounts moved, not who ultimately controls the receiving accounts.

**The answer is identity, not cryptography.** A later layer would bind a disclosure to verified recipient identity. A donor would then learn "this sum went to N distinct verified recipients", rather than merely "this sum left these accounts". This is deliberately out of v1 scope, because it changes the trust statement.

## Contributing upstream

- [OpenZeppelin/stellar-contracts#849](https://github.com/OpenZeppelin/stellar-contracts/issues/849): the aggregate disclosure's public-input table omitted `PVK_B,ᵢ`, so the D-sender aggregate could not be assembled. Filed by this project; closed and fixed upstream on 2026-09-10.

## License

MIT ([LICENSE](LICENSE)). Code under `ct/` is derived from MIT-licensed upstream sources; see [ct/NOTICE.md](ct/NOTICE.md).
