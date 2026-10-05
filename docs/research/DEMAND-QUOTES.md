# Demand quotes: did SDF ask for a privacy compliance / auditor / allow-deny "operator"?

Researched 2026-10-05. Research only: nobody was contacted, nothing was posted, no git commands were run.

**What this checks.** The claim in `scf-research/ROUND4-STATED-DEMAND-REPORT.md` §2 item 1 and `scf-research/sources/round4/r4d-sdf-meetings-community.md` (records D3, D4) is that SDF staff repeatedly asked someone to build a privacy compliance, selective-disclosure, auditor or allow/deny-list **operator** for OpenZeppelin Confidential Tokens (CT) and Nethermind Stellar Private Payments (SPP). Every quote below was re-read from the primary source in this session. Nothing was copied from r4d.

**Bottom line.**
- **Confirmed in written SDF material: one meeting.** On 2026-08-06 the official notes say "Nobody is building that platform for you. Hint." and "Alex's main ask: … go **be the operator**". Both are at `meetings/2026-08-06.mdx` lines 61 and 63.
- **Kaan Kacar wrote those notes.** He is in the frontmatter (`authors: kaankacar`), he opened and merged PR #2751, and the notes were published on 2026-08-19, 13 days after the call. The "Alex's main ask" line is Kaan's paraphrase of Alessandro Voto. It is not a verbatim transcript. Alex did not review the PR (the only approver was `wmendes`).
- **Read in context, "be the operator" means operating a compliant confidential-token deployment** for a chosen jurisdiction and use case: "sanction lists, allow/deny lists, compliance hooks". Line 59 ("shared deployments serving many customers under the same jurisdictional requirements, not one pool per app") supports reading this as a shared, multi-customer operator. The quote is not specifically "build auditor-key custody as a service".
- **Other SDF channels contain softer asks.** The CT and SPP developer-preview blogs ask for "design partners" from teams "building compliance-focused privacy solutions". Neither says that the operator role is unfilled.
- **The "repeatedly" in the claim is not supported by written SDF sources.** All other 2026 notes (06-11 to 08-13) contain no operator, auditor-service or allow/deny ask. The caption-only meetings are covered in §3.

---

## 1. Sources read

