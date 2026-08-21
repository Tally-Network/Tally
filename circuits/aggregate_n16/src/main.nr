use std::embedded_curve_ops::EmbeddedCurvePoint;
use stellar_confidential_lib::{
    H, assert_on_curve_non_identity, ecdh, encrypt_amount, poseidon_with_domain, scalar_mul,
    vk_from_sk,
};

// Tally -- D-sender MULTI-SENDER aggregate disclosure circuit.
//
// Proves to a designated disclosure recipient (P_R, nu) that a set of N_ACTIVE
// on-chain confidential transfers, ORIGINATED BY ACCOUNTS THE PROVER CONTROLS,
// sum to exactly V_total -- without revealing any individual amount.
//
// Extends SELECTIVE_DISCLOSURE.md Section 10 in two ways, both raised upstream
// in OpenZeppelin/stellar-contracts#849:
//
//   1. PVK_B is PER-EVENT. Section 10's public-input table lists only
//      (R_e_i, sigma_i, v_tilde_i) per event, which is the D-recipient shape.
//      The D-sender block ECDHs against the RECIPIENT's viewing key (DS4), and
//      in an outbound aggregate every event has a different recipient.
//
//   2. PVK_A and sk are PER-EVENT. Section 10 lists PVK_A as a COMMON input,
//      which pins an aggregate to a single sender account. Sends from one
//      account serialise (each spend replaces C_spend), so parallelism forces
//      a fan-out across accounts -- and one-proof-per-account leaks per-account
//      subtotals, which for small per-account counts approaches full
//      per-recipient disclosure. Vectorising PVK_A keeps the whole round in ONE
//      proof regardless of how many sender accounts it spans.
//
// SAFETY INVARIANT -- MINIMUM ANONYMITY SET.
// An aggregate over a single event IS that event's amount; over two, it is one
// subtraction away. This circuit therefore REFUSES to prove below MIN_ACTIVE,
// and publishes n_active so the disclosure recipient sees the exact size of the
// set the total was taken over. The floor is enforced in-circuit, not only in
// the SDK, so bypassing the SDK cannot silently degrade the guarantee.
//
// Padding: slots beyond n_active carry active[i] = 0. Every per-event equality
// is gated on active[i], so inactive slots impose no constraint and contribute
// nothing to the sum. The verifier pads by REPEATING a real event's public data
// with active = 0, which keeps every padded point on-curve.
//
// Verifier obligations (in addition to SELECTIVE_DISCLOSURE.md Section 5.3):
//   - Resolve PVK_A_i from E_i.from and PVK_B_i from E_i.to, never from the
//     bundle.
//   - Reject DUPLICATE event references among active slots. The circuit cannot
//     see duplicates; counting one event twice would inflate the total.
//   - Enforce its own floor on n_active if it wants one stricter than MIN_ACTIVE.
//
// Constraints (per active event i)
// --------------------------------
//   B_i    active_i in {0,1}
//   D1_i   vk_i    = Poseidon2(delta_vk, sk_i, addr_f)
//   D2_i   PVK_A_i = vk_i * H                      binds event i to its sender
//   DS3_i  R_e_i   = r_e_i * H, r_e_i != 0         originator binding
//   DS4_i  S_B_i   = ECDH(r_e_i, PVK_B_i)
//   DS5_i  v_tilde_i = v_tx_i + Poseidon2(delta_tx_amount, S_B_i, sigma_i)
//   D5_i   v_tx_i in [0, 2^127)
//   AGG    V_total  = sum(active_i * v_tx_i)
//   CNT    n_active = sum(active_i),  n_active >= MIN_ACTIVE
//   U1     R_disc   = r_disc * H, r_disc != 0
//   U2     S_disc   = r_disc * P_R
//   U3     v_tilde_disc = V_total + Poseidon2(delta_disc_bind, S_disc.x, nu)
//
// NOTE ON THE DOMAIN TAG. delta_disc_bind = 15 per the normative table in
// DESIGN_cont.md Section 13, which Section 10 requires for the aggregate
// U-block ("delta_disc_bind replacing delta_disc to separate domain"). The
// reference demo's single-event circuits hardcode 13 for delta_disc, which is
// delta_ecdh's value -- a domain-separation collision reported separately. This
// circuit follows the spec.

pub global N: u32 = 16;

