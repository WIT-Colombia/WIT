
#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

base=/opt/xamuko/deploy
mode=${1:-validate}

die() {
  echo "ERROR: $1" >&2
  exit 78
}

[[ $EUID -eq 0 ]] || die "Se requieren permisos de administrador."

case "$mode" in
  validate|--prepare|--activate) ;;
  *) die "Uso: $0 [validate|--prepare|--activate]" ;;
esac

# Validar estructura existente
[[ -d "$base/releases" ]] || die "No existe el directorio de releases."
[[ -f /etc/systemd/system/xamuko-api.service ]] || die "No existe el servicio original."
[[ $(systemctl show xamuko-api -p User --value) == ssm-user ]] || die "Usuario del servicio inesperado."
[[ -x /usr/bin/node-22 ]] || die "Node 22 no esta disponible."

service_workdir=$(systemctl show xamuko-api -p WorkingDirectory --value)

if [[ "$service_workdir" == "$base/current/backend" ]]; then
  [[ -L "$base/current" ]] || die "No existe el enlace current."
  current_release=$(readlink -f "$base/current")
elif [[ "$service_workdir" == "$base"/releases/*/backend ]]; then
  current_release=${service_workdir%/backend}
else
  die "El servicio utiliza una ruta no reconocida."
fi

[[ -d "$current_release/backend" ]] || die "Backend actual inexistente."
[[ -s "$current_release/backend/dist/server.js" ]] || die "Falta server.js."
[[ -f "$current_release/xamuko-api.env" ]] || die "Falta xamuko-api.env."
[[ $(stat -c '%a' "$current_release/xamuko-api.env") == 600 ]] || die "Permisos incorrectos en xamuko-api.env."

systemctl is-active --quiet xamuko-api || die "La API actual no esta activa."
curl -fsS --max-time 10 http://127.0.0.1:3000/api/v1/health >/dev/null || die "La API actual no responde."

if [[ -e "$base/current" && ! -L "$base/current" ]]; then
  die "current existe, pero no es un enlace simbolico."
fi

if [[ -L "$base/current" ]]; then
  [[ $(readlink -f "$base/current") == "$current_release" ]] || die "current no coincide con el release activo."
fi

if [[ "$mode" == validate ]]; then
  echo "Validation passed; production remains unchanged"
  exit 0
fi

# Preparacion controlada, sin activar despliegues
if [[ "$mode" == --prepare ]]; then
  [[ ! -f "$base/GITHUB_RELEASE_POLL_ENABLED" ]] || die "El poller ya esta habilitado."

  here=$(cd "$(dirname "$0")" && pwd)
  [[ -f "$here/deploy-github-release.sh" ]] || die "Falta deploy-github-release.sh."
  [[ -f "$here/github-release-poll.sh" ]] || die "Falta github-release-poll.sh."

  dropin=/etc/systemd/system/xamuko-api.service.d/90-xamuko-release.conf

  [[ ! -e "$dropin" ]] || die "Ya existe el override del despliegue."
  [[ -z "$(systemctl show xamuko-api -p DropInPaths --value)" ]] || die "Existen otros overrides que requieren revision."

  mkdir -p "$base/backups"
  backup="$base/backups/github-release-$(date -u +%Y%m%dT%H%M%SZ)-$$"
  mkdir -p "$backup"

  cp -a /etc/systemd/system/xamuko-api.service "$backup/"

  if [[ ! -L "$base/current" ]]; then
    ln -s "$current_release" "$base/.current-next.$$"
    mv -Tf "$base/.current-next.$$" "$base/current"
  fi

  install -d -o root -g root -m 0700 /var/lib/xamuko-build
  install -d -m 0755 /etc/systemd/system/xamuko-api.service.d

  temp_override=$(mktemp "${dropin}.XXXXXX")

  cat > "$temp_override" <<'UNIT'
[Service]
WorkingDirectory=/opt/xamuko/deploy/current/backend
EnvironmentFile=
EnvironmentFile=/opt/xamuko/deploy/current/xamuko-api.env
ExecStart=
ExecStart=/usr/bin/node-22 /opt/xamuko/deploy/current/backend/dist/server.js
UNIT

  chmod 0644 "$temp_override"
  mv -T "$temp_override" "$dropin"

  install -m 0755 "$here/deploy-github-release.sh" /usr/local/sbin/xamuko-deploy-github-release
  install -m 0755 "$here/github-release-poll.sh" /usr/local/sbin/xamuko-github-release-poll

  cat > /etc/systemd/system/xamuko-github-release-poll.service <<'UNIT'
[Unit]
Description=XAMUKO verified GitHub release deployment
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/xamuko-github-release-poll
TimeoutStartSec=2700
UNIT

  cat > /etc/systemd/system/xamuko-github-release-poll.timer <<'UNIT'
[Unit]
Description=Check XAMUKO releases every five minutes

[Timer]
OnBootSec=2min
OnUnitInactiveSec=5min
RandomizedDelaySec=30
Unit=xamuko-github-release-poll.service

[Install]
WantedBy=timers.target
UNIT

  systemctl daemon-reload

  [[ $(systemctl show xamuko-api -p WorkingDirectory --value) == "$base/current/backend" ]] || die "El override no quedo configurado."

  echo "Preparacion completada."
  echo "API actual conservada."
  echo "Temporizador NO activado."
  echo "Respaldo: $backup"
  exit 0
fi

# Activacion solo despues de pruebas supervisadas
if [[ "$mode" == --activate ]]; then
  [[ -f "$base/READY" ]] || die "Falta READY."
  [[ -f "$base/GITHUB_RELEASE_POLL_TESTED" ]] || die "Falta validacion supervisada."
  [[ -L "$base/current" ]] || die "Falta current."

  [[ $(systemctl show xamuko-api -p WorkingDirectory --value) == "$base/current/backend" ]] || die "El servicio no utiliza current."

  [[ -x /usr/local/sbin/xamuko-deploy-github-release ]] || die "Falta el ejecutable de despliegue."
  [[ -x /usr/local/sbin/xamuko-github-release-poll ]] || die "Falta el poller."

  [[ -f /etc/systemd/system/xamuko-github-release-poll.timer ]] || die "Falta el temporizador."

  touch "$base/GITHUB_RELEASE_POLL_ENABLED"

  if ! systemctl enable --now xamuko-github-release-poll.timer; then
    rm -f "$base/GITHUB_RELEASE_POLL_ENABLED"
    systemctl disable --now xamuko-github-release-poll.timer || true
    die "No fue posible activar el temporizador."
  fi

  echo "Poller de produccion activado."
fi
