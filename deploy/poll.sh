#!/usr/bin/env bash
# Pull deployment for AWS accounts where custom IAM/OIDC is unavailable.
set -Eeuo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
base=/opt/xamuko/deploy
[[ $EUID == 0 && -f $base/POLL_ENABLED && -f $base/READY ]] || exit 0
exec 8>/run/lock/xamuko-poll.lock
flock -n 8 || exit 0
sha=$(git ls-remote https://github.com/WIT-Colombia/WIT.git refs/heads/staging | cut -f1)
[[ $sha =~ ^[0-9a-f]{40}$ ]] || exit 65
[[ ! -f $base/last-attempt || $(cat "$base/last-attempt") != "$sha" ]] || exit 0
response=$(mktemp)
trap 'rm -f "$response"' EXIT
curl --connect-timeout 10 --max-time 30 -fsS \
  -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  'https://api.github.com/repos/WIT-Colombia/WIT/actions/workflows/staging-deploy.yml/runs?branch=staging&event=push&per_page=20' \
  -o "$response"
if ! python3 - "$response" "$sha" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    runs = json.load(f)['workflow_runs']
matching = [r for r in runs if r['head_sha'] == sys.argv[2]
            and r['head_branch'] == 'staging' and r['event'] == 'push'
            and r['repository']['id'] == 1402327719
            and r['path'] == '.github/workflows/staging-deploy.yml']
if not matching:
    sys.exit(1)
latest = max(matching, key=lambda r: r['id'])
sys.exit(0 if latest['status'] == 'completed' and latest['conclusion'] == 'success' else 1)
PY
then
  echo 'Current staging commit has no successful push verification yet'
  exit 0
fi
# Record BEFORE execution: failed candidates are not retried indefinitely. A manual
# rollback stays in place until a new staging commit or explicit administrator retry.
printf '%s\n' "$sha" > "$base/last-attempt"
exec /usr/local/sbin/xamuko-deploy deploy "$sha"
