# Target 2 — what a public observer sees

Generated from the ledger by `npx tsx cli/explorer-view.ts`. Re-run it and you get the same answer; that is the point of publishing it this way rather than as a screenshot.

**Transaction:** [`310ccf759644f7671b4e86815abb4ddda46bd194205c9c594fcce63a655ea995`](https://stellar.expert/explorer/testnet/tx/310ccf759644f7671b4e86815abb4ddda46bd194205c9c594fcce63a655ea995)
**Contract:** [`CDRRP2JFAPIM47QBAC7U2WYRTSMEC4SMM6QAP3HX7DPFIZTTATQCURGN`](https://stellar.expert/explorer/testnet/contract/CDRRP2JFAPIM47QBAC7U2WYRTSMEC4SMM6QAP3HX7DPFIZTTATQCURGN)
**Ledger:** 5029650

| Field | Visibility | Value |
|:---|:---|:---|
| `from` | 🔓 **Public** | `GBSKR6XD2R5AGK4Y53ZB5F4QBI7R7L3YIB…UMDYIO` |
| `to` | 🔓 **Public** | `GD5KASCZUIFXKXNG2RLDLIMT6EACDCQCAN…F3BNJ5` |
| `ledger` | 🔓 **Public** | `5029650` |
| `tx` | 🔓 **Public** | `310ccf759644f7671b4e86815abb4ddda4…5ea995` |
| `b_tilde` | 🔒 Encrypted | `0x2e5607dfa1310ecab0e317ed82adf942…6f93fe` |
| `b_tilde_aud_s` | 🔒 Encrypted | `0x2a8d28f89a03cf04e308b638a4220156…201222` |
| `r_e_point` | 🔒 Encrypted | `0x1b116267d8335eb00d5f45d4db187b04…1edbd8` |
| `r_tilde_aud_r` | 🔒 Encrypted | `0x106c571e49d07e803b30bd1bcd1244cb…fb2825` |
| `r_tilde_aud_s` | 🔒 Encrypted | `0x29dce3188fda9f48285094f01b452ff9…0e9ef4` |
| `sigma` | 🔒 Encrypted | `0x001e30b7c64f3ba70117b76c95747c09…9325af` |
| `v_tilde` | 🔒 Encrypted | `0x1ee661cc1ac41e7dcac756d3820a3937…4263a3` |
| `v_tilde_aud_r` | 🔒 Encrypted | `0x2efed42c7600c392284f1332ef383026…31d6df` |
| `v_tilde_aud_s` | 🔒 Encrypted | `0x0f436601d61535fd1c1cd10b075089c6…26922d` |

## The point

**Sender and recipient are in the clear.** They are indexed event topics, so anyone can query every transfer out of a given account — which is exactly what makes a withheld transfer detectable, and why completeness does not depend on the funder cooperating.

**The amount is not there.** Not encrypted-but-present-in-a-field-called-amount: *there is no amount field at all.* `v_tilde` is the transfer value masked under a shared secret only the sender and recipient can derive; `b_tilde` is the sender's post-transfer balance, similarly masked; the `*_aud_*` fields are the auditor channel. Every one is 32 bytes of ciphertext.

This is what "confidentiality, not anonymity" means concretely: an observer learns that these two accounts transacted, and cannot learn how much.

Open the transaction on the explorer above and you will see the same event with the same fields.
