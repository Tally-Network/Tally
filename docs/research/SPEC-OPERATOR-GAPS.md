# Spec–Operator Gaps: OZ Confidential Tokens and Nethermind SPP

**Purpose.** For Tally, a planned privacy compliance and selective-disclosure operator on Stellar, list what each system **specifies but leaves to an operator**.

**Date and status.** Research snapshot taken 2026-10-05. Read-only research: no code was changed and no one was contacted.

**Sources pinned**
- **OZ:** OpenZeppelin/stellar-contracts branch `v0.9.0` @ `df602b613fbc` (2026-09-23). Paths are relative to `packages/tokens/src/confidential/` unless they start with `examples/`. `main` @ `b40c5ea` (2026-09-26) is checked only for the selective-disclosure doc question (§A.0, §E).
- **SPP:** NethermindEth/stellar-private-payments @ `b692e70` (2026-10-02), cited `SPP:` or `SPP@b692e70:`.
- **Demo:** brozorec/stellar-confidential-token-demo @ `9500ed7` (2026-08-04).
- **Blog:** OZ guest post on stellar.org, 2026-09-24.

---

## A. OpenZeppelin Confidential Tokens (stellar-contracts v0.9.0 @ df602b613fbc, 2026-09-23)

All paths are relative to `packages/tokens/src/confidential/` unless stated otherwise. Line numbers are against df602b613fbc.

### A.0 Where selective disclosure is specified ("SELECTIVE_DISCLOSURE.md")

