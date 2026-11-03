#!/usr/bin/env bash
set -Eeuo pipefail
umask 022
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
base=${XAMUKO_DEPLOY_BASE:-/opt/xamuko/deploy}
archive=${1:-}
sha=${2:-}
action=${3:-deploy}
[[ $EUID == 0 && $action == deploy ]] || exit 64
[[ -f $archive && $sha =~ ^[0-9a-f]{40}$ ]] || exit 64
exec 9>/run/lock/xamuko-deploy.lock
flock -n 9 || { echo 'Another deployment is running'; exit 75; }
[[ -d $base && -d $base/releases ]] || { echo 'Existing deployment directory required'; exit 78; }
service_workdir=$(systemctl show xamuko-api -p WorkingDirectory --value)
if [[ -L $base/current ]]; then
  old=$(readlink -f "$base/current")
else
  [[ $service_workdir == "$base"/releases/*/backend ]] || { echo 'Service is not using a managed release'; exit 78; }
  old=${service_workdir%/backend}
fi
[[ -d $old/backend ]] || { echo 'Active release missing'; exit 78; }
release="$base/releases/$sha"
[[ ! -e $release ]] || { echo 'Release exists; use rollback to reactivate it'; exit 65; }
[[ -f "$old/backend/xamuko-api.env" ]] || { echo 'Active xamuko-api.env missing'; exit 78; }
[[ $(stat -c '%a' "$old/backend/xamuko-api.env") == 600 ]] || { echo 'Active environment permissions invalid'; exit 78; }
work=$(mktemp -d /var/lib/xamuko-build/release.XXXXXXXX)
changed=0
cleanup(){ rm -rf -- "$work"; }
rollback(){ local code=$?; if [[ $changed == 1 ]]; then ln -sfn "$old" "$base/.current-next"; mv -Tf "$base/.current-next" "$base/current"; systemctl restart xamuko-api || true; fi; exit "$code"; }
trap cleanup EXIT
trap rollback ERR
tar -tzf "$archive" | grep -qE '(^|/)\.\.|^/' && { echo 'Unsafe archive paths'; exit 65; }
tar -xzf "$archive" -C "$work"
[[ "$(cat "$work/RELEASE_COMMIT" 2>/dev/null)" == "$sha" ]] || { echo 'Artifact commit mismatch'; exit 65; }
[[ -s "$work/dist/server.js" && -d "$work/node_modules/@prisma/client" ]] || { echo 'Incomplete backend artifact'; exit 65; }
[[ $(df --output=avail -k "$base" | tail -1) -gt 4194304 ]] || { echo 'Need at least 4 GiB free'; exit 74; }
if [[ -d "$old/backend/prisma" && -d "$work/prisma" ]]; then
  diff -qr "$old/backend/prisma" "$work/prisma" >/dev/null || { echo 'Prisma changes require manual review'; exit 65; }
fi
mkdir -p "$release/backend"
cp -a "$work/." "$release/backend/"
install -o root -g root -m 0600 "$old/backend/xamuko-api.env" "$release/backend/xamuko-api.env"
printf '%s\n' "$sha" > "$release/COMMIT"
touch "$release/VERIFIED"
chown -R root:root "$release"
smoke="xamuko-smoke-${sha:0:12}"
systemd-run --quiet --collect --unit="$smoke" -p User=ssm-user -p NoNewPrivileges=yes -p TimeoutStopSec=15 -p WorkingDirectory="$release/backend" -p 'Environment=PORT=3001 HOST=127.0.0.1' /usr/bin/node "$release/backend/dist/server.js"
smoke_ok=0
for _ in {1..20}; do
  if systemctl is-active --quiet "$smoke" && curl --max-time 2 -fsS http://127.0.0.1:3001/api/v1/health >/dev/null; then smoke_ok=1; break; fi
  sleep 1
done
systemctl stop "$smoke" || true
[[ $smoke_ok == 1 ]] || { echo 'Candidate smoke test failed; live release untouched'; exit 1; }
ln -sfn "$release" "$base/.current-next"
changed=1
mv -Tf "$base/.current-next" "$base/current"
systemctl restart xamuko-api
healthy=0
for _ in {1..30}; do
  if systemctl is-active --quiet xamuko-api && curl --max-time 3 -fsS http://127.0.0.1:3000/api/v1/health >/dev/null; then healthy=1; break; fi
  sleep 2
done
[[ $healthy == 1 ]] || { echo 'New release healthcheck failed; rollback executed'; exit 1; }
ln -sfn "$old" "$base/.previous-next"
mv -Tf "$base/.previous-next" "$base/previous"
trap - ERR
echo "Activated $sha"
