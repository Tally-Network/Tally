# Tally operator: design

Status: **design only**, written 2026-10-05. Nothing in this document is built unless §6 says so.

Evidence for every claim is in three research files, each citing file:line or a URL:
- [research/DEMAND-QUOTES.md](research/DEMAND-QUOTES.md) **[DQ]**: demand quotes;
- [research/SPEC-OPERATOR-GAPS.md](research/SPEC-OPERATOR-GAPS.md) **[SG]**: what the specs leave to an operator;
- [research/OVERLAP.md](research/OVERLAP.md) **[OV]**: who else could claim this.

Paths written `OZ:` are relative to `vendor/stellar-contracts/packages/tokens/src/confidential/` at v0.9.0 (`df602b6`). Paths written `SPP:` refer to `NethermindEth/stellar-private-payments` @ `b692e70`.

---

## 0. What is being designed, and how strong the demand really is

**The product.** A service that runs the compliance roles OpenZeppelin Confidential Tokens (OZ CT) and Nethermind's Stellar Private Payments (SPP) define but leave to someone else:
- auditor-key custody;
- scoped audit requests;
- selective-disclosure outputs;
- allow/deny-list management.

Tally runs these roles for issuers and pool operators, and for their holders. Confidential one-to-many payouts with a provable total remain the first use case.

**Demand, verified 2026-10-05 [DQ].** The written record is narrower than earlier research claimed.

