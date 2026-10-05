/**
 * Zero-knowledge prover for Tally's DISCLOSURE circuits.
 *
 * Two proving modes coexist in this system and must not be confused:
 *
 *   Transfer-family circuits  →  { keccak: true }    NON-zk, mandatory.
 *       These are verified by the on-chain Nethermind verifier, which
 *       implements only the non-zk flavour (OZ v0.9.0
 *       circuits/vks/README.md: "Do not pass --zk"). A zk proof simply fails
 *       on chain.
 *
 *   Disclosure circuits        →  { keccakZK: true }  ZK, and it matters.
 *       These never register with the on-chain verifier set — they are
 *       verified OFF-CHAIN by the donor via bb.js (OZ v0.9.0
 *       docs/selective-disclosure/protocol.md), so the on-chain verifier's
 *       limitation does not bind them.
 *
 * Why the disclosure proof MUST be zero-knowledge: the entire claim is that it
 * reveals only the aggregate. A non-zk Honk proof is succinct but not
 * witness-hiding, so with `{ keccak: true }` the individual amounts would be
 * protected only by the on-chain commitments — not by the artifact we hand the
 * donor. The donor already learns the total; the point is that they learn
 * nothing else, and only zk mode establishes that.
 *
 * Cost of the correct mode, measured on aggregate_n8/16/64:
 *   proof 14,592 B → 16,224 B (+1,632 B), prove +~50 ms. Constant across n.
 */
import { Noir, type CompiledCircuit } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";

/** Disclosure proofs are zero-knowledge. Do not change this to `keccak`. */
const KECCAK_ZK = { keccakZK: true } as const;

export interface ProofResult {
  proof: Uint8Array;
  publicInputs: string[];
}

export class DisclosureProver {
  readonly #noir: Noir;
  readonly #backend: UltraHonkBackend;

  constructor(circuit: CompiledCircuit) {
    this.#noir = new Noir(circuit);
    this.#backend = new UltraHonkBackend(circuit.bytecode);
  }

  async prove(inputs: Record<string, unknown>): Promise<ProofResult> {
    const { witness } = await this.#noir.execute(inputs as never);
    const { proof, publicInputs } = await this.#backend.generateProof(witness, KECCAK_ZK);
    return { proof, publicInputs };
  }

  /** The donor's side. Must use the same mode the prover used. */
  async verify(result: ProofResult): Promise<boolean> {
    return this.#backend.verifyProof(result, KECCAK_ZK);
  }

  /** Pinned verification key — the donor's trust anchor (§5.5). */
  async verificationKey(): Promise<Uint8Array> {
    return this.#backend.getVerificationKey(KECCAK_ZK);
  }

  async destroy(): Promise<void> { await this.#backend.destroy(); }
}
