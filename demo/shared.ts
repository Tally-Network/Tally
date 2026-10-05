/** Network config + the deployment this demo runs against. */
import { readFileSync } from "node:fs";
import { Networks } from "@stellar/stellar-sdk";

export const RPC_URL = process.env.TALLY_RPC ?? "https://soroban-testnet.stellar.org";
export const PASSPHRASE = Networks.TESTNET;
export const FRIENDBOT = "https://friendbot.stellar.org";

export interface Deployment {
  network: string; rpcUrl: string; passphrase: string; deployedAtLedger: number;
  openZeppelin: string;
  contracts: { token: string; verifier: string; auditor: string; underlying: string; registry: string };
  /** Public auditor key only. The secret is never stored in this repository. */
  auditor: { id: number; keyXHex: string; keyYHex: string };
  addrF: string;
}

export function loadDeployment(): Deployment {
  const p = process.env.TALLY_DEPLOYMENT
    ?? new URL("./deployment.testnet.json", import.meta.url).pathname;
  return JSON.parse(readFileSync(p, "utf8")) as Deployment;
}

export async function friendbotFund(pubkey: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT}/?addr=${encodeURIComponent(pubkey)}`);
  if (!res.ok && res.status !== 400) throw new Error(`friendbot ${pubkey}: ${res.status}`);
}
