/**
 * Headless test of the registration core against LIVE testnet.
 *
 * The wallet is simulated by a Stellar keypair doing exactly what Freighter
 * does — SEP-0053 prefix, SHA-256, ed25519 — so everything except the browser
 * plumbing is exercised for real: derivation, the mandatory signer checks,
 * proving, submission, and a read-back proving the on-chain account matches the
 * key the wallet derived.
 */
import { Keypair, TransactionBuilder, Contract, BASE_FEE, rpc, xdr, Address, Networks } from "@stellar/stellar-sdk";
import { readFileSync } from "node:fs";
import { sha256 } from "@noble/hashes/sha2";

import { deriveFromWallet, deriveFromRawRoot, derivationMessage, registerWitness,
         type MessageSigner } from "./core.js";
import { encodeRegisterData } from "../vendor/confidential-token-demo/packages/sdk/src/chain/payload.js";
import { CircuitProver } from "../vendor/confidential-token-demo/packages/sdk/src/proving/prover.js";
import { loadCircuit } from "../vendor/confidential-token-demo/packages/sdk/src/proving/artifacts.js";
import { ChainClient, keypairSigner } from "../vendor/confidential-token-demo/packages/sdk/src/chain/client.js";
import { pointCoords } from "../vendor/confidential-token-demo/packages/sdk/src/crypto/grumpkin.js";

const dep = JSON.parse(readFileSync(new URL("../demo/deployment.testnet.json", import.meta.url), "utf8"));
const PREFIX = new TextEncoder().encode("Stellar Signed Message:\n");
const pass = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m: string) => { console.log(`  \x1b[31m✗\x1b[0m ${m}`); process.exitCode = 1; };

/** Exactly what a SEP-0053 wallet does. */
function walletSigner(kp: Keypair): MessageSigner {
  const digest = (m: string) => sha256(Buffer.concat([PREFIX, Buffer.from(m, "utf8")]));
  return {
    address: kp.publicKey(),
    async signMessage(m) { return new Uint8Array(kp.sign(Buffer.from(digest(m)))); },
    async verify(m, sig) { return kp.verify(Buffer.from(digest(m)), Buffer.from(sig)); },
  };
}

async function main() {
  const server = new rpc.Server(dep.rpcUrl);
  const client = new ChainClient({ rpcUrl: dep.rpcUrl, networkPassphrase: Networks.TESTNET, contracts: dep.contracts });
  const token = dep.contracts.token;

  console.log("\n[1] derivation is deterministic and address-bound\n");
  const kp = Keypair.random();
  await (await fetch(`https://friendbot.stellar.org/?addr=${kp.publicKey()}`)).text();
  const w = walletSigner(kp);

  const a = await deriveFromWallet(w, token);
  const b = await deriveFromWallet(w, token);
  a.keys.sk === b.keys.sk ? pass("same wallet + same deployment -> same key") : fail("derivation is not deterministic");

  const other = Keypair.random();
  await (await fetch(`https://friendbot.stellar.org/?addr=${other.publicKey()}`)).text();
  const c = await deriveFromWallet(walletSigner(other), token);
  a.keys.sk !== c.keys.sk ? pass("different address -> different key (acct_f binding, §5.1)") : fail("keys collide across addresses");

  const d = await deriveFromWallet(w, dep.contracts.verifier);   // pretend another deployment
  a.keys.sk !== d.keys.sk ? pass("different deployment -> different key (addr_f binding)") : fail("keys collide across deployments");

  console.log("\n[2] the mandatory §5.2 checks actually reject\n");
  const wrongAccount: MessageSigner = { ...w, async verify() { return false; } };
  try { await deriveFromWallet(wrongAccount, token); fail("accepted a signature that does not verify"); }
  catch (e: any) { /wallet has the intended account/.test(e.message) ? pass("rejects a signature from the wrong account") : fail(`wrong error: ${e.message}`); }

  let n = 0;
  const nondeterministic: MessageSigner = { ...w, async signMessage(m) { n++; return new Uint8Array(Keypair.random().sign(Buffer.from(sha256(Buffer.concat([PREFIX, Buffer.from(m)]))))); }, async verify() { return true; } };
  try { await deriveFromWallet(nondeterministic, token); fail("accepted a non-deterministic signer"); }
  catch (e: any) { /not deterministic/.test(e.message) ? pass("rejects a non-deterministic (MPC/threshold) signer") : fail(`wrong error: ${e.message}`); }

  const raw = deriveFromRawRoot(new Uint8Array(32).fill(9), token, kp.publicKey());
  raw.form === "raw-root" ? pass("raw-root fallback derives and reports its form (§5.3)") : fail("raw-root form mislabelled");

  console.log("\n[3] register on live testnet, then read the account back\n");
  const prover = new CircuitProver(loadCircuit("register"));
  const t0 = Date.now();
  const witness = registerWitness(a.keys);
  const { proof } = await prover.prove(witness.inputs);
  const proveMs = Date.now() - t0;
  await prover.destroy();
  pass(`proof generated client-side in ${proveMs} ms (${proof.length} B)`);

  const signer = keypairSigner(kp.secret(), Networks.TESTNET);
  const src = await server.getAccount(kp.publicKey());
  const tx = new TransactionBuilder(src, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(token).call("register",
      new Address(kp.publicKey()).toScVal(), xdr.ScVal.scvU32(0), encodeRegisterData(witness, proof)))
    .setTimeout(120).build();
  const sim: any = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) { fail(`simulate: ${sim.error}`); return; }
  const signed = TransactionBuilder.fromXDR(await signer.sign(rpc.assembleTransaction(tx, sim).build().toXDR()), Networks.TESTNET);
  const sent = await server.sendTransaction(signed);
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1200));
    const g: any = await server.getTransaction(sent.hash);
    if (g.status === "SUCCESS") break;
    if (g.status === "FAILED") { fail(`register FAILED ${sent.hash}`); return; }
  }
  pass(`registered on chain (tx ${sent.hash.slice(0, 12)}…)`);

  const onChain = await client.confidentialBalance(kp.publicKey());
  if (!onChain) { fail("account not found after registration"); return; }
  const got = pointCoords(onChain.viewingPublicKey);
  const want = pointCoords(a.keys.PVK);
  got.x === want.x && got.y === want.y
    ? pass("on-chain viewing key matches the key derived from the wallet signature")
    : fail("on-chain key does NOT match the derived key");

  console.log(`\n  account ${kp.publicKey()}\n  https://stellar.expert/explorer/testnet/tx/${sent.hash}\n`);
}
main().catch(e => { console.error("\nFAILED:", e?.message ?? e); process.exit(1); });
