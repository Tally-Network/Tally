# Target 4, alternative shape — a small real round

**Status: sketch. Not scoped, not started.** Two decisions above this document are open (whether a Grainlify settlement lands on Stellar; whether Tally has an SCF slot at all), and this exists so there is something to think with, not something to build from.

**The shape:** a standalone Stellar round with **n ≥ 5 real contributors registering non-custodially**, rather than routing Grainlify's founding payout through Tally.

**This is target 7, not a substitute for target 4.** Target 4 stays ❌ until a platform integrates. See [DEMONSTRATION-STATUS.md](DEMONSTRATION-STATUS.md).

---

## What it would prove, and what it would not

| Proves | Does not prove |
|:---|:---|
| Real people, with their own wallets, holding their own keys | That a platform integrated Tally into its payout path |
| Non-custodial registration works outside our test harness | Anything about Grainlify |
| A real round is publicly verifiable by a third party with `tally verify` | Production-scale operation |

**Be explicit in the submission: this is not §4 target 4 as written.** Target 4 says "Grainlify calls the SDK for a real contributor payout." This substitutes a different, weaker adoption signal — and a *stronger* privacy signal, since the contributors are independent parties holding their own keys rather than a harness generating both sides.

Presented as what it is, it is credible. Presented as target 4, a reviewer who reads carefully will catch it, and that costs more than the gap it papers over.

## The sentence that ships with this, verbatim

Wherever this round is described publicly, unshortened, in the same discipline as the trust statement:

> **Real people, real wallets, real keys, real verification — nominal value.** The round runs on Stellar testnet, where the asset has no monetary worth; what is real is that independent contributors hold their own keys, that no platform can decrypt their amounts, and that anyone can verify the total.

If real monetary value is required, that is a mainnet requirement, and mainnet is gated on the upstream audit — outside our control.

## What already exists

- Round registry, deployed and namespaced (`CDWIXFBO…BK7W`)
- Aggregate circuits `n ∈ {8, 16, 64}` with pinned zero-knowledge VKs
- Fan-out orchestration across lanes
- `tally challenge` / `prove` / `verify`, with negative cases verified
- Proof that browser-side non-custodial registration works — in the reference app, not ours

## What would have to be built

**1. A registration page — the only substantial piece (~3–4 days)**

Wallet connect → SEP-0053 message signing → key derivation → in-browser proof (~672 ms) → `register` submitted. The proving path is proven; the surrounding obligations are the work, and `SDK.md` §5.2 makes them mandatory rather than optional:

- Verify the returned signature against the expected public key and abort on mismatch. A wallet with a different account selected returns a **well-formed signature over the same message**, yielding a wrong but entirely usable key: registration succeeds, and the account is then unreachable from the key the contributor believes controls it.
- Obtain the signature twice from independent invocations and abort if they differ — MPC and threshold signers randomise the nonce.
- Record which signer enrolled; the key binds to the *address*, not the signer.
- Raw-root fallback with explicit backup UX, since SEP-0053 support across wallets is uneven and §5.2 requires falling back rather than failing enrolment.
- The required disclosure, at the point of account creation: confidentiality is bounded by the secrecy of the signing key, and `register` is single-use so the key cannot be rotated in place.

**2. Round runner using real addresses (~1 day)** — `demo/run-round.ts` generates both sides; this takes a real recipient list and pays it.

**3. Published verification instructions (~0.5 day)** — the round is only evidence if a stranger can re-run `tally verify` against it. Funder address, round id, and the command.

**4. Recruitment (calendar time, not effort)** — ≥5 contributors who will actually complete registration.

**Roughly 5–6 days of build, plus recruitment elapsed time.**

## The risks worth naming now

- **Funnel.** Every contributor must connect a wallet and sign. With 5 needed, a 50% completion rate means recruiting 10. The floor is a hard constraint: **4 registrations produce no provable round at all**, because `MIN_ACTIVE = 5` is a circuit constraint rather than a policy.
- **Wallet support.** SEP-0053 message signing is uneven. Freighter works; others may force the raw-root path, which needs the backup UX before anyone uses it.
- **This competes with the Grainlify integration for the same days.** If the Grainlify decision resolves toward Stellar soon, most of this work — the registration page especially — is reusable, since Grainlify would need exactly that flow. If it resolves toward Aptos, this becomes the adoption story rather than a stopgap.

**The registration page is the piece worth building either way.** It is the only item that is not already done, and it is required under both outcomes.