| # | Source | Loaded? | Method | Notes |
|---|---|---|---|---|
| S1 | `stellar/stellar-docs` `meetings/2026-06-11 … 2026-08-13.mdx` (9 files: 06-11, 06-18, 06-25, 07-02, 07-16, 07-23, 07-30, 08-06, 08-13) | yes | `gh api repos/stellar/stellar-docs/contents/meetings/<date>.mdx --jq .content \| base64 -d`. Line numbers below are file lines. | No notes exist after 08-13. The notes directory listing ends at `2026-08-13.mdx`. Every file has `authors: kaankacar`. |
| S2 | https://developers.stellar.org/meetings/2026/08/06 | yes (HTTP 200) | curl + grep | The rendered page contains the same "be the operator" and "Nobody is building that platform for you" text. |
| S3 | stellar-docs PR #2751 (commits d5b25ef2 and a954d088, reviews, review comments) | yes | `gh pr view`, `gh api …/pulls/2751/{commits,comments}` | Author and merger is kaankacar. Approved by wmendes. Commits are dated 2026-08-14 and the merge 2026-08-19. Lines 61 and 63 are identical in the first and final commits. The only post-review edits were Copilot-prompted corrections to the auditor-registry and archive wording (lines 41, 49, 55). |
| S4 | YouTube metadata (yt-dlp `--print`) for 7nta-uFWiRY (08-06, 1:00:50), SesCqhylBYw (08-13), npqRSfq-rWA (08-20), 5dVgKuapDPg (08-27), fzUx9zoE0JU (09-03), QO40dHfJO9Y (09-17), 0CqboqwZnH4 (09-24), Zo8LK7puSTc (10-01), FxOz4jo3QIE (CT preview, uploaded 2026-07-03, 30:09), e4VNVdQ4ESI (SPP preview, uploaded 2026-08-29, 29:46) | yes | yt-dlp 2026.08.19 via `uv tool run` | Titles and durations were confirmed. |
| S5 | YouTube auto-captions for the videos in S4 | **no, from this machine** | `youtube-transcript-api` failed (IpBlocked). yt-dlp (default, `--impersonate chrome`, and android_vr/web_embedded/ios/mweb clients) failed (HTTP 429). A direct curl and WebFetch of the unsigned-IP timedtext URL also failed (429). Invidious mirrors failed (502/500/HTML). youtubetotranscript.com and youtube-transcript.io returned 403, and tubetranscript.com returned no transcript. | I could not use the local Chrome because selecting one of three connected browsers needs the user. A remote cloud agent was tried; see §3 for the result. |
| S6 | stellar.org blog, "Practical Confidential Stablecoins: An Issuer-Controlled Architecture", Boyan Barakov (OpenZeppelin), dated 2026-09-24 (page JSON `"date":"2026-09-24"`) | yes | curl + BeautifulSoup text | This is the "common policy registry" post. |
| S7 | stellar.org blog, "Developer Preview: Confidential Tokens on Stellar", Maryam Mazraei, 2026-06-29 | yes | same | |
| S8 | stellar.org blog, "Developer Preview: Stellar Private Payments", Maryam Mazraei, 2026-08-24 | yes | same | |
| S9 | stellar.org blog, "financial-privacy" ("Your Paycheck Is Private…"), James Bachini | yes | same | **Dated 2026-01-15 in page JSON, not 09-28 as r4d says.** 09-28 is the sidebar date of a different post (Soroban Rust SDK v28). It is out of the June-onward window and contains no operator ask. |
| S10 | stellar.org sitemap, filtered for privacy, confidential, compliance, ZK and audit slugs | yes | curl | The only privacy posts dated 2026-06 or later are S6, S7 and S8. |
| S11 | OpenZeppelin site sitemap (openzeppelin.com/news) | yes | curl | **No OpenZeppelin-hosted post on Stellar confidential tokens or a policy registry was found.** The "OZ blog of 2026-09-24" is the stellar.org guest post S6. |
| S12 | Nethermind blog, "Stellar Private Payments: Confidential and Compliant Transfers on Public Rails" (Antonio Larriba, Stefano De Angelis; `datePublished: Jul 16, 2026`) | yes | curl + BeautifulSoup | Used for counter-evidence: who runs the ASP. |
| S13 | GitHub repos: `NethermindEth/stellar-private-payments` README and tree; `brozorec/stellar-confidential-token-demo` tree; `OpenZeppelin/stellar-contracts` tree; `Caxton-Dev-Hub/stellar-confidential`; `stellar-huub/stellar-confidential`; `aguilar1x/stellar-confidential-token-sdk` | yes | `gh api` | Used for counter-evidence. |

Speaker identification method: the 08-06 notes name the guests at line 15 ("Alessandro Voto (goes by Alex), senior product manager of privacy at SDF"; "Jay Geng, a stellar-core engineer at SDF"). The notes are written in Kaan's first person ("I collected…", "I asked chat's version directly"). Kaan's authorship comes from the frontmatter and from PR #2751. Each attribution below follows the notes' own "Alex's…", "Jay's…" or first-person wording.

---

## 2. Meetings with docs notes (CONFIRMED text; attribution is the note-writer's)

### 2.1 2026-08-06, "Live from Stellar House" (Confidential Tokens Q&A). Video `7nta-uFWiRY` (1:00:50). Notes author: Kaan Kacar.

The notes carry no timestamps. The video is a full-hour Q&A, and the notes follow the order of the call: "Timing Leaks… Road to Mainnet" is the second-to-last section before the agentic-payments "Bonus Round" and the closing. Lines 59 to 63 therefore probably fall around **0:45 to 0:55**. That is an **estimate from section order, not a verified timestamp**, because the captions could not be loaded.