| Statement | Speaker | Source | Status |
|:---|:---|:---|:---|
| "scoped audit requests, monitoring, and selective-disclosure tooling — say, sharing your confidential history with a service so you can do your taxes — are wide-open design space. Nobody is building that platform for you. Hint." | Kaan Kacar (SDF DevRel; author of the notes, in his own voice) | `stellar-docs meetings/2026-08-06.mdx:61` | Confirmed text |
| "Alex's main ask: OpenZeppelin is a _tooling_ provider, not an operator. Pick a jurisdiction and a use case and go **be the operator** — sanction lists, allow/deny lists, compliance hooks — and show everyone what best practice looks like." | Alessandro Voto (SDF privacy PM), **paraphrased by Kaan** | `2026-08-06.mdx:63` | Confirmed text; Alex's exact words unconfirmed |
| "the auditor key should sit unused inside an **MPC or TEE custody setup** (think Utila or Fireblocks, not a Freighter wallet) and only answer scoped requests when a regulator compels one" | Alex, paraphrased | `2026-08-06.mdx:39` | Confirmed text |
| "an argument for shared deployments serving many customers under the same jurisdictional requirements, not one pool per app" | Alex, paraphrased (the clause may be Kaan's gloss) | `2026-08-06.mdx:59` | Confirmed text |
| "the key can even belong to a third party that doesn't exist on-chain" | Jay Geng (SDF core), paraphrased | `2026-08-06.mdx:37` | Confirmed text |
| "We welcome design partners… If you're building compliance-focused privacy solutions on Stellar…" | SDF blog, Confidential Tokens preview (2026-06-29) and SPP preview (2026-08-24) | stellar.org | Confirmed text |
| Moonlight "providers" (08-27); SPP "who deposits first?" and "just do it" (09-17) | Kaan | YouTube only | **UNCONFIRMED.** Every caption route was blocked from this machine |

What this supports:
- **One explicit ask, at one meeting.** It is written by SDF DevRel, partly in his own voice and partly paraphrasing SDF's privacy PM.
- **Plus design guidance** that matches this product: MPC/TEE custody, answering scoped requests only, shared multi-customer deployments.

What it does **not** support:
- "SDF staff asked repeatedly". The round-4 research report overstated this, and the overstatement is corrected there.
- Any statement by SDF, OpenZeppelin or Nethermind that they will *not* build this. None was found, so first-party work remains possible.

---

## 1. Actors and trust model

| Actor | Who | Trusted for | Not trusted for |
|:---|:---|:---|:---|
| **Holder** | An account owner on an OZ CT token, or a note owner in an SPP pool | Their own keys and their own disclosures | Completeness of what they disclose: a holder can cherry-pick (OZ `docs/selective-disclosure/security.md:32`) |
| **Issuer / pool operator** (tenant) | Deploys an OZ CT token or an SPP pool and names Tally as its auditor/ASP | Deciding *whether* to act: freeze, clawback, list policy | Decrypting alone; proving a clawback alone (OZ `docs/compliance.md:192-194`) |
| **Requester** | A regulator, auditor or tax authority acting under a stated legal basis, or the holder themselves | Holding a disclosure recipient key `(r_R, P_R)` | Receiving more than the approved scope |
| **Custodians** | *n* independent key-share holders: the tenant, Tally, and an independent third party | Running their share honestly and checking scope before contributing | Fewer than *t* of them acting together |
| **Tally** | The operator | Running the request workflow, the archive, the list projections, the transparency log, and one key share | Decrypting anything on its own, holding a quorum, or touching a tenant's admin keys |
| **Archives** | Tally's event archive plus at least one independent archive | Availability (OZ `docs/indexer.md:116-122`) | Integrity. Every proof and opening is checked against chain commitments |

**Design rule.** No single party, Tally included, can decrypt any amount, prove a clawback, or change a list unilaterally. Each section below states how that rule is enforced.

---

## 2. Auditor-key custody

### 2.1 What the protocols fix

**OZ CT [SG §D]:**
- The auditor key is one Grumpkin scalar `k` with `K_aud = k·H`. Registration accepts any valid point, with no proof of possession (OZ `auditor/storage.rs:120-149`; `docs/protocol/proof-system.md:185`).
- `k` must be a BN254 field element (`< r`), because circuits take `k_aud: Field` (OZ `circuits/clawback/src/main.nr:83-84`).
- `rotate_key` overwrites the key in place (OZ `auditor/storage.rs:104-116`). Rotation revokes nothing. Every historical key version must be kept, and rotation breaks proofs already in flight (OZ `docs/protocol/auditing.md:83-98`).
- `auditor_id` is fixed per account at registration (OZ `docs/protocol/account-state.md:35`).

**Routine decryption is linear in `k`:**
1. `S = k·R_e`
2. `s = Poseidon2(δ_ecdh, S.x, S.y)`
3. sponge masks, then subtraction (OZ `docs/protocol/auditing.md:21-27`).

**Two flows put `k` inside a proof as a private witness:**
- clawback (CB1; OZ `docs/compliance.md:198-225`);
- auditor-side disclosure (D-auditor A1; OZ `docs/selective-disclosure/circuits/d-auditor.md:26`).

**SPP:**
- The Global View Key is one Baby JubJub scalar `d`. It is immutable per pool, with no setter, and it is a constructor argument (SPP `docs/src/global_view_key.md:147-152`).
- Decryption is linear: `S = 8d·R`, then one Poseidon2 permutation.
- No SPP flow uses `d` as a proof witness.

**Consequences:**
- The curves differ, so **one secret cannot serve both systems**: two key families, two ceremonies.
- An SPP pool's custody committee must exist **before the pool is deployed**.

### 2.2 Options compared

| Option | Who can decrypt alone | Fits OZ routine decryption | Fits OZ clawback / D-auditor proofs | Fits SPP GVK | Operational cost | Verdict |
|:---|:---|:---|:---|:---|:---|:---|
| **A. Tally holds `k` in an HSM** | Tally (and whoever compromises it) | Yes | Yes (prove inside the HSM boundary) | Yes | Low | **Rejected.** It breaks the design rule |
| **B. Customer-held key** (tenant runs its own auditor; Tally supplies software) | The tenant | Yes | Yes | Yes | Low for Tally | **Supported as a mode, not the product.** It is "tooling, not operator" — the opposite of the ask (`2026-08-06.mdx:63`) |
| **C. Threshold custody, t-of-n Shamir shares from a distributed key generation (DKG); decryption by threshold ECDH** | Nobody below *t* | Yes: each custodian returns `k_i·R_e` with a DLEQ proof against `k_i·H`; the combiner interpolates `S` | **No, not directly:** the proof needs `k` as one witness | Yes: same structure with `8d_i·R` | Medium: DKG, share refresh, *n* online services | **Chosen for decryption** |
| **D. Commercial MPC custody** (e.g. Utila, Fireblocks, as `2026-08-06.mdx:39` suggests) | Nobody below the vendor's threshold | Only if the vendor supports Grumpkin / Baby JubJub scalar multiplication. **UNVERIFIED and unlikely**: such products target secp256k1/ed25519 signing, not ECDH on embedded BN254 curves | No | Same caveat | Vendor fees | **Open question to SDF** (§9). Not assumed |
| **E. TEE (attested enclave) holding `k`** | The enclave operator, if the TEE is broken | Yes | Yes | Yes | Medium; trust moves to hardware and attestation | **Used only as a short-lived proving step inside option C**, never for long-term storage |

### 2.3 Chosen design

**Routine decryption (OZ and SPP): 2-of-3 threshold custody** (option C).
- **Custodians:** the tenant's compliance function, Tally, and an independent custodian chosen by the tenant (for example its law firm or a second custody provider).
- **Rule:** at least one of the three must be neither the tenant nor Tally. The tenant's freeze and clawback signers must not hold a quorum of shares, which keeps CB1's separation between admin and auditor (OZ `docs/compliance.md:192-194`).
- **Key generation:** a Pedersen DKG over the relevant group, rejecting any output `≥ r` for OZ (the probability is negligible, but the check is mandatory). The group public key `K` is registered with a **proof of possession** — a threshold Schnorr signature over Grumpkin on `(auditor contract, auditor_id, K)` — published in the transparency log, because the registry itself checks none (OZ `docs/protocol/proof-system.md:185`).
- **Who combines:** the **requester**. Custodians encrypt their `k_i·R_e` contributions, with DLEQ proofs, to the requester's disclosure key `P_R`. Only the party entitled to the result ever holds `S`. Tally sees `S` only when Tally itself is the requester (for example, producing a tax export on a holder's instruction).
- **Share maintenance:** proactive re-sharing on a fixed schedule and whenever a custodian changes. This keeps `K` unchanged, so it avoids the blind windows and reverted proofs that `rotate_key` causes (OZ `docs/protocol/auditing.md:83-98`). `rotate_key` is reserved for suspected compromise of a quorum.
- **History:** shares for every key version are kept for the life of the archive (OZ `docs/protocol/auditing.md:89`).

