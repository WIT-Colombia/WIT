
#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

base=${XAMUKO_DEPLOY_BASE:-/opt/xamuko/deploy}
archive=${1:-}
sha=${2:-}

fail() {
  echo "ERROR: $1" >&2
  exit 78
}

[[ $EUID -eq 0 ]] || fail "Se requieren permisos root."
[[ -f "$archive" ]] || fail "Artefacto inexistente."
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || fail "SHA invalido."

exec 9>/run/lock/xamuko-deploy.lock
flock -n 9 || fail "Otro despliegue esta en progreso."

[[ -f "$base/READY" ]] || fail "Produccion no esta preparada."
[[ -L "$base/current" ]] || fail "Falta current."

[[ $(systemctl show xamuko-api -p WorkingDirectory --value) == "$base/current/backend" ]] || fail "Servicio no configurado para current."

old=$(readlink -f "$base/current")
release="$base/releases/$sha"

[[ -d "$old/backend" ]] || fail "Release anterior inexistente."
[[ -f "$old/xamuko-api.env" ]] || fail "Faltan variables del release anterior."
[[ $(stat -c '%a' "$old/xamuko-api.env") == 600 ]] || fail "Permisos incorrectos del entorno."
[[ ! -e "$release" && ! -L "$release" ]] || fail "Release ya existe."

[[ -d /var/lib/xamuko-build ]] || fail "Falta directorio de preparacion."
work=$(mktemp -d /var/lib/xamuko-build/release.XXXXXXXX)
smoke_env="$work/smoke.env"
smoke="xamuko-smoke-${sha:0:12}"

created=0
switched=0
smoke_started=0

cleanup() {
  if [[ "$smoke_started" == 1 ]]; then
    systemctl stop "$smoke" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$work"
}

rollback() {
  local code=$?
  trap - ERR

  echo "Fallo de despliegue. Iniciando recuperacion." >&2

  if [[ "$switched" == 1 ]]; then
    ln -s "$old" "$base/.current-next"
    mv -Tf "$base/.current-next" "$base/current"

    if systemctl restart xamuko-api && \
       systemctl is-active --quiet xamuko-api && \
       curl -fsS --max-time 10 http://127.0.0.1:3000/api/v1/health >/dev/null; then
      echo "Release anterior recuperado."
      rm -rf -- "$release"
    else
      echo "CRITICO: rollback requiere intervencion manual." >&2
    fi
  elif [[ "$created" == 1 ]]; then
    rm -rf -- "$release"
  fi

  exit "$code"
}

trap cleanup EXIT
trap rollback ERR

# Verificar seguridad del archivo antes de extraerlo
python3 - "$archive" <<'PY'
import posixpath
import sys
import tarfile

with tarfile.open(sys.argv[1], "r:gz") as tar:
    for member in tar:
        path = posixpath.normpath(member.name)

        if path.startswith("/") or path == ".." or path.startswith("../"):
            raise SystemExit("Ruta insegura en artefacto")

        if member.issym():
            target = posixpath.normpath(
                posixpath.join(posixpath.dirname(path), member.linkname)
            )
            if target.startswith("/") or target == ".." or target.startswith("../"):
                raise SystemExit("Enlace inseguro en artefacto")
        elif member.islnk():
            target = posixpath.normpath(member.linkname)
            if target.startswith("/") or target == ".." or target.startswith("../"):
                raise SystemExit("Enlace duro inseguro")
        elif not (member.isfile() or member.isdir()):
            raise SystemExit("Tipo de archivo no permitido")
PY

tar -xzf "$archive" -C "$work"

[[ "$(cat "$work/RELEASE_COMMIT" 2>/dev/null)" == "$sha" ]] || fail "Commit del artefacto incorrecto."
[[ -s "$work/dist/server.js" ]] || fail "Falta servidor compilado."
[[ -d "$work/node_modules/@prisma/client" ]] || fail "Faltan dependencias Prisma."

[[ $(df --output=avail -k "$base" | tail -1) -gt 4194304 ]] || fail "Espacio insuficiente."

# No permitir cambios de esquema sin revision
if [[ -d "$old/backend/prisma" || -d "$work/prisma" ]]; then
  [[ -d "$old/backend/prisma" && -d "$work/prisma" ]] || fail "Estructura Prisma diferente."
  diff -qr "$old/backend/prisma" "$work/prisma" >/dev/null || fail "Cambios Prisma requieren revision manual."
fi

mkdir -p "$release/backend"
created=1

cp -a "$work/." "$release/backend/"
install -o root -g root -m 0600 "$old/xamuko-api.env" "$release/xamuko-api.env"

printf '%s\n' "$sha" > "$release/COMMIT"
touch "$release/VERIFIED"
chown -R root:root "$release"

# Entorno aislado para comprobar el candidato
install -m 0600 "$old/xamuko-api.env" "$smoke_env"
printf '\nPORT=3001\nHOST=127.0.0.1\n' >> "$smoke_env"

systemd-run --quiet --collect \
  --unit="$smoke" \
  -p User=ssm-user \
  -p NoNewPrivileges=yes \
  -p "WorkingDirectory=$release/backend" \
  -p "EnvironmentFile=$smoke_env" \
  /usr/bin/node-22 "$release/backend/dist/server.js"

smoke_started=1
smoke_ok=0

for _ in {1..20}; do
  if systemctl is-active --quiet "$smoke" && \
     curl -fsS --max-time 2 http://127.0.0.1:3001/api/v1/health >/dev/null; then
    smoke_ok=1
    break
  fi
  sleep 1
done

systemctl stop "$smoke" >/dev/null 2>&1 || true
smoke_started=0

[[ "$smoke_ok" == 1 ]] || fail "Smoke test fallido."

# Cambiar a la nueva version
ln -s "$release" "$base/.current-next"
mv -Tf "$base/.current-next" "$base/current"
switched=1

systemctl restart xamuko-api

healthy=0

for _ in {1..30}; do
  if systemctl is-active --quiet xamuko-api && \
     curl -fsS --max-time 3 http://127.0.0.1:3000/api/v1/health >/dev/null; then

    pid=$(systemctl show xamuko-api -p MainPID --value)

    if [[ "$pid" =~ ^[1-9][0-9]*$ ]] && \
       [[ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" == "$release/backend" ]]; then
      healthy=1
      break
    fi
  fi
  sleep 2
done

[[ "$healthy" == 1 ]] || fail "Nuevo release no responde correctamente."

ln -s "$old" "$base/.previous-next"
mv -Tf "$base/.previous-next" "$base/previous"

switched=0
trap - ERR

echo "Despliegue exitoso: $sha"
