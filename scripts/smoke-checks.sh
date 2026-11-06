#!/usr/bin/env bash

set -euo pipefail

repository_root="$(git rev-parse --show-toplevel)"
cd "$repository_root"

required_files=(
  "README.md"
  ".github/CODEOWNERS"
  ".github/workflows/blank.yml"
  "scripts/smoke-checks.sh"
)

for file in "${required_files[@]}"; do
  if [[ ! -s "$file" ]]; then
    printf 'Required file is missing or empty: %s\n' "$file" >&2
    exit 1
  fi
done

conflict_markers='^(<{7,}|={7,}$|>{7,})'
while IFS= read -r -d '' file; do
  if grep -nE "$conflict_markers" "./$file"; then
    printf 'Unresolved merge-conflict marker found in %s\n' "$file" >&2
    exit 1
  else
    grep_status=$?
    if [[ "$grep_status" -gt 1 ]]; then
      printf 'Unable to inspect %s\n' "$file" >&2
      exit "$grep_status"
    fi
  fi
done < <(git ls-files --cached --others --exclude-standard -z)

printf 'Repository smoke checks passed.\n'