| # | Speaker (per notes) | Role | Exact quote | Source | Status |
|---|---|---|---|---|---|
| 1 | Kaan Kacar (editorial, first person) | SDF senior developer advocate, meeting host and notes author | "On observability: the OpenZeppelin demo ships an auditor interface showing all transactions and amounts (deliberately open there; keep it behind custody in real life), but scoped audit requests, monitoring, and selective-disclosure tooling — say, sharing your confidential history with a service so you can do your taxes — are wide-open design space. Nobody is building that platform for you. Hint." | `meetings/2026-08-06.mdx:61` | **Confirmed (notes).** The sentence is in Kaan's narrative voice and is not attributed to Alex or Jay. "Hint." is Kaan's. Unchanged since first commit d5b25ef2. |
| 2 | Alessandro "Alex" Voto (paraphrased by Kaan) | SDF senior PM, privacy | "Alex's main ask: OpenZeppelin is a _tooling_ provider, not an operator. Pick a jurisdiction and a use case and go **be the operator** — sanction lists, allow/deny lists, compliance hooks — and show everyone what best practice looks like." | `meetings/2026-08-06.mdx:63` | **Confirmed (notes)** as Kaan's paraphrase. It is **not a verbatim Alex quote**: there are no quotation marks and it was written 8 to 13 days later. Alex's exact words are unconfirmed (no captions). |
| 3 | Alessandro Voto (paraphrased) | SDF senior PM, privacy | "These systems **benefit from scale**: more parties, purposes, and denominations all make correlation harder — an argument for shared deployments serving many customers under the same jurisdictional requirements, not one pool per app." | `meetings/2026-08-06.mdx:59` | **Confirmed (notes).** The previous sentence ("Alex didn't dodge it") makes Alex the speaker, but the "an argument for…" clause may be Kaan's gloss. |
| 4 | Alessandro Voto (paraphrased) | SDF senior PM, privacy | "there's **selective disclosure**, which is user-initiated (\"I can prove this payment happened to whoever I choose\"), and there's compelled revelation through the auditor key. The intention is _not_ that someone sits watching the pool — the auditor key should sit unused inside an **MPC or TEE custody setup** (think Utila or Fireblocks, not a Freighter wallet) and only answer scoped requests when a regulator compels one. A single auditor address does not mean a single person; put real key management on it. Alex would be shocked if you didn't." | `meetings/2026-08-06.mdx:39` | **Confirmed (notes).** This is design guidance, not an explicit "someone please build this". |
| 5 | Jay Geng (paraphrased) | SDF stellar-core engineer | "Amounts are encrypted under the sender's and recipient's keys — and, in addition, under the **auditor's key**. Whoever holds that viewing key can decrypt the same information, no cooperation required. Policies — who can audit, rotation, key lifetime — don't have to live in the contract logic; it just cares that the key exists. It's decoupled and modular — the key can even belong to a third party that doesn't exist on-chain." | `meetings/2026-08-06.mdx:37` | **Confirmed (notes).** It states that a third-party auditor is possible by design. It is not an ask. |
| 6 | Kaan Kacar (author correction) | SDF DevRel | "the shipped implementation binds an `auditor_id` per account at registration, out of a shared auditor registry that can hold many keys and serve many tokens — design your compliance around that, not around a single global key." | `meetings/2026-08-06.mdx:41` | **Confirmed (notes).** Added in commit a954d088 after a Copilot review comment. |
| 7 | Alessandro Voto (paraphrased) | SDF senior PM, privacy | "The SDF position pairs privacy with **compliance readiness**: the tools ship with freezing, clawback, and Stellar Asset Contract passthroughs, deliberately open-ended because disclosure requirements differ by jurisdiction — you figure out what \"legal\" means where you operate, and the boundaries enforce it." | `meetings/2026-08-06.mdx:23` | **Confirmed (notes).** The sentence comes in Alex's paragraph (line 21: "Alex pushed back…"). |
| 8 | Jay Geng (paraphrased) / Kaan | SDF core / DevRel | "OpenZeppelin's spec is blunt about this — recovery from seed requires a durable event archive, and they publish an indexer specification for exactly that — so wire up infrastructure with the retention you actually need" | `meetings/2026-08-06.mdx:55` | **Confirmed (notes).** Archive and indexer requirement. The wording was rewritten in a954d088. |
| 9 | Alessandro Voto (paraphrased) | SDF senior PM, privacy | "If you need counterparty privacy, **Nethermind's Stellar Private Payments** is a privacy-pool toolkit that shields amounts _and_ addresses." | `meetings/2026-08-06.mdx:31` | **Confirmed (notes).** This is the only privacy-pool mention in the notes. |
| 10 | Alessandro Voto (paraphrased) | SDF senior PM, privacy | "ideally ending as a plain checkbox in your wallet that says _make this transaction private_, done compliantly, from mainnet day one." | `meetings/2026-08-06.mdx:71` | **Confirmed (notes).** |

