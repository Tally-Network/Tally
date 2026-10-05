# Published rounds — verify one yourself

Every verification we had done before this directory existed was performed by whoever generated the proof. That is not evidence. This is a round anyone can check with no help from us.

## The two-minute path

```bash
git clone --recurse-submodules https://github.com/Tally-Network/Tally
cd Tally
pnpm install
pnpm verify:evidence
```

`verify:evidence` reads [`latest.json`](latest.json), so it always checks whichever round is currently published. Expected output:

<!-- round:verify-output -->
```
✓ round found: 5 lanes, window [5033961, 5033976]
✓ 16 transfers from the declared lanes inside the window
✓ public inputs reconstructed from chain state only
✓ verification key matches the pinned artifact (1760 B)
✓ proof verified (16224 B, zero-knowledge)

TOTAL DISBURSED: 3160  (stroops of the wrapped asset)
over 16 transfers from 5 declared lanes, ledgers 5033961–5033976
no individual amount was revealed.
```
<!-- /round:verify-output -->

Exit `0` means verified. Exit `2` means the proof was rejected. Exit `1` means it could not be checked.

## ⏳ This expires, and that is a real limitation

<!-- round:expiry -->
**The current round (`round-005`, published 2026-10-05 by `pnpm evidence:refresh`) is verifiable until ledger 5154939 — about seven days later.** A scheduled job publishes the next round before then. The exact figure is in [`latest.json`](latest.json) and the round's own `round.json`.
<!-- /round:expiry --> The exact figure is in [`latest.json`](latest.json) and the round's own `round.json`.

Soroban RPC serves only a rolling window of events (~7 days), and `verify` deliberately enumerates the round's transfers **from chain events** rather than from anything we hand you. Past the window they are simply not served.

**You will not be left guessing.** `verify` checks the RPC's own `oldestLedger` before enumerating, and if the round has aged out it says exactly that and exits **3** — distinct from **2** (proof rejected) and **1** (could not verify):

<!-- round:expired-example -->
```
✗ this round has aged out of the RPC's event retention window.

    round opened at ledger  5033961
    RPC serves from ledger  5044310   (10,349 ledgers ≈ 0.6 days too old)

  This is not a proof failure. The proof is untouched and would still verify.
```
<!-- /round:expired-example -->

**If it has expired**, one command republishes a fresh round:

```bash
pnpm evidence:refresh     # runs a real round, then republishes evidence/round-NNN
```

That keeps *current* evidence verifiable. It does not make a *historical* round verifiable — a donor auditing a programme a year later is exactly the case the product is for, and closing it needs the persistent event archive the specification defines in `INDEXER.md`. **We have not built it.** Tracked as Milestone U2 in [`docs/SDK-SAFETY-INVARIANTS.md`](../docs/SDK-SAFETY-INVARIANTS.md).

## What you are actually checking

`verify` takes **exactly three values** from the funder's bundle — the proof, `r_disc`, and the sealed total. Everything else it works out itself:

| From the chain | From your own challenge | From the funder |
|:---|:---|:---|
| lane set and window (round registry) | `P_R`, `ν` | `proof` |
| every transfer out of those lanes in that window | | `r_disc_x`, `r_disc_y` |
| each sender's and recipient's public viewing key | | `v_tilde_disc` |
| `addr_f`, `n_active` | | |

So a funder cannot choose which transfers the total covers. If one were withheld, the count reconstructed from chain would not match the proof and verification would fail.

## Why the donor's secret key is published here

`challenge.json` contains `secret_r_R`. That is **deliberate, and it is the donor's key, not the funder's.**

Publishing it makes *everyone* the donor for this one demonstration round, so anyone can decrypt the total. It reveals nothing about any individual amount and nothing about the funder. A real donor keeps `r_R` private, and then only that donor learns the total.

## Try breaking it

The verifier should reject these. If any of them passes, something is wrong and we want to know:

<!-- round:tamper -->
```bash
# inflate the sealed total by one
python3 -c "import json;b=json.load(open('evidence/round-005/bundle.json'));b['v_tilde_disc']=hex(int(b['v_tilde_disc'],16)+1);json.dump(b,open('/tmp/t.json','w'))"
npx tsx cli/tally.ts verify --funder GBNYNIHC6ZFH5D2Z5KPVWRFUG76L2NWHUKAX2KTOEJRAM2WPSUSB3PQY \
  --round 030a11181f262d343b424950575e656c737a81888f969da4abb2b9c0c7ced5dc \
  --challenge evidence/round-005/challenge.json --bundle /tmp/t.json        # expect PROOF FAILED, exit 2

# replay the bundle against a challenge it was not built for
npx tsx cli/tally.ts challenge --out /tmp/c2.json
npx tsx cli/tally.ts verify --funder GBNYNIHC6ZFH5D2Z5KPVWRFUG76L2NWHUKAX2KTOEJRAM2WPSUSB3PQY \
  --round 030a11181f262d343b424950575e656c737a81888f969da4abb2b9c0c7ced5dc \
  --challenge /tmp/c2.json --bundle evidence/round-005/bundle.json          # expect PROOF FAILED, exit 2
```
<!-- /round:tamper -->

## Earlier rounds

`round-001` and `round-002` (August 2026) were produced by the retired OpenZeppelin `539968f` deployment. Their ledgers have left the RPC retention window, and their pinned verification keys no longer match the current circuits, so they are kept only as a record.

## Current round

<!-- round:current -->
| | |
|:---|:---|
| Network | Stellar testnet |
| Funder | `GBNYNIHC6ZFH5D2Z5KPVWRFUG76L2NWHUKAX2KTOEJRAM2WPSUSB3PQY` |
| Round id | `030a11181f262d343b424950575e656c737a81888f969da4abb2b9c0c7ced5dc` |
| Registry | [`CDWIXFBO…BK7W`](https://stellar.expert/explorer/testnet/contract/CDWIXFBOR5DB4UVQXYL3VY7OQZNUAWAVEPSKKTNH3R5XI6CJ2IS7BK7W) |
| Token | [`CDRRP2JF…URGN`](https://stellar.expert/explorer/testnet/contract/CDRRP2JFAPIM47QBAC7U2WYRTSMEC4SMM6QAP3HX7DPFIZTTATQCURGN) (OpenZeppelin v0.9.0) |
| Window | ledgers 5033961 – 5033976 |
| Transfers | 16, across 5 lanes |
| Total | 3160 stroops — **real people are not involved; see the note below** |
<!-- /round:current -->

**Real wallets, real keys, nominal value.** This round was generated by a test harness: the recipients are freshly created testnet accounts, not people, and testnet XLM has no value. What is real is the chain, the contracts, the proof, and the verification path you just ran. A round with real independent contributors is a separate, not-yet-built target — see [`docs/DEMONSTRATION-STATUS.md`](../docs/DEMONSTRATION-STATUS.md).
