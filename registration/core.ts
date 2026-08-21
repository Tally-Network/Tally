/**
 * Non-custodial confidential-account registration — the part that can be wrong
 * silently, kept separate from the part that can only be wrong loudly.
 *
 * Everything here is pure logic plus one chain submit: key derivation, the
 * mandatory signer checks, witness construction, proving, and the register
 * call. It runs identically in Node and in a browser, so it is tested headless
 * (`test-core.ts`) against real testnet rather than only by clicking a button.
 *
 * `index.html` is the thin shell around it: connect a wallet, get a signature,
 * call `register()`. A broken wallet button fails visibly. A wrong key
 * derivation does not — it registers an account that looks fine and is
 * unreachable from the key the contributor believes controls it.
 *
 * KEY DERIVATION IS NORMATIVE, NOT OURS TO CHOOSE (OZ `SDK.md` §5.1–§5.2).
 * Implementations MUST NOT substitute a different KDF: the choice is arbitrary
 * in isolation but has to be identical across clients, or the same wallet
 * derives different accounts in different apps.
 *
 *     root = Ed25519-Sign(sk_ed, SHA-256("Stellar Signed Message:\n" || msg))
 *     msg  = "openzeppelin/confidential-token/v1/sk" \n <contract> \n <account>
 *     sk   = RS(HKDF-SHA-512(IKM=root, salt=<domain>, info=be32(addr_f)||be32(acct_f)||le4(j)))
 *
 * NOTE: this differs from the reference demo app, which derives
 * `sk = SHA-512(signature) mod r` over a message of its own. That predates the
 * specification. Keys from the two schemes are not interchangeable; this one
 * follows the spec.
 */
import { hkdf } from "@noble/hashes/hkdf";
import { sha512 } from "@noble/hashes/sha2";
import { sha256 } from "@noble/hashes/sha2";

import { deriveKeys, type KeyPair } from "../vendor/confidential-token-demo/packages/sdk/src/crypto/keys.js";
import { addressToField } from "../vendor/confidential-token-demo/packages/sdk/src/crypto/address.js";
import { FR_MODULUS } from "../vendor/confidential-token-demo/packages/sdk/src/crypto/constants.js";
import { fromBytesBE, toBytes32BE } from "../vendor/confidential-token-demo/packages/sdk/src/crypto/field.js";
import { vkFromSk } from "../vendor/confidential-token-demo/packages/sdk/src/crypto/poseidon2.js";
import { buildRegisterWitness } from "../vendor/confidential-token-demo/packages/sdk/src/witness/register.js";
import { encodeRegisterData } from "../vendor/confidential-token-demo/packages/sdk/src/chain/payload.js";

/** SEP-0053's fixed prefix — 24 ASCII bytes. */
const SEP53_PREFIX = new TextEncoder().encode("Stellar Signed Message:\n");
/** The protocol's derivation domain, used as both message tag and HKDF salt. */
const DOMAIN = "openzeppelin/confidential-token/v1/sk";

const enc = new TextEncoder();
const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

/**
 * The exact bytes a wallet is asked to sign (§5.2).
 *
 * Strkeys rather than their compressed field forms, deliberately: a wallet that
 * renders SEP-0053 messages as text then shows the user addresses they can
 * compare against the deployment they meant to register on.
 */
export function derivationMessage(tokenContract: string, account: string): string {
  return `${DOMAIN}\n${tokenContract}\n${account}`;
}

/** SHA-256(prefix || msg) — what the ed25519 key actually signs. */
export function derivationDigest(tokenContract: string, account: string): Uint8Array {
  return sha256(concat(SEP53_PREFIX, enc.encode(derivationMessage(tokenContract, account))));
}

/**
 * §5.1 derivation. Rejection-samples until the candidate is a valid scalar and
 * the resulting `vk` is non-zero (register constraint R5).
 */
export function skFromRoot(root: Uint8Array, tokenContract: string, account: string): bigint {
  const addrF = addressToField(tokenContract);
  const acctF = addressToField(account);
  for (let j = 0; j < 256; j++) {
    const le4 = new Uint8Array(4);
    new DataView(le4.buffer).setUint32(0, j, true);
    const info = concat(toBytes32BE(addrF), toBytes32BE(acctF), le4);
    const out = hkdf(sha512, root, enc.encode(DOMAIN), info, 32);
    out[0] &= 0x3f;                       // clear the top 2 bits (§4.7)
    const cand = fromBytesBE(out);
    if (cand >= 1n && cand < FR_MODULUS && vkFromSk(cand, addrF) !== 0n) return cand;
  }
  throw new Error("key derivation failed to sample a valid scalar in 256 attempts");
}

