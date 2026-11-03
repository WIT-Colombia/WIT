#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
base=${XAMUKO_DEPLOY_BASE:-/opt/xamuko/deploy}
repo=${XAMUKO_REPOSITORY:-WIT-Colombia/WIT}
branch=${XAMUKO_PRODUCTION_BRANCH:-integration/preserve-all-20261029}
[[ $EUID == 0 && -f $base/GITHUB_RELEASE_POLL_ENABLED && -f $base/READY ]] || exit 0
[[ $branch =~ ^[A-Za-z0-9._/-]+$ && "$branch" != /* && "$branch" != *..* ]] || exit 64
exec 8>/run/lock/xamuko-github-release-poll.lock
flock -n 8 || exit 0
sha=$(git ls-remote "https://github.com/$repo.git" "refs/heads/$branch" | awk 'NR==1 {print $1}')
[[ $sha =~ ^[0-9a-f]{40}$ ]] || exit 65
[[ ! -f $base/github-release-last-attempt || $(cat "$base/github-release-last-attempt") != "$sha" ]] || exit 0
json=$(mktemp)
archive=$(mktemp --suffix=.tar.gz)
checksum=$(mktemp)
trap 'rm -f "$json" "$archive" "$checksum"' EXIT
curl --connect-timeout 10 --max-time 30 -fsS -H 'Accept: application/vnd.github+json' "https://api.github.com/repos/$repo/releases/tags/backend-$sha" -o "$json"
python3 - "$json" "$sha" "$repo" "$archive" "$checksum" <<'PY'
import json,sys,urllib.request
path,sha,repo,archive,checksum=sys.argv[1:]
with open(path) as f: release=json.load(f)
if release.get('draft') or release.get('prerelease') or release.get('tag_name') != f'backend-{sha}':
    raise SystemExit('Release is not a verified stable release')
assets={a['name']:a for a in release.get('assets',[])}
tar=f'xamuko-backend-{sha}.tar.gz'
sumfile=f'xamuko-backend-{sha}.tar.gz.sha256'
if tar not in assets or sumfile not in assets: raise SystemExit('Release assets incomplete')
urllib.request.urlretrieve(assets[tar]['browser_download_url'], archive)
urllib.request.urlretrieve(assets[sumfile]['browser_download_url'], checksum)
PY
grep -Eq "^[0-9a-f]{64}[[:space:]]+xamuko-backend-${sha}\.tar\.gz$" "$checksum"
expected=$(awk '{print $1}' "$checksum")
printf '%s  %s\n' "$expected" "$archive" | sha256sum -c -
printf '%s\n' "$sha" > "$base/github-release-last-attempt"
exec /usr/local/sbin/xamuko-deploy-github-release "$archive" "$sha"