### 2.2 2026-08-13, Builder Summit São Paulo winners. Video `SesCqhylBYw`. Notes author: Kaan.

| # | Speaker | Role | Exact quote | Source | Status |
|---|---|---|---|---|---|
| 11 | Kaan Kacar | SDF DevRel | "Second place went to a **Confidential Token SDK** — a TypeScript client for OpenZeppelin's confidential tokens, with a verifiable replay archive. If you read the July 2 note on the confidential-token developer preview, this is exactly the tooling layer that preview was begging for." | `meetings/2026-08-13.mdx:29` | **Confirmed (notes).** This is a client SDK and archive, not an operator. |
| 12 | Kaan Kacar (relaying Teague) | SDF DevRel | "a bounty program … pointed squarely at what we want to see built on the network: privacy, anchors and ramps, local yield, and agentic payments and tooling." | `meetings/2026-08-13.mdx:21` | **Confirmed (notes).** "Privacy" is a priority area, but no operator is named. |
| 13 | Kaan Kacar | SDF DevRel | "Second place: **Green Road** by **Trustless Work** — a confidential milestone escrow that releases a private allowance without revealing the amount." (track: "Enterprise Compliance & RWA") | `meetings/2026-08-13.mdx:33-35` | **Confirmed (notes).** |

### 2.3 2026-07-02, "A Week About Privacy" (same day as the CT preview). Video `N7PtAJaELzA`. Notes author: Kaan.

| # | Speaker | Role | Exact quote | Source | Status |
|---|---|---|---|---|---|
| 14 | Kaan Kacar | SDF DevRel | "Only the holder — and optionally an **auditor** who holds a decryption key — can read the balance, which is how you'd add a compliance layer." | `meetings/2026-07-02.mdx:53` | **Confirmed (notes).** Descriptive, with no ask. |

### 2.4 2026-07-23, Hypertron guest. Video `0RpAMlqRmkY`. Notes author: Kaan.

| # | Speaker | Role | Exact quote | Source | Status |
|---|---|---|---|---|---|
| 15 | Sweta (Hypertron co-founder), as reported by Kaan | Ecosystem team, not SDF | "Hypertron's target is **linkability** — nobody should be able to learn who pays whom — while keeping compliance deliberately open through **viewing keys**, so an auditor with the right key can still see what regulators need to see. … compliance intentionally left open." | `meetings/2026-07-23.mdx:37` | **Confirmed (notes).** A third team that leaves the compliance role open. |
| 16 | Kaan Kacar | SDF DevRel | "A private payments product for businesses is a whole different level of hard, and I'd love to see more projects emerge in this lane." | `meetings/2026-07-23.mdx:51` | **Confirmed (notes).** A general ask for B2B private payments products. It does not mention an operator. |

### 2.5 2026-07-16 (Raven). Video `Zv_scYurQMI`. Notes author: Kaan.

| # | Speaker | Role | Exact quote | Source | Status |
|---|---|---|---|---|---|
| 17 | Kaan Kacar | SDF DevRel | "Best mini case study of the call came from Bri, who is building an application with confidential token transfers and used Raven as a **research tool**" | `meetings/2026-07-16.mdx:66` | **Confirmed (notes).** Shows a CT builder exists. No ask. |

### 2.6 Other notes with privacy mentions but no operator or compliance ask

