#!/usr/bin/env bash
# Run every *.test.sh next to this file and print a final summary.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
total_pass=0; total_fail=0; failed_files=()

strip_ansi() { sed -E 's/\x1B\[[0-9;]*[a-zA-Z]//g'; }

for t in "$HERE"/*.test.sh; do
  [ -e "$t" ] || continue
  printf '\n\033[1m== %s ==\033[0m\n' "$(basename "$t")"
  output="$(bash "$t" 2>&1)"
  rc=$?
  printf '%s\n' "$output"
  plain="$(printf '%s' "$output" | strip_ansi)"
  pass="$(printf '%s' "$plain" | grep -c '✓' || true)"
  fail="$(printf '%s' "$plain" | grep -c '✗' || true)"
  total_pass=$((total_pass + pass))
  total_fail=$((total_fail + fail))
  if [ "$rc" != "0" ] || [ "$fail" != "0" ]; then
    failed_files+=("$(basename "$t")")
  fi
done

printf '\n\033[1m== summary ==\033[0m\n'
printf 'passed: %d\n' "$total_pass"
printf 'failed: %d\n' "$total_fail"
if [ "${#failed_files[@]}" -gt 0 ]; then
  printf 'failing files:\n'
  for f in "${failed_files[@]}"; do printf '  - %s\n' "$f"; done
  exit 1
fi
exit 0
