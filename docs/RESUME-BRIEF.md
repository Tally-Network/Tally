# Resume brief: Tally (updated 2026-10-05)

## Where things stand

**Block A (repair) is done locally.**
- The repo is on OpenZeppelin stellar-contracts v0.9.0 (`df602b6`), with a fresh testnet deployment.
- The exposed demo auditor key is retired and removed from history: rewritten with `git filter-repo`, map in `docs/HISTORY-REWRITE.md`.
- A secret guard and CI are added.
- Costs were re-measured: `MEASUREMENTS.md`.
- Evidence was refreshed after the push: `evidence/round-004`, verifiable until about ledger 5153815 (round-003 was the clean-clone run).

**Nothing has been pushed.** `origin` (`git@github.com:Tally-Network/Tally.git`) still has the old history, including the retired key value. Publishing the rewrite needs `git push --force origin main`. That waits on the user's explicit approval, because it replaces public history.

**Block B (design) is done:**
- `docs/OPERATOR-DESIGN.md`
- `docs/SCOPE-LEDGER.md`
- `docs/BUDGET-DRAFT.md` ($144,000; 10/20/30/40)
- research in `docs/research/` (`DEMAND-QUOTES.md`, `SPEC-OPERATOR-GAPS.md`, `OVERLAP.md`)
- open questions for SDF in OPERATOR-DESIGN §9

## Site (built locally, not deployed)

`site/` holds the landing page and docs (Next.js 16 and Fumadocs on the Agenforce template), with claim and link checks in CI. Planned address: `tally.0xo.in` on Vercel. Nothing is deployed:
- no Vercel project exists;
- no DNS record exists;
- the GitHub Pages redirect (`pages-redirect/`, a manual workflow) has not run.

See `site/README.md` and `site/CLAIMS.md`.

## Current deployment (testnet, public)

Defined in `demo/deployment.testnet.json`.

| Item | Value |
|:---|:---|
| Token | `CDRRP2JFAPIM47QBAC7U2WYRTSMEC4SMM6QAP3HX7DPFIZTTATQCURGN` |
| Verifier | `CAGL7SYHENABJPNPTSUO5RCROAUGTOSDVFWDDSDVHTLTR7V2N4QJB5LL` |
| Auditor | `CDMJCKJGYWFGZCNNZMQAUMDJCRWQMFZEG24FYENE4AQRJ2P3HKC5AMW7` |
| Registry | `CDWIXFBOR5DB4UVQXYL3VY7OQZNUAWAVEPSKKTNH3R5XI6CJ2IS7BK7W` |
| Deployer | stellar CLI identity `tally-deployer` |
| Auditor secret | `~/.config/tally/testnet-auditor-CDRRP2JF….json` (0600). **Never in the repo** |

## Re-run anything

```bash
pnpm install && pnpm test              # guard, typecheck, conformance, proving, retention, contracts
pnpm test:registration                 # live testnet
pnpm demo                              # live testnet round
pnpm verify:evidence                   # published round (until it ages out)
pnpm evidence:refresh                  # republish when it does
pnpm measure                           # on-chain costs → ct/measurements.testnet.json
pnpm build:circuits                    # needs nargo 1.0.0-beta.11
```

The bb CLI 0.87.0 and nargo beta.11 used this session were downloaded to the scratchpad. The global `nargo` on this machine is still beta.9.

## Facts that changed this session

| Claim | Before | Now |
|:---|:---|:---|
| Transfers per transaction | 1 | **4** (demonstrated); instructions and size bind together |
| `confidential_transfer` cost | 93% of the cap | 91.2M instructions, **22.8%** of the cap |
| Aggregate on-chain verification | Off-chain because it doesn't fit | **It fits** (n = 64 at 37.7%); stays off-chain for privacy |
| SDF demand | "Repeated" | **One** confirmed written ask (2026-08-06 notes, Kaan Kacar paraphrasing Alex Voto); the rest is caption-only and unverified |
| Overlap | — | **Remi** (SCF #44, $133.7k) builds an auditor/compliance surface on the same standard for its own flows |

## Decisions waiting on the user

1. **Force-push** the rewritten history to `origin/main`. This is irreversible for anyone who cloned the old history.
2. Whether to **submit to SCF #46** (Build deadline 2026-11-08) given the Remi overlap and thin demand, or first get SDF's answers to OPERATOR-DESIGN §9.
3. **Rates and team** in BUDGET-DRAFT (the rates are placeholders), and a **named tenant** for the tranche-3 pilot.
4. Whether to **contact SDF's privacy team** with the §9 questions. Nobody has been contacted.
5. **Site deploy:** create the Vercel project (root `site/`), add the Cloudflare CNAME for `tally`, then run the Pages redirect workflow. All three wait on the force-push, because the site links into `main`.

## Re-check before acting

- OZ: whether `v0.9.0` is tagged, and which branch mainnet will use (`main` lacks clawback).
- Confidential Tokens and SPP mainnet dates.
- Whether Remi ships its auditor dashboard.
- The published round's expiry (ledger ~5153815).
- CI's first run on GitHub. It has only been exercised locally; the circuits job assumes bb.js VK bytes are identical across platforms.
