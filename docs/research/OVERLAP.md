# Overlap check: who else could claim Tally's operator role

Checked on 2026-10-05. Research only. Nobody was contacted.

**The claim being tested.** Tally wants to be the privacy **compliance and selective-disclosure operator** for OpenZeppelin Confidential Tokens (OZ CT) and Nethermind's Stellar Private Payments (SPP). It covers five operator functions:

1. Auditor-key custody, where no single party can decrypt alone.
2. Scoped audit requests, with logging.
3. Disclosure outputs: aggregate totals, and per-counterparty and per-period proofs.
4. Tax export.
5. Allow/deny-list (association-set) management, for both systems.

The first use case is confidential one-to-many payouts.

**How each cell is marked.**
- **Y** means it is shipped in code I could read, or on a live page.
- **P** means planned, or only partly there. The note says which.
- **—** means I found nothing.
- "Own" in the privacy-system column means the project runs its own protocol, not OZ CT or SPP.
- Funding comes from SCF project or submission pages. Tranche *payment* status is almost never public. I mark it as not verified unless the project's repo shows it.

## Summary table

| Candidate | What it is | Privacy system | Custody (no single decryptor) | Scoped audit + log | Disclosure proofs (agg / per-cpty / per-period) | Tax export | Allow/deny | Status | Verdict | Source |
|---|---|---|---|---|---|---|---|---|---|---|
| **Remi** (SCF #44, $133.7k) | Remittance settlement company. Its plan includes an auditor/compliance dashboard and Anchor Platform disbursement | **OZ CT** (its own wrappers of OZ `539968f`) | — (a ZK-proven escrow of each viewing key to **one** auditor) | P (dashboard and compliance API are T2; no request workflow described) | P (per-transfer disclosure/decryption only; no aggregates) | — ("reports a regulator accepts", not tax) | P (freeze/block plus "screening hooks"; OZ allowlist/blocklist wrappers in repo) | Testnet contracts only. T2/T3 not visible | **PARTIAL (high). Closest funded overlap on OZ CT, but only for its own deployment** | SCF submission recCJsvZpqeNpRztT; github.com/Remi-FZC-LLC/stellar-confidential-token @1142ca5 |
| **Arcane** (SCF #42, $150k) | "Private Compliant Layer": a compliance portal, case management, scoped disclosure by role/app/time window, and an audit trail | **Own** shielded pool | — | **Y/P** (T1 deliverable: "scoped disclosure by role, application, and time window", all actions logged. A PoC portal with `/cases` API is live) | — (decrypt/export records; no ZK disclosure proofs) | P ("export transaction records") | — (an "Application Gatekeeper" handles authorization) | Testnet PoC (stellar.arcane.finance bundle uses `Test SDF Network`). No public Stellar code | **PARTIAL (high). Same operator functions, wrong privacy system** | SCF submission reccH830ZyGpt6aR1; project page …-3fq |
| **Safeguard-Inc** (unfunded as far as found) | Compliance stack "for Stellar Confidential Tokens": a policy engine, enforcement hooks, and an audit-record/authorization layer | **OZ CT** (implements the OZ `Policy::is_authorized(account, token)` seam) | — | **P** (scoped auditor grants plus audit-access logging. The `DecryptionProvider` trait exists, but "No provider is implemented") | — | — | **Y** (allowlist → denylist → sanctions → jurisdiction; one policy bound to many tokens) | Testnet (2 contracts). One author; last code 2026-09-14 | **PARTIAL. Overlaps the OZ CT policy and audit-log functions; no cryptography** | github.com/Safeguard-Inc (policy @2487969, audit @04e575a) |
| **OpenZeppelin** (spec + brozorec demo) | Protocol spec plus a reference demo with an auditor console, `/verify` disclosure and allow/block policies | **OZ CT** (first party) | — (one Grumpkin auditor key per `auditor_id`, manager-gated registry) | — (the spec makes on-chain disclosure logging a **non-goal**) | P (D-recipient and D-sender **shipped**. Aggregate §10, D-auditor and D-balance **specified, not shipped**) | — | Y (demo allowlist/blocklist policy contracts, owner-managed) | Testnet developer preview; audits in progress | **PARTIAL. Supplies the tools, not the operator** (SDF: "OZ is a tooling provider, not an operator") | stellar-contracts @b40c5ea `docs/SELECTIVE_DISCLOSURE.md`, `COMPLIANCE.md`; demo @9500ed7 |
| **Nethermind SPP** (first party) | Privacy-pool protocol with ASP allow/block trees, a Global View Key (GVK) and note-disclosure receipts | **SPP** (first party) | — (GVK is **one** immutable admin scalar `d`: "Never lose", no rotation) | — (GVK audit is a Rust library call that walks the whole pool; no CLI or UI) | P (note-ownership receipts for ≤4 unspent notes; no aggregate or per-period) | — | Y (ASP membership/non-membership trees plus an admin page. The ASP *operator* is left to the deployer. "Pools/ASP operator manual" issue #377 is open) | Testnet; unaudited | **PARTIAL. Supplies the tools; leaves the operator role open.** KYT-on-deposit and ragequit are stated plans only | NethermindEth/stellar-private-payments @b692e70 |
| **ZKELLA** (SCF #45, $127.8k) | Shielded token, viewing keys, sanctions non-membership, auditor API, Travel Rule | **Own** (CT-20 / ShieldedToken, Groth16) | — (holder-exported viewing keys; revocation by epoch rotation) | P ("Auditor API" in the design) | — | — | P (sanctions non-membership proofs in `contracts/compliance`) | Testnet PoC; Tranche-2 doc present; active 2026-10-04 | **PARTIAL (low). Own stack** | github.com/ZKELLA-org/zkella @04044af |
| **Moonlight** (SCF #37, The AHA Co.) | UTXO privacy channels run by "Privacy Providers" (banks, wallets) under councils | **Own** | — (the provider holds the off-chain session↔bundle map) | Y within own system (audit flow: auditor contacts the provider, which discloses only its own records) | — | P (CSV "audit export" of bundle ID, status, fee, time) | P (council-defined KYC/KYB) | Testnet (08/27 dev meeting) | **PARTIAL. The operator role exists, but inside Moonlight** | moonlight-protocol/docs @d089422 |
| **Hypertron** (no SCF found) | B2B private payments, payment links, treasury; "selective disclosure and audit workflows" | **Own** shielded pool | — | P (marketing claim) | — | — | — | Testnet early access | **PARTIAL (low). Own stack** | hypertron.space; meetings/2026/07/23 |
| **Galmanus spp-compliance-layer** (hackathon, unfunded) | KYC-gated, unlinkable admission into SPP's `asp-membership`; durable ASP root index; STARK attestation | **SPP** | — | — | — | — | **P** (an SPP allow-list *admission* contract, live on testnet) | Testnet; last push 2026-09-03 | **PARTIAL. SPP association-set slice only** | github.com/Galmanus/spp-compliance-layer @d8bb55e; SPP issues #531/#532 |
| **Haven** (SCF #45, $97k) | Privacy-first neobank (consumer) | Not chosen. The SCF page says it will adopt Stellar confidential protocols at mainnet; the site lists "Privacy Pools" as a partner | — | — | — | — | — (KYC held by licensed partners) | Pre-launch on Stellar | **ADJACENT (a likely customer)** | SCF project page …-rol; haven.hn |
| **Merkle Science** (SCF #41, $138k) | Soroban risk scoring, KYT, flow-of-funds | None | — | — | — | — | Data source only | Classic Stellar since 2022 (SDF partner). Nothing found on CT or SPP | **ADJACENT (a KYT feed an operator would buy)** | SCF project page …-lhx |
| **SDF first party** | `who-ate-gerald` (Frontier Lab, Bri Wylde): a game where an auditor-key worker answers 1 question per player per day. SDP (Disbursement Platform) forks: no CT | OZ CT (vendored demo SDK) | — | P (a rate-limited auditor oracle in a game) | — | — | — | Testnet demo | **ADJACENT.** SDF is *asking* for this operator, not building it | stellar-experimental/who-ate-gerald @9cc612f; meetings/2026/08/06 |
| **Pocket Wallet** (justmert) | CT wallet extension plus an INDEXER.md archive and a self-serve auditor registry | OZ CT | — | — | — | — | — | Testnet; last push 2026-08-14 | **ADJACENT** | github.com/justmert/pocket @5cf375e |
| **CT SDK, São Paulo Privacy #2** (aguilar1x / Oppia) | TS client plus a "verifiable replay archive"; demo where "every resident can audit the total" | OZ CT | — | — | P (a homomorphic-sum *dues* demo, many-to-one; not a proof system) | — | — | Testnet; idle since 2026-08-08 | **ADJACENT** | github.com/aguilar1x/stellar-confidential-token-sdk @45178c4 |
| **Velum** (São Paulo, Enterprise lane) | Implements OZ `disclose_balance_ge` plus an on-chain position attestation | OZ CT | — | — | P (balance threshold only) | — | P (T-REX identity policy) | Testnet; idle since 2026-08-06 | **ADJACENT** | github.com/ThaisFReis/velum @b7aea4a |
| **Obscura** (berkay1532, Real-World ZK) | Confidential payroll: "Salaries private. Totals provable." Also ran payroll on official OZ CT | Own batch circuit, plus OZ CT spike | — | — | P (one public payroll total on its own contract) | — | — | Testnet; idle since 2026-07-04 | **ADJACENT (overlaps the *use case*, not the operator role)** | github.com/berkay1532/confidential-payroll-stellar @13eeeb0 |
| **Green Road** (Trustless Work, São Paulo Enterprise #2) | Confidential milestone escrow on OZ CT with auditor recovery and holder disclosure | OZ CT | — | — | P (single-transfer holder disclosure) | — | — | Testnet PoC; idle since 2026-08-04 | **ADJACENT (a likely customer)** | github.com/Trustless-Work/privacy-poc @473fc03 |
| **LumenShade** (SCF #37, $135k) | Privacy pool. Phase 2 was "association sets + selective disclosure" | Own | — | — | — | — | P (planned) | Stalled ($90k of $135k per earlier research) | **NONE (stalled)** | SCF submission recK30XDY8nKSGFL7 |
| **Fairblock** (SCF #40, $150k) | Confidential transfers via MPC-IBE/HE/ZK | Own | P (MPC-IBE threshold decryption, but its own network) | — | P ("selective disclosure" in MVP) | — | — | Stellar "coming soon"; stalled ($100k of $150k per earlier research) | **ADJACENT (stalled)** | SCF submission recJbAw5nnUU1ZUmb |
| **stellar-huub/stellar-confidential** | CT infrastructure roadmap: indexer, recovery, "auditor dashboard, disclosure requests, access logs" | OZ CT | — | P (Phase 5, not started) | — | — | — | Scaffolding; idle since 2026-09-09 | **ADJACENT (roadmap only)** | github.com/stellar-huub/stellar-confidential @6f87aec |
| **Chainalysis / Elliptic / TRM** | — | — | — | — | — | — | — | Found no Stellar privacy-pool or CT screening announcement | **NONE found** | web search 2026-10-05 |
| Other hackathon apps (ZeroWage, Zebra, Setu, LetsPay/Payfurt, ShieldPay, ZetaPay, Confiroll, AuditLine, Stellar-Privacy-Layer, theboycoder agent commerce, Shielded-Protocol) | Payroll, remittance or treasury demos with view keys or disclosure | Mostly own circuits; a few on OZ CT | — | AuditLine has "scoped disclosure" (mock crypto) | Some reveal a payroll total publicly | Zebra mentions tax only in its pitch | — | Testnet or mock; mostly idle | **ADJACENT / NONE** | see §Other |

## Per-candidate notes

### Remi: the most important finding (SCF #44, Integration, $133.7k)
- My local research appendix filed Remi as "RWA / UNKNOWN" (`scf-research/appendix-a-winners-41-45.md:118`). The submission shows it is a **confidential settlement layer on the Confidential Token standard**: https://communityfund.stellar.org/submissions/recCJsvZpqeNpRztT
- Tranche 1 ($42.8k): a CT deployment for USDC, key management, sponsored tx, admin dashboard MVP, and TS SDK plus proving service.
- Tranche 2 ($56.9k):
  - Banking/Partner dashboard.
  - **Auditor/Compliance dashboard ($8.9k).**
  - Partner API plus webhooks.
  - **Compliance API + screening hooks ($6.2k).**
  - **Selective disclosure/decryption ($6.8k).**
  - Anchor Platform prototype.
  - Reconciliation service.
- Tranche 3 ($34k): mainnet, production dashboards with RBAC, Compliance API v1, and **Anchor Platform disbursement integration**.
- **Custody.** Each account's viewing key is escrowed to the auditor, "proven correct with a zero-knowledge proof". That is a single auditor; I found no MPC, TEE or threshold design.
- **Disclosure.** "Reveal the amount and parties of one specific transfer, and only that one." That is per-transfer, not aggregate.
- **Code.** github.com/Remi-FZC-LLC/stellar-confidential-token @1142ca5 (last push 2026-08-16) is "deliverable 1.1 of the Remi grant". It contains wrappers of OZ `539968f`: `confidential-token`, `compliant-token`, `auditor-registry`, `policies/allowlist`, `policies/blocklist`, and `circuits/disclosure/` (README table, lines ~25–37). Its dashboards are not public.
- **Why it matters.** Remi is building an auditor/compliance surface on OZ CT, including payouts through Anchor Platform. A reviewer will cite it. Remi does **not** do the following:
  - offer itself as a third-party or shared operator for other issuers;
  - cover SPP;
  - split auditor custody;
  - produce aggregate, per-period or tax disclosures.

### Arcane (SCF #42, Open, $150k)
- Submission: https://communityfund.stellar.org/submissions/reccH830ZyGpt6aR1
- T1 ($30k) "Compliance Infrastructure – Testnet":
  - SEP-10/SEP-01 RBAC backend.
  - **"Authorized users can request scoped disclosure by role, application, and time window."**
  - "All disclosure actions logged in audit trail."
  - A Compliance Portal with "investigation case management", search/filter/**export** of transaction records.
- T2: Confidential Transaction Engine (shield/transfer/unshield) and a Gatekeeper.
- T3 ($75k): mainnet.
- The live PoC at https://stellar.arcane.finance is a SPA. Its JS bundle contains "Compliance Portal", auditor, disclosure, `createCase → ${API_URL}/cases` and `Test SDF Network ; September 2015`.
- No public Stellar repo exists: github.com/arcane-finance-defi has Aleo/Miden/Solana repos only. The Hashlock audits are for Solana (hashlock.com/audits/arcane).
- **Verdict.** On the *operator functions*, this is the strongest functional overlap: scoped requests plus logging plus a portal. But it runs on Arcane's own shielded pool. Nothing says it serves OZ CT or SPP, or splits auditor custody.

### Safeguard-Inc (not in SCF records found)
- Org created 2026-09-01. Its description: "Compliance infrastructure for Stellar Confidential Tokens: policy engine, fail-closed enforcement hooks, tamper-evident audit trails."
- `safeguard-policy/crates/safeguard-contract/src/contract.rs:317` (@2487969) implements `is_authorized(env, account, token) -> bool`, the exact OZ `Policy` seam (OZ `COMPLIANCE.md` §3, lines 69–95). It has tests for sanctions-registry lookup and expiry (`test.rs:1415–1547`).
- `safeguard-audit` (@04e575a) has role- and scope-bounded auditor grants (`docs/auditor-model.md` "Scoped access"), audit-access events, evidence packages and reports. But `docs/privacy.md` ("The decryption boundary", ~lines 103–113) says: "**No provider is implemented here; that waits for the verified upstream Confidential Token architecture.**"
- One committer (LaPoshBaby, ~400 commits in about 2 weeks). Testnet contracts `CDVME6OP…` and `CC7UKMCY…`. No SPP support, no custody, no disclosure proofs.
- **PARTIAL.** It already claims "allow/deny + scoped audit log for OZ CT" on paper.

### OpenZeppelin (first party)
- The confidential module is now on `main` (OZ stellar-contracts @b40c5ea). The `feat/confidential-verifier-ultrahonk` branch that the demo and Remi pin **no longer exists** upstream.
- `docs/SELECTIVE_DISCLOSURE.md` @b40c5ea:
  - The gap statement is at lines 38–46: an auditor key "cannot decrypt one transfer without being able to decrypt all of them".
  - The **non-goals** are at lines 60–68: "On-chain disclosure logging" and a "Disclosure-recipient registry". Completeness "continues to route through the auditor".
  - **§10 Aggregate Disclosures** (lines 395–425) specifies vectorised D-recipient/D-sender/D-auditor aggregates: "received at least X from counterparty Y during window W".
  - §15.1 (lines 529–541) lists four circuits to add.
- Demo `brozorec/stellar-confidential-token-demo` @9500ed7 (= remote HEAD, last push 2026-08-04):
  - `packages/disclosure/README.md:3` ships D-recipient and D-sender only. Line 22: "Remaining disclosure variants (D-auditor §8, D-balance §9, aggregates §10) belong here".
  - `contracts/auditor/src/lib.rs:30–49` is an admin/manager-gated single-key registry.
  - `contracts/policies/allowlist/src/lib.rs:43,49,63` and `blocklist/src/lib.rs:42,48,62` are owner-managed lists.
  - README line 26 describes the auditor console.
- brozorec/stellar-confidential-token-sdk @c49f8d3 (2026-09-01) is the same two compliance channels, packaged as an SDK.
- SDF notes (https://developers.stellar.org/meetings/2026/08/06):
  - "the auditor key should sit unused inside an MPC or TEE custody setup (think Utila or Fireblocks…)".
  - "OpenZeppelin is a tooling provider, not an operator… go be the operator."
  - "scoped audit requests, monitoring, and selective-disclosure tooling… Nobody is building that platform."
- The OZ guest post (Barakov, 2026-09-24) mentions "specialized service providers" and a shared policy registry. It does not say OZ will operate either.
- Note: OZ issue #849 (aggregate D-sender public-input gap) was filed by Jagadeeshftw, i.e. Tally itself. It is not a third-party claim.

### Nethermind SPP (first party)
- NethermindEth/stellar-private-payments @b692e70 (2026-10-02).
- **ASP.**
  - README line 20 says ASPs "maintain membership and non-membership Merkle trees".
  - The demo admin page manages both trees.
  - `contracts/asp-membership/src/lib.rs:115,166,252` (constructor, `update_admin`, `insert_leaf`) and `asp-non-membership/src/lib.rs:374,532` (insert/delete).
  - Issue #377 "Pools/ASP operator manual" (open) and #369 "Separate SDK APIs for… ASP operator/admin" (open).
  - Per Antonio Larriba on the 09/17 dev meeting (https://www.youtube.com/watch?v=QO40dHfJO9Y, about 10–24 min): the pool admin is "free to decide which kind of compliance"; Nethermind is building KYT-on-deposit and ragequit. Neither appears in the repo; grep for `kyt`/`ragequit` found nothing.
- **GVK** (`docs/src/global_view_key.md`):
  - Lines 3–18: "audit is a Rust library call only".
  - Lines 147–152: `admin_view_key` is immutable with "no setter… a leaked private `d` retroactively deanonymizes the pool's whole history".
  - Lines 189–192: "**Never lose the admin's private scalar `d`**… no recovery path".
  - `GvkAudit` walks *every* note.
- **Disclosure** (`docs/src/disclosure.md:1–7, 67–103`): a receipt proving ownership and amounts of 1–4 **unspent** notes to an "authority", bound to a context hash. This is not a period or counterparty aggregate.
- **PARTIAL.** These are tools. The ASP and auditor operator roles are explicitly left to deployers.

### ZKELLA (SCF #45, Open, $127.8k)
- ZKELLA-org/zkella @04044af (2026-10-04).
- README line 8: "auditor viewing keys, Travel Rule-aligned disclosure workflows". Lines 75–83: viewing keys "shareable with auditors", an "Auditor API", and a sanctions non-membership proof endpoint. Line 31: `contracts/compliance` holds the sanctions non-membership proofs.
- `docs/VIEWING_KEYS.md:9`: revocation only by rotation.
- It runs its own ShieldedToken. `docs/DESIGN_EXPLORATION.md` *compares* it to OZ CT; it does not integrate.
- `docs/TRANCHE2_DELIVERABLES.md` exists, which implies T1 was delivered. Payment is not verified.
- **PARTIAL (own stack).**

### Haven (SCF #45, Integration, $97k)
- SCF page: it "adopts Stellar's confidential-balance and shielded-transfer protocols upon mainnet deployment". KYC is held by licensed partners.
- haven.hn: "Coming in Q2'26"; "Privacy Pools" is listed as a partner; whitepaper "coming soon". It has no auditor, disclosure or tax features.
- **ADJACENT.** A plausible *customer* (named in the D3 first-users list).

### Merkle Science (SCF #41, $138k)
- SCF page (https://communityfund.stellar.org/project/merkle-science-plattform-for-soroban-lhx): risk scoring, transaction monitoring and flow-of-funds for Soroban. "Supported Stellar since 2022". #40 was not awarded; #41 was awarded.
- I found no reference to CT, SPP, association sets or shielded-pool screening (SCF page, web search, stellar.org/privacy).
- **ADJACENT.** A data or KYT input to an operator, not an operator.

### SDF first party
- stellar-experimental/who-ate-gerald @9cc612f (Bri Wylde, 2026-10-01). README lines 9–12 and 37: "Maude McLedger, who holds the token's auditor key, answers one private question per villager per day, enforced in code". It vendors the brozorec SDK and disclosure circuits.
- This is a *game* showing a rate-limited auditor oracle. The auditor key sits in one Cloudflare worker.
- SDP forks (`meridian-pay-sdp-backend`, @cb40d7c) and upstream `stellar-disbursement-platform-backend`: no branch or issue mentions "confidential".
- stellar.org/privacy and developers.stellar.org/docs/build/apps/privacy name no compliance-operator partners.
- **ADJACENT.** SDF is asking for the operator; it is not building one.

### Moonlight (The AHA Company; SCF #37)
- moonlight-protocol/docs @d089422:
  - `privacy-providers/compliance-and-audit.md:3–37`: an audit flow, scope limited to the provider's own records, and council KYC/KYB.
  - `privacy-providers/provider-console.md:55–62,120`: a CSV "Audit Export" (`/api/v1/dashboard/audit-export`).
- provider-platform @c0a123b: "Privacy Providers are the regulatory-friendly third parties that onboard end-users…"
- **PARTIAL.** The operator role exists, but inside Moonlight's own protocol. No OZ CT or SPP.

### Hypertron
- 07/23 dev meeting (https://developers.stellar.org/meetings/2026/07/23): its own pool (Merkle tree, nullifiers, relayer) and "viewing keys" for auditors.
- hypertron.space: "Selective disclosure and audit workflows when someone needs to see" payment records; "live shielded pool on testnet".
- I found no SCF award and no public repo.
- **PARTIAL (own stack).**

### Pocket Wallet (justmert)
- github.com/justmert/pocket @5cf375e:
  - Line 28: testnet only.
  - Line 38: amounts are visible to "you and the auditor key you bound".
  - Line 96: `indexer/` conforms to INDEXER.md.
  - Line 110: a "self-serve" auditor registry.
- It has no operator functions. **ADJACENT** (a possible client of an operator).

### São Paulo Builder Summit entries (2026-08; meetings/2026/08/13)
- **Privacy #2, "Confidential Token SDK… verifiable replay archive"** = aguilar1x/stellar-confidential-token-sdk @45178c4.
  - README line 5: "TypeScript client for OpenZeppelin Confidential Tokens… and the verifiable archive".
  - Lines ~286–291: a dues demo where "every resident can still audit the total".
  - A client SDK, not an operator.
- **Enterprise #2, Green Road** = Trustless-Work/privacy-poc @473fc03. README lines 3–31: CT milestone escrow; "Receiver and Auditor recovery"; "selective disclosure for supported holder-generated transfers". A customer profile.
- **Velum** (ThaisFReis/velum @b7aea4a). README lines 40–41: it implements the `disclose_balance_ge` circuit that the OZ spec "specifies… and does not ship", plus an on-chain attestation contract.
- **Galmanus/spp-compliance-layer** @d8bb55e (submitted to both privacy sub-lanes; not a listed winner). README lines 50–63: `asp-admitter` "becomes the admin of Nethermind's own `asp-membership` contract and inserts a pool key only after a hash-based STARK proof that the requester is in the issuer's KYC'd set". It is live on testnet. Nethermind accepted the related inserter-role idea: issue #531 closed COMPLETED 2026-09-02.

### Other hackathon and wave projects (all ADJACENT or NONE)
All on testnet, most idle. Most use their own circuits; some reveal a payroll total publicly; none runs custody, scoped audit, tax export or cross-system lists.
- **Obscura** (berkay1532 @13eeeb0). README lines 3–4 ("Salaries private. Totals provable."), 98–102 and 132: the `batch_v2` circuit gives "Σ = revealed total". Idle since 2026-07-04.
- **ZeroWage** (zerowage-protocol). Groth16 payroll.
- **Zebra** (edycutjong). Mentions "tax authorities" in its pitch.
- **Setu** (Flamki). Privacy-pool disclosure receipts.
- **LetsPay / Payfurt**. Its own BLS12-381 protocol; auditor x25519 view key.
- **ShieldPay, ZetaPay, PrivatePay-ZK, ZeroPayroll.**
- **Confiroll** (bytemaster333). On OZ CT.
- **AuditLine Treasury** (leocagli). Its "scoped disclosure" is demo-only; the README says it is "not claimed as a Stellar Confidential Token" settlement.
- **Stellar-Privacy-Layer** (Fayedamz). "Mock cryptography".
- **theboycoder/confidential-agent-commerce.** OZ CT plus an auditor.
- **Shielded-Protocol.** Drips Wave; a viewing-key CLI.
- **Confidential-Compliance-Passport.** Empty READMEs.

### LumenShade (SCF #37) and Fairblock (SCF #40)
- LumenShade:
  - Submission recK30XDY8nKSGFL7. Phase 2: "optional compliance mechanisms such as user-defined association sets and selective disclosure".
  - Earlier research (`scf-research/ROUND3-OPENINGS-REPORT.md:120,200`) records it as stalled at $90k of $135k.
- Fairblock:
  - Submission recJbAw5nnUU1ZUmb: MPC-IBE/HE/ZK confidential stablecoins with "selective disclosure". This is threshold decryption, but on its own network.
  - The same report records it as stalled at $100k of $150k, with Stellar "Coming soon".

### Chainalysis / Elliptic / TRM
- Searches found no Stellar privacy-pool or CT screening announcement. The Elliptic hits were generic SEO "corpus" pages, and a 2020 Decrypt piece on XLM monitoring. This is absence of evidence, not proof.

## What remains unclaimed (strict)

1. **Split auditor-key custody for OZ CT and SPP.** No project implements MPC, TEE or threshold custody for the OZ `auditor_id` secret or the SPP GVK scalar `d`. The current models are:
   - OZ demo: one key in a browser console.
   - SPP: one immutable `d` with no recovery.
   - Remi: escrow to a single auditor.
   - ZKELLA: holder-exported keys.
   - Fairblock's MPC-IBE is its own system, and it is stalled.
2. **A third-party, multi-tenant operator serving *other* issuers' OZ CT and SPP deployments.**
   - Remi, Arcane, Moonlight and Hypertron are operators only for their own stack or flows.
   - Safeguard is OZ-CT-only, has no decryption and is unfunded.
3. **Scoped audit requests bound to actual decryption, for OZ CT or SPP.** Meaning: request, approve, decrypt only the scoped events, log it.
   - Safeguard has the authorization log but no `DecryptionProvider`.
   - Arcane has the workflow, but for its own pool.
   - The OZ spec makes logging a non-goal.
   - SPP GVK audit decrypts the whole pool.
4. **Aggregate, per-counterparty and per-period disclosure proofs.** OZ specifies them (§10) but has not shipped them. Nobody else has a public implementation: SPP receipts cover ≤4 unspent notes, Velum covers balance-≥ only, and Obscura and the aguilar1x demo reveal totals on their own contracts.
5. **Tax export from confidential history.** Nobody has it. The nearest are Moonlight's CSV audit export (bundle metadata) and Arcane/Remi "export records/reports".
6. **One allow/deny (association-set) registry spanning both OZ CT `Policy` and SPP ASP trees.** Nobody has it. Safeguard covers OZ only; Galmanus covers SPP admission only.
7. **Partly claimed, not open:** compliance for confidential one-to-many payouts on OZ CT. Remi's T3 plans "Anchor Platform disbursement integration" with an auditor dashboard. Obscura (abandoned) showed payroll with a provable total. SDF's SDP has no CT work.

## Could not verify

- **SCF tranche payment status** for Remi, Arcane, ZKELLA, Haven and Merkle Science. Project pages show "Awarded" only. ZKELLA's repo has a Tranche-2 deliverables doc.
- **Arcane's Stellar source code.** No public repo; only the PoC bundle.
- **Remi's dashboards and compliance API code.** Only the contracts repo is public, and it was last pushed 2026-08-16.
- **Hypertron's code and any SCF application.** Same for Moonlight #46 applications.
- **Whether Haven will use OZ CT, SPP or Privacy Pools (0xbow-style).**
- **Moonlight mainnet status.** The provider-platform supports a `mainnet` config, but the 08/27 meeting said testnet.
- **Nethermind's KYT-on-deposit and ragequit timeline.** Stated on stream only.
- **Funding sources** for Safeguard-Inc and stellar-huub (possibly Drips Wave; not confirmed).
- **Unpublished entries.** The São Paulo Privacy #1 wallet's repo, Real-World ZK #3 "Umbra" (repo 404), and the "more than five or six teams" building on SPP at Istanbul.
- **Whether OZ plans to ship the §10 aggregate circuits itself.** No issue or PR found beyond Tally's own #849.
- **Chainalysis, Elliptic and TRM.** Nothing found. Their private sales offerings cannot be checked.