- `2026-06-18.mdx:15` and `2026-06-25.mdx:46` list ZK hackathon scope, including "privacy pools, private payments, confidential tokens, identity and compliance proofs". This is hackathon scope, not an operator ask.
- `2026-06-11`, `2026-07-30`: no relevant passages. 07-30 line 60 only previews that "Next week we talk confidential tokens with more SDF folks".

---

## 3. Meetings without notes (captions)

**I could not get any captions, so this section has no quotes.** Every route failed:
- this machine: youtube-transcript-api IpBlocked; yt-dlp HTTP 429 on all clients, with and without browser impersonation;
- WebFetch on the timedtext URL: 429;
- the transcript sites and Invidious mirrors;
- a second agent that was meant to run on a different network: same IpBlocked and 429 results.

The local Chrome extension was not used, because choosing one of the three connected browsers needs the user.

The videos exist and their metadata loaded (S4), but I did not read their contents. The table lists, without quoting it as evidence, what r4d attributes to each one, so a later pass can check it.

| Video | Date (upload) | Length | r4d claim (NOT verified here) | Status |
|---|---|---|---|---|
| npqRSfq-rWA dev meeting 08/20 | 2026-08-21 | 1:12:49 | Social login / C-address asks (D9). Not about privacy. | **UNVERIFIED** |
| 5dVgKuapDPg dev meeting 08/27 (Moonlight) | 2026-08-28 | 58:10 | Kaan, about 28 min: "a few months after launching on mainnet I'd love to see a lot of providers providing a lot of opportunities for companies to just link into this private layer" | **UNVERIFIED (would be auto-captions)** |
| fzUx9zoE0JU dev meeting 09/03 | 2026-09-04 | 56:25 | No privacy-operator claim in r4d | not checked |
| QO40dHfJO9Y dev meeting 09/17 (SPP, Antonio Larriba) | 2026-09-17 | 48:31 | Kaan: "who deposits first?… how does a pool on mainnet bootstrap an anonymity set?" (about 30 min); "one pool that is configurable and interoperable…" and "anyone watching in Istanbul during the hackathon, just do it then" (about 26–28 min). Antonio: "association set providers are the parties in charge of running these sets" (about 10–14 min); KYT-on-deposit and ragequit are being built by Nethermind (about 24 min) | **UNVERIFIED (would be auto-captions)** |
| 0CqboqwZnH4 dev meeting 09/24 | 2026-09-24 | 55:40 | No privacy-operator claim in r4d | not checked |
| Zo8LK7puSTc dev meeting 10/01 | 2026-10-02 | 1:01:19 | DVN operators (D15). Not about privacy. | not checked |
| FxOz4jo3QIE CT developer preview (Boyan Barakov, OZ, and Alessandro Voto) | 2026-07-03 | 30:09 | r4d: "None of them had SDF asks" | not checked |
| e4VNVdQ4ESI SPP developer preview (Antonio Larriba and Alessandro Voto) | 2026-08-29 | 29:46 | r4d: "None of them had SDF asks" | not checked |
| 7nta-uFWiRY dev meeting 08/06 | 2026-08-07 | 1:00:50 | The notes exist (see §2.1), but Alex's verbatim wording could not be checked against audio | notes confirmed; speech UNVERIFIED |

**Effect on the claim.** If the 09/17 and 08/27 quotes hold up, they are SDF DevRel (Kaan) asking for SPP pool bootstrapping and Moonlight "providers". Those are adjacent to an ASP or operator role, but they come from one person (Kaan) and are not written SDF policy. Until someone checks them, the written record has **one** SDF operator ask: 08-06, Kaan's paraphrase of Alex. It also has **two** soft blog calls for "compliance-focused privacy solutions" (B7, B8).

To finish this, run `yt-dlp --write-auto-sub --skip-download --sub-lang en <url>` from a residential IP, or open each video's "Show transcript" panel in a signed-in browser. Quotes from that would be marked UNCONFIRMED (auto-captions).

---

## 4. Blogs and posts, 2026-06 onward (CONFIRMED, exact text)

