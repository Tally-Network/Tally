#!/usr/bin/env bash
# Generates the Tally aggregate-disclosure circuit family from _template.nr.
#
# INVARIANT: every N in the family must satisfy N >= MIN_ACTIVE. A circuit whose
# capacity sits below the safety floor can never produce a proof — the in-circuit
# `n_active >= MIN_ACTIVE` assert is unsatisfiable — so generating one is always
# a mistake. This script refuses to.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIN_ACTIVE="${MIN_ACTIVE:-5}"
SIZES="${SIZES:-8 16 64}"

for N in $SIZES; do
  if [ "$N" -lt "$MIN_ACTIVE" ]; then
    echo "refusing to generate n=$N: capacity below MIN_ACTIVE=$MIN_ACTIVE (unprovable)" >&2
    exit 1
  fi
  d="$ROOT/aggregate_n${N}"
  mkdir -p "$d/src"
  sed -e "s/__N__/${N}/" -e "s/__MIN__/${MIN_ACTIVE}/" "$ROOT/_template.nr" > "$d/src/main.nr"
  cat > "$d/Nargo.toml" <<TOML
[package]
name = "tally_aggregate_n${N}"
type = "bin"
authors = ["Tally"]
compiler_version = ">=0.30.0"

[dependencies]
stellar_confidential_lib = { path = "../../vendor/stellar-contracts/packages/tokens/src/confidential/circuits/lib" }
TOML
  echo "generated aggregate_n${N} (MIN_ACTIVE=${MIN_ACTIVE})"
done
