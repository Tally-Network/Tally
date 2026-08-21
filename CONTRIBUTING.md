# Contributing to Tally

## The rule that matters most

> **An inherited default is true in its original context and can be false one level away. Check whether a claim was verified *here*, or carried in from somewhere it was correct.**

Every cryptographic error this project has shipped came from that shape. Neither was careless; both were true statements applied one level from where they were true.

| Error | True where it came from | False here |
|:---|:---|:---|
| "UltraHonk over Grumpkin" | Grumpkin genuinely is the curve the circuits compute over | UltraHonk proves over **BN254**; Grumpkin is the *embedded* curve |
| Disclosure proofs non-zk | The on-chain verifier implements only the non-zk flavour, so `{ keccak: true }` is **mandatory** for transfers | Disclosure proofs are verified **off-chain**; that constraint never applied, and non-zk is not witness-hiding — so the artifact did not deliver the guarantee the page claimed |

The second one put a **false claim about the core guarantee** on a public page. It survived drafting, review and publication. Only a deliberate line-by-line accuracy pass caught it.

So the question to ask of any claim is not *"is this sentence true?"* — it will usually read as true, because it was true somewhere. Ask:

1. **Did we verify this here, or inherit it?** Inherited means: copied from upstream docs, carried over from a reference implementation, or true of a component we depend on rather than of the thing we are describing.
2. **What would have to be different for it to be false in our context?** Different verifier, different curve role, different trust boundary, different chain, different revision.
3. **Can I point at the measurement or the source line?** If the answer is "it's what the SDK does", that is an inheritance, not a verification.

### Where this applies hardest

- **Any sentence in `site/`, `README.md`, or the trust statement.** Public text aimed at reviewers who read exactly that sentence.
- **Proving-mode flags.** `keccak` vs `keccakZK` — see [`demo/zk-prover.ts`](demo/zk-prover.ts). Transfers non-zk, disclosure zk. Changing either silently changes what is guaranteed.
- **Upstream revision claims.** We pin `vendor/stellar-contracts` at `539968f`; the branch tip behaves differently ([`docs/SDK-SAFETY-INVARIANTS.md`](docs/SDK-SAFETY-INVARIANTS.md) §I3).
- **Anything sourced from a document rather than from code.** Documentation goes stale silently. Two claims in this repo were wrong because they came from a docs table rather than a schema or a source file — cite the file and revision you actually read.

### Practice

- **A CLI that executes on import makes its own test suite meaningless.** Guard the dispatch on being the entry point. Without it, importing the module to unit-test a pure function runs the command and exits — and the test file looks like it passed because nothing failed, having never run. `cli/tally.ts` carries the guard; anything else with a top-level dispatch needs one too.
- **Write the negative test first.** The circuit-family floor bug (`n=4` with `MIN_ACTIVE=5` was structurally unprovable) was caught by a test, not by reasoning. So was the fact that the round registry's window actually excludes anything — which is why `pnpm demo` sends a transfer *before* the round opens on every run.
- **A demo that cannot fail proves nothing.** If every case in a demonstration passes by construction, it cannot distinguish working machinery from absent machinery.
- **Re-measure after changing a mode or a version.** Numbers are not portable across proving modes, circuit revisions, or protocol upgrades.
- **State what you did not check.** "I read the docs, not the schema" is a useful sentence. "Nothing else was wrong" is only worth writing if you actually looked.

## Working in this repo

```bash
git clone --recurse-submodules https://github.com/Tally-Network/Tally
cd Tally && pnpm install
cargo test -p tally_round_registry --manifest-path contracts/Cargo.toml
bash circuits/scripts/generate.sh    # circuits are GENERATED — edit _template.nr
pnpm demo                            # full round on testnet
```

Circuits under `circuits/aggregate_n*/src/` are generated. Edit `circuits/_template.nr` and regenerate; the generator refuses to emit a circuit whose capacity is below `MIN_ACTIVE`.

Submodules are pinned deliberately. Do not bump them casually — see Milestone U1 in [`docs/SDK-SAFETY-INVARIANTS.md`](docs/SDK-SAFETY-INVARIANTS.md).
