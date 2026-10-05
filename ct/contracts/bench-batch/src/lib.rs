//! Measurement-only contract: performs several `confidential_transfer` calls
//! inside ONE Stellar transaction. A transaction may carry only one
//! `InvokeHostFunctionOp`, so a wrapper like this is the only way to batch.
//! Used by ct/scripts/measure.ts to find how many transfers fit under the
//! per-transaction limits. Not part of the product; never holds funds.
#![no_std]

use soroban_sdk::{contract, contractimpl, vec, Address, Bytes, Env, IntoVal, Symbol, Vec};

#[contract]
pub struct BenchBatch;

#[contractimpl]
impl BenchBatch {
    /// For each i: `token.confidential_transfer(from, to[i], data[i])`.
    /// Each `data[i]` must carry a proof built against the spendable balance
    /// that the previous transfer leaves behind. The token itself enforces
    /// `from.require_auth()` on every call; `from` authorizes this batch once.
    pub fn transfer_many(e: Env, token: Address, from: Address, to: Vec<Address>, data: Vec<Bytes>) {
        assert!(to.len() == data.len(), "length mismatch");
        // Authorize at the root so each nested `from.require_auth()` inside
        // the token resolves against this invocation tree. Empty args keep the
        // proofs from being copied into the root auth entry a second time.
        from.require_auth_for_args(vec![&e]);
        let method = Symbol::new(&e, "confidential_transfer");
        for i in 0..to.len() {
            let args = vec![
                &e,
                from.into_val(&e),
                to.get_unchecked(i).into_val(&e),
                data.get_unchecked(i).into_val(&e),
            ];
            e.invoke_contract::<()>(&token, &method, args);
        }
    }
}
