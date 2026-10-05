# Demonstration status

**Updated 2026-10-05,** after the move to OpenZeppelin stellar-contracts v0.9.0 and a fresh testnet deployment.

**Positioning.** Tally is being repositioned as a privacy compliance and selective-disclosure service for Stellar confidential tokens. Confidential one-to-many payouts with a provable total are the first use case. The operator service itself is a design ([OPERATOR-DESIGN.md](OPERATOR-DESIGN.md)); nothing below demonstrates it.

**No adoption.** Tally has no users, no integrations and no partner agreements. Nothing in this repository is used by anyone else.

| # | What is demonstrated | Status | Evidence |
|:--|:---|:---|:---|
| 1 | A funder pays ≥ 10 recipients in one round on testnet | ✅ | `pnpm demo`: 16 recipients across 5 lanes on OpenZeppelin v0.9.0 contracts (run 2026-10-05) |
| 2 | Explorers show transfers with no amount visible | ✅ on the retired deployment only | [`evidence/explorer-view.md`](../evidence/explorer-view.md) decodes a transfer from the August deployment; not regenerated against v0.9.0 |
| 3 | A donor verifies the round total with only their own key and nonce | ✅ | `pnpm demo` step [5]; the standalone `tally challenge` / `prove` / `verify` in [`cli/`](../cli/) |
| 4 | A published round that anyone can re-verify | ✅ while inside the RPC retention window | [`evidence/`](../evidence/), checked with `pnpm verify:evidence` |
| 5 | Non-custodial registration from a wallet signature | ✅ headless only | `pnpm test:registration`: 9 checks against live testnet, including the v0.9.0 account binding |
| 6 | Several confidential transfers in one transaction | ✅ as a measurement only | [MEASUREMENTS.md](../MEASUREMENTS.md): 4 per transaction; the demo still sends one per transaction |
| 7 | Live landing page | ✅ | <https://tally-network.github.io/Tally/> |
| 8 | An independent party verifies a published round and reports the output | ❌ Not done | Nobody outside the project has run it |
| 9 | A round with real, independent contributors holding their own keys | ❌ Not built | [TARGET4-SKETCH.md](TARGET4-SKETCH.md); the browser registration page does not exist |
| 10 | A platform pays real contributors through Tally | ❌ Not built | No integration exists |
| 11 | Durable verification beyond the ~7-day RPC event window | ❌ Not built | Needs an event archive that follows OpenZeppelin's `docs/indexer.md` |
| 12 | Any operator function (auditor-key custody, scoped audits, list management) | ❌ Not built | Design only: [OPERATOR-DESIGN.md](OPERATOR-DESIGN.md) |

## Notes

**Rows 2 and 4 depend on chain data.** Soroban RPC keeps about 7 days of events. `tally verify` enumerates transfers from chain rather than from anything the funder supplies, so a published round stops being verifiable once its ledgers leave the window. `tally verify` detects that and says so rather than reporting an empty set. `pnpm evidence:refresh` republishes.

**Row 6 is a measurement, not a feature.** The batch wrapper in `ct/contracts/bench-batch` exists only to find the per-transaction limit. Switching the payout flow to batching is unscheduled work.

**The SDK is Tally's own port.** The code under `ct/sdk` ports the reference demo's client SDK to v0.9.0. It passes all 19 OpenZeppelin v0.9.0 primitive vectors that it implements (`pnpm test:conformance`). It is neither published as a package nor audited.

**The exposed demo key.** Commit `83f3f8c` put an auditor secret in `demo/deployment.testnet.json`. That key was demo-only, guarded nothing of value, and is retired: the deployment it belonged to is no longer used. The current deployment's auditor key has never been in the repository. See the README.

**History.** An earlier version of this page (21–22 Aug 2026) tracked targets built around one specific platform integration. That integration was never built, so it now appears only as row 10, without naming a platform.
