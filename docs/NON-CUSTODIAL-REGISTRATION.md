# Non-custodial contributor registration — what it actually takes

**Question:** is custodial derivation a cryptographic constraint or a schedule constraint?

**Answer: a schedule constraint, and a small one. Non-custodial registration is already implemented and working in the reference browser app.** It is not research. My earlier framing — "custodial is the only MVP-shaped answer" — was wrong, and it was wrong in the direction that happens to be convenient, which is the direction to distrust.

---

## It already works

`packages/app/lib/wallet.ts` in the reference demo performs the entire flow client-side:

```
freighter.signMessage(msg)  →  skFromSignature()  →  deriveKeys()
                            →  buildRegisterWitness()
                            →  CircuitProver.prove()      ~672 ms, 33 ACIR opcodes
                            →  submitRegister()
```

The spending key is derived from a **deterministic ed25519 wallet signature** (RFC 8032 signatures are deterministic, so the same account signing the same message yields the same 64 bytes forever). Proving runs in the browser on bb.js/WASM. The key never leaves the contributor's device, and the platform never sees it.

So a contributor can generate the proof-carrying registration from a wallet **today**. Nothing needs inventing.

## The passkey premise needs one correction

Passkey smart accounts can **authorise** `register` — they are contract addresses and `require_auth` works normally. But they cannot **derive** the confidential key. `SDK.md` §5.3 is explicit:

> **Contract addresses.** A confidential account registered by a smart account or other contract address has **no ed25519 signer to sign §5.2's message**, so its root comes from whatever custody mechanism controls the contract.

A contract address therefore falls back to a **raw 32-byte root**, and:

> A raw root is reproducible from nothing the user already holds, so an implementation that generates one MUST surface it for backup at creation and MUST NOT treat it as recoverable from the account's other credentials.

**So "passkeys work with confidential tokens" is true for authorisation and false for key derivation** — and derivation is the half that carries the confidentiality. Under a passkey smart account the contributor must separately back up a 32-byte secret that the passkey neither protects nor recovers, which is a worse recovery story than the ed25519 wallet path, not a better one.

*(A WebAuthn PRF/`hmac-secret` extension could seed the root deterministically from the passkey. That is not in the spec, PRF support is not universal, and it would be our own extension carrying our own analysis. Not for v1.)*

**The practical non-custodial route is the ordinary ed25519 wallet — Freighter, Lobstr, xBull — which is exactly the path already built.**

## What the delta actually buys and costs

| | Custodial | Non-custodial (ed25519 wallet) |
|:---|:---|:---|
| Who holds the spending key | **Grainlify** | The contributor |
| Can the platform read amounts? | **Yes, all of them** | No |
| Contributor action before payout | None | Connect wallet, sign once, ~672 ms proof |
| Payout can proceed immediately | Yes | Only for already-registered contributors |
| Recovery if the contributor loses access | Platform re-derives | Re-sign with the same wallet key |

### Work required (~4–6 days on top of custodial)

None of it is cryptography. It is product surface plus the safety obligations `SDK.md` §5.2 makes mandatory:

1. **Registration page** — wallet connect, SEP-0053 message signing, in-browser proof, submit. Grainlify's frontend is TypeScript, so the SDK drops in.
2. **§5.2 mandatory checks**, each of which is a real failure mode:
   - Verify the returned signature against the expected public key and abort on mismatch — a wallet with a different account selected returns a *well-formed signature over the same message*, producing a wrong but entirely usable key. Registration succeeds and the account is then unreachable from the key the contributor believes controls it.
   - Obtain the signature twice from independent invocations and abort if they differ — MPC and threshold signers randomise the nonce and do not reproduce.
   - Record which signer enrolled; the key is bound to the *address*, not the signer.
3. **Raw-root fallback with explicit backup UX** — SEP-0053 support across wallets is uneven, and §5.2 requires falling back rather than failing enrolment.
4. **Required disclosure** — §5.2: "the account's confidentiality is bounded by the secrecy of the account's signing key," and `register` is single-use so the key cannot be rotated in place. This must appear at the point of account creation.

### Recommended shape: non-custodial by default, round-scoped

Do not block payouts on contributor action. **A round pays whoever is registered when it opens**; anyone unregistered is paid in the next round. Registration becomes an onboarding step Grainlify already has a natural place for, and the payout path never stalls on a contributor who has not signed in.

## Why this decides the flagship integration

Custodial derivation would make our first real integration demonstrate a product where **privacy holds against the public but not against the platform**. For a bounty platform that is a coherent threat model — but it is not the one the trust statement describes, and shipping it silently would make the page's central claim true only in a weaker sense than a reader would take from it.

**Recommendation: build the flagship integration non-custodial.** It costs roughly four to six days on a path already proven in shipped code, and it avoids a permanent asterisk on the product's core claim.

### If custodial ships anyway, the trust statement gains a third sentence

Not a footnote, not a status doc — the same unshortened public copy, everywhere the other two appear:

> **Under Grainlify's custodial registration, this also does not assure** that recipient amounts are private from Grainlify itself: Grainlify derives and holds each contributor's confidential keys, so it can decrypt every individual amount it disburses, and the guarantee here is privacy from the public ledger rather than privacy from the platform.

That sentence is the honest cost of the schedule saving. It is also, read plainly, an argument for spending the four days.