| # | Author | Role | Exact quote | Source | Status |
|---|---|---|---|---|---|
| B1 | Boyan Barakov | OpenZeppelin senior OSS developer (guest post on stellar.org) | "Identity verification and participant screening are offchain processes. They may involve an issuer's internal systems, specialized service providers, or a shared registry used across multiple assets. The token contract does not need to reproduce these systems. Its role is to enforce their outcome." | stellar.org/blog/developers/practical-confidential-stablecoins-an-issuer-controlled-architecture, section "External Policy Enforcement", 2026-09-24 | Confirmed |
| B2 | Boyan Barakov | OZ | "An issuer operating several stablecoins across different jurisdictions can point multiple token contracts to a common policy registry. The policy can evolve without requiring the core confidential layer to be redesigned." | same, "External Policy Enforcement" | Confirmed. **This describes an issuer-run design option, not a request for a third-party operator.** |
| B3 | Boyan Barakov | OZ | "When addresses remain public, the token contract can apply controls to a specific account. An authorized operator can restrict an identified address, while external policy systems can determine whether an account is permitted to participate." | same, "The Case for Visible Identities" | Confirmed. "Operator" here means the token's admin role. |
| B4 | Boyan Barakov | OZ | "These capabilities do not make a stablecoin deployment compliant by themselves. They define the technical building blocks that an issuer can combine with proper governance, security, legal, and operational processes." | same, "Design Requirements…" | Confirmed. Consistent with "OZ is a tooling provider, not an operator". |
| B5 | Boyan Barakov | OZ | "the token implements a scoped, dual-auditor model … The inbound channel gives the recipient's auditor visibility into the incoming transfer. The outbound channel gives the sender's auditor visibility into the amount transferred and the sender's remaining post-transaction balance." | same, "Scoped Audit Visibility" | Confirmed |
| B6 | Maryam Mazraei | SDF (blog author) | "Configurable compliance policy engine. Lets you plug in policy contracts that act as allow-list or block-list identity registries." | stellar.org/blog/developers/developer-preview-confidential-tokens-on-stellar, "What's in this version", 2026-06-29 | Confirmed |
| B7 | Maryam Mazraei | SDF | "We welcome design partners and community contributions—If you're building compliance-focused privacy solutions on Stellar, an SCF cohort member or joined our recent Stellar Hacks: Real-World ZK hackathon—share what you're working on in our Developer Discord." | CT preview blog, "Try it yourself", 2026-06-29 | Confirmed. **A soft, explicit SDF call for "compliance-focused privacy solutions".** |
| B8 | Maryam Mazraei | SDF | "We welcome design partners and developer contributions. If you're building compliance-focused privacy solutions on Stellar, an SCF cohort member, or joined our recent Stellar Hacks: Real-World ZK hackathon or Stellar Summit São Paulo, share what you're working on in our Developer Discord." | stellar.org/blog/developers/developer-preview-stellar-private-payments, "Try it yourself", 2026-08-24 | Confirmed. Same call, repeated for SPP. |
| B9 | Maryam Mazraei | SDF | "Every pool transaction (deposit, transfer, and withdrawal) then proves membership or non-membership through a designated association set provider without revealing the user's history. … The hosted demo runs in block-list-only mode, so anyone can try it without ASP onboarding." | SPP preview blog, "What's in this version" | Confirmed. The ASP is a deployer-designated role. |
| B10 | Maryam Mazraei | SDF | "Global View Keys. Optionally provide pool-wide visibility for administrators across all in-pool transactions via a designated auditor account. … The global view key can be secured with an institutional wallet solution, and even remain within a trusted execution environment for secure disclosure of only relevant, scoped transaction data." | SPP preview blog | Confirmed |
| B11 | Maryam Mazraei | SDF | "Compliance is a design parameter, not a fixed setting. The same pool contract can be configured to support multiple different kinds of use cases or jurisdictions." | SPP preview blog | Confirmed |

No other stellar.org post dated 2026-06 or later is about privacy operators or compliance (S10). The "financial-privacy" post is dated 2026-01-15 (S9).

---