- **`docs/SELECTIVE_DISCLOSURE.md` does not exist on v0.9.0.** It existed from 2026-07-07 (commit `1e51389`, PR #756) until 2026-09-10, when commit `844383c` ("Confidential Token: docs refactor (#869)") deleted it (−561 lines) and split its content into the directory `docs/selective-disclosure/` (`git log --all -- packages/tokens/src/confidential/docs/SELECTIVE_DISCLOSURE.md`; `git show --stat 844383c`).
- **On `main` the file still exists.** `main` @ `b40c5ea` (2026-09-26) has `docs/SELECTIVE_DISCLOSURE.md` (561 lines, last changed by #822 on 2026-07-31). Its §8 covers D-auditor, §14 the out-of-scope items and §15.1 the circuit list. `main` does not contain the v0.9.0 docs split or the clawback work: compare `main...v0.9.0` gives ahead 20, behind 5, merge base `9c5e279`.
- **No PR is titled "selective disclosure"** in OZ/stellar-contracts or in the demo repo. The related issue #849 (aggregate table) was closed 2026-09-10.
- On v0.9.0 selective disclosure is specified in `docs/selective-disclosure/README.md`, `protocol.md`, `security.md` and `circuits/{d-recipient,d-sender,d-auditor,d-balance,aggregate}.md`. `docs/README.md:59` makes the directory normative "for the off-chain disclosure layer".
- **It is spec only.** v0.9.0 ships no disclosure circuits: `circuits/` contains `clawback register set_spender spender_transfer transfer withdraw` plus gadgets/lib, and no `disclose_*` package. The spec names four circuits it expects: `disclose_recipient`, `disclose_sender`, `disclose_auditor`, `disclose_balance` (`docs/selective-disclosure/security.md:58-65`). They "do *not* register with the on-chain verifier set" (`security.md:69`).

### A.(i) What is specified

**Auditor registry model**
- Three contracts per deployment. The `ConfidentialAuditor` registry holds Grumpkin public keys indexed by `auditor_id` and can be reused across tokens (`README.md:34-41`; `docs/protocol/system-model.md:11`).
- The trait is `register_key(auditor_id, point, operator)`, `rotate_key(auditor_id, new_point, operator)` and `get_key(auditor_id)`. The two writes have **no default body** because "this is a privileged operation that requires custom access control" (`auditor/mod.rs:57-137`, esp. `:84-88`, `:117-121`). Events: `AuditorRegistered{auditor_id, point}` and `AuditorRotated{auditor_id, old_point, new_point}` (`auditor/mod.rs:165-211`).
- Write-time validation covers only non-identity, canonical encoding and on-curve (`y² = x³ − 17 mod r`) (`auditor/storage.rs:120-149`). **There is no proof of possession.** "K_aud is registered in the auditor contract by the auditor itself, with no accompanying proof … the contract trusts the fetched value" (`docs/protocol/proof-system.md:185`).
- The registry keeps one current key per id, and `rotate_key` overwrites it in place (`auditor/storage.rs:104-116`). The spec permits a versioned activation-ledger registry and calls it "an optional production target" (`docs/protocol/auditing.md:79`). There is no deregistration or revocation entry point (`auditor/mod.rs:58-137`). TTL is extended 30 days on each read (`auditor/mod.rs:159-161`; `auditor/storage.rs:153-160`).
- The reference example gates writes with `#[only_role(operator, "manager")]` (`examples/confidential/auditor/src/contract.rs:23-30`).

**Per-account `auditor_id` binding at registration**
- `register(account, auditor_id, data)` (`docs/protocol/interface.md:12`). The owner chooses `auditor_id` freely. The register proof does not constrain it, and the core checks only that the id exists (`docs/protocol/operations/register.md:31-33`; code `storage.rs:414-415`).
- The id is "Set once at registration" (`docs/protocol/account-state.md:35`) and "immutable" (`docs/overview.md:144`; `docs/protocol/auditing.md:75`). Only the key under the id rotates.
- The default `ComplianceHooks::on_register` "deliberately does not restrict" the choice. A deployment with designated auditors MUST gate it in `Hooks::on_register` (`docs/protocol/operations/register.md:33`; `docs/compliance.md:148-170`; `compliance/mod.rs:327-331`, `:352-358`). The `ApprovedAuditors` allowlist in the example is "deployment-maintained" (`docs/compliance.md:170`).
- One `auditor_id` serves both channels of an account (`docs/protocol/auditing.md:48`; `docs/protocol/security.md:53`).

**What an auditor can decrypt, and when**
- Recipient channel (2 lanes): `v_transfer` and `r_transfer` (`docs/protocol/auditing.md:7-11`, `:56-61`). Sender/owner channel (3 lanes): amount, post-op balance (or allowance), and post-op spendable blinding (or allowance blinding) (`auditing.md:13-17`, `:58-61`). At `set_spender` there is an extra escrow of `r_a` (`auditing.md:124-132`).
- Decryption is `S = k·R_e`, then `s = Poseidon(δ_ecdh, S.x, S.y)`, then sponge masks, then subtraction (`docs/protocol/auditing.md:21-27`; `docs/sdk/auditor-client.md:3`).
- Bounds: **forward-only**, i.e. only events emitted while that key was active (`auditing.md:39`, `:47`, `:93`). The recipient-channel opening is reset by merge (`auditing.md:41`). The sender-side opening is **standing** across merges and revokes, provided the auditor folds every inbound flow (`auditing.md:45-50`; `docs/sdk/auditor-client.md:11`).
- Allowance openings are recoverable only from the event, so they depend on the archive (`auditing.md:134-136`; `docs/indexer.md:124-126`).
- A compromised auditor key yields every amount and checkpoint and the standing openings for every bound account, but not viewing keys or spending authority. It "is custodied at the same level as a viewing key" (`docs/protocol/security.md:53-55`).

**Key rotation**
- In-flight proofs built against the old key revert at verification and must be re-proved (`docs/protocol/auditing.md:83-85`).
- "The auditor MUST retain the secret key for every historical version it has issued." To decrypt an event the auditor resolves the key version from its own rotation records, or from a versioned registry by activation ledger (`auditing.md:87-89`).
- A new key starts with nothing and re-anchors at the next checkpoint. A retired key keeps what it already opened (`auditing.md:91-98`).

**Compliance hook interface**
- The `Hooks` trait has `on_register`, `on_deposit`, `on_merge`, `on_withdraw`, `on_transfer`, `on_spender_transfer`, `on_set_spender` and `on_revoke_spender`. They run after auth and decode and before storage (`mod.rs:173-217`; `docs/protocol/interface.md:40`). `NoHooks` is the zero-cost default (`mod.rs:220-225`).
- `ComplianceHooks` provides freeze, policy and SAC gates, with a per-party matrix (`compliance/mod.rs:306-432`; `docs/compliance.md:35-93`). It is configured as `ComplianceConfig{policy: Option<Address>, sac_passthrough: bool}` (`docs/compliance.md:13-25`).
- Admin authority is not prescribed. Ownable and RBAC are suggestions (`docs/compliance.md:27-31`; `compliance/mod.rs:62-74`).

**Allowlist / blocklist policies**
- The interface is a single call, `Policy::is_authorized(account, token) -> bool` (`compliance/mod.rs:50-55`; `docs/compliance.md:69-77`). "Membership management, list semantics, and identity proofs live entirely inside the policy contract. The token's only agreement with the policy is the boolean return value" (`docs/compliance.md:85`). Allowlist, denylist and KYC/ASP/sanctions are named as modes (`docs/compliance.md:79-83`). One registry can serve many tokens (`docs/compliance.md:87`).
- The spender is policy-gated at grant time and at spend time but not on revoke (`docs/compliance.md:89`).
- **No `Policy` implementation ships in v0.9.0.** `grep -rn is_authorized` finds only the trait and its call site (`compliance/storage.rs:426-429`). `examples/fungible-allowlist` and `examples/fungible-blocklist` belong to the non-confidential fungible token.

**Clawback**
- The trait is opt-in: `ConfidentialClawback::{clawback, force_revoke_spender, clawback_nonce}` (`compliance/mod.rs:198-302`; `docs/compliance.md:174-178`). There are three roles: the token admin decides *whether*, the auditor produces the proof and so decides *how much and where*, and the issuer extracts the surplus (`docs/compliance.md:186-194`).
- The circuit CB1 takes `K_aud = k_aud·H` with **`k_aud` as a private witness** (`docs/compliance.md:198-225`; `circuits/clawback/src/main.nr:83-108`).
- The account must be frozen, the nonce is anti-replay, and settlement is `None` or `Some(d)`. Extraction order is "Nothing in the contract enforces which comes first" (`docs/compliance.md:227-246`, `:254-258`).
- Clawback MUST be paired with a freeze-enforcing `Hooks` (`docs/compliance.md:260`; `compliance/mod.rs:181-197`).
- The auditor client MUST verify its openings against the chain, read `clawback_nonce` and fold `Clawback` events (`docs/sdk/auditor-client.md:13`).

**Indexer obligations**
- An "Indexer operator" is a named role (`docs/README.md:12`). The indexer MUST persist verbatim events (`docs/indexer.md:27-41`), keep them **indefinitely** (`:82-88`), do at-least-once ingestion and detect gaps (`:74-80`), and expose C2 ordered history, C3 a completeness flag and C4 ingestion status (`:90-114`). It is trusted for availability only, and "deployments running or contracting at least two" archives (`:116-122`).
- The auditor has no state fallback for allowances (`docs/indexer.md:124-126`).

**Disclosure primitives** (`docs/selective-disclosure/`)
- The recipient keypair `(r_R, P_R)` is published out-of-band, and there is "no on-chain registration" (`README.md:80-84`). A fresh nonce `ν` comes per request (`README.md:84`). Disclosure ciphertext U1–U3 (`protocol.md:3-27`).
- The bundle is `(circuit_id, ref_E, π, R_disc, ṽ_disc)` (`protocol.md:53-66`). The six-step verifier protocol requires resolving the auditor key "at the version active at the event's ledger" and "MUST reject if the version cannot be resolved" (`protocol.md:68-90`, esp. `:84`).
- Variants: D-recipient and D-sender (holder `vk`), D-auditor (auditor `aud_sk` as a private witness, A1–A4) (`circuits/d-auditor.md:9-33`), D-balance (`circuits/d-balance.md`), and aggregate with n ∈ {1,4,16,64}, predicate-only or value-revealing (`circuits/aggregate.md`; `security.md:67`).
- Holder disclosures are not complete. "Recipients that require completeness must request from the auditor" (`security.md:32`). Non-goals: completeness proofs, on-chain disclosure logging, and a recipient registry (`README.md:60-66`). Out of scope: delegated viewers, the Merkle-accumulator, and public proofs (`security.md:42-50`). On-chain verification is outlined but out of scope (`protocol.md:92-104`).
- SDK: verification MUST pin the verification key, be distributable independently of any wallet, and return typed errors (`docs/sdk/clients.md:11-15`). Remote proving MUST be opt-in only (`docs/sdk/proving.md:36-38`). The auditor `k` is a secret that MUST NOT leave the trust boundary (`docs/sdk/requirements.md:5`).

### A.(ii) Specified but left to an operator

| # | Item | Spec says (quote) | file:line | What an operator must provide |
|:--|:--|:--|:--|:--|
| A1 | Auditor key generation and custody | "The auditor is trusted to protect its decryption key and exercise access only upon legitimate regulatory request." / "an auditor key is custodied at the same level as a viewing key" | `docs/protocol/system-model.md:23`; `docs/protocol/security.md:55`; `docs/sdk/requirements.md:5` | Keygen ceremony, HSM, MPC or threshold custody, access policy, and an access log. Nothing in the spec says how `k` is generated: `sdk/key-derivation.md` covers holder keys only. |
| A2 | Historical auditor secret keys | "The auditor MUST retain the secret key for every historical version it has issued." | `docs/protocol/auditing.md:89` | Durable, versioned key archive keyed by `(auditor_id, activation ledger)`, kept for as long as any event may need decrypting. |
| A3 | Key-version history (reference registry overwrites in place) | "it keeps a single current key per `auditor_id`, which `rotate_key` overwrites in place; a versioned, activation-ledger registry is an optional production target" | `docs/protocol/auditing.md:79`; `auditor/storage.rs:104-116` | Either deploy a versioned registry, or index `AuditorRotated` events (`auditor/mod.rs:185-193`). Disclosure verifiers MUST resolve the key "at the version active at the event's ledger" or reject (`docs/selective-disclosure/protocol.md:84`), so a public key-history service is needed. |
| A4 | Registry access control and rotation governance | "No default implementation is provided because this is a privileged operation that requires custom access control." | `auditor/mod.rs:84-88`, `:117-121` | Multisig or RBAC for `register_key` and `rotate_key`, a rotation runbook, and coordination with in-flight proofs, which revert on rotation (`docs/protocol/auditing.md:85`). |
| A5 | Proof of possession for auditor keys | "K_aud is registered … by the auditor itself, with no accompanying proof … the contract trusts the fetched value." | `docs/protocol/proof-system.md:185` | Off-chain PoP before registration, e.g. a Schnorr signature over Grumpkin. Otherwise an admin can register a key nobody holds and silently blind auditing. |
| A6 | Which auditors an account may pick | "deployments that must restrict which auditors an account may bind to MUST enforce that restriction in their `Hooks::on_register`" / "`ApprovedAuditors` is a deployment-maintained … allowlist" | `docs/protocol/operations/register.md:33`; `docs/compliance.md:150-170` | An approved-auditor list and the custom `on_register` hook. The choice is permanent, because `auditor_id` is immutable (`docs/compliance.md:170`). |
| A7 | Standing-opening maintenance (auditor client state) | "Maintaining it is the client's job: an implementation MUST add the `lane[0]` amount and `lane[1]` r_transfer of every inbound…" | `docs/sdk/auditor-client.md:11` | A stateful per-account ledger of `(v, r)` for `C_spend`, `C_receive` and each `C_a`, checked against on-chain commitments (`docs/indexer.md:126`). |
| A8 | Auditor event observation | "the escrowed blinding lives nowhere in contract storage, so an auditor that missed a delegation event cannot recover that opening" | `docs/protocol/auditing.md:136`; `docs/indexer.md:124-126` | Gap-free ingestion of all auditor-channel events from key activation onward. |
| A9 | Durable event archive (indexer) | "Indexer operators MUST satisfy [Data Model] through [Retention Obligations]" / "retain … indefinitely" / "deployments running or contracting at least two" | `docs/indexer.md:7`, `:84`, `:122` | An indexer conforming to C2, C3 and C4 (C1 recommended), with indefinite retention, at least two independent endpoints, and gap tracking. |
| A10 | Allowlist, denylist, KYC, ASP or sanctions policy | "Membership management, list semantics, and identity proofs live entirely inside the policy contract." | `docs/compliance.md:85`; `compliance/mod.rs:50-55` | A `Policy` contract implementing `is_authorized(account, token)`, with list curation, list-update governance and screening feeds. **None ships in v0.9.0.** |
| A11 | Admin authority (freeze, config, clawback) | "The contract does not prescribe how that authority is structured." | `docs/compliance.md:29`; `compliance/mod.rs:62-74` | Role design, e.g. separate freeze, policy and clawback signers (`docs/compliance.md:31`, `:194`), plus signer custody. |
| A12 | Clawback proof production | "Auditor — the holder of the secret key … Produces the proof and thereby decides how much and where to" | `docs/compliance.md:189`; `docs/sdk/auditor-client.md:13` | A prover with `k_aud` and current openings as witness, verification of openings before proving, the `clawback_nonce` read, and a request and approval workflow with the token admin. |
| A13 | Clawback sequencing with issuer | "Nothing in the contract enforces which comes first; under a `None` settlement the extraction must follow the seize" | `docs/compliance.md:241-245` | A coordinated runbook: freeze, `force_revoke_spender`, auditor proof, clawback, then SAC extraction. |
| A14 | Freeze-enforcing Hooks when clawback is enabled | "A deployment that enables clawback MUST wire `ComplianceHooks`, or a custom `Hooks` impl that gates the same seven positions" | `docs/compliance.md:260`; `compliance/mod.rs:195-197` | Deployment configuration review and attestation. |
| A15 | Governance of verifier, auditor contract and VKs | "this specification does not prescribe a governance policy … deliberately left to implementers" | `docs/protocol/system-model.md:44-53` | Answers to the four listed questions, a timelock or multisig, and VK reproducibility. |
| A16 | Disclosure recipient keypair and nonce issuance | "publishes a long-lived Grumpkin keypair (r_R, P_R) … Publication is out-of-band; no on-chain registration." / "supplies a fresh nonce ν … over an authenticated channel" | `docs/selective-disclosure/README.md:82-84` | Recipient key publication (PKI), nonce issuance and tracking, and replay checks. |
| A17 | Authenticated request and delivery channel | "TLS to a compliance API, a signed email, a dedicated KYC portal" | `docs/selective-disclosure/protocol.md:39` | A compliance API or portal that carries `(P_R, ν, ref_E)` out and bundles in. |
| A18 | Disclosure circuits and pinned VK set | "Prover and verifier must therefore agree, out of band, on which compiled circuit each `circuit_id` denotes … the verification-key set is a trusted input." | `docs/selective-disclosure/protocol.md:37`; `docs/sdk/clients.md:15` | Implement `disclose_*` (absent from v0.9.0 `circuits/`), then publish and pin the VKs and the `circuit_id` registry. |
| A19 | Standalone disclosure verifier | "A standalone verifier library (independent of the wallet)" / "MUST be distributable independently of any wallet … typed indication of which check failed" | `docs/selective-disclosure/security.md:80-88`; `docs/sdk/clients.md:13` | A verifier library or service that runs steps 1–6, including the historical auditor-key lookup. |
| A20 | Completeness (holder can cherry-pick) | "Recipients that require completeness must request from the auditor, not the holder." | `docs/selective-disclosure/security.md:32` | An auditor-side disclosure service (D-auditor and its aggregates), which is the only completeness backstop. |
| A21 | Data protection after disclosure | "a non-cryptographic concern handled by the recipient's own data-protection obligations" | `docs/selective-disclosure/security.md:34` | Retention and handling policy for decrypted values. |
| A22 | On-chain disclosure verification (gating) | "None of this is part of the present document" | `docs/selective-disclosure/protocol.md:92-104` | If a pool gates on a disclosure, the request/response verifier contract and an event-inclusion binding. |
| A23 | Delegated (continuous) viewers | "Out of scope here; revisit if real deployments demonstrate the need." | `docs/selective-disclosure/security.md:46` | Today this is only possible as the auditor itself, or by the holder handing over `vk`, which the SDK forbids presenting as safe (`docs/sdk/requirements.md:7`). |

---

## B. Nethermind Stellar Private Payments (SPP)

**Source.** github.com/NethermindEth/stellar-private-payments @ `b692e7027f64e1e577c20ed002cb7b4960a7a8fb` (2026-10-02, "Update deps (#657)"). Cited below as `SPP:`.

**Docs.**
- mdBook: https://nethermindeth.github.io/stellar-private-payments/docs/ (built from `docs/`).
- Demo: https://nethermindeth.github.io/stellar-private-payments/ (ASP admin simulator at `/admin.html`).
- Blog, 2026-07-16: https://www.nethermind.io/blog/stellar-private-payments-confidential-and-compliant-transfers-on-public-rails

**Companion PoC SDK.** github.com/stellar-experimental/js-private-payments-sdk @ `7ce7ff7` (2026-04-28). Its README calls it "Proof of Concept … Testnet only". I read only the README.

**Status.** "a reference implementation … has not yet been audited and should not be used in production" (`SPP:README.md:15-16`).

### B.(i) What is specified

**Model and cryptography**
- The model is a Tornado-Nova-style 2-in/2-out UTXO pool with Groth16 proofs over BN254 from Circom circuits (`SPP:README.md:25`; `circuits/src/keypair.circom:2`). Proofs are verified on-chain with the Soroban BN254 host functions (`contracts/circom-groth16-verifier/src/lib.rs:4`, `:99`).
- Poseidon2 over BN254 is used in-circuit and on-chain (`contracts/soroban-utils/src/poseidon2.rs:25-40`).
- The note key is hash-based: `pk = Poseidon2(sk, 0; dom 0x03)`, which is not an EC point (`circuits/src/keypair.circom:9-19`).
- Note encryption to recipients uses X25519 + XSalsa20-Poly1305 (`sdk/native/src/zk/encryption.rs:141-147`, `:320-370`).
- All user keys derive from one Ed25519 SEP-53 wallet signature (`encryption.rs:52`, `:57-60`, `:93-95`).

**Association sets (ASP)**
- The README describes the role: "ASPs maintain membership and non-membership Merkle trees … enabling pool operators to enforce administrative controls" (`SPP:README.md:20`).
- Pool policy flags are `none`, `allowlist`, `blocklist` or `allowlist-blocklist`. They are fixed at construction and have no setter (`DEPLOY.md:56-67`; `contracts/pool-core/src/policy.rs:3-17`; `contracts/pool/src/pool.rs:196-217`).
- **Allowlist (`asp-membership`)**
  - An append-only incremental Poseidon2 Merkle tree with a 90-root history (`contracts/asp-membership/src/lib.rs:14`).
  - `insert_leaf` is admin-only (`:252-255`).
  - **There is no delete.** The public functions are only `__constructor`, `update_admin`, `get_root`, `is_known_root`, `hash_pair` and `insert_leaf` (`:115-252`).
  - Leaf = `Poseidon2(notePubKey, membershipBlinding; 0x01)` (`circuits/src/aspMembership.circom:32-36`; `docs/src/privacy-tradeoffs.md:26`). The blinding is derived from the user's wallet signature (`sdk/native/src/zk/encryption.rs:95`, `:116-139`).
- **Blocklist (`asp-non-membership`)**
  - An on-chain sparse Merkle tree. `insert_leaf(key, value)` and `delete_leaf(key)` are both admin-only (`contracts/asp-non-membership/src/lib.rs:374-377`, `:532-535`).
  - The key is "the unblinded note public key", which is public in events (`docs/src/privacy-tradeoffs.md:27`).
- **Root freshness**
  - The blocklist root must equal the *current* root. The allowlist root may be any of the last 90 (`contracts/pool/src/pool.rs:505-518`).
  - Circuit depths: pool tree 20, ASP trees 10 (`circuits/src/policy_tx_2_2_AB.circom:10`).
- **What is screened:** the input notes' spending public keys (`circuits/src/policyTransactionBoth.circom:54-56`), not the depositing G-address. A deposit is screened only because the SDK pads the inputs with the user's own key (`sdk/native/src/zk/flows.rs:647-651`, `:710`). `transact` does only `sender.require_auth()` (`contracts/pool/src/pool.rs:427-433`).

**What SPP does not include**
- **KYT on deposit:** not specified. A repo-wide grep finds no KYT. The only deposit control is `maximum_deposit_amount` (`contracts/pool/src/pool.rs:441-447`).
- **Ragequit / emergency exit:** not specified. The only exit is a `transact` withdrawal with `ext_amount < 0` that still passes the ASP checks (`pool.rs:538-542`).
- **Fees / relayer:** none. `ExtData` holds `{recipient, ext_amount, encrypted_output0/1}` only (`contracts/pool-core/src/ext_data.rs:17-26`).

**Admin roles**
- Pool admin: `update_admin`, `update_asp_membership` and `update_asp_non_membership`, the last two swapping ASP contract addresses (`contracts/pool/src/pool.rs:661-663`, `:693-720`).
- Each ASP contract has its own admin.
- There is no pause or upgrade entry point (grep shows no `update_current_contract_wasm`).
- The VK is baked into each verifier WASM (`DEPLOY.md:19-21`).
- The admin may be any `Address` (`DEPLOY.md:46`), so a Stellar multisig or contract account can be used.

**Disclosure and viewing keys**
- **User disclosure receipts**
  - A Groth16 proof of ownership of 1–4 notes. It *reveals the amounts*, roots, commitments and nullifiers, and binds them to an authority/purpose/nonce context hash (`docs/src/disclosure.md:3-54`; `circuits/src/selectiveDisclosure.circom:16-30`).
  - Verification is off-chain, with RPC checks of roots and nullifiers (`docs/src/disclosure.md:206-233`).
  - The VK hash "must come from an out-of-band source" (`docs/src/disclosure.md:158`).
- **Global View Key (GVK)**
  - The pool admin's Baby JubJub public key `D = d·BASE8` is a constructor argument of `pool-gvk`. It is immutable and has no setter (`docs/src/global_view_key.md:147-152`; `contracts/pool-gvk/src/pool_gvk.rs:214-243`).
  - Every note `(pk, amount, blinding)` is encrypted in-circuit (`docs/src/global_view_key.md:60-85`):
    - ephemeral `R = r·BASE8`;
    - `S = r·(8·D)`;
    - keystream = one Poseidon2 permutation over `(S.x, S.y, 0, 0x06)`.
  - Modes: view-only encrypts outputs; traceable encrypts inputs and outputs, so notes can be linked across hops (`docs/src/global_view_key.md:20-30`).
  - The admin decrypts with the effective scalar `8d` (`docs/src/global_view_key.md:99-112`).
  - Auditing is a Rust library API only, with no CLI or UI (`docs/src/global_view_key.md:14-18`, `:198-219`).

**Event history**
- "RPC nodes only store events for a small retention window (7 days)" (`SPP:README.md:123`).
- A bootnode is offered to serve history, with stated integrity and censorship risks (`docs/src/bootnode.md:3-12`, `:40-45`).
- The indexer and prover run client-side (`app/ARCHITECTURE.md:56-60`, `:106`).

### B.(ii) Specified but left to an operator

| # | Item | Spec says (quote) | repo@commit:file:line | What an operator must provide |
|:--|:--|:--|:--|:--|
| B1 | ASP operator (allowlist admission) | "ASPs maintain membership and non-membership Merkle trees … enabling pool operators to enforce administrative controls" / demo is a "Simulation of ASP providers for testing (`/admin.html`)" | SPP@b692e70:`README.md:20`; `app/README.md:14` | A production ASP service: KYC/KYB intake, leaf intake (users must supply note pubkey + membership blinding, or the leaf), admin signer for `insert_leaf`. The blog says admission happens "after an offchain verification process defined by the ASP". |
| B2 | Allowlist removal | (no delete function exists) | `contracts/asp-membership/src/lib.rs:115-252` | Removal policy. The options are to block via the blocklist, or to deploy a new membership contract and call `update_asp_membership` (`contracts/pool/src/pool.rs:693-720`), which drops every existing member. |
| B3 | Blocklist curation | "`key` is the unblinded note public key. Public blocklist key transparency" | `docs/src/privacy-tradeoffs.md:27`; `contracts/asp-non-membership/src/lib.rs:374-377`, `:532-535` | A screening feed that maps sanctioned or flagged parties to *note public keys*, which is non-trivial because notes are not tied to G-addresses. Also an admin signer and an appeal and deletion process. |
| B4 | Blocklist update scheduling | exact-root check: `if non_member_root != proof.asp_non_membership_root { return Err(Error::InvalidProof) }` | `contracts/pool/src/pool.rs:507-511` | Batching and cadence, so that updates do not keep invalidating in-flight user proofs, plus user notification. |
| B5 | KYT on deposit | not specified | (absent; repo grep) | If required, a deposit-time KYT on the Stellar G-address, done off-chain before ASP admission. There is no on-chain hook for it. |
| B6 | Ragequit / exit for non-compliant users | not specified; withdrawals pass ASP checks | `contracts/pool/src/pool.rs:505-518`, `:538-542` | A policy statement only. The protocol gives no exit path, so the operator carries the risk of trapped funds. |
| B7 | Pool and ASP admin custody | `update_admin`, `update_asp_membership`, `update_asp_non_membership` | `contracts/pool/src/pool.rs:661-663`, `:693-720`; `DEPLOY.md:46` | Multisig or contract-account admins and a governance runbook. There is no pause or upgrade, so the only response to a bug is redeploy and migrate. |
| B8 | GVK key custody | "Never lose the admin's private scalar `d`. It is not stored anywhere by the deployment tooling" | `docs/src/global_view_key.md:192-194` | Keygen (`gvkey-gen`, `DEPLOY.md:83-91`), backup and custody of `d`. Losing it disables auditing permanently. |
| B9 | GVK compromise and rotation | "There is no setter for either. A rotated-out admin therefore keeps the ability to decrypt every future note … the only recovery is deploying a new pool and migrating." | `docs/src/global_view_key.md:147-152` | A compromise plan, which means a new pool plus user migration. |
| B10 | GVK audit tooling | "This is a Rust library API only" | `docs/src/global_view_key.md:218-219` | An audit service or UI, case management and access logging. |
| B11 | Event history and archive | "RPC nodes only store events for a small retention window (7 days)" / bootnode "can serve incorrect history, omit events, or selectively censor data" | `SPP:README.md:123`; `docs/src/bootnode.md:3-12`, `:42` | A bootnode or archival RPC, ideally several for cross-checking. |
| B12 | Trusted setup | "Before mainnet, run a new trusted ceremony" | `deployments/testnet/circuit_keys/README.md:47` | A Phase-2 ceremony per circuit (`tools/ceremony-cli`). |
| B13 | Disclosure VK distribution | "The canonical hash must come from an out-of-band source" | `docs/src/disclosure.md:158` | Publication of canonical VK hashes and a verifier service for authorities. |
| B14 | License obligations when hosting | "you become the distributor … LGPLv3" | `SPP:README.md:141-148` | License compliance. |

---

## C. Interaction points between OZ Confidential Tokens and SPP

| Aspect | OZ Confidential Tokens (v0.9.0) | SPP (b692e70) | Consequence for Tally |
|:--|:--|:--|:--|
| Privacy model | Confidentiality, not anonymity: addresses visible, amounts hidden (`README.md:10-11`) | UTXO pool. Notes are unlinkable except via GVK traceable mode (`docs/src/global_view_key.md:20-30`) | Different audit questions. OZ asks "how much did A pay B"; SPP asks "whose note is this, and where did it go". |
| Proof system | Noir/UltraHonk, verifier from `NethermindEth/rs-soroban-ultrahonk` (`docs/protocol/system-model.md:9`) | Circom/Groth16 over BN254 (`SPP:README.md:25`) | Separate provers and VK pinning. SPP also needs a trusted-setup ceremony (B12); UltraHonk needs only the universal SRS (`docs/protocol/proof-system.md:137`). |
| Auditor / view-key curve | **Grumpkin** (`y²=x³−17` over BN254 F_r), `K = k·H`, `k < r` (`auditor/storage.rs:120-149`; `circuits/clawback/src/main.nr:84`) | **Baby JubJub** (twisted Edwards over BN254 F_r), `D = d·BASE8`, decrypt with `8d` (`docs/src/global_view_key.md:99-112`) | Both curves are defined over BN254 F_r, but they are different groups. **One auditor secret cannot serve both.** Tally needs two key families with separate custody, PoP and rotation logic. |
| Key mutability | Key under `auditor_id` rotatable via `rotate_key`; `auditor_id` immutable per account (`auditor/storage.rs:104-116`; `docs/protocol/account-state.md:35`) | GVK `D` immutable per pool (`docs/src/global_view_key.md:147-152`) | OZ supports key-only rotation. SPP needs a new pool to rotate. |
| Auditor scope | Per account, chosen by the holder at registration; dual-channel (`docs/protocol/auditing.md:3-19`) | Per pool, one admin key for all notes (`docs/src/global_view_key.md`) | Tally's tenancy model differs: per-`auditor_id` for OZ, per-pool for SPP. |
| Encryption KDF | ECDH, then `Poseidon2(δ_ecdh=13, S.x, S.y)`, then sponge with the tag as the leading input (`docs/protocol/primitives.md:55-63`; `docs/protocol/domain-separators.md`) | ECDH, then a single Poseidon2 permutation over `(S.x, S.y, 0, 0x06)` with the tag in the capacity lane (`docs/src/global_view_key.md:83-85`) | Both use Poseidon2 over BN254 with small-integer tags, but the tag placement and values differ. OZ flags the cross-protocol collision risk and offers a hashed-tag alternative (`docs/protocol/domain-separators.md:29`). Never reuse secrets across the two systems. |
| User recipient key | Grumpkin PVK = `vk·H` (`docs/protocol/keys-and-commitments.md:19-23`) | X25519 encryption key; note key is hash-based (`encryption.rs:141-147`; `keypair.circom:9-19`) | No shared recipient-key format. |
| Allow/deny lists | One boolean call: `Policy::is_authorized(account: Address, token: Address)` over **Stellar addresses** (`compliance/mod.rs:50-55`) | Merkle trees over **note public keys**: append-only allowlist, SMT blocklist (`contracts/asp-membership/src/lib.rs`; `contracts/asp-non-membership/src/lib.rs`) | A single "common policy registry" cannot feed both directly. Tally would maintain a canonical subject list and *project* it into (a) an OZ `Policy` contract keyed by G/C-address and (b) SPP ASP tree updates keyed by note pubkeys, which need user-supplied leaf material. |
| Policy evaluation timing | Synchronous on every state change (`docs/compliance.md:71`) | At proof time against tree roots: blocklist at the current root, allowlist within the last 90 roots (`contracts/pool/src/pool.rs:505-518`) | An OZ list change takes effect at the next transaction. An SPP blocklist change invalidates proofs that are in flight. |
| Seizure | Clawback with an auditor proof plus admin (`docs/compliance.md:174-265`) | None | Clawback is a Tally service only for OZ. |
| Selective disclosure | Off-chain, recipient-bound (`P_R`, `ν`) ciphertext; amounts sealed to the recipient (`docs/selective-disclosure/protocol.md:3-27`) | Portable JSON receipt; amounts revealed in clear to anyone holding it; context hash binding (`docs/src/disclosure.md:3-54`) | Different confidentiality semantics. An OZ disclosure can be verified by anyone but read only by the recipient; an SPP receipt is readable by anyone who holds it. |
| Event archive | Indexer MUST retain indefinitely and expose C2–C4 (`docs/indexer.md:82-114`) | Optional bootnode; RPC keeps about 7 days (`SPP:README.md:123`) | One archive service can serve both if it meets the stricter OZ contract. |
| Common policy registry (OZ blog) | "An issuer operating several stablecoins across different jurisdictions can point multiple token contracts to a common policy registry." This is a guest post by Boyan Barakov (OZ) on stellar.org, 2026-09-24: https://stellar.org/blog/developers/practical-confidential-stablecoins-an-issuer-controlled-architecture. It describes deployment, not an artifact. The interface is the `Policy` trait above, and no operator is named. | — | The registry is a role Tally can fill: one `Policy` contract shared across tokens, using the `token` argument for per-token rules (`docs/compliance.md:87`). |

**What the brozorec demo already implements for disclosure.** github.com/brozorec/stellar-confidential-token-demo @ `9500ed7` (2026-08-04). Built against the OZ `feat/confidential-verifier-ultrahonk` branch, so it predates OZ #853 and the clawback work.
- **Circuits:** only `disclose_recipient` and `disclose_sender` exist (`packages/disclosure/circuits/`). "Remaining disclosure variants (D-auditor §8, D-balance §9, aggregates §10) belong here as sibling circuit packages" (`packages/disclosure/README.md:22`).
- **SDK:** `proveRecipientDisclosure`, `proveSenderDisclosure`, `verifyDisclosure` (pins the VK, resolves `refE`, reads PVKs from chain, throws typed errors), `decryptDisclosure` and recipient key/request helpers (`packages/sdk/src/disclosure/{prove,verify,recipient,types}.ts`).
- **Auditor:** browser-only decryption (`packages/sdk/src/auditor/decrypt.ts`; `packages/app/app/auditor/page.tsx`).
  - It does not handle `lane[2]` escrows, because it predates #853.
  - It has no proofs and no auditor-side disclosure.
  - It uses one `auditor_id 0` for every account.
  - The **auditor secret is shipped in the client bundle on purpose** (`packages/app/lib/deployment.ts:14-17`; `packages/app/app/auditor/page.tsx:15-16`).
- **Server:** the only server component is a read-only event indexer (Goldsky plus a Cloudflare Worker). There is no auditor service, disclosure inbox, nonce tracking or key custody.
- **Gaps left to an operator:** D-auditor, D-balance, aggregates, an auditor key service, and recipient nonce bookkeeping.

---

## D. Constraints on auditor-key custody design (OZ Confidential Tokens)

| # | Finding | Evidence |
|:--|:--|:--|
| D1 | **The auditor key is a single Grumpkin scalar `k` with public key `K_aud = k·H`.** The registry stores one 64-byte affine point per `auditor_id`. There is no multi-key, threshold or committee structure, and nothing in the registry records how `k` was produced. | `auditor/mod.rs:3-5`, `:21-25`; `docs/compliance.md:204` (CB1); `docs/selective-disclosure/circuits/d-auditor.md:26` (A1) |
| D2 | **The secret must be a BN254 `Field` element (< r), not an arbitrary Grumpkin scalar (< q).** Every circuit that takes it declares `k_aud: Field` and lifts it with `EmbeddedCurveScalar::from_field`. Grumpkin scalars live in F_q, "slightly larger than F_r". A DKG run over the Grumpkin group order must reject outputs ≥ r, or reduce its arithmetic to keep the key < r. The chance of hitting such an output is negligible (|q−r| ≈ 2^127 against 2^254), but the check must exist. | `circuits/clawback/src/main.nr:83-84`, `:106`; `circuits/lib/src/lib.nr:168-170`; `docs/protocol/primitives.md:21`, `:25` |
| D3 | **Routine decryption is linear in `k`, so threshold ECDH works without changing the protocol.** Decryption is `S = k·R_e`, then `s = Poseidon2(δ_ecdh, S.x, S.y)`, sponge masks, and subtraction. With Shamir or additive shares `k_i`, each custodian returns `k_i·R_e`, plus a DLEQ proof against its share's public key `k_i·H` to prove correctness. A combiner Lagrange-interpolates `S` in the group and finishes the hash locally. The full point `S` must be reconstructed, because Poseidon is applied to `(S.x, S.y)` and so cannot be split across custodians. The combiner therefore learns `s` for that event's channel. That opens only the event's lanes, because each event has its own `R_e` and salt. *(The threshold construction is standard cryptography; it is not something the OZ docs describe.)* | `docs/protocol/auditing.md:21-27`; `docs/protocol/primitives.md:55-63`; `docs/sdk/auditor-client.md:3` |
| D4 | **The spec does not forbid threshold custody, but it does not provide for it either.** It requires only that `k` and the accumulated openings stay "within the trust boundary" and are never sent to a remote service without explicit opt-in. It also says an auditor key is custodied like a viewing key. A threshold design has to define its own trust boundary, i.e. the combiner plus the opening store, and say how it satisfies these requirements. | `docs/sdk/requirements.md:5`; `docs/protocol/security.md:55`; `docs/sdk/proving.md:38` |
| D5 | **Proving with `k` is the hard part.** Two flows put `k` into a ZK proof as a private witness: clawback (CB1, `k_aud`) and D-auditor disclosure (A1, `aud_sk`, with one witness per slot in aggregates). Under threshold custody each such proof needs one of three things: (a) a transient reconstruction of `k` inside a TEE or HSM that also runs the UltraHonk prover; (b) a collaborative or MPC prover (co-SNARK) for UltraHonk, which is *not verified here* and outside the OZ docs; or (c) a circuit change that replaces the A1/CB1 `K = k·H` constraints with a statement about a threshold-produced `S`. Option (c) would be a new circuit and a new VK, which means a protocol change for CB, which is registered on-chain. | `docs/compliance.md:204`, `:225`; `circuits/clawback/src/main.nr:77`, `:83-108`; `docs/selective-disclosure/circuits/d-auditor.md:20`, `:26-29`; `docs/selective-disclosure/circuits/aggregate.md:28` |
| D6 | **CB1 exists to stop the admin from proving alone, so a threshold design must keep that separation.** The auditor key is what makes the clawback witness "an approval rather than a computation". If the token admin's signers also hold a quorum of key shares, the stated "Neither party can act alone" separation collapses. | `docs/compliance.md:192-194`, `:209` |
| D7 | **Rotation does not revoke anything, and every key version must be kept.** A retired key keeps every opening it ever made, and the auditor "MUST retain the secret key for every historical version". Threshold shares for old versions must therefore be kept, or re-shared, for the life of the archive. Rotating in a new committee does not cut off the old one. | `docs/protocol/auditing.md:89`, `:93-96`; `docs/protocol/security.md:53` |
| D8 | **Rotation breaks in-flight proofs and resets the new key's view.** A proof built against the old key reverts. The new key opens nothing that predates it and re-anchors only at the next checkpoint. Frequent rotation, for example as a committee-refresh strategy, therefore creates blind windows for standing openings and clawback readiness. Proactive re-sharing that keeps the same `K_aud` avoids both problems. | `docs/protocol/auditing.md:83-85`, `:91-98` |
| D9 | **The `auditor_id` is immutable per account, but the key under it is not.** Custody can migrate from a single key to a threshold key by `rotate_key` without re-registering accounts, at the cost described in D8. | `docs/protocol/account-state.md:35`; `docs/protocol/auditing.md:75`; `auditor/storage.rs:104-116` |
| D10 | **There is no proof of possession at registration.** The registry accepts any valid point. For a DKG-produced key, the operator should publish a PoP, for example a threshold Schnorr signature over Grumpkin, so that a verifier knows a quorum actually controls `K_aud`. | `docs/protocol/proof-system.md:185`; `auditor/storage.rs:142-149` |
| D11 | **The auditor-client state is as sensitive as `k`.** The standing openings `(v, r)` are "self-verifying artifacts" that can be handed to third parties. Splitting `k` while storing the openings in the clear does not reduce exposure for current state. The opening store needs equal protection, or must itself be secret-shared, and every fold is an addition, which secret sharing handles natively. | `docs/protocol/security.md:55`; `docs/sdk/requirements.md:5`, `:9`; `docs/sdk/auditor-client.md:11-15` |
| D12 | **One key serves both channels and all bound accounts.** A key compromise exposes every account bound to that `auditor_id`. A per-tenant `auditor_id` is the only isolation knob, and an account cannot be moved off it once registered. | `docs/protocol/auditing.md:48`; `docs/protocol/security.md:53`; `docs/compliance.md:170` |

### D.SPP — the same question for SPP's Global View Key (for comparison)

| # | Finding | Evidence |
|:--|:--|:--|
| D13 | **The GVK is a single Baby JubJub scalar `d`.** It is randomly generated and immutable per pool, and decryption uses `8d`. There is no rotation, so a threshold committee must be set up **before** pool deployment, because `D` is a constructor argument. | SPP@b692e70:`sdk/native/src/types/gvk.rs:182-203`; `docs/src/global_view_key.md:99-112`, `:147-152` |
| D14 | **GVK decryption is threshold-friendly.** `S = 8d·R` is linear in `d`. The keystream is one Poseidon2 permutation over `(S.x, S.y, 0, 0x06)`, so the combiner needs the full `S`, as in D3. No SPP flow uses `d` as a proof witness: auditing is a library call. That makes threshold custody simpler than for OZ, where clawback and D-auditor use `k` as a witness. *(Inference; not tested.)* | `docs/src/global_view_key.md:83-85`, `:198-219` |
| D15 | **Neither codebase has threshold support.** A grep of SPP for threshold, multisig, Shamir, FROST or MPC finds nothing relevant. OZ's registry stores one point. In both, admin `Address`es can be Stellar multisig or contract accounts through `require_auth`, but that covers *authorization*, not *decryption-key custody*. | SPP grep; `auditor/mod.rs:57-137`; SPP `DEPLOY.md:46` |

---

## E. Could not verify

1. **Threshold or MPC proving for UltraHonk (D5(b)).** I did not test whether a collaborative prover can produce the clawback or D-auditor UltraHonk proofs with `k` secret-shared. Neither OZ nor SPP documents one.
2. **Threshold-ECDH compatibility (D3).** This is an inference from the linearity of `S = k·R_e` and `S = 8d·R`. I implemented and tested nothing.
3. **OZ `main` vs `v0.9.0` divergence.** `main` @ `b40c5ea` (2026-09-26) is 5 commits ahead of and 20 behind `v0.9.0` (merge base `9c5e279`).
   - `main` still has the old flat docs, including `docs/SELECTIVE_DISCLOSURE.md` (561 lines, last changed by #822 on 2026-07-31), and a `revoke_spender` circuit. It has no `clawback` circuit.
   - The clawback, `lane[2]` escrow and docs-split changes (#853, #854, #869, #872) are on `v0.9.0` only.
   - I did not determine which branch OZ treats as canonical for future releases.
4. **"Selective disclosure" PRs.** No OZ or demo PR has "selective disclosure" in its title (searched without a state filter). The related issue #849 (SELECTIVE_DISCLOSURE.md §10 aggregate table) was closed 2026-09-10. I did not exhaustively review PR bodies.
5. **The OZ 2026-09-24 post** is on stellar.org, not openzeppelin.com/news. I found no separate "policy registry" artifact, issue or PR in OZ/stellar-contracts.
6. **SPP details I did not check**
   - The SPP blog post was read via a summarizing fetch, so its quotes are approximate.
   - I did not diff the mdBook site against the repo `docs/`.
   - I did not review js-private-payments-sdk beyond its README.
   - I did not test whether a custom prover can deposit with a note key other than the depositor's (B.(i) "what is screened").
7. **SPP blocklist depth (inference, untested).** The on-chain SMT has no depth bound while the circuits use `smtLevels = 10`, so colliding keys might make non-membership proofs unbuildable.
8. **No production ASP or OZ `Policy` implementation** was found to compare against. The OZ `Policy` trait has no implementer on v0.9.0, and SPP's ASP is a demo admin page.
