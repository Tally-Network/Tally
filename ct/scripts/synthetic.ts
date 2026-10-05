/** Synthetic, fully valid aggregate-disclosure witnesses for benchmarks. */
import { deriveKeys } from "../sdk/src/crypto/keys.js";
import { randomScalar } from "../sdk/src/crypto/field.js";
import { H, pointCoords, scalarMul, type Point } from "../sdk/src/crypto/grumpkin.js";
import { poseidonWithDomain } from "../sdk/src/crypto/poseidon2.js";
import { DOMAIN } from "../sdk/src/crypto/constants.js";
import { buildTransferWitness } from "../sdk/src/witness/transfer.js";

const hex = (x: bigint) => "0x" + x.toString(16).padStart(64, "0");

/**
 * A valid aggregate witness built entirely off-chain: n transfers fanned out
 * over 5 lanes, using the same SDK crypto as a real round.
 */
export function syntheticAggregate(n: number, kAud: Point, addrF: bigint) {
  const lanes = Array.from({ length: 5 }, () => deriveKeys(randomScalar(), addrF));
  const F: Record<string, string[]> = { sk: [], r_e: [], v_tx: [], active: [], pvk_a_x: [], pvk_a_y: [],
    pvk_b_x: [], pvk_b_y: [], r_e_x: [], r_e_y: [], sigma: [], v_tilde: [] };
  let total = 0n;
  for (let i = 0; i < n; i++) {
    const lane = lanes[i % 5]!, rec = deriveKeys(randomScalar(), addrF);
    const amount = 100n + BigInt(i);
    const w = buildTransferWitness({ keys: lane, v: 1_000_000n, r: randomScalar(), amount, pvkB: rec.PVK, kAudR: kAud, kAudS: kAud });
    const A = pointCoords(lane.PVK), B = pointCoords(rec.PVK), R = pointCoords(w.payload.rE);
    F.sk!.push(hex(lane.sk)); F.r_e!.push(hex(w.rEScalar)); F.v_tx!.push(hex(amount)); F.active!.push(hex(1n));
    F.pvk_a_x!.push(hex(A.x)); F.pvk_a_y!.push(hex(A.y)); F.pvk_b_x!.push(hex(B.x)); F.pvk_b_y!.push(hex(B.y));
    F.r_e_x!.push(hex(R.x)); F.r_e_y!.push(hex(R.y)); F.sigma!.push(hex(w.payload.sigma)); F.v_tilde!.push(hex(w.payload.vTilde));
    total += amount;
  }
  const rDisc = randomScalar(), pR = scalarMul(randomScalar(), H), PR = pointCoords(pR), nu = randomScalar();
  const sDisc = pointCoords(scalarMul(rDisc, pR)), rd = pointCoords(scalarMul(rDisc, H));
  return { ...F, r_disc: hex(rDisc), addr_f: hex(addrF), n_active: hex(BigInt(n)), p_r_x: hex(PR.x), p_r_y: hex(PR.y),
    nu: hex(nu), r_disc_x: hex(rd.x), r_disc_y: hex(rd.y), v_tilde_disc: hex(total + poseidonWithDomain(DOMAIN.DISCLOSURE_BIND, [sDisc.x, nu])) };
}

