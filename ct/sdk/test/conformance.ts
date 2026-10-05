/**
 * Cross-language conformance: every OpenZeppelin v0.9.0 primitive vector in
 * vendor/stellar-contracts/.../circuits/lib/testdata must be reproduced
 * byte-for-byte by this SDK (that directory's README: "A consumer in any
 * language is correct iff ... it reproduces every output in every JSON file").
 *
 * Exit code 0 = all vectors match; 1 = any mismatch.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { addressToField } from "../src/crypto/address.js";
import { G, H, commit, ecdh, scalarMul, pointCoords, Grumpkin, type Point } from "../src/crypto/grumpkin.js";
import {
  poseidonWithDomain, spongeSqueeze2, spongeSqueeze3, vkFromSk, dvkFromVkOp, deriveSpendR,
  deriveAllowR, deriveTransferBlind, encryptAmount, encryptBalance, encryptAllowance, encryptEscDvk,
} from "../src/crypto/poseidon2.js";

const DIR = new URL(
  "../../../vendor/stellar-contracts/packages/tokens/src/confidential/circuits/lib/testdata/",
  import.meta.url,
).pathname;

const big = (h: string) => BigInt(h);
const hex = (x: bigint) => "0x" + x.toString(16).padStart(64, "0");
const norm = (h: string) => hex(BigInt(h));
const pt = (v: unknown): Point => {
  if (v === "H") return H;
  if (v === "G") return G;
  const o = v as { x: string; y: string };
  return Grumpkin.fromAffine({ x: big(o.x), y: big(o.y) });
};
const ptOut = (p: Point) => { const c = pointCoords(p); return { x: hex(c.x), y: hex(c.y) }; };

type In = Record<string, any>;
const IMPL: Record<string, (i: In) => unknown> = {
  address_to_field: (i) => hex(addressToField(i.strkey)),
  commit: (i) => ptOut(commit(big(i.value), big(i.randomness))),
  derive_allow_r: (i) => hex(deriveAllowR(big(i.dvk), big(i.sigma_a))),
  derive_spend_r: (i) => hex(deriveSpendR(big(i.vk), big(i.sigma))),
  derive_transfer_blind: (i) => hex(deriveTransferBlind(big(i.s), big(i.sigma))),
  dvk_from_vk_op: (i) => hex(dvkFromVkOp(big(i.vk), big(i.op_i))),
  ecdh: (i) => hex(ecdh(big(i.scalar), pt(i.point))),
  encrypt_allowance: (i) => hex(encryptAllowance(big(i.v_a), big(i.dvk), big(i.sigma_a))),
  encrypt_amount: (i) => hex(encryptAmount(big(i.v_transfer), big(i.s), big(i.sigma))),
  encrypt_balance: (i) => hex(encryptBalance(big(i.v_new), big(i.vk), big(i.sigma))),
  encrypt_esc_dvk: (i) => hex(encryptEscDvk(big(i.dvk), big(i.s), big(i.op_i))),
  poseidon_with_domain: (i) => hex(poseidonWithDomain(big(i.domain), (i.inputs as string[]).map(big))),
  pvk_from_vk: (i) => ptOut(scalarMul(big(i.vk), H)),
  scalar_mul: (i) => ptOut(scalarMul(big(i.scalar), pt(i.point))),
  sponge_squeeze_2: (i) => spongeSqueeze2(big(i.d), big(i.s), big(i.sigma)).map(hex),
  sponge_squeeze_3: (i) => spongeSqueeze3(big(i.d), big(i.s), big(i.sigma)).map(hex),
  vk_from_sk: (i) => hex(vkFromSk(big(i.sk), big(i.wrap))),
};
// Spender-only primitive; Tally never builds spender operations.
const NOT_IMPLEMENTED = new Set(["encrypt_esc_allow_r_auditor"]);

const normOut = (o: unknown): unknown =>
  typeof o === "string" ? norm(o)
  : Array.isArray(o) ? o.map(normOut)
  : { x: norm((o as any).x), y: norm((o as any).y) };

let pass = 0, fail = 0, skipped = 0;
for (const f of readdirSync(DIR).filter((n) => n.endsWith(".json")).sort()) {
  const doc = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  const impl = IMPL[doc.primitive];
  if (!impl) {
    if (!NOT_IMPLEMENTED.has(doc.primitive)) { console.log(`FAIL ${doc.primitive}: no SDK implementation mapped`); fail++; }
    else { console.log(`skip ${doc.primitive} (not used by Tally)`); skipped++; }
    continue;
  }
  doc.vectors.forEach((v: any, k: number) => {
    const got = JSON.stringify(impl(v.inputs)), want = JSON.stringify(normOut(v.output));
    if (got === want) pass++;
    else { fail++; console.log(`FAIL ${doc.primitive}[${k}]\n  want ${want}\n  got  ${got}`); }
  });
}
console.log(`conformance: ${pass} passed, ${fail} failed, ${skipped} skipped`);
process.exit(fail === 0 ? 0 : 1);
