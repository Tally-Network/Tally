/**
 * Register-circuit witness (docs/protocol/operations/register.md). Proves
 * knowledge of `sk` such that `Y = sk·H` and `PVK = vk·H` with
 * `vk = Poseidon2(VIEWING_KEY, sk, addr_f)`.
 *
 * Public inputs (contract PI order): Y, PVK, addr_f, acct_f. The contract
 * recomputes `acct_f = address_to_field(account)` itself, which binds the proof
 * to the registering address (OpenZeppelin #775).
 */

import type { KeyPair } from "../crypto/keys.js";
import type { Point } from "../crypto/grumpkin.js";
import { addressToField } from "../crypto/address.js";
import { fieldIn, pointIn, type NoirInputs } from "./common.js";

export interface RegisterWitness {
  inputs: NoirInputs;
  /** On-chain `RegisterPayload` { y, pvk }. */
  payload: { y: Point; pvk: Point };
}

/** `account` is the strkey of the address that will call `register`. */
export function buildRegisterWitness(keys: KeyPair, account: string): RegisterWitness {
  const inputs: NoirInputs = {
    sk: fieldIn(keys.sk),
    ...pointIn("y", keys.Y),
    ...pointIn("pvk", keys.PVK),
    addr_f: fieldIn(keys.addrF),
    _acct_f: fieldIn(addressToField(account)),
  };
  return { inputs, payload: { y: keys.Y, pvk: keys.PVK } };
}