**Proofs that need `k` as a witness (OZ clawback, D-auditor aggregates).**
1. *t* custodians release their shares to an attested TEE that runs the UltraHonk prover.
2. The TEE checks that a scope-approved request exists in the transparency log.
3. It reconstructs `k`, proves, zeroises, and publishes its attestation alongside the proof.

This is the weakest point of the design: for the duration of one proof, `k` exists in one place. Two alternatives would avoid it:
- a collaborative (co-SNARK) UltraHonk prover — none was found and none is assumed;
- a circuit change that proves over a threshold-produced `S` rather than `K = k·H` — a new VK, and a protocol change for CB1, which is registered on-chain.

Both go to SDF and OpenZeppelin as open questions (§9).

**Standing openings.** An auditor accumulates per-account Pedersen openings `(v, r)` that are as sensitive as `k` (OZ `docs/protocol/security.md:55`; `docs/sdk/auditor-client.md:11`). The opening store is held **additively secret-shared** among the same custodians. Folding an event into an opening is an addition, which works share-wise, so no custodian holds a cleartext balance.

**SPP Global View Key.**
- Same 2-of-3 DKG, but over Baby JubJub.
- It must run before the pool is constructed, because the key is a constructor argument.
- No proving step is needed.
- Compromise cannot be fixed by rotation. The only remedy is a new pool and user migration (SPP `docs/src/global_view_key.md:147-152`), and the tenant must accept that in writing.

---

## 3. Scoped audit requests

### 3.1 The request object

```text
AuditRequest {
  id, tenant: { kind: OZ_CT | SPP, contract, auditor_id? },
  requester: { identity, P_R (Grumpkin or Baby JubJub), nonce ν },
  legal_basis: { kind, reference, jurisdiction },      // free text + document hash
  subjects: [ Stellar address | SPP note public key ],
  period: { from_ledger, to_ledger },
  data: [ amounts_in | amounts_out | balance_checkpoints | allowance ],
  output: per_event | aggregate | statement,
  expires_at, notify_subject_after: duration | never_by_order,
  signatures: [ requester, approvers… ]
}
```

### 3.2 Who may ask, and who must approve

| Requester | Approvals needed before any custodian contributes |
|:---|:---|
| Holder, about their own accounts | The holder's signature with the account key. No custodian decryption is needed: holders disclose with their own `vk` (§4) |
| Tenant's own compliance function | Tenant signature plus the independent custodian's scope check |
| Regulator or court | Tenant signature (or a documented compulsion overriding it) plus the independent custodian's scope check plus Tally's check |
| Anyone else | Refused |

