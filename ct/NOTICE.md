# Provenance of `ct/`

| Path | Origin | Licence | Changes |
|:---|:---|:---|:---|
| `sdk/src/**` | `brozorec/stellar-confidential-token-demo` @ `9500ed7`, `packages/sdk/src` (only the modules Tally uses) | MIT (declared in that repository's `package.json`; the repository has no LICENSE file) | Ported to OpenZeppelin stellar-contracts v0.9.0: domain tags renumbered to the v0.9.0 table; ECDH binds both coordinates; three-lane sender-auditor sponge; register witness binds `acct_f`; v0.9.0 payload and event field names; withdraw path removed |
| `sdk/circuits/*.json` | Compiled from `vendor/stellar-contracts` v0.9.0 with nargo 1.0.0-beta.11 | MIT (OpenZeppelin) | None |
| `sdk/circuits/vks/*.vk.bin` | Copied from `vendor/stellar-contracts/packages/tokens/src/confidential/circuits/vks` @ v0.9.0. I reproduced the matching `.vk.json` files byte-for-byte with nargo 1.0.0-beta.11 and bb 0.87.0 | MIT (OpenZeppelin) | None |
| `contracts/verifier`, `contracts/auditor` | OpenZeppelin `examples/confidential/{verifier,auditor}/src/contract.rs` @ v0.9.0 | MIT | `#![no_std]` header added |
| `contracts/token` | `brozorec/stellar-confidential-token-demo` @ `9500ed7`, `contracts/token` | MIT | Doc comment updated |
| `contracts/bench-batch`, `scripts/*`, `sdk/test/*` | Tally | MIT | — |
