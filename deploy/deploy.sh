#!/usr/bin/env bash
set -Eeuo pipefail
umask 022
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export AWS_PAGER=
base=/opt/xamuko/deploy
action=${1:-}
sha=${2:-}
[[ $EUID == 0 && $action =~ ^(deploy|rollback)$ ]] || exit 64
[[ $sha =~ ^[0-9a-f]{40}$ || ( $action == rollback && $sha == bootstrap ) ]] || exit 64
exec 9>/run/lock/xamuko-deploy.lock
flock -n 9 || { echo 'Another deployment is running'; exit 75; }
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
if [[ $action == deploy ]]; then
  [[ ! -e $release ]] || { echo 'Release exists; use rollback to reactivate it'; exit 65; }
  [[ $(df --output=avail -k "$base" | tail -1) -gt 4194304 ]] || { echo 'Need at least 4 GiB free'; exit 74; }
  work=$(mktemp -d /var/lib/xamuko-build/release.XXXXXXXX)
  trap 'rm -rf -- "${work:?}"' EXIT
  # Fetch a fixed commit from staging; never execute git hooks or pull mutable code.
  git -c core.hooksPath=/dev/null init -q "$work/source"
  git -C "$work/source" -c core.hooksPath=/dev/null fetch -q --depth=1 https://github.com/WIT-Colombia/WIT.git refs/heads/staging
  [[ $(git -C "$work/source" rev-parse FETCH_HEAD) == "$sha" ]] || { echo 'Stale deployment: staging moved'; exit 65; }
  git -C "$work/source" -c core.hooksPath=/dev/null checkout -q --detach "$sha"
  # Database changes require a separate reviewed migration and recovery plan.
  diff -qr "$old/backend/prisma" "$work/source/backend/prisma" >/dev/null || { echo 'Prisma changes require manual review'; exit 65; }
  cp /etc/xamuko-deploy/frontend.env "$work/source/frontend/apps/usuario/.env.production.local"
  chown -R xamuko-build:xamuko-build "$work"
  systemd-run --quiet --wait --pipe --collect --unit="xamuko-build-${sha:0:12}" \
    -p User=xamuko-build -p Group=xamuko-build -p NoNewPrivileges=yes \
    -p ProtectSystem=strict -p ProtectHome=yes -p PrivateTmp=yes \
    -p MemoryMax=384M -p MemorySwapMax=512M -p CPUQuota=50% \
    -p Nice=10 -p TasksMax=128 -p RuntimeMaxSec=1800 -p OOMPolicy=stop \
    -p "ReadWritePaths=$work" -p "Environment=HOME=$work" \
    -p IPAddressDeny=169.254.169.254/32 -p IPAddressDeny=169.254.170.2/32 \
    -p IPAddressDeny=fd00:ec2::254/128 \
    /usr/local/libexec/xamuko-build "$work/source"
  [[ -s $work/source/backend/dist/server.js && -s $work/source/frontend/apps/usuario/dist/index.html ]]
  mkdir "$release"
  cp -a "$work/source/backend" "$release/backend"
  cp -a "$work/source/frontend/apps/usuario/dist" "$release/web"
  chown -R root:root "$release"
  rm -f "$release/backend/.env"
  [[ ! -e $release/backend/storage ]] || { echo 'Unexpected storage in artifact'; exit 65; }
  ln -s /opt/xamuko/api/backend/.env "$release/backend/.env"
  ln -s /opt/xamuko/api/backend/storage "$release/backend/storage"
  # Keep hashed assets available to clients with an older page, including rollback.
  [[ -d $release/web/assets && ! -L $release/web/assets ]]
  [[ -z $(find "$release/web" -type l -print -quit) ]] || exit 65
  cp -an "$release/web/assets/." "$base/assets/"
  rm -rf "$release/web/assets"
  ln -s "$base/assets" "$release/web/assets"
  printf '%s\n' "$sha" > "$release/COMMIT"
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
  -p "WorkingDirectory=$release/backend" \
  -p 'Environment=PORT=3001 HOST=127.0.0.1' \
  /usr/bin/node "$release/backend/dist/server.js"
smoke_ok=0
for _ in {1..20}; do
  if systemctl is-active --quiet "$smoke_unit" && curl --max-time 2 -fsS http://127.0.0.1:3001/api/v1/health >/dev/null; then smoke_ok=1; break; fi
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
ln -s "$old" "$base/.previous-next"
mv -Tf "$base/.previous-next" "$base/previous"
printf '%s %s %s\n' "$(date -u +%FT%TZ)" "$action" "$sha" >> "$base/history.log"
trap - ERR INT TERM
echo "Activated $sha"
