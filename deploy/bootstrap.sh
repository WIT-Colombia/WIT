#!/usr/bin/env bash
# One-time setup, after reviewing this file. Leaves original application files intact.
set -Eeuo pipefail
umask 022
[[ $EUID == 0 ]] || exit 64
here=$(cd "$(dirname "$0")" && pwd)
base=/opt/xamuko/deploy
[[ ! -e $base ]] || { echo 'Existing deployment directory: inspect before continuing'; exit 65; }
[[ -f /opt/xamuko/api/backend/.env && -s /opt/xamuko/api/backend/dist/server.js ]]
[[ -s /var/www/xamuko/index.html ]]
[[ $(systemctl show xamuko-api -p User --value) == ssm-user ]]
[[ $(systemctl show xamuko-api -p WorkingDirectory --value) == /opt/xamuko/api/backend ]]
[[ ! -d /etc/systemd/system/xamuko-api.service.d ]]
nginx -t
systemctl is-active --quiet xamuko-api
curl --max-time 10 -fsS http://127.0.0.1:3000/api/v1/health >/dev/null
curl --max-time 15 -fsS https://xamuko.com/ >/dev/null
[[ $(df --output=avail -k /opt/xamuko | tail -1) -gt 4194304 ]]
id xamuko-build >/dev/null 2>&1 || useradd --system --no-create-home --shell /sbin/nologin xamuko-build
install -d -m 0755 "$base/releases" /usr/local/libexec /etc/xamuko-deploy
install -d -m 0700 "$base/backups"
install -d -m 0711 /var/lib/xamuko-build
cp -a /etc/nginx/conf.d/xamuko-web.conf "$base/backups/xamuko-web.conf"
cp -a /etc/systemd/system/xamuko-api.service "$base/backups/xamuko-api.service"
install -m 0755 "$here/deploy.sh" /usr/local/sbin/xamuko-deploy
install -m 0755 "$here/build.sh" /usr/local/libexec/xamuko-build
# Only PUBLIC Vite settings belong here. Backend secrets stay in their existing file.
install -m 0644 /dev/null /etc/xamuko-deploy/frontend.env
initial=$base/releases/bootstrap
mkdir "$initial"
cp -a /opt/xamuko/api/backend "$initial/backend"
cp -a /var/www/xamuko "$initial/web"
mkdir "$base/assets"
cp -a "$initial/web/assets/." "$base/assets/"
rm -rf "$initial/web/assets"
ln -s "$base/assets" "$initial/web/assets"
rm -f "$initial/backend/.env"
rm -rf "$initial/backend/storage"
install -d -o ssm-user -g ssm-user -m 0700 /opt/xamuko/api/backend/storage
ln -s /opt/xamuko/api/backend/.env "$initial/backend/.env"
ln -s /opt/xamuko/api/backend/storage "$initial/backend/storage"
ln -s "$initial" "$base/current"
# Preserve the currently running version as an explicit rollback target.
restore() {
  local status=$?
  trap - ERR
  cp -a "$base/backups/xamuko-web.conf" /etc/nginx/conf.d/xamuko-web.conf
  rm -f /etc/systemd/system/xamuko-api.service.d/deploy.conf
  systemctl daemon-reload
  nginx -t && systemctl reload nginx
  echo 'Bootstrap failed; original service and Nginx configuration restored'
  exit "$status"
}
trap restore ERR
install -d /etc/systemd/system/xamuko-api.service.d
cat > /etc/systemd/system/xamuko-api.service.d/deploy.conf <<'UNIT'
[Service]
WorkingDirectory=/opt/xamuko/deploy/current/backend
ExecStart=
ExecStart=/usr/bin/node /opt/xamuko/deploy/current/backend/dist/server.js
UNIT
python3 - <<'PY'
from pathlib import Path
p = Path('/etc/nginx/conf.d/xamuko-web.conf')
s = p.read_text()
assert s.count('root /var/www/xamuko;') == 1, 'Unexpected Nginx root'
p.write_text(s.replace('root /var/www/xamuko;', 'root /opt/xamuko/deploy/current/web;'))
PY
nginx -t
systemctl daemon-reload
systemctl reload nginx
curl --max-time 15 -fsS https://xamuko.com/ >/dev/null
curl --max-time 15 -fsS https://xamuko.com/api/v1/health >/dev/null
touch "$base/READY"
touch "$initial/VERIFIED"
trap - ERR
echo 'Bootstrap ready; API has not been restarted. Originals retained.'
