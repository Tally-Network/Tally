# `pnpm demo` — one confidential disbursement round, end to end

```bash
git clone --recurse-submodules https://github.com/Tally-Network/Tally
cd Tally
git submodule update --init      # OpenZeppelin stellar-contracts v0.9.0 @ df602b6
pnpm install
pnpm demo
```

Runs against Stellar **testnet** using the deployment in [`deployment.testnet.json`](deployment.testnet.json) and the round registry it names (currently [`CDWIXFBO…BK7W`](https://stellar.expert/explorer/testnet/contract/CDWIXFBOR5DB4UVQXYL3VY7OQZNUAWAVEPSKKTNH3R5XI6CJ2IS7BK7W)). `deployment.testnet.json` holds public data only; the auditor secret is never in the repository. Override with `TALLY_REGISTRY`, `TALLY_DEPLOYMENT`, `TALLY_RPC`. Takes several minutes; accounts are created fresh each run, so it is idempotent.

## What it does

```
[pre-round]  one transfer BEFORE open_round        ← must be excluded
[1] open_round(funder, round_id, lanes[])          ← opened_at stamped by the contract
[2] 16 transfers across 5 lanes                    ← amounts encrypted, addresses public
[3] close_round(funder, round_id)                  ← closed_at stamped
[4] DONOR: given only the funder address + round id
       · resolves lane set and window FROM CHAIN
       · enumerates transfers from declared lanes
       · discards anything outside the window
[5] ONE aggregate proof over 16 events / 5 lanes → donor verifies the total
```

## Last verified run

<!-- round:last-run -->
2026-10-05, OpenZeppelin v0.9.0 deployment, from `main` at `bf56134` (`pnpm evidence:refresh`, which runs this demo and published `evidence/round-004`). The figures are recorded in [`evidence/round-004/run.json`](../evidence/round-004/run.json):

```
resolved from chain: 5 lanes, window [5032842, 5032851]
transfers from declared lanes (all time) : 17
inside the declared window               : 16
excluded by the window                   : 1  <- the pre-round transfer
proof     16224B in 2032ms, spans 5 sender accounts
donor total = 3160   expected 3160   MATCH
=== ROUND VERIFIED ===
```
<!-- /round:last-run -->

## Why the pre-round transfer is in the script

It is the negative case, and it runs every time. Without it the window looks decorative: a demo where everything is inside the window cannot distinguish a working completeness check from one that returns "all events" regardless. The 999 sent before `open_round` must be excluded, and the donor's total must come out to 3160 rather than 4159 — if that ever flips, the window stopped working.

## What the donor is given

The funder address and the round id. Nothing else. The lane set, the window, the transfer set, and every public input to the proof are resolved from chain state — never from the funder's bundle (OZ v0.9.0 `docs/selective-disclosure/protocol.md`). The donor holds its own disclosure keypair and issues its own nonce; it never receives any secret of the funder's.

See [docs/TRUST-STATEMENT.md](../docs/TRUST-STATEMENT.md) for exactly what this does and does not assure.
