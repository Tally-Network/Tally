# `ct/` — confidential-token layer, OpenZeppelin v0.9.0

| Path | What it is |
|:---|:---|
| `sdk/src` | Client SDK (crypto, witness assembly, payload encoding, event parsing, state sync, proving), ported to v0.9.0. Only the modules Tally uses |
| `sdk/circuits` | v0.9.0 `register` / `transfer` / `withdraw` circuits compiled with nargo 1.0.0-beta.11, and the upstream `*.vk.bin` |
| `sdk/test/conformance.ts` | Reproduces OpenZeppelin's published primitive vectors (`pnpm test:conformance`) |
| `sdk/test/prove.ts` | Builds, proves and locally verifies a register and a transfer (`pnpm test:prove`) |
| `contracts/` | Token, verifier and auditor wrappers on v0.9.0, plus `bench-batch` (measurement only) |
| `scripts/deploy.ts` | Testnet deployment (`pnpm deploy:testnet`); the auditor secret is written outside the repository |
| `scripts/measure.ts` | On-chain cost and batching benchmark (`pnpm measure`) → `measurements.testnet.json` |
| `scripts/bench-aggregate.ts` | Local zero-knowledge proving benchmark for the aggregate circuits |

Provenance and licences: [NOTICE.md](NOTICE.md).
