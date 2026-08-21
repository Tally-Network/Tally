# Cryptographic accuracy pass over all public text

**Scope:** every cryptographic claim on the landing page and in the READMEs — curves, transcripts, protocol versions, host functions, proof-system names, proof sizes.

**Prompted by:** "UltraHonk over Grumpkin" shipping to a page aimed at reviewers who read exactly that sentence. It was plausible enough to survive drafting, which is the property that makes this class of error dangerous.

---

## Found: one material error, already shipped and now fixed

### 🔴 The disclosure proofs were not zero-knowledge

The page and README described the donor receiving "a zero-knowledge proof… which reveals only the total." **They did not.**

`bb.js` exposes two distinct options — `keccak` (non-zk) and `keccakZK` (zk). The vendored reference SDK hardcodes:

```ts
const KECCAK = { keccak: true } as const;   // non-zk
```

correctly, because the on-chain Nethermind verifier implements only the non-zk flavour and OZ `SDK.md` §8.1 requires it: *"Zero-knowledge mode MUST NOT be enabled while the verifier implements only the non-zk flavour."*

Our aggregate inherited that setting — **but the constraint does not apply to us.** Disclosure circuits never register with the on-chain verifier set; they are verified off-chain by the donor via `bb.js` (`SELECTIVE_DISCLOSURE.md` §5.5). We were carrying a restriction that exists for a verifier we do not use.

**Why it is material rather than pedantic.** A non-zk Honk proof is succinct but **not witness-hiding**. Under `{ keccak: true }` the individual amounts were protected only by the commitments on chain — not by the artifact handed to the donor — while the entire public claim is that the artifact reveals only the total. The claim was resting on something other than what it named.

**Fixed.** `demo/zk-prover.ts` uses `{ keccakZK: true }`, with the two-mode distinction documented in the file so it cannot be silently reverted. Transfer proofs correctly stay non-zk.

**Cost, measured:** 14,592 B → **16,224 B** (+1,632 B), +~50 ms. **Constant across n = 8, 16, 64**, so the headline property survives. Full demo re-run end to end: verified, donor total exact.

---

## Checked and correct — everything else

| Claim | Verdict |
|:---|:---|
| Balances/amounts are **Pedersen commitments** on **Grumpkin** | ✅ `commit(v,r) = v·G + r·H` over Grumpkin |
| **UltraHonk on BN254**, Grumpkin the embedded curve | ✅ corrected earlier; BN254 SRS and pairing check, Grumpkin for in-circuit EC ops |
| **Keccak** Fiat–Shamir transcript | ✅ mandatory per §8.1; matches the on-chain verifier |
| **Protocol 25 (X-Ray)** introduced BN254 host functions | ✅ CAP-74: `g1_add`, `g1_mul`, `multi_pairing_check` |
| **CAP-80 / Protocol 26 (Yardstick)** added `g1_msm` + F<sub>r</sub> arithmetic | ✅ `DESIGN_cont.md` §10.7; "protocol 26 is the effective minimum" |
| Yardstick **live on mainnet 6 May 2026** | ✅ verified against SDF's upgrade guide |
| **100,000,000** instruction cap per transaction | ✅ SLP-0004 current value |
| On-chain transfer proof **14,592 B** | ✅ 456 BN254 field elements × 32 B, non-zk |
| `n_active` is a **public input** | ✅ bound into the proof |
| `MIN_ACTIVE` is a **circuit constraint** | ✅ assert, not a library check |
| Amounts **encrypted client-side, never plaintext on chain** | ✅ |
| Every transfer **publishes its sender address** | ✅ `#[topic] from`, emission unconditional |
| **SEP-41** token wrapper, OZ suite + Nethermind verifier | ✅ |
| Cost model `~81M + ~120k per public input` | ✅ labelled as fitted from three measured points |

**Nothing else was wrong.** Two clarifications were added rather than corrections: the on-chain verification measurements are noted as taken with non-zk proofs (cost is driven by public-input count, not proving mode), and the two proving modes now have their own explanation on the page.

---

## The pattern worth keeping

Both errors found by this exercise — "UltraHonk over Grumpkin" and the non-zk disclosure proof — were **inherited defaults that were correct in their original context and wrong in ours**. Grumpkin is genuinely the curve the circuits compute over; non-zk is genuinely required on chain. Neither was careless; both were true statements applied one level away from where they were true.

That suggests the check to run on any crypto claim is not "is this sentence true?" but **"is this sentence true *here*, and did we verify it or inherit it?"**
