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
  # nargo records absolute source paths in file_map; store them relative to
  # the repository so the artifact is identical on every machine.
  node -e 'const fs=require("fs"),[f,r]=process.argv.slice(1),j=JSON.parse(fs.readFileSync(f,"utf8"));for(const v of Object.values(j.file_map))if(v.path.startsWith(r+"/"))v.path=v.path.slice(r.length+1);fs.writeFileSync(f,JSON.stringify(j))' "$d/circuit.json" "$ROOT"
  echo "compiled $name"
done
(cd "$ROOT" && npx tsx circuits/scripts/pin-vks.ts)