## 5. Counter-evidence: who already builds, or plans to build, parts of the operator role

1. **Nethermind ships the ASP operator tooling and expects pool admins or "accredited providers" to run it.**
   - SPP README: "an example of an ASP admin page which will be separated according to roles in the main application"; the admin page lets you "Add/insert public keys to the ASP membership tree".
   - The repo also contains `tools/bootnode` (an indexer/archive) and the `contracts/asp-membership` and `contracts/asp-non-membership` contracts.
   - Nethermind blog compliance matrix: "KYC gating … Invoked by: ASP (pool administrator or accredited provider)"; "Global viewing keys* … Pool administrator / regulator … *currently under design in SPP".
   - "In future versions of SPP, pool administrators will be able to configure which sets, disclosure mechanisms, and viewing permissions apply".
   - Reading: Nethermind builds the mechanism and an admin UI, and leaves the operating party open ("accredited provider"). It is not itself operating.
2. **OpenZeppelin ships reference compliance and auditor pieces, not an operated service.**
   - `OpenZeppelin/stellar-contracts/examples/confidential/auditor/` (auditor registry example).
   - `brozorec/stellar-confidential-token-demo` has `contracts/auditor`, `contracts/token_with_compliance`, `packages/disclosure` (disclose_sender/recipient Noir circuits), `packages/indexer` (Goldsky pipeline) and an `app/auditor` page.
   - B4 says explicitly that the issuer must add "governance, security, legal, and operational processes". This is consistent with Alex's "tooling provider, not an operator".
   - The common building blocks already exist, so a new operator would mostly be integrating and running them.
3. **Third-party projects that plan the auditing and compliance layer for CT:**
   - `stellar-huub/stellar-confidential` (138 files; created 2026-09-07, last push 2026-09-09; 0 stars). README: "make Confidential Tokens on Stellar easier to build, integrate, recover, audit, and operate". Its roadmap "Phase 5 — Auditing & Compliance" lists "Auditor dashboard", "Viewing-key workflows", "Disclosure requests", "Access controls" and "Audit logs". Phase 3 is a multi-provider archive.
     - **This is the closest direct overlap.** It is early and roadmap-only for compliance.
     - `Caxton-Dev-Hub/stellar-confidential` is a README-only copy (1 file, 2026-09-07).
   - `aguilar1x/stellar-confidential-token-sdk` (224 files): "the SDK.md client, and the INDEXER.md archive it replays history from". This is probably the São Paulo second-place "Confidential Token SDK with a verifiable replay archive" (08-13 line 29), but that link is **unverified**. It is client and archive, not a compliance operator.
4. **Hypertron** (07-23 notes, line 37) builds B2B private payments with viewing keys but has "compliance intentionally left open". It is an adjacent product and could grow into an operator role.
5. **The SDF SPP blog** says "there is no third-party verifier or operator to trust" (SPP preview, "How it works"). This refers to proof verification, not compliance, so it does not contradict the ask, but the word "operator" is used differently there.

No statement was found from SDF, OZ or Nethermind saying that **they** will run an auditor, ASP or policy-registry service for others.

---

## 6. Could not verify

- **Verbatim speech for 08-06 lines 61 and 63.** Captions could not be fetched from this machine (§1 S5), so the exact words Alex used, and whether "Hint." was said aloud or added in writing, are unconfirmed. The timestamp is an estimate from section order only.
- **Any operator, ASP or provider asks in 08-20, 08-27, 09-03, 09-17, 09-24 and 10-01, and in the CT and SPP preview videos.** See §3 for what, if anything, the remote caption fetch returned. r4d's quotes from those videos ("who deposits first?", "anyone watching in Istanbul…", "I'd love to see a lot of providers…", Antonio's ASP remarks) are **not re-verified here** unless §3 says otherwise.
- **The identity of the "Confidential Token SDK" São Paulo winner** (the notes do not name the builder).
- **Who "wmendes" is** (the PR #2751 approver). It does not affect attribution.
- **The Nethermind blog's publish date.** The page JSON says `datePublished: Jul 16, 2026`. I did not cross-check it.
