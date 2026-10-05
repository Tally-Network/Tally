# Non-custodial contributor registration

A contributor registers a confidential account **from their own wallet**. The spending key is derived from a wallet signature on their device and never leaves it — so amounts are private from the public ledger *and* from whoever runs the disbursement.

Custodial derivation would be simpler and would make our first real integration demonstrate a product where privacy holds against the public but not against the platform. That is not what the trust statement describes.

## What is tested, and what is not

This is split deliberately along the line between failures that are **loud** and failures that are **silent**.

| | Where | Verified |
|:---|:---|:---|
| Key derivation, mandatory signer checks, proving, submission, chain read-back | [`core.ts`](core.ts) | ✅ **Yes — headless, against live testnet.** [`test-core.ts`](test-core.ts), 9 checks |
| Wallet connect button, Freighter plumbing, layout | — | ❌ **Not built.** There is no browser page in this repository; a wallet UI would wrap `core.ts` |

A broken connect button would fail in front of you. A wrong key derivation does not: it registers an account that looks fine and is permanently unreachable from the key the contributor believes controls it. So the second is tested and the first is not, rather than the other way round.

```bash
npx tsx registration/test-core.ts
```

Last run: derivation deterministic and bound to both `addr_f` and `acct_f`; wrong-account and non-deterministic signers both rejected; raw-root fallback reports its form; proof generated client-side in **882 ms**; account registered on testnet (OpenZeppelin v0.9.0 deployment, 2026-10-05); **on-chain viewing key matched the wallet-derived key**.

## Derivation is normative, not ours to choose

OpenZeppelin v0.9.0 `docs/sdk/key-derivation.md` ("Derivation"). Implementations MUST NOT substitute a different KDF — the choice is arbitrary in isolation, but has to be identical across clients or the same wallet derives different accounts in different apps.

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

OpenZeppelin v0.9.0 `docs/sdk/key-derivation.md` requires a raw root to be surfaced for backup at creation ("Raw roots and imported keys") and `sk` export to be offered as a backup ("Signer roots"). A wallet UI built on `core.ts` should show this before anything is signed:

> Your confidential account is only as private as the key that signs for this address. Anyone who obtains that key can both view and spend. Registration is single-use, so the key cannot be rotated in place — recovering from a compromise means registering a new address and moving the funds.

The wording is Tally's; the obligations behind it are upstream's.

## Browser page

Not built. There is no `index.html` in this repository; an earlier version of this README pointed at one that was never committed. Only the headless core and its live-testnet test exist.
