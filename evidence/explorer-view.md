# Target 2 — what a public observer sees

Generated from the ledger by `npx tsx cli/explorer-view.ts`. Re-run it and you get the same answer; that is the point of publishing it this way rather than as a screenshot.

**Transaction:** [`238e76e1608c863523a2ea251d4c9bae5b87bbd38ec4fc0d901b371e15432068`](https://stellar.expert/explorer/testnet/tx/238e76e1608c863523a2ea251d4c9bae5b87bbd38ec4fc0d901b371e15432068)
**Contract:** [`CCDZ52D7ERL4AC4COSLCAUZF442CS7XTV2OXT5YPHLLE23W2IXDKJYHD`](https://stellar.expert/explorer/testnet/contract/CCDZ52D7ERL4AC4COSLCAUZF442CS7XTV2OXT5YPHLLE23W2IXDKJYHD)
**Ledger:** 4289034

| Field | Visibility | Value |
|:---|:---|:---|
| `from` | 🔓 **Public** | `GCNLQPYI67UPSC5RU4NIZ6TPWYMUCFFGOY…ZDQMSD` |
| `to` | 🔓 **Public** | `GASV2GPGEYY2ZTNVSMLXWNZPB6DIFVW2EA…VP4QEE` |
| `ledger` | 🔓 **Public** | `4289034` |
| `tx` | 🔓 **Public** | `238e76e1608c863523a2ea251d4c9bae5b…432068` |
| `b_aud_s` | 🔒 Encrypted | `0x0c82abf062f427859a6474e11ee6aa65…0b8bed` |
| `b_tilde` | 🔒 Encrypted | `0x2ad26c21e882d7a966202d444e3a4be6…d385c2` |
| `r_aud_r` | 🔒 Encrypted | `0x1ac1a9fca36f86314091eefa817dd71d…45b2cc` |
| `r_e` | 🔒 Encrypted | `0x20122fe07bf6d857fd99bea933c80878…1be80f` |
| `sigma` | 🔒 Encrypted | `0x00e3f02363abcd8436121de6317946ad…fc17dd` |
| `v_aud_r` | 🔒 Encrypted | `0x1d745bc0558df4344652ede1c01bf7ea…7b04d4` |
| `v_aud_s` | 🔒 Encrypted | `0x0dfd2775b20dba29ac7c08bf7dc91245…bc26a4` |
| `v_tilde` | 🔒 Encrypted | `0x05ffd9d6b040557fa536aac24fc78297…f7753e` |

## The point

**Sender and recipient are in the clear.** They are indexed event topics, so anyone can query every transfer out of a given account — which is exactly what makes a withheld transfer detectable, and why completeness does not depend on the funder cooperating.

**The amount is not there.** Not encrypted-but-present-in-a-field-called-amount: *there is no amount field at all.* `v_tilde` is the transfer value masked under a shared secret only the sender and recipient can derive; `b_tilde` is the sender's post-transfer balance, similarly masked; the `*_aud_*` fields are the auditor channel. Every one is 32 bytes of ciphertext.

This is what "confidentiality, not anonymity" means concretely: an observer learns that these two accounts transacted, and cannot learn how much.

Open the transaction on the explorer above and you will see the same event with the same fields.
