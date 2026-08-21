# Non-custodial contributor registration

A contributor registers a confidential account **from their own wallet**. The spending key is derived from a wallet signature on their device and never leaves it — so amounts are private from the public ledger *and* from whoever runs the disbursement.

Custodial derivation would be simpler and would make our first real integration demonstrate a product where privacy holds against the public but not against the platform. That is not what the trust statement describes.

## What is tested, and what is not

This is split deliberately along the line between failures that are **loud** and failures that are **silent**.

| | Where | Verified |
|:---|:---|:---|
| Key derivation, §5.2 signer checks, proving, submission, chain read-back | [`core.ts`](core.ts) | ✅ **Yes — headless, against live testnet.** [`test-core.ts`](test-core.ts), 9 checks |
| Wallet connect button, Freighter plumbing, layout | [`index.html`](index.html) | ❌ **No.** Needs a browser with a wallet extension |

A broken connect button fails in front of you. A wrong key derivation does not: it registers an account that looks fine and is permanently unreachable from the key the contributor believes controls it. So the second is tested and the first is not, rather than the other way round.

```bash
npx tsx registration/test-core.ts
```

Last run: derivation deterministic and bound to both `addr_f` and `acct_f`; wrong-account and non-deterministic signers both rejected; raw-root fallback reports its form; proof generated client-side in **932 ms**; account registered on testnet; **on-chain viewing key matched the wallet-derived key**.

## Derivation is normative, not ours to choose

`SDK.md` §5.1–§5.2. Implementations MUST NOT substitute a different KDF — the choice is arbitrary in isolation, but has to be identical across clients or the same wallet derives different accounts in different apps.

```
msg  = "openzeppelin/confidential-token/v1/sk" \n <token contract> \n <account>
root = Ed25519-Sign(sk_ed, SHA-256("Stellar Signed Message:\n" || msg))
sk   = RS(HKDF-SHA-512(IKM=root, salt=<domain>, info=be32(addr_f)‖be32(acct_f)‖le4(j)))
```

Strkeys go in the message rather than their compressed forms so a wallet rendering SEP-0053 as text shows the contributor addresses they can actually compare.

> **This differs from the reference demo app**, which derives `sk = SHA-512(signature) mod r` over a message of its own. That app predates the specification. Keys from the two schemes are not interchangeable.

## The checks that are mandatory, and why

Each guards a failure that otherwise succeeds quietly.

- **Verify the signature against the expected public key.** A wallet with a different account selected returns a *well-formed signature over the same message*. Registration succeeds, and the account is unreachable from the key the contributor believes controls it.
- **Sign twice from independent invocations.** RFC 8032 ed25519 is deterministic; threshold and MPC signers randomise the nonce and will not reproduce the key later. Registration is refused rather than stranding funds.
- **Record which signer enrolled.** `sk` binds to the *address*, not to the signer, and which signer enrolled is not recoverable from chain state.
- **Fall back to a raw root, never fail enrolment.** SEP-0053 support across wallets is uneven. A raw root is reproducible from nothing the contributor already holds, so the caller must surface it for backup at creation and must not offer recovery.

## Required disclosure

`SDK.md` §5.2 requires this at the point of account creation, and the page shows it before anything is signed:

> Your confidential account is only as private as the key that signs for this address. Anyone who obtains that key can both view and spend. Registration is single-use, so the key cannot be rotated in place — recovering from a compromise means registering a new address and moving the funds.

## Running the page

```bash
pnpm --filter @ctd/sdk build      # the vendored SDK compiles to dist/
python3 -m http.server -d registration 8080
```

Serve rather than bundle. Browser bundlers rewrite bb.js's worker URL into a hashed chunk and proving hangs — the SDK documents this, and serving native ESM avoids it entirely.

**Untested.** Needs Freighter and a testnet account. If you run it, the meaningful check is the last one: after registering, `confidential_balance(yourAddress).viewing_public_key` must equal the key the page derived.
