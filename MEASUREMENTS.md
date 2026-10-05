# Measurements (current)

Re-measured **2026-10-05** on Stellar testnet, protocol 29 (ledger 5,029,400), against OpenZeppelin stellar-contracts **v0.9.0** (`df602b6`). These figures supersede the cost and batching figures in [PHASE1-MEASUREMENTS.md](PHASE1-MEASUREMENTS.md), which were taken on 2026-08-21 under a 100,000,000-instruction cap.

- **Raw data:** [`ct/measurements.testnet.json`](ct/measurements.testnet.json).
- **Harness:** [`ct/scripts/measure.ts`](ct/scripts/measure.ts). It is committed; Phase 1's harness was never in the repository.
- **Re-run:** `pnpm measure`. It needs a deployment from `pnpm deploy:testnet` and the `tally-deployer` CLI identity.

**Method.** Every on-chain figure comes from `simulateTransaction`:
- the resources the RPC returns in `SorobanTransactionData`;
- `minResourceFee`;
- the size of the assembled envelope.

Limits are read live with `stellar network settings`. Simulation figures include whatever margin the RPC applies; I did not measure that margin separately. Where a transaction was submitted, its hash is given.

## Network limits in force (testnet, read 2026-10-05)

| Limit | Value |
|:---|---:|
| Instructions per transaction | 400,000,000 |
| Transaction size | 132,096 B |
| Disk-read entries per transaction | 200 |
| Write entries per transaction | 200 |
| Write bytes per transaction | 132,096 B |
| Memory per transaction | 41,943,040 B |

## Single operations

| Operation | CPU instructions | Share of 400M | Tx size | Write B | RO / RW entries | Min resource fee (stroops) |
|:---|---:|---:|---:|---:|:---:|---:|
| `register` | 88,344,016 | 22.1 % | 30,464 B | 568 | 7 / 1 | 550,806 |
| `confidential_transfer` | 91,193,854 | 22.8 % | 31,876 B | 1,136 | 7 / 2 | 1,311,887 |

Proof generation runs locally (Apple M4 Pro, Node 24.20.0, bb.js 0.87.0, `pnpm test:prove`). The warm figure is the second proof after the backend is initialised:

| Circuit | First proof | Warm proof | Proof size |
|:---|---:|---:|---:|
| `register` (6 public inputs) | 1,199 ms | 696 ms | 14,592 B |
| `transfer` (25 public inputs) | 2,005 ms | 1,321 ms | 14,592 B |
| `tally_aggregate_n16`, zero-knowledge (`pnpm demo`) | 2,260 ms | — | 16,224 B |

## Transfers per transaction

A Stellar transaction can carry only one `InvokeHostFunctionOp`. To batch, a contract must make the calls itself. [`ct/contracts/bench-batch`](ct/contracts/bench-batch/src/lib.rs) is a measurement-only wrapper that calls `confidential_transfer` *k* times for one sender. Each proof is built against the balance the previous transfer leaves.

| k | CPU instructions | Share of 400M | Tx size | Share of 132,096 B | Fits? |
|---:|---:|---:|---:|---:|:---:|
| 1 | 91,550,838 | 22.9 % | 32,084 B | 24.3 % | yes |
| 2 | 182,067,642 | 45.5 % | 63,264 B | 47.9 % | yes |
| 3 | 272,645,811 | 68.2 % | 94,444 B | 71.5 % | yes |
| **4** | **363,272,171** | **90.8 %** | **125,624 B** | **95.1 %** | **yes, submitted** |
| 5 | over budget (`Error(Budget, ExceededLimit)`) | — | — | — | no |

**Four confidential transfers from one sender landed in a single transaction:**
- Transaction [`fe362834…b59384`](https://stellar.expert/explorer/testnet/tx/fe362834f8ddf8cb16cde66e71d64fc75dd7103a4968141bca4bd2faeab59384) succeeded in ledger 5,029,434.
- It went through bench contract `CB6U7QX2OR3ADD3NW6NSZQWNADIC3LFJKM3MN3NND4VPPDWTPQDDA3VV`.

**Instructions and transaction size bind together at k = 4.** At k = 5 instructions run out first. Size would also exceed the limit (~156.8 kB by extrapolation, not measured).

**How the wrapper authorises matters.** A first version authorised the batch with `require_auth()`, which copies every proof into the root authorisation entry a second time. That raised the envelope to 140,968 B at k = 3, over the size limit, and the k = 4 submission was rejected (`txSorobanInvalid`). Authorising the root with empty arguments (`require_auth_for_args([])`) avoids the copy and gives the table above.

**What this replaces.** Phase 1 measured one transfer per transaction under the 100M cap ("batching is impossible today"). That is no longer true. A one-to-many round can pay up to four recipients per transaction from each lane. In the demo's layout (16 transfers over 5 lanes, no lane carrying more than 4), each lane's transfers fit in one transaction, so a round needs 5 transfer transactions instead of 16. The demo still sends one transfer per transaction; it has not been switched to batching.

## Aggregate disclosure proofs verified on-chain (capacity only)

Tally verifies aggregate proofs **off-chain**, by the donor. These figures answer only whether on-chain verification would fit:
- A separate measurement-only verifier, `CACEIWIWMRIC4XQJKO4BYUWGBSV5DTMI36JPLARUCUNLV6Q6VWO54UQJ`, holds each aggregate VK.
- `verify_proof` is simulated on it.
- The proofs are non-zk, because the on-chain verifier implements only the non-zk flavour.

| n | Public inputs | CPU instructions | Share of 400M | Tx size | Verified |
|---:|---:|---:|---:|---:|:---:|
| 8 | 80 | 91,214,362 | 22.8 % | 17,452 B | true |
| 16 | 152 | 100,835,059 | 25.2 % | 19,756 B | true |
| 64 | 584 | 150,810,864 | 37.7 % | 33,580 B | true |

**What this changes.** Phase 1 found n = 16 at 100.0 % of the old cap and n = 64 over it. All three sizes now fit with room to spare.

**Why verification stays off-chain anyway.** Putting it on-chain would publish that a disclosure happened, to whom and when. It would also force the non-zk flavour, and a non-zk proof is not witness-hiding. So the reason is privacy, not capacity.

## Claims corrected by this re-measurement

| Previously published | Now |
|:---|:---|
| `confidential_transfer` ~93,000,000 instructions, "93 % of the 100M per-tx cap" | 91,193,854, 22.8 % of a 400M cap |
| "Max transfers per transaction: 1 — batching is impossible today" | 4 per transaction from one sender, demonstrated on testnet |
| "Transaction size is not the constraint" | It is a constraint when batching: 95.1 % of the limit at k = 4 |
| Aggregate n = 16 verifies "with 17,126 instructions of margin" on-chain | 25.2 % of the cap; verification stays off-chain for privacy |
| `register` 87,995,074 instructions, 88.0 % | 88,344,016, 22.1 % |
| Transfer proof ~1.26 s steady state | 1.32 s warm on this machine (different hardware; not a regression claim) |
