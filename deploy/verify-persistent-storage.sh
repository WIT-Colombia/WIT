#!/usr/bin/env bash
# Refuse releases unless uploads and verification documents survive versions.
set -Eeuo pipefail
base=${XAMUKO_DEPLOY_BASE:-/opt/xamuko/deploy}
release=${1:-}
fail() { echo "ERROR: $1" >&2; exit 78; }
[[ -d "$release/backend" && -f "$release/xamuko-api.env" ]] || fail "Release o entorno inexistente."
command -v runuser >/dev/null 2>&1 || fail "Falta runuser para comprobar permisos."
releases_root=$(realpath -m "$base/releases")
check_directory() {
  local candidate=$1 canonical
  [[ -d "$candidate" ]] || fail "Directorio persistente inexistente: $candidate"
  canonical=$(realpath -e "$candidate") || fail "Almacenamiento sin ruta valida."
  [[ "$canonical" != "$releases_root" && "$canonical" != "$releases_root/"* ]] || fail "Almacenamiento dentro de releases: requiere migracion supervisada."
  [[ "$canonical" != *$'\n'* ]] || fail "Nombre de ruta invalido."
  runuser -u ssm-user -- test -r "$canonical" &&
    runuser -u ssm-user -- test -w "$canonical" &&
    runuser -u ssm-user -- test -x "$canonical" ||
      fail "ssm-user no tiene acceso de lectura y escritura: $canonical"
  checked_dir=$canonical
}
# Any explicit environment override takes precedence over the legacy storage
# symlink and must also be checked; otherwise uploads might remain versioned.
paths=$(python3 - "$release/xamuko-api.env" <<'PY'
from pathlib import Path
import sys
keys = ("PHOTO_STORAGE_DIR", "VERIFICATION_STORAGE_DIR", "PHOTO_STORAGE_BACKEND", "PHOTO_S3_BUCKET")
values = {}
for line in Path(sys.argv[1]).read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    if key in keys:
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        values[key] = value
for key in keys:
    print(values.get(key, "-"))
PY
) || fail "No se puede validar el entorno."
mapfile -t config_values <<< "$paths"
photo_path=${config_values[0]:--}
verification_path=${config_values[1]:--}
photo_backend=${config_values[2]:--}
photo_bucket=${config_values[3]:--}
photo_backend=${photo_backend,,}
# Validar el sistema de almacenamiento de fotografias
case "$photo_backend" in
  s3)
    [[ "$photo_bucket" != - && -n "$photo_bucket" ]] ||
      fail "PHOTO_S3_BUCKET es obligatorio para Amazon S3."
    ;;
  local|-)
    ;;
  *)
    fail "PHOTO_STORAGE_BACKEND no reconocido."
    ;;
esac

# Comprobar rutas locales configuradas
if [[ "$photo_path" != - ]]; then
  [[ "$photo_path" == /* ]] ||
    fail "PHOTO_STORAGE_DIR debe ser absoluta."
  check_directory "$photo_path"
fi

if [[ "$verification_path" != - ]]; then
  [[ "$verification_path" == /* ]] ||
    fail "VERIFICATION_STORAGE_DIR debe ser absoluta."
  check_directory "$verification_path"
fi

# Evitar mezclar documentos y fotografias locales
if [[ "$photo_path" != - && "$verification_path" != - ]]; then
  [[ "$(realpath -e "$photo_path")" != "$(realpath -e "$verification_path")" ]] ||
    fail "Fotos y verificaciones requieren directorios distintos."
fi

# Verificar almacenamiento persistente
if [[ -L "$release/backend/storage" ]]; then
  target=$(readlink -e "$release/backend/storage") ||
    fail "Enlace de almacenamiento roto."
  check_directory "$target"
  printf 'LINK %s\n' "$checked_dir"
else
  [[ "$verification_path" != - ]] ||
    fail "Configure almacenamiento persistente para documentos."

  if [[ "$photo_backend" == s3 ]]; then
  printf 'ENV_ONLY\n'
  else
    [[ "$photo_path" != - ]] ||
      fail "Configure almacenamiento persistente para fotografias."
    printf 'ENV_ONLY\n'
  fi
fi
