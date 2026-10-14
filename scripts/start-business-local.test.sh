#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT_DIR/scripts/start-business-local.sh"

grep -Fq "curl --noproxy '*'" "$SCRIPT"
grep -Fq 'listening_pid' "$SCRIPT"

# Simulate a proxy that falsely returns HTTP 200 for an unavailable loopback port.
# The direct request used by the startup script must therefore produce 000.
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
cat >"$tmp_dir/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
has_no_proxy=0
for arg in "$@"; do
  [[ "$arg" == "--noproxy" ]] && has_no_proxy=1
done
if [[ "$has_no_proxy" -eq 1 ]]; then
  printf '000'
  exit 7
else
  printf '200'
fi
FAKE_CURL
chmod +x "$tmp_dir/curl"

http_status() {
  local status
  status="$(curl --noproxy '*' -sS -o /dev/null -w '%{http_code}' --max-time 2 "$1" 2>/dev/null || true)"
  if [[ "$status" =~ ^[0-9]{3}$ ]]; then
    printf '%s' "$status"
  else
    printf '000'
  fi
}

status="$(PATH="$tmp_dir:$PATH" http_status http://127.0.0.1:3001/api/v1/health)"
[[ "$status" == "000" ]]

printf 'PASS: comprobación local sin proxy y verificación de proceso presentes.\n'