/// Minimum number of events an aggregate may be taken over. See SAFETY
/// INVARIANT above. Configurable per deployment; never set below 2, and
/// prefer >= 5 for disbursement rounds.
/// INVARIANT: N >= MIN_ACTIVE. A circuit whose capacity is below the floor can
/// never produce a proof, so `scripts/generate.sh` refuses to emit one. This is
/// why the family starts at n = 8.
pub global MIN_ACTIVE: Field = 5;

/// delta_disc_bind -- DESIGN_cont.md Section 13.
pub global DISC_BIND: Field = 15;

fn main(
    // ---- private witnesses ----
    sk: [Field; N],
    r_e: [Field; N],
    v_tx: [Field; N],
    r_disc: Field,
    // ---- public: common ----
    addr_f: pub Field,
    n_active: pub Field,
    // ---- public: per event ----
    active: pub [Field; N],
    pvk_a_x: pub [Field; N],
    pvk_a_y: pub [Field; N],
    pvk_b_x: pub [Field; N],
    pvk_b_y: pub [Field; N],
    r_e_x: pub [Field; N],
    r_e_y: pub [Field; N],
    sigma: pub [Field; N],
    v_tilde: pub [Field; N],
    // ---- public: disclosure channel ----
    p_r_x: pub Field,
    p_r_y: pub Field,
    nu: pub Field,
    r_disc_x: pub Field,
    r_disc_y: pub Field,
    v_tilde_disc: pub Field,
) {
    assert(r_disc != 0);

    let mut n_counted: Field = 0;
    let mut total: Field = 0;

    for i in 0..N {
        let a = active[i];

        // B_i -- active is strictly boolean, so it cannot scale a contribution.
        assert(a * (a - 1) == 0);
        n_counted += a;

        // Non-zero in every slot; padding supplies r_e = 1. Keeping this
        // ungated avoids a conditional inverse and costs nothing.
        assert(r_e[i] != 0);

        // D1_i / D2_i -- per-event sender binding. This is the extension that
        // lets one proof span multiple funder accounts.
        let vk_i = vk_from_sk(sk[i], addr_f);
        let pvk_derived = scalar_mul(vk_i, H);
        assert(a * (pvk_derived.x - pvk_a_x[i]) == 0);
        assert(a * (pvk_derived.y - pvk_a_y[i]) == 0);

        // DS3_i -- only the party that sampled r_e_i can satisfy this against
        // the event's emitted R_e_i.
        let re_derived = scalar_mul(r_e[i], H);
        assert(a * (re_derived.x - r_e_x[i]) == 0);
        assert(a * (re_derived.y - r_e_y[i]) == 0);

        // PVK_B_i is an account-sourced point consumed by ECDH: validate.
        // Ungated -- padding repeats a real event, so padded points are valid.
        let pvk_b = EmbeddedCurvePoint { x: pvk_b_x[i], y: pvk_b_y[i], is_infinite: false };
        assert_on_curve_non_identity(pvk_b);

        // DS4_i / DS5_i -- recover the amount from the sender side.
        let s_b = ecdh(r_e[i], pvk_b);
        let v_tilde_derived = encrypt_amount(v_tx[i], s_b, sigma[i]);
        assert(a * (v_tilde_derived - v_tilde[i]) == 0);

        // D5_i -- range validity.
        v_tx[i].assert_max_bit_size::<127>();

        // AGG
        total += a * v_tx[i];
    }

    // CNT -- publish the anonymity set and enforce the floor.
    assert(n_counted == n_active);
    // n_active >= MIN_ACTIVE: a field subtraction that underflows wraps to a
    // value far above 2^32, so the bit-size assert is a sound >= check here.
    (n_active - MIN_ACTIVE).assert_max_bit_size::<32>();

    // U1
    let r_disc_derived = scalar_mul(r_disc, H);
    assert(r_disc_derived.x == r_disc_x);
    assert(r_disc_derived.y == r_disc_y);

    // P_R is the disclosure recipient's key, consumed by ECDH: validate.
    let p_r = EmbeddedCurvePoint { x: p_r_x, y: p_r_y, is_infinite: false };
    assert_on_curve_non_identity(p_r);

    // U2 / U3 -- seal ONLY the total to the disclosure recipient.
    let s_disc = scalar_mul(r_disc, p_r);
    let mask = poseidon_with_domain(DISC_BIND, [s_disc.x, nu]);
    assert(total + mask == v_tilde_disc);
}
