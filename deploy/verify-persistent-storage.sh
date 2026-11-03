#!/usr/bin/env bash
# Refuse releases unless photos and verification PDFs use persistent storage.
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
if [[ -L "$release/backend/storage" ]]; then
  target=$(readlink -e "$release/backend/storage") || fail "Enlace de almacenamiento roto."
  check_directory "$target"
  printf 'LINK %s\n' "$checked_dir"
else
  # Both environment paths must be explicit and external; otherwise one type
  # of uploaded document could silently stay inside a versioned directory.
  paths=$(python3 - "$release/xamuko-api.env" <<'PY'
from pathlib import Path
import sys
keys = ("PHOTO_STORAGE_DIR", "VERIFICATION_STORAGE_DIR")
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
if any(not values.get(key, "").startswith("/") for key in keys):
    raise SystemExit("Configure ambas rutas externas PHOTO_STORAGE_DIR y VERIFICATION_STORAGE_DIR, o migre el almacenamiento existente a un enlace persistente.")
for key in keys:
    print(values[key])
PY
) || fail "Almacenamiento no persistente."
  photo_path=${paths%%$'\n'*}
  verification_path=${paths#*$'\n'}
  [[ "$photo_path" != "$verification_path" ]] || fail "Las rutas de fotos y verificaciones deben ser diferentes."
  check_directory "$photo_path"
  check_directory "$verification_path"
  printf 'ENV_ONLY\n'
fi
