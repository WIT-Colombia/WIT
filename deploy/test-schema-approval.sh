#!/usr/bin/env bash
set -Eeuo pipefail
# Isolated fixtures: no production paths or databases are touched.
script=$(cd "$(dirname "$0")" && pwd)/verify-schema-approval.sh
root() {
  if [[ $EUID == 0 ]]; then "$@"; else sudo "$@"; fi
}
tmp=$(mktemp -d)
trap 'root rm -rf -- "$tmp"' EXIT
sha=0123456789012345678901234567890123456789
other=1111111111111111111111111111111111111111
old="$tmp/old"
candidate="$tmp/candidate"
base="$tmp/base"
mkdir -p "$old" "$candidate" "$base"
printf 'schema A\n' > "$old/schema.prisma"
printf 'schema A\n' > "$candidate/schema.prisma"
# Identical Prisma tree needs no new approval.
root bash "$script" "$old" "$candidate" "$sha" "$base" >/dev/null
printf 'schema B\n' > "$candidate/schema.prisma"
if root bash "$script" "$old" "$candidate" "$sha" "$base" >/dev/null 2>&1; then
  echo 'FAIL: unapproved Prisma changes passed verification' >&2; exit 1
fi
root install -d -o root -g root -m 0700 "$base/schema-approvals"
printf '%s\n' "$other" | root tee "$base/schema-approvals/$sha.approved" >/dev/null
root chmod 0600 "$base/schema-approvals/$sha.approved"
if root bash "$script" "$old" "$candidate" "$sha" "$base" >/dev/null 2>&1; then
  echo 'FAIL: wrong approval SHA was accepted' >&2; exit 1
fi
printf '%s\n' "$sha" | root tee "$base/schema-approvals/$sha.approved" >/dev/null
root chmod 0644 "$base/schema-approvals/$sha.approved"
if root bash "$script" "$old" "$candidate" "$sha" "$base" >/dev/null 2>&1; then
  echo 'FAIL: world-readable approval was accepted' >&2; exit 1
fi
root chmod 0600 "$base/schema-approvals/$sha.approved"
root bash "$script" "$old" "$candidate" "$sha" "$base" >/dev/null
root chmod 0755 "$base/schema-approvals"
if root bash "$script" "$old" "$candidate" "$sha" "$base" >/dev/null 2>&1; then
  echo 'FAIL: world-readable approvals directory was accepted' >&2; exit 1
fi
root chmod 0700 "$base/schema-approvals"
if root bash "$script" "$old" "$candidate" "$other" "$base" >/dev/null 2>&1; then
  echo 'FAIL: approval for a different release was accepted' >&2; exit 1
fi
echo 'schema approval guard tests passed'
