#!/usr/bin/env bash
# Builds the Tally aggregate-disclosure circuits, copies each compiled artifact
# to circuits/aggregate_n*/circuit.json, and re-pins the verification keys. Toolchain must match OpenZeppelin stellar-contracts v0.9.0:
# nargo 1.0.0-beta.11 (bb.js 0.87.0 is pinned in package.json).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WANT="1.0.0-beta.11"
GOT="$(nargo --version | sed -n 's/^nargo version = //p')"
if [ "$GOT" != "$WANT" ]; then
  echo "nargo $WANT required, found '$GOT' (noirup -v $WANT)" >&2
  exit 1
fi

bash "$ROOT/circuits/scripts/generate.sh"
for d in "$ROOT"/circuits/aggregate_n*/; do
  name="$(basename "$d")"
  (cd "$d" && nargo compile)
  # Committed so a clean clone can verify a round without installing nargo.
  # CI rebuilds and fails on any difference.
  cp "$d/target/tally_${name}.json" "$d/circuit.json"
  echo "compiled $name"
done
(cd "$ROOT" && npx tsx circuits/scripts/pin-vks.ts)
