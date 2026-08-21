# `tally` — independent round verification

The trust statement says a donor **is assured** of something. If verification only runs inside our demo script, no donor can perform it and the assurance is theoretical. This is the tool that makes it real.

```bash
npx tsx cli/tally.ts challenge                                   # donor
npx tsx cli/tally.ts prove  --funder G… --round <hex> --keys …   # funder
npx tsx cli/tally.ts verify --funder G… --round <hex>            # donor
```

## The trust boundary

`verify` constructs **every public input itself** — from chain state and from its own challenge. From the funder's bundle it reads exactly three values:

| Read from the bundle | Everything else |
|:---|:---|
| `proof` · `r_disc_x/y` · `v_tilde_disc` | lane set, window, transfer set, `PVK_A`, `PVK_B`, `R_e`, `σ`, `ṽ`, `addr_f`, `n_active` — all resolved from chain; `P_R`, `ν` — the donor's own |

If a funder could supply a public input, it could prove a statement about a set of transfers *it* chose rather than the set the chain records. That is the attack this layer exists to stop, so the boundary is enforced in code, not documented as a convention.

**Public-input order comes from the circuit's own ABI**, not from a hardcoded list — a change to the circuit signature cannot silently produce a verifier that checks the right proof against the wrong vector.

## What `verify` actually does

1. `get_round(funder, round_id)` — lane set and window, from the registry. Namespaced by funder, so another account cannot serve you its round.
2. Enumerate `Transfer` **and** `SpenderTransfer` events with `from ∈ lanes` inside `[opened_at, closed_at]`. Reject duplicates — the circuit cannot see them, and one event counted twice inflates the total.
3. Refuse a round below the floor (`MIN_ACTIVE = 5`). A total over fewer transfers is not an aggregate.
4. Read `PVK_A` from each event's `from` and `PVK_B` from its `to`.
5. Check the derived verification key against the pinned `vk.zk.bin`, and refuse to verify on mismatch.
6. Verify the zero-knowledge proof.
7. Decrypt the total using the donor's own `r_R` and `ν`.

## Verified behaviour

Run against a real testnet round of 16 transfers across 5 lanes:

| Case | Result | Exit |
|:---|:---|---:|
| Valid bundle | `TOTAL DISBURSED: 3160` over 16 transfers | `0` |
| Total inflated by 1 | `PROOF FAILED` | `2` |
| Bundle replayed against a fresh nonce | `PROOF FAILED` | `2` |
| Wrong funder for that round id | no round in that namespace | `1` |

Exit codes are distinct so this can gate a script: `0` verified, `2` proof rejected, `1` could not verify.

## Notes

`prove` needs the funder's lane spending keys, which grant **both view and spend**. A real funder holds them in a signer service; `demo/last-round.json` writes them in plaintext because it is a testnet demo, and is gitignored.

`r_e` is never stored — `prove` re-derives it from `(lane vk, event σ)` and refuses any event it cannot re-derive, which is the disclosability test `SDK.md` §12.2 requires rather than assumes.