/** A wallet that can sign the SEP-0053 message. Freighter, Lobstr, a keypair. */
export interface MessageSigner {
  /** The address whose key signs. */
  address: string;
  /**
   * Signs `message` under SEP-0053, returning the 64-byte RFC 8032 signature.
   *
   * Takes the MESSAGE rather than the digest on purpose: wallet APIs
   * (Freighter's `signMessage`) apply the `Stellar Signed Message:\n` prefix
   * and SHA-256 themselves, and handing them a pre-hashed digest would sign
   * the wrong bytes — a mismatch that still produces a usable-looking key.
   */
  signMessage(message: string): Promise<Uint8Array>;
  /** Verifies a signature really came from `address`. */
  verify(message: string, signature: Uint8Array): Promise<boolean>;
}

export interface DerivationResult {
  keys: KeyPair;
  /** How the key was produced — a user must not be offered a recovery path their account cannot satisfy (§5.3). */
  form: "signer-root" | "raw-root";
  /** The signer that enrolled. `sk` binds to the ADDRESS, not to this key, and which signer enrolled is not recoverable from chain state (§5.2). */
  enrolledSigner: string;
}

/**
 * Derive the confidential keys from a wallet, performing every check `SDK.md`
 * §5.2 marks mandatory. Each of these guards a failure that otherwise succeeds
 * quietly and strands the account.
 */
export async function deriveFromWallet(
  signer: MessageSigner,
  tokenContract: string,
): Promise<DerivationResult> {
  const message = derivationMessage(tokenContract, signer.address);

  const sig1 = await signer.signMessage(message);
  if (sig1.length !== 64) throw new Error(`expected a 64-byte ed25519 signature, got ${sig1.length}`);

  // MANDATORY: verify against the key we expect to have signed. A wallet with a
  // different account selected returns a WELL-FORMED signature over the same
  // message, yielding a wrong but entirely usable key — registration succeeds
  // and the account is unreachable from the key the user believes controls it.
  if (!(await signer.verify(message, sig1))) {
    throw new Error(
      "the signature does not verify against this address.\n" +
      "Check that your wallet has the intended account selected.");
  }

  // MANDATORY: sign twice from independent invocations. RFC 8032 ed25519 is
  // deterministic, so a conforming signer returns identical bytes. Threshold
  // and MPC signers randomise the nonce and will not reproduce the key later.
  const sig2 = await signer.signMessage(message);
  if (Buffer.compare(Buffer.from(sig1), Buffer.from(sig2)) !== 0) {
    throw new Error(
      "this signer is not deterministic — two signatures over the same message differed.\n" +
      "Threshold and MPC signers behave this way. Your key could not be re-derived later,\n" +
      "so registration is refused. Use a raw-root account with an explicit backup instead.");
  }

  const sk = skFromRoot(sig1, tokenContract, signer.address);
  return {
    keys: deriveKeys(sk, addressToField(tokenContract)),
    form: "signer-root",
    enrolledSigner: signer.address,
  };
}

/**
 * §5.3 fallback for wallets with no SEP-0053 path and for contract addresses
 * (a smart account has no ed25519 signer of its own).
 *
 * A raw root is reproducible from NOTHING the user already holds, so a caller
 * MUST surface it for backup at creation and MUST NOT present recovery as
 * available. That is the caller's obligation; this function only derives.
 */
export function deriveFromRawRoot(root: Uint8Array, tokenContract: string, account: string): DerivationResult {
  if (root.length !== 32) throw new Error(`raw root must be 32 bytes, got ${root.length}`);
  const sk = skFromRoot(root, tokenContract, account);
  return { keys: deriveKeys(sk, addressToField(tokenContract)), form: "raw-root", enrolledSigner: account };
}

/** Build the `register` call arguments. Proving happens in the caller's prover. */
export function registerPayload(keys: KeyPair, proof: Uint8Array) {
  const witness = buildRegisterWitness(keys);
  return { witness, data: encodeRegisterData(witness, proof) };
}

/** Witness only — feed `.inputs` to a prover, then pass the proof to `registerPayload`. */
export function registerWitness(keys: KeyPair) {
  return buildRegisterWitness(keys);
}