Each custodian applies the tenant's written **scope policy** independently, for example "no request wider than 90 days or 50 subjects without counsel sign-off". A request that fails any custodian's check cannot reach *t*.

### 3.3 How scope is enforced (cryptographically, not by promise)

- Custodians compute `k_i·R_e` **only for events they resolve themselves** from at least two archives. An event is in scope when it is emitted by the tenant contract, falls within `[from_ledger, to_ledger]`, and its `from`/`to` (OZ) or note key (SPP) matches a listed subject.
- A requester cannot smuggle in an out-of-scope `R_e`, because custodians never accept points from the requester.
- Each contribution is bound to `(request id, event id)` and encrypted to `P_R`.
- **Limit:** for OZ standing openings (balances), a contribution reveals the channel secret for that event's lanes, which include the post-operation balance. A "balance checkpoint at ledger L" request is therefore a narrower disclosure than "all amounts in the period", and the request form makes the requester choose explicitly.

### 3.4 Logging

**What is logged:**
- request receipt;
- every approval and refusal, with its reason;
- the event-id set resolved;
- every contribution released (custodian, event id, hash of the encrypted contribution);
- every TEE proving session (attestation hash);
- every list change (§5).

**How the log is protected:**
- An append-only, hash-chained log.
- Each custodian countersigns the log head daily.
- The head is anchored on Stellar daily, through a small log-anchor contract or a memo.

**Subject notification:**
- The default is after the period set in the request.
- Suppression requires `never_by_order` with a document hash.
- The log records suppressed requests even when the subject is not notified.

---

## 4. Selective-disclosure outputs

| Output | Who produces it | Circuit / mechanism | Completeness | State |
|:---|:---|:---|:---|:---|
| **Aggregate total of payouts** (funder to many recipients) | Funder, with its own `vk` | `tally_aggregate_nN` (D-sender, multi-sender, `n_active ≥ MIN_ACTIVE` in-circuit). Verified off-chain; the verifier resolves every public input from chain | Yes for the declared lanes and window: the round registry fixes them in advance, and every transfer publishes its sender | **Built** (n = 8/16/64; v0.9.0) |
| **Per-period total, sender side** | Holder | Same circuit. The verifier enumerates every transfer *from* the account in `[from, to]` and requires all of them to be covered (the declared-window rule, without a registry) | Yes: outbound transfers are enumerable by their public `from` | Circuit built; **verifier mode missing** |
| **Per-counterparty total** (A paid B in a period) | Holder (sender) | Aggregate variant with a public `pvk_b` constant across active slots (one extra equality per slot) | Yes for outbound, as above | **Missing**: new circuit and VK |
| **Inbound totals** (what A received) | Holder (recipient) | D-recipient aggregate: amounts recovered with the recipient's `vk` (OZ `docs/selective-disclosure/circuits/d-recipient.md`, `aggregate.md`) | **No**: the holder can omit inbound events; OZ says completeness requires the auditor (`security.md:32`) | **Missing** |
| **Auditor-attested totals** (completeness backstop) | Custodians plus a TEE proving step (§2.3) | D-auditor aggregate (OZ `d-auditor.md`; `k` as witness) | Yes: the auditor channel sees every event of bound accounts | **Missing**; depends on §2.3's TEE step |
| **Tax export** | Holder, locally (non-custodial); optionally countersigned by Tally | For one account and period, a statement file listing each event: ledger, tx hash, counterparty, direction and amount, decrypted locally with the holder's own `vk`. Each line references the chain event. It is accompanied by the per-period sender-side aggregate proof (outflows) and the D-recipient aggregate (inflows), so a tax adviser can check totals against proofs. CSV and JSON | Outbound complete; inbound holder-asserted unless an auditor-attested total is attached | **Missing** |
| **SPP receipts** | SPP note owner | SPP's own disclosure receipt (Groth16, reveals amounts to the holder of the receipt; SPP `docs/src/disclosure.md:3-54`) | Per note | Upstream; Tally only verifies and pins VK hashes |

