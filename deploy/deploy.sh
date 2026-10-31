#!/usr/bin/env bash
set -Eeuo pipefail
umask 022
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export AWS_PAGER=
base=/opt/xamuko/deploy
action=${1:-}
sha=${2:-}
artifact_bucket=${3:-}
artifact_key=${4:-}
artifact_sha256=${5:-}
started_ms=$(date +%s%3N)
status_file=$base/status.json
work=''
[[ $EUID == 0 && $action =~ ^(deploy|rollback)$ ]] || exit 64
[[ $sha =~ ^[0-9a-f]{40}$ || ( $action == rollback && $sha == bootstrap ) ]] || exit 64
exec 9>/run/lock/xamuko-deploy.lock
flock -n 9 || { echo 'Another deployment is running'; exit 75; }
write_status() {
  local result=$1 error=${2:-} finished_ms duration active_sha
  [[ -d $base ]] || return 0
  finished_ms=$(date +%s%3N)
  duration=$((finished_ms - started_ms))
  active_sha=$(readlink -f "$base/current" 2>/dev/null | sed 's#.*/##' || true)
  local tmp="$base/.status.json.$$"
  printf '{"finishedAt":"%s","requestedAction":"%s","requestedSha":"%s","activeRelease":"%s","result":"%s","durationMs":%s,"error":"%s"}\n' \
    "$(date -u +%FT%TZ)" "$action" "$sha" "$active_sha" "$result" "$duration" "$error" > "$tmp"
  chmod 0640 "$tmp"
  mv -f "$tmp" "$status_file"
}
on_exit() {
  local code=$?
  local result=success
  [[ $code -eq 0 ]] || result=failure
  if [[ -n ${work:-} ]]; then
    rm -rf -- "$work" || true
  fi
  write_status "$result" "$([[ $code -eq 0 ]] || echo 'see journalctl -u xamuko-poll.service')"
  if [[ -d $base ]]; then
    printf '%s %s %s %s\n' "$(date -u +%FT%TZ)" "$action" "$sha" "$result" >> "$base/history.log"
  fi
}
trap on_exit EXIT
[[ -f $base/READY && -L $base/current ]] || { echo 'Bootstrap required'; exit 78; }
old=$(readlink -f "$base/current")
release=$base/releases/$sha
health() {
  local _
  for _ in {1..30}; do
    if systemctl is-active --quiet xamuko-api &&
       curl --max-time 3 -fsS http://127.0.0.1:3000/api/v1/health | /usr/bin/node -e '
         let b="";process.stdin.on("data",c=>b+=c);process.stdin.on("end",()=>{
           try{const h=JSON.parse(b);process.exit(h.status==="ok"&&h.service==="wit-backend"?0:1)}catch{process.exit(1)}
         })'; then return 0; fi
    sleep 2
  done
  return 1
}
switch_to() {
  rm -f "$base/.current-next"
  ln -s "$1" "$base/.current-next"
  mv -Tf "$base/.current-next" "$base/current"
}
nginx -t
health
curl --max-time 15 -fsS https://xamuko.com/ >/dev/null
curl --max-time 15 -fsS https://xamuko.com/api/v1/public/businesses >/dev/null
if [[ $action == deploy ]]; then
  [[ ! -e $release ]] || { echo 'Release exists; use rollback to reactivate it'; exit 65; }
  [[ $(df --output=avail -k "$base" | tail -1) -gt 4194304 ]] || { echo 'Need at least 4 GiB free'; exit 74; }
  [[ $artifact_bucket =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || { echo 'Invalid artifact bucket'; exit 64; }
  [[ $artifact_key == releases/$sha/xamuko-backend-$sha.tar.gz ]] || { echo 'Artifact key does not match commit'; exit 65; }
  [[ $artifact_sha256 =~ ^[0-9a-f]{64}$ ]] || { echo 'Invalid artifact checksum'; exit 64; }
  work=$(mktemp -d /var/lib/xamuko-build/release.XXXXXXXX)
  aws s3 cp "s3://$artifact_bucket/$artifact_key" "$work/release.tar.gz" --only-show-errors
  printf '%s  %s\\n' "$artifact_sha256" "$work/release.tar.gz" | sha256sum -c -
  tar -tzf "$work/release.tar.gz" | grep -qE '(^|/)\.\.|^/' && { echo 'Unsafe archive paths'; exit 65; }
  mkdir "$work/package"
  tar -xzf "$work/release.tar.gz" -C "$work/package"
  [[ -f "$work/package/RELEASE_COMMIT" ]] || { echo 'RELEASE_COMMIT missing'; exit 65; }
  [[ "$(cat "$work/package/RELEASE_COMMIT")" == "$sha" ]] || { echo 'Artifact commit mismatch'; exit 65; }
  [[ -s "$work/package/dist/server.js" ]] || { echo 'Backend dist missing'; exit 65; }
  [[ -d "$work/package/node_modules/@prisma/client" ]] || { echo 'Prisma Client missing'; exit 65; }
  old_env="$old/backend/.env"
  [[ -f "$old_env" ]] || { echo 'Active release EnvironmentFile missing'; exit 78; }
  [[ "$(stat -c '%a' "$old_env")" == "600" ]] || { echo 'Active EnvironmentFile permissions invalid'; exit 78; }
  [[ "$(stat -c '%U:%G' "$old_env")" == "root:root" ]] || { echo 'Active EnvironmentFile owner invalid'; exit 78; }
  if [[ -d "$old/backend/prisma" && -d "$work/package/prisma" ]]; then
    diff -qr "$old/backend/prisma" "$work/package/prisma" >/dev/null || { echo 'Prisma changes require manual review'; exit 65; }
  fi
  mkdir -p "$release/backend"
  cp -a "$work/package/." "$release/backend/"
  install -o root -g root -m 0600 "$old_env" "$release/backend/.env"
  chown -R root:root "$release"
  printf '%s\\n' "$sha" > "$release/COMMIT"
  touch "$release/VERIFIED"
else
  [[ -d $release && -f $release/VERIFIED ]] || { echo 'Unknown verified release'; exit 65; }
  diff -qr "$old/backend/prisma" "$release/backend/prisma" >/dev/null || { echo 'Schema differs; manual review required'; exit 65; }
fi
[[ $old != "$release" ]] || { echo 'Already active'; exit 0; }
# Smoke test on a loopback-only alternate port before switching live traffic.
smoke_unit="xamuko-smoke-${sha:0:12}"
[[ -z $(ss -H -ltn 'sport = :3001') ]] || { echo 'Smoke port already in use'; exit 65; }
systemd-run --quiet --collect --unit="$smoke_unit" \
  -p User=ssm-user -p NoNewPrivileges=yes \
  -p TimeoutStopSec=15 \
  -p "WorkingDirectory=$release/backend" \
  -p 'Environment=PORT=3001 HOST=127.0.0.1' \
  /usr/bin/node "$release/backend/dist/server.js"
smoke_ok=0
for _ in {1..20}; do
  if systemctl is-active --quiet "$smoke_unit" && curl --max-time 2 -fsS http://127.0.0.1:3001/api/v1/health >/dev/null; then
    if curl --max-time 15 -fsS http://127.0.0.1:3001/api/v1/public/businesses >/dev/null; then smoke_ok=1; fi
    break
  fi
  sleep 1
done
systemctl stop "$smoke_unit" || true
[[ $smoke_ok == 1 ]] || { echo 'Candidate smoke test failed; live release untouched'; exit 1; }
# Old release and the original deployment are retained; never prune automatically.
changed=0
recover() {
  local code=$?
  trap - ERR INT TERM
  if [[ $changed == 1 ]]; then
    echo 'Activation failed; restoring previous release'
    switch_to "$old"
    systemctl restart xamuko-api
    health || { echo 'CRITICAL: rollback health failed'; exit 70; }
  fi
  exit "$code"
}
trap recover ERR
trap 'false' INT TERM
changed=1
switch_to "$release"
systemctl restart xamuko-api
health
curl --max-time 15 -fsS https://xamuko.com/ >/dev/null
curl --max-time 15 -fsS https://xamuko.com/api/v1/health >/dev/null
curl --max-time 15 -fsS https://xamuko.com/api/v1/public/businesses >/dev/null
ln -s "$old" "$base/.previous-next"
mv -Tf "$base/.previous-next" "$base/previous"
trap - ERR INT TERM
echo "Activated $sha"
