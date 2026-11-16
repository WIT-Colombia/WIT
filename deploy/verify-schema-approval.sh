#!/usr/bin/env bash
# Requires a specific, root-owned operator approval when Prisma contents change.
# Usage: verify-schema-approval OLD_PRISMA_DIR NEW_PRISMA_DIR RELEASE_SHA DEPLOY_BASE
set -Eeuo pipefail
old_schema=${1:-}
new_schema=${2:-}
release_sha=${3:-}
deploy_base=${4:-}
[[ -d "$old_schema" && -d "$new_schema" ]] || {
  echo 'BLOCK: Prisma schema directory missing; manual review required.' >&2
  exit 78
}
[[ $release_sha =~ ^[0-9a-f]{40}$ && -d "$deploy_base" ]] || exit 64
if diff -qr "$old_schema" "$new_schema" >/dev/null; then
  echo 'Prisma package unchanged; no schema-change approval needed.'
  exit 0
fi
approvals="$deploy_base/schema-approvals"
marker="$approvals/$release_sha.approved"
[[ -d "$approvals" && ! -L "$approvals" ]] || {
  echo 'BLOCK: schema changes require a dedicated operator approval directory.' >&2
  exit 65
}
[[ $(stat -c '%u:%g:%a' "$approvals") == '0:0:700' ]] || {
  echo 'BLOCK: schema approval directory must be root:root mode 0700.' >&2
  exit 65
}
[[ -f "$marker" && ! -L "$marker" ]] || {
  echo 'BLOCK: Prisma changed; manual migration, preflight and SHA approval are required.' >&2
  exit 65
}
[[ $(stat -c '%u:%g:%a' "$marker") == '0:0:600' ]] || {
  echo 'BLOCK: schema approval must be a root-owned 0600 regular file.' >&2
  exit 65
}
approved=$(<"$marker")
[[ "$approved" == "$release_sha" ]] || {
  echo 'BLOCK: schema approval does not match the immutable release SHA.' >&2
  exit 65
}
echo 'Operator-approved Prisma package change for exact release SHA.'
