/**
 * Deploy Tally's testnet stack against OpenZeppelin stellar-contracts v0.9.0:
 *
 *   1. Ensure the native XLM Stellar Asset Contract exists (the underlying).
 *   2. Deploy verifier + auditor + confidential token, and Tally's round
 *      registry.
 *   3. Register the v0.9.0 verification keys (ct/sdk/circuits/vks/*.vk.bin,
 *      copied byte-for-byte from vendor/stellar-contracts).
 *   4. Generate ONE auditor key (id 0) and register its public point.
 *   5. Assert the contract's address-as-field equals the SDK's.
 *   6. Write demo/deployment.testnet.json — PUBLIC DATA ONLY.
 *
 * The auditor SECRET never touches the repository. It is written to
 * $TALLY_SECRETS_DIR (default ~/.config/tally) with mode 0600, and the script
 * refuses to write it anywhere inside the repo. The demo never needs it: it
 * reads the auditor's public key from chain.
 *
 * Usage:  pnpm deploy:testnet
 * Deployer: the stellar CLI identity `tally-deployer` (created and funded via
 * friendbot if missing).
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Address, Networks, xdr } from "@stellar/stellar-sdk";

import { ChainClient, keypairSigner } from "../sdk/src/chain/client.js";
import { addressToField } from "../sdk/src/crypto/address.js";
import { fromBytesBE, randomScalar, toHex32 } from "../sdk/src/crypto/field.js";
import { H, pointCoords, pointToBytes, scalarMul } from "../sdk/src/crypto/grumpkin.js";
import { CIRCUIT_TYPE } from "../sdk/src/crypto/constants.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const NETWORK = "testnet";
const RPC_URL = process.env.TALLY_RPC ?? "https://soroban-testnet.stellar.org";
const PASSPHRASE = Networks.TESTNET;
const DEPLOYER = "tally-deployer";
const OUT = join(REPO, "demo/deployment.testnet.json");
const SECRETS_DIR = resolve(process.env.TALLY_SECRETS_DIR ?? join(homedir(), ".config/tally"));

const WASM = {
  token: join(REPO, "ct/contracts/target/wasm32v1-none/release/confidential_token_contract.wasm"),
  verifier: join(REPO, "ct/contracts/target/wasm32v1-none/release/confidential_verifier_contract.wasm"),
  auditor: join(REPO, "ct/contracts/target/wasm32v1-none/release/confidential_auditor_contract.wasm"),
  registry: join(REPO, "contracts/target/wasm32v1-none/release/tally_round_registry.wasm"),
};
const VKS: ReadonlyArray<[string, number]> = [
  ["register", CIRCUIT_TYPE.Register],
  ["withdraw", CIRCUIT_TYPE.Withdraw],
  ["transfer", CIRCUIT_TYPE.Transfer],
  ["spender_transfer", CIRCUIT_TYPE.SpenderTransfer],
  ["set_spender", CIRCUIT_TYPE.SetSpender],
  ["clawback", CIRCUIT_TYPE.Clawback],
];

const stellar = (args: string[]) =>
  execFileSync("stellar", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const stellarSoft = (args: string[]) => { try { return stellar(args); } catch { return ""; } };
const lastToken = (out: string) => out.split(/\s+/).filter(Boolean).pop()!;

function ensureDeployer(): string {
  if (!stellarSoft(["keys", "public-key", DEPLOYER])) {
    stellar(["keys", "generate", DEPLOYER, "--network", NETWORK, "--fund"]);
  }
  return stellar(["keys", "public-key", DEPLOYER]);
}

function deploy(wasm: string, ctor: string[]): string {
  if (!existsSync(wasm)) throw new Error(`missing ${wasm}; run pnpm build:contracts`);
  const id = lastToken(stellar(["contract", "deploy", "--wasm", wasm, "--source", DEPLOYER,
    "--network", NETWORK, "--", ...ctor]));
  if (!id.startsWith("C")) throw new Error(`unexpected deploy output for ${wasm}: ${id}`);
  return id;
}

function writeSecret(path: string, body: object): void {
  if (path === REPO || path.startsWith(REPO + "/")) {
    throw new Error(`refusing to write a secret inside the repository: ${path}`);
  }
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify(body, null, 2) + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
}

async function readAddressAsField(client: ChainClient, token: string, fromLedger: number): Promise<bigint | null> {
  const resp = await client.server.getEvents({
    startLedger: fromLedger, filters: [{ type: "contract", contractIds: [token] }], limit: 50,
  });
  for (const ev of resp.events) {
    if (ev.topic[0]?.sym().toString() !== "address_as_field_set") continue;
    for (const entry of ev.value.map() ?? []) {
      if (entry.key().sym().toString() === "address_as_field") {
        return fromBytesBE(new Uint8Array(entry.val().bytes()));
      }
    }
  }
  return null;
}

async function main() {
  const deployer = ensureDeployer();
  console.log(`deployer ${DEPLOYER} = ${deployer}`);

  stellarSoft(["contract", "asset", "deploy", "--asset", "native", "--source", DEPLOYER, "--network", NETWORK]);
  const underlying = stellar(["contract", "id", "asset", "--asset", "native", "--network", NETWORK]);
  console.log(`underlying (native SAC) = ${underlying}`);

  const verifier = deploy(WASM.verifier, ["--admin", deployer, "--manager", deployer]);
  const auditor = deploy(WASM.auditor, ["--admin", deployer, "--manager", deployer]);
  console.log(`verifier = ${verifier}\nauditor  = ${auditor}`);

  const client = new ChainClient({ rpcUrl: RPC_URL, networkPassphrase: PASSPHRASE,
    contracts: { token: "", verifier, auditor } });
  const ledgerBeforeToken = await client.latestLedger();
  const token = deploy(WASM.token, ["--underlying_asset", underlying, "--verifier", verifier, "--auditor", auditor]);
  client.cfg.contracts.token = token;
  const registry = deploy(WASM.registry, []);
  console.log(`token    = ${token}\nregistry = ${registry}`);

  const signer = keypairSigner(stellar(["keys", "show", DEPLOYER]), PASSPHRASE);
  const deployerVal = new Address(deployer).toScVal();
  for (const [name, type] of VKS) {
    const vk = readFileSync(join(REPO, "ct/sdk/circuits/vks", `${name}.vk.bin`));
    await client.invoke(verifier, "register_verification_key",
      [xdr.ScVal.scvU32(type), xdr.ScVal.scvBytes(vk), deployerVal], signer);
    console.log(`  registered VK ${name} (circuit ${type}, ${vk.length}B)`);
  }

  // Auditor key: K_aud = a·H. The secret goes to SECRETS_DIR only.
  const auditorSecret = randomScalar();
  const kAud = scalarMul(auditorSecret, H);
  await client.invoke(auditor, "register_key",
    [xdr.ScVal.scvU32(0), xdr.ScVal.scvBytes(Buffer.from(pointToBytes(kAud))), deployerVal], signer);
  const k = pointCoords(kAud);
  const secretPath = join(SECRETS_DIR, `${NETWORK}-auditor-${token}.json`);
  writeSecret(secretPath, { network: NETWORK, token, auditorContract: auditor, auditorId: 0,
    secretHex: toHex32(auditorSecret), keyXHex: toHex32(k.x), keyYHex: toHex32(k.y) });
  console.log(`  registered auditor key id 0; secret written to ${secretPath} (0600, outside the repo)`);

  const sdkAddrF = addressToField(token);
  const onchain = await readAddressAsField(client, token, ledgerBeforeToken);
  if (onchain === null) throw new Error("AddressAsFieldSet event not found; cannot check addr_f parity");
  if (onchain !== sdkAddrF) throw new Error(`addr_f mismatch: SDK ${toHex32(sdkAddrF)} != contract ${toHex32(onchain)}`);
  console.log(`  addr_f parity OK: ${toHex32(sdkAddrF)}`);

  const deployment = {
    network: NETWORK,
    rpcUrl: RPC_URL,
    passphrase: PASSPHRASE,
    deployedAtLedger: ledgerBeforeToken,
    openZeppelin: "stellar-contracts v0.9.0 @ df602b613fbc4ae1e98ff62ba3caef671a370f65",
    contracts: { token, verifier, auditor, underlying, registry },
    auditor: { id: 0, keyXHex: toHex32(k.x), keyYHex: toHex32(k.y) },
    addrF: toHex32(sdkAddrF),
  };
  writeFileSync(OUT, JSON.stringify(deployment, null, 2) + "\n");
  console.log(`\nwrote ${OUT} (public data only)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
