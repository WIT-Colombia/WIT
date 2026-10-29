#!/usr/bin/env bash
set -Eeuo pipefail

# Fast, dependency-free regression tests for the deployment bookkeeping.
script=$(cd "$(dirname "$0")" && pwd)/deploy.sh
grep -q "work=''" "$script"
grep -q 'rm -rf -- "\$work" || true' "$script"
[[ $(grep -c "^trap .*EXIT" "$script") -eq 1 ]]

run_case() {
  local expected=$1 code=$2 dir=$3
  local status="$dir/status.json" history="$dir/history.log" work="$dir/work"
  mkdir -p "$dir" "$work"
  (
    set -Eeuo pipefail
    started_ms=$(($(date +%s) * 1000))
    action=deploy sha=0123456789012345678901234567890123456789
    write_status() {
      local result=$1 error=${2:-} finished_ms duration
      finished_ms=$(($(date +%s) * 1000)); duration=$((finished_ms - started_ms))
      local tmp="$dir/.status.json.$$"
      printf '{"finishedAt":"%s","requestedAction":"%s","requestedSha":"%s","activeRelease":"candidate","result":"%s","durationMs":%s,"error":"%s"}\n' \
        "$(date -u +%FT%TZ)" "$action" "$sha" "$result" "$duration" "$error" > "$tmp"
      [[ -s "$tmp" && ! -e "$status" ]]
      mv -f "$tmp" "$status"
    }
    on_exit() {
      local rc=$? result=success
      [[ $rc -eq 0 ]] || result=failure
      rm -rf -- "$work" || true
      write_status "$result" "$([[ $rc -eq 0 ]] || echo error)"
      printf '%s %s %s %s\n' "$(date -u +%FT%TZ)" "$action" "$sha" "$result" >> "$history"
      exit "$rc"
    }
    trap on_exit EXIT
    exit "$code"
  ) || [[ $code -ne 0 ]]
  node - "$status" "$expected" "$history" <<'NODE'
const fs = require('fs');
const [status, expected, history] = process.argv.slice(2);
const value = JSON.parse(fs.readFileSync(status, 'utf8'));
if (value.result !== expected || value.requestedSha.length !== 40 ||
    value.requestedAction !== 'deploy' || !value.finishedAt ||
    !Number.isInteger(value.durationMs) || value.durationMs < 0 ||
    !fs.readFileSync(history, 'utf8').trim().endsWith(` ${expected}`)) process.exit(1);
NODE
  [[ ! -e "$work" ]]
}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
run_case success 0 "$tmp/success"
run_case failure 23 "$tmp/failure"
echo 'deployment bookkeeping tests passed'
