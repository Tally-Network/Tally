# Tally scope ledger

Written 2026-10-05. Two columns and no blank cells: every item belongs to exactly one side.

- **Done before funding** means it already exists in this repository, or on testnet, as of this commit.
- **Reserved for funded tranches** means it does not exist yet. Tranche numbers refer to [BUDGET-DRAFT.md](BUDGET-DRAFT.md).
- Design references are to [OPERATOR-DESIGN.md](OPERATOR-DESIGN.md).

| DONE BEFORE FUNDING | RESERVED FOR FUNDED TRANCHES |
|:---|:---|
| Multi-sender aggregate disclosure circuits, n = 8/16/64: zero-knowledge, in-circuit anonymity floor, rebuilt on OpenZeppelin v0.9.0 with pinned VKs (`circuits/`) | Auditor client: three-lane decryption, standing openings, `clawback_nonce` folding, checked against chain commitments (§2, §6) — **T1** |
| Round-registry contract (soroban-sdk 28; 16 tests, 10 negative), deployed on testnet (`contracts/`) | Event archive meeting OZ `docs/indexer.md` C2–C4 (§6) — **T1** |
| Client SDK ported to OpenZeppelin v0.9.0; 19/19 upstream primitive vectors pass (`ct/sdk`) | Per-period verifier mode for sender-side totals (§4) — **T1** |
| v0.9.0 testnet deployment (token, verifier, auditor, registry), with the auditor secret kept out of the repository (`ct/scripts/deploy.ts`) | Grumpkin distributed key generation, threshold ECDH with DLEQ proofs, published proof of possession (§2.3) — **T2** |
| End-to-end round, 16 recipients across 5 lanes, donor-verified (`pnpm demo`) | Proactive share refresh and a secret-shared standing-opening store (§2.3) — **T2** |
| Standalone `tally challenge` / `prove` / `verify` CLI: chain-resolved inputs, VK pinning, retention detection (`cli/`) | Custodian node service and requester-side combining client (§2.3) — **T2** |
| Published round verifiable from a clean clone, with two negative cases rejected (`evidence/`, the round named in `evidence/latest.json`) | Scoped audit-request workflow: API, approvals, scope engine, encrypted delivery (§3) — **T3** |
| Headless non-custodial registration following OZ `docs/sdk/key-derivation.md`, tested on live testnet (`registration/`) | Transparency log with custodian countersignatures and a daily on-chain anchor (§3.4) — **T3** |
| Measurements under protocol 29, including four transfers per transaction demonstrated on testnet (`MEASUREMENTS.md`) | `TallyPolicy` contract for OZ CT and the canonical subject registry with screening-feed integration (§5) — **T3** |
| Secret guard with negative tests, and CI covering secrets, types, conformance, proving, circuit drift and contracts | SPP list operation (admission leaves, batched blocklist) and Baby JubJub threshold custody of the Global View Key (§2.3, §5) — **T3** |
| Upstream fix accepted: OpenZeppelin/stellar-contracts#849 | Per-counterparty aggregate circuit, D-recipient aggregate circuit, and tax-export statement (§4) — **T3** |
| Landing page, trust statement, safety invariants, demonstration status | Operator console for tenants and requesters, plus a testnet pilot with one tenant (§1, §3) — **T3** |
| Operator design, specification-gap analysis, overlap analysis and verified demand quotes (`docs/OPERATOR-DESIGN.md`, `docs/research/`) | D-auditor aggregate with an attested-TEE proving step; HSM-backed share storage; uplift to the OpenZeppelin release that reaches mainnet; mainnet deployment of contracts, archives and custodian nodes; a second independent archive; payout batching in the library; fixes arising from the external audit; runbooks; a mainnet pilot. **Follows SDF's approval of Confidential Tokens for mainnet** (§2.3, §6) — **T4** |

**Excluded from both columns:** security audits, marketing, legal work, and any past work. The budget excludes them too.
