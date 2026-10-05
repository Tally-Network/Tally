# Budget draft

Written 2026-10-05. A draft for discussion, built from [SCOPE-LEDGER.md](SCOPE-LEDGER.md) and [OPERATOR-DESIGN.md](OPERATOR-DESIGN.md). Each line is hours × rate; each tranche equals its share of the total exactly.

**Tranches 1–3 are fully deliverable on testnet.** They depend on nothing outside this project except public testnet infrastructure.

**Tranche 4 (mainnet) follows SDF's approval of Confidential Tokens for mainnet.** It does not start before that approval, and its timing is outside this project's control. Its deliverables assume an OpenZeppelin release that reaches mainnet and an external security audit of tranches 1–3; the audit itself is not in this budget.

**Excluded:** security audits, marketing, legal work, and past work. Everything already built (see the left column of the scope ledger) is not charged.

## Rates

| Role | Rate (USD/hour) |
|:---|---:|
| Cryptography engineer (Noir, threshold protocols) | 110 |
| Protocol / backend engineer (Rust, TypeScript, services) | 90 |
| Frontend engineer (operator console) | 75 |
| Infrastructure engineer (archives, HSM/TEE, deployment) | 85 |

## Tranche 1 — 10 % — auditor client and archive (testnet)

**Deliverable.** An auditor client that decrypts every v0.9.0 event type and keeps standing openings that verify against chain; an archive serving C2–C4; per-period verification. All on testnet.

| Task | Role | Hours | Rate | Cost (USD) |
|:---|:---|---:|---:|---:|
| Auditor client: three-lane decryption of transfer, withdraw and spender events; v0.9.0 test vectors | CRY | 39 | 110 | 4,290 |
| Standing-opening ledger with verification against on-chain commitments; clawback_nonce folding | CRY | 24 | 110 | 2,640 |
| Event archive v1: gap-free ingestion, verbatim storage, C2 ordered history, C3 completeness flag, C4 ingestion status | BE | 46 | 90 | 4,140 |
| Per-period verifier mode (all outbound transfers of an account in a ledger range must be covered) | BE | 31 | 90 | 2,790 |
| Testnet tranche report with reproducible commands | BE | 6 | 90 | 540 |
| **Subtotal** | | **146** | | **14,400** |

## Tranche 2 — 20 % — threshold custody (testnet)

**Deliverable.** Two-of-three custodians generate a Grumpkin auditor key, publish its proof of possession, and decrypt a scoped event set for a requester without any single custodian learning the plaintext. On testnet.

| Task | Role | Hours | Rate | Cost (USD) |
|:---|:---|---:|---:|---:|
| Pedersen DKG over Grumpkin with range check (< r) and published transcript | CRY | 58 | 110 | 6,380 |
| Threshold ECDH contributions with DLEQ proofs; requester-side combining and verification | CRY | 48 | 110 | 5,280 |
| Proof of possession: threshold Schnorr over Grumpkin on (auditor contract, auditor_id, K) | CRY | 28 | 110 | 3,080 |
| Proactive share refresh keeping K unchanged; key-version history | CRY | 26 | 110 | 2,860 |
| Additively secret-shared standing-opening store | CRY | 20 | 110 | 2,200 |
| Custodian node service (scope check, contribution, encrypted delivery to P_R) | BE | 90 | 90 | 8,100 |
| Testnet demonstration: 2-of-3 custodians decrypt a scoped event set; tranche report | BE | 10 | 90 | 900 |
| **Subtotal** | | **280** | | **28,800** |

## Tranche 3 — 30 % — requests, lists, disclosure outputs, pilot (testnet)

**Deliverable.** Scoped audit requests end to end with a public log; OZ and SPP list projections; per-counterparty, D-recipient and tax-export outputs; an operator console; one tenant piloting on testnet.

| Task | Role | Hours | Rate | Cost (USD) |
|:---|:---|---:|---:|---:|
| Audit-request API, approval flow and per-custodian scope engine | BE | 80 | 90 | 7,200 |
| Transparency log: hash chain, custodian countersignatures, daily on-chain anchor contract | BE | 46 | 90 | 4,140 |
| TallyPolicy contract (multi-token Policy::is_authorized) and canonical subject registry | BE | 50 | 90 | 4,500 |
| Screening-feed integration (adapter; provider to be selected) | BE | 16 | 90 | 1,440 |
| SPP ASP operation: admission leaves, batched blocklist schedule, emergency path | BE | 34 | 90 | 3,060 |
| Baby JubJub DKG and threshold GVK decryption for SPP pools | CRY | 38 | 110 | 4,180 |
| Per-counterparty aggregate circuit, VK pinning and tests | CRY | 30 | 110 | 3,300 |
| D-recipient aggregate circuit, VK pinning and tests | CRY | 40 | 110 | 4,400 |
| Tax-export statement generator and published format specification | BE | 28 | 90 | 2,520 |
| Operator console for tenants and requesters | FE | 84 | 75 | 6,300 |
| Testnet pilot with one tenant; tranche report | BE | 24 | 90 | 2,160 |
| **Subtotal** | | **470** | | **43,200** |

## Tranche 4 — 40 % — mainnet

**Deliverable.** Mainnet operation of everything above plus D-auditor proofs through an attested TEE and HSM-backed shares, after an external audit (not budgeted here).

| Task | Role | Hours | Rate | Cost (USD) |
|:---|:---|---:|---:|---:|
| D-auditor aggregate circuit | CRY | 61 | 110 | 6,710 |
| Attested-TEE proving step for k-witness proofs (clawback, D-auditor) | CRY | 60 | 110 | 6,600 |
| TEE deployment, attestation publication and session logging | OPS | 50 | 85 | 4,250 |
| HSM-backed share storage for custodian nodes | OPS | 56 | 85 | 4,760 |
| Uplift to the OpenZeppelin release that reaches mainnet; re-run conformance and measurements | CRY | 36 | 110 | 3,960 |
| Mainnet deployment: contracts, archives, custodian nodes, log anchor | OPS | 60 | 85 | 5,100 |
| Second independent archive arrangement and cross-check monitoring | OPS | 30 | 85 | 2,550 |
| Payout batching (up to 4 transfers per transaction) in the library | BE | 40 | 90 | 3,600 |
| Fixes arising from the external audit (the audit itself is excluded) | BE | 60 | 90 | 5,400 |
| Operational runbooks: rotation, compromise, outage, list emergencies | BE | 34 | 90 | 3,060 |
| Mainnet pilot with one tenant; final report | BE | 129 | 90 | 11,610 |
| **Subtotal** | | **616** | | **57,600** |

## Summary

| Tranche | Share | Hours | Cost (USD) | Network |
|:---|---:|---:|---:|:---|
| 1 | 10 % | 146 | 14,400 | testnet |
| 2 | 20 % | 280 | 28,800 | testnet |
| 3 | 30 % | 470 | 43,200 | testnet |
| 4 | 40 % | 616 | 57,600 | mainnet (after SDF approval) |
| **Total** | 100 % | **1512** | **144,000** | |

Role codes: CRY cryptography, BE protocol/backend, FE frontend, OPS infrastructure.

**Assumptions to confirm before submission.** The rates are placeholders, not quotes. Hours are estimates for one experienced team; the tranche-3 pilot and tranche-4 mainnet pilot need a named tenant, which does not exist yet. Hosting and HSM/TEE service fees are not included and would be quoted separately.