**Rules carried from the existing code** (`docs/SDK-SAFETY-INVARIANTS.md`):
- the anonymity-set floor (`MIN_ACTIVE`) is enforced in the circuit;
- a verifier never takes public inputs from the prover's bundle;
- disclosure proofs are zero-knowledge (`keccakZK`);
- verification keys are pinned.

**What the tax export does not do:** fiat valuation, jurisdiction-specific tax computation, or filing. It is a verifiable transaction statement, not tax advice.

---

## 5. Allow / deny lists for both systems

The two systems' list semantics differ, so no single on-chain list can serve both [SG §C]:
- **OZ:** a synchronous boolean `Policy::is_authorized(account, token)` over Stellar addresses (OZ `compliance/mod.rs:50-55`). OpenZeppelin ships no implementation in v0.9.0; Remi ships ownable allowlist/blocklist policies for its own suite [OV].
- **SPP:** Merkle trees over note public keys. The allowlist is append-only, with no delete (SPP `contracts/asp-membership/src/lib.rs:115-252`). The blocklist root must equal the current root at proof time (SPP `contracts/pool/src/pool.rs:507-511`).

**Design: one canonical subject registry, two projections.**

1. **Canonical registry (off-chain, Tally).** For each subject:
   - identity reference (no personal data on-chain);
   - screening status and source (a sanctions/KYT feed; candidate provider Merkle Science, SCF #41 — a partnership is not established);
   - per-tenant decisions;
   - linked identifiers: Stellar addresses, and SPP note public keys the subject registered at admission.
2. **OZ projection: `TallyPolicy` contract.** One contract serving many tokens; the `token` argument selects per-tenant rules (OZ `docs/compliance.md:87`).
   - **Modes:** allowlist, denylist, both.
   - **Updates:** batched, emitting events.
   - **Signing:** a 2-of-3 multisig of tenant, Tally and the independent party.
   - **Timing:** additions to a denylist take effect at once; removals from a denylist and additions to an allowlist need the tenant signature plus one other.
3. **SPP projection: Tally runs the ASP contracts for the pool.**
   - **Admission:** the subject passes KYC, then submits the leaf `Poseidon2(notePubKey, membershipBlinding)` produced by the SPP SDK. Tally inserts it.
   - **Blocking:** the subject's registered note keys go into the non-membership tree.
   - **Removal from the allowlist is impossible** (no delete), so a "removal" is a blocklist insertion, and the tenant is told so in writing.
   - **Cadence:** blocklist updates invalidate proofs in flight (exact-root rule), so they are batched on a published schedule (for example hourly), with an emergency path for sanctions hits.
4. **Appeals.** A subject can contest a listing through the tenant. Reversal follows the same signing rules, and both listing and reversal are recorded in the transparency log (§3.4).

**Known limit.** A blocked subject who generates fresh SPP note keys outside the admission flow is not caught by the blocklist. On allowlist pools, admission is the control; on blocklist-only pools, this is a residual risk the tenant accepts in writing.

---

## 6. What Tally implements, what is missing, and what must change

| Area | Implemented today (this repository) | Missing | Must change |
|:---|:---|:---|:---|
| Confidential-token client | `ct/sdk`: v0.9.0 crypto, witnesses, payloads, events, state, proving; 19/19 conformance vectors | Auditor client (three-lane decryption, standing openings, `clawback_nonce` folding) | Package as a library rather than repository-internal code |
| Disclosure circuits | `tally_aggregate_n{8,16,64}` (multi-sender D-sender, in-circuit floor, ZK) | Per-counterparty variant, D-recipient aggregate, D-auditor aggregate | Move the circuit-ID registry and VK pinning into a published, versioned manifest |
| Verifier | `tally verify` CLI (chain-resolved inputs, VK pinning, retention detection, typed exit codes) | Per-period verifier mode; historical auditor-key lookup (needed by D-auditor; OZ `docs/selective-disclosure/protocol.md:84`) | Read events from conforming archives as well as RPC |
| Completeness anchor | `round-registry` contract (soroban-sdk 28; 16 tests) | — | — |
| Registration | Headless non-custodial derivation following OZ `docs/sdk/key-derivation.md`; live-testnet test | Wallet UI | — |
| Key custody | None | DKG (Grumpkin and Baby JubJub), threshold ECDH with DLEQ, share refresh, PoP publication, TEE proving step, secret-shared opening store | — |
| Request workflow | None | Request API, approvals, scope engine, encrypted contribution delivery | — |
| Transparency log | None | Hash-chained log, custodian countersignatures, daily on-chain anchor | — |
| Lists | None | Canonical registry, `TallyPolicy` contract, SPP ASP operation, screening-feed integration | — |
| Event archive | None (verification relies on ~7 days of RPC retention) | An archive meeting OZ `docs/indexer.md` C2–C4, plus an independent second archive | — |
| Tax export | None | Statement generator and format specification | — |
| Payout flow | Demo fan-out, one transfer per transaction | Batching (four per transaction, measured in `MEASUREMENTS.md`) | Extract the payout logic from `demo/run-round.ts` into the library |

---

## 7. Threat model

| # | Component | Abuse or failure | Impact | Mitigation | Residual |
|:--|:---|:---|:---|:---|:---|
| T1 | Key shares | *t* custodians collude | Full decryption for every account bound to that `auditor_id` (OZ `security.md:53-55`) | Independent custodians, one of whom must be neither tenant nor Tally; signed custody agreements; transparency log of every contribution | Collusion of *t* is undetectable cryptographically; contractual deterrence only |
| T2 | Key shares | One share stolen | None by itself | Shares held in separate HSMs; proactive re-sharing invalidates stolen shares | A thief who collects *t* shares across epochs before a refresh |
| T3 | DKG | Biased or backdoored key; key ≥ r | Unusable or weak key | Verifiable DKG transcript published; range check; PoP published | — |
| T4 | Registry | Admin registers a key nobody holds (no PoP on-chain) | Auditing silently blinded | Tally publishes PoP; verifiers and tenants check the PoP before trusting an `auditor_id` | Holders who never check |
| T5 | TEE proving step | TEE compromise or side channel during reconstruction | `k` exposed | Reconstruction only for logged, approved requests; attestation published; short sessions; vendor-diverse TEEs | Hardware-level attacks; this is the weakest point (§2.3) |
| T6 | Request workflow | Over-broad scope; forged legal basis | Excess disclosure | Independent scope checks by each custodian; tenant scope policy; requester identity verification; requests logged and, by default, notified | Approvers who rubber-stamp |
| T7 | Request workflow | Requester smuggles out-of-scope events | Excess disclosure | Custodians resolve events themselves from ≥ 2 archives and never accept `R_e` from the requester | Archive collusion (see T10) |
| T8 | Contributions | Custodian returns a wrong partial | Wrong amounts | DLEQ proof per contribution; the combiner checks against the on-chain commitment | — |
| T9 | Standing openings | Opening store leaked | Current balances of all bound accounts | Openings additively secret-shared; never held in the clear by one party | — |
| T10 | Archives | Archive omits or forges events | Incomplete scope or verification | ≥ 2 independent archives; every opening checked against on-chain commitments (OZ `indexer.md:116-122`); RPC cross-check within the window | All archives colluding to omit |
| T11 | Disclosure verifier | Verifier takes inputs from the bundle | Forged totals | Verifier resolves every input from chain (existing rule, enforced in `cli/tally.ts`) | — |
| T12 | Holder disclosures | Holder omits inbound events | Under-reported inflows | Inbound totals are labelled holder-asserted; completeness only via auditor-attested totals | — |
| T13 | Aggregate privacy | Small-n aggregate reveals individual amounts | Per-recipient disclosure | In-circuit `MIN_ACTIVE`; `n_active` public | Repeated aggregates over overlapping sets (differencing) — needs request-history checks (not designed yet) |
| T14 | OZ lists | Policy signer key theft | Arbitrary freezes and unfreezes | 2-of-3 multisig; logged; asymmetric rules for loosening | Quorum theft |
| T15 | SPP lists | Blocklist update invalidates in-flight proofs | User transactions fail | Published batch schedule; user notification | Emergency updates still break proofs |
| T16 | SPP lists | Allowlist cannot remove | Removed subject still a member | Blocklist insertion; disclosed to tenant | On pools without a blocklist, removal is impossible |
| T17 | SPP GVK | GVK quorum compromised | Every future note readable | Same custody as T1/T2 | No rotation: new pool and migration only |
| T18 | Clawback | Admin and auditor collude | Seizure without due process | Separate signers; clawback requires a logged request through the same workflow | Tenant governance |
| T19 | Operator outage | Tally unavailable | Requests stall; lists frozen | Custodians able to run without Tally for decryption (Tally is one of three); list contracts remain readable | List updates pause |
| T20 | Upstream change | OZ or SPP changes cryptography (as v0.9.0 did) | Silent mismatch; failed decryption | Pinned revisions; conformance vectors in CI; coordinated uplift (`SDK-SAFETY-INVARIANTS.md` §I3) | Upstream timing |
| T21 | Regulatory | Operator compelled to act outside policy | Disclosure beyond the tenant's policy | Tally holds one share only; compulsion of Tally alone cannot reach *t* | Compulsion of *t* custodians in one jurisdiction; spread custodians across jurisdictions |

---

## 8. Overlap, stated strictly [OV]

| Candidate | Overlap |
|:---|:---|
| **Remi** (SCF #44, $133.7k) | **High.** A confidential-token suite on OZ CT (`539968f`) with an auditor registry, compliance hooks, allowlist/blocklist policies and planned auditor dashboards. It serves its own remittance flows, and plans payouts through Anchor Platform. Single-auditor escrow; no threshold custody, scoped-request workflow, aggregates or tax export found. Code: `Remi-FZC-LLC/stellar-confidential-token` @ `1142ca5` (last push 2026-08-16) |
| **Arcane** (SCF #42) | **High in function, different stack.** Scoped disclosure by role, app and time window, with logging, on its own shielded pool, not OZ CT or SPP |
| **Nethermind SPP** | Supplies the ASP contracts, a demo admin page, receipts and a GVK library; leaves the operator role open |
| **OpenZeppelin** | Supplies the specs, example auditor registry and demo auditor UI; states it is a tooling provider |
| **ZKELLA, Moonlight, Hypertron, Safeguard, others** | Partial, each for its own stack or unfunded [OV] |
| **SDF first-party** | None found; SDF is asking rather than building |

**Unclaimed, strictly:**
- threshold custody of either auditor key;
- an operator serving *other* issuers across both systems;
- cryptographically scoped audit requests with a public log;
- aggregate, per-period and per-counterparty disclosure proofs;
- tax export;
- one subject registry projected into both systems' lists.

**Partly claimed:** compliance for confidential one-to-many payouts on OZ CT (Remi's plan).

---

## 9. Open questions for SDF's privacy team

1. **Operator role.** Is a third-party compliance operator serving several issuers (Alex's "shared deployments") what SDF wants funded, or should each issuer run its own? Would SDF introduce issuers or anchors who need one?
2. **Custody guidance.** The 2026-08-06 notes suggest Utila or Fireblocks. Does either support scalar multiplication on Grumpkin (OZ) or Baby JubJub (SPP)? If not, does SDF accept threshold ECDH with an attested-TEE proving step as "real key management"?
3. **Proving with a shared key.** Would OpenZeppelin consider a clawback or D-auditor circuit variant that proves over a threshold-produced shared point instead of `K = k·H` as a private witness? Is SDF aware of a collaborative UltraHonk prover?
4. **Versioned auditor registry.** OZ calls an activation-ledger registry "an optional production target" (`docs/protocol/auditing.md:79`). Will one ship, or should operators index `AuditorRotated` events?
5. **Proof of possession.** Would OZ add PoP to `register_key`, or should the operator publish it off-chain?
6. **Mainnet.** What are the conditions and the expected timing for Confidential Tokens on mainnet? What is the status of SPP's audit and trusted-setup ceremony? Our mainnet tranche depends on both.
7. **Canonical branch.** OZ `main` (`b40c5ea`) and `v0.9.0` diverge (no clawback or docs split on `main`). Which will mainnet use?
8. **SPP compliance gaps.** Are KYT-on-deposit and a ragequit path planned? Without ragequit, who bears trapped funds after a delisting?
9. **Lists.** Would SDF or OZ prefer one shared `Policy` registry across issuers (the 2026-09-24 guest post's "common policy registry") run by a neutral operator, and what governance would it expect?
10. **Archives.** OZ asks deployments to run or contract "at least two" archives. Does SDF plan to run one, so that operators can cross-check?
11. **Jurisdiction.** Which jurisdiction and use case would SDF most like to see demonstrated first ("pick a jurisdiction and a use case")?
12. **Overlap.** How does SDF see this alongside Remi's funded auditor and compliance plans on the same standard?
