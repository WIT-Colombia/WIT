#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
TEST_DATABASE="xamuko_modalities_test"
TEST_USER="xamuko_test_app"
TEST_HOST="127.0.0.1"
TEST_PORT="3306"
BACKEND_PORT="3001"
BACKEND_PID=""
FRONTEND_PID=""
BACKEND_REUSED=0
BACKEND_LOG=""
FRONTEND_LOG=""
DATABASE_URL=""

stop_tree() {
  local pid="$1"
  local child
  [[ -z "$pid" ]] && return 0
  while read -r child; do
    [[ -n "$child" ]] && stop_tree "$child"
  done < <(pgrep -P "$pid" 2>/dev/null || true)
  kill "$pid" 2>/dev/null || true
}

cleanup() {
  trap - EXIT INT TERM
  printf '\nDeteniendo servicios locales...\n'
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    stop_tree "$FRONTEND_PID"
  fi
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    stop_tree "$BACKEND_PID"
  fi
  [[ -n "$FRONTEND_PID" ]] && wait "$FRONTEND_PID" 2>/dev/null || true
  [[ -n "$BACKEND_PID" ]] && wait "$BACKEND_PID" 2>/dev/null || true
  [[ -n "$BACKEND_LOG" ]] && rm -f "$BACKEND_LOG"
  [[ -n "$FRONTEND_LOG" ]] && rm -f "$FRONTEND_LOG"
  unset DATABASE_URL DB_PASS MYSQL_PWD
  printf 'Servicios detenidos y variables temporales limpiadas.\n'
}
trap cleanup EXIT INT TERM
report_error() {
  local status="$?"
  printf 'Error de arranque en la línea %s (código %s).\n' "${BASH_LINENO[0]:-desconocida}" "$status" >&2
  exit "$status"
}
trap report_error ERR

if [[ ! -d "$BACKEND_DIR" || ! -d "$FRONTEND_DIR" ]]; then
  printf 'No se encontró la estructura esperada del repositorio.\n' >&2
  exit 1
fi
if ! command -v mysql >/dev/null 2>&1; then
  printf 'No se encontró el cliente mysql en PATH. Instálalo o añade MySQL al PATH.\n' >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  printf 'Se requieren Node.js y npm para iniciar XAMUKO.\n' >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  printf 'Se requiere curl para comprobar los servicios locales.\n' >&2
  exit 1
fi

http_status() {
  local status
  status="$(curl --noproxy '*' -sS -o /dev/null -w '%{http_code}' --max-time 2 "$1" 2>/dev/null || true)"
  if [[ "$status" =~ ^[0-9]{3}$ ]]; then
    printf '%s' "$status"
  else
    printf '000'
  fi
}

http_reachable() {
  [[ "$(http_status "$1")" != "000" ]]
}

listening_pid() {
  lsof -nP -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -n 1 || true
}

process_snapshot() {
  local pid="$1"
  ps eww -p "$pid" -o command= 2>/dev/null || true
}

process_cwd() {
  local pid="$1"
  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1 || true
}

printf 'Introduce la contraseña de MySQL para %s@localhost (no se mostrará): ' "$TEST_USER"
read -r -s DB_PASS
printf '\n'
if [[ -z "$DB_PASS" ]]; then
  printf 'No se introdujo una contraseña. Se detiene el arranque.\n' >&2
  exit 1
fi

identity="$(MYSQL_PWD="$DB_PASS" mysql --protocol=TCP -h "$TEST_HOST" -P "$TEST_PORT" -u "$TEST_USER" "$TEST_DATABASE" -Nse 'SELECT DATABASE(), CURRENT_USER()' 2>/dev/null)" || {
  printf 'No fue posible verificar la conexión MySQL local.\n' >&2
  exit 1
}
db_name="$(printf '%s' "$identity" | awk '{print $1}')"
db_user="$(printf '%s' "$identity" | awk '{print $2}')"
if [[ "$db_name" != "$TEST_DATABASE" || "$db_user" != "$TEST_USER@localhost" ]]; then
  printf 'Verificación rechazada: el destino no es la base de pruebas autorizada.\n' >&2
  exit 1
fi
printf 'Conexión confirmada: %s en 127.0.0.1:%s con %s@localhost.\n' "$TEST_DATABASE" "$TEST_PORT" "$TEST_USER"

backend_status="$(http_status "http://127.0.0.1:${BACKEND_PORT}/api/v1/health")"
backend_listener_pid="$(listening_pid "$BACKEND_PORT")"
if [[ "$backend_status" != "000" || -n "$backend_listener_pid" ]]; then
  backend_snapshot=""
  backend_cwd=""
  if [[ -n "$backend_listener_pid" ]]; then
    backend_snapshot="$(process_snapshot "$backend_listener_pid")"
    backend_cwd="$(process_cwd "$backend_listener_pid")"
  fi
  if [[ ! "$backend_status" =~ ^2[0-9][0-9]$ || -z "$backend_listener_pid" || "$backend_cwd" != "$BACKEND_DIR" || "$backend_snapshot" != *"/$TEST_DATABASE"* ]]; then
    unset DB_PASS MYSQL_PWD
    printf 'El puerto %s está ocupado o no responde con salud HTTP válida (HTTP %s); no se reutilizará ni se detendrá ningún proceso.\n' "$BACKEND_PORT" "$backend_status" >&2
    exit 1
  fi
  BACKEND_REUSED=1
  unset DB_PASS MYSQL_PWD
  printf 'Backend existente verificado para %s; no se iniciará otro proceso.\n' "$TEST_DATABASE"
else
  DATABASE_URL="$(DB_PASS="$DB_PASS" node --input-type=module -e '
    const url = new URL("mysql://127.0.0.1:3306/xamuko_modalities_test");
    url.username = "xamuko_test_app";
    url.password = process.env.DB_PASS ?? "";
    process.stdout.write(url.toString());
  ')"
  unset DB_PASS
  export DATABASE_URL
  export NODE_ENV=development HOST=127.0.0.1 PORT="$BACKEND_PORT"

  BACKEND_LOG="$(mktemp -t xamuko-business-backend.XXXXXX)"
  (
    cd "$BACKEND_DIR"
      exec npm run dev
  ) >"$BACKEND_LOG" 2>&1 &
  BACKEND_PID=$!
  printf 'Iniciando backend en http://127.0.0.1:%s con la base de pruebas verificada...\n' "$BACKEND_PORT"
fi

if [[ "$BACKEND_REUSED" -eq 0 ]]; then
  for _ in {1..30}; do
    backend_status="$(http_status "http://127.0.0.1:${BACKEND_PORT}/api/v1/health")"
    if [[ "$backend_status" =~ ^2[0-9][0-9]$ ]]; then
      break
    fi
    sleep 1
  done
fi
backend_status="$(http_status "http://127.0.0.1:${BACKEND_PORT}/api/v1/health")"
if [[ ! "$backend_status" =~ ^2[0-9][0-9]$ ]]; then
  printf 'El backend no está saludable en el puerto %s (HTTP %s).\n' "$BACKEND_PORT" "$backend_status" >&2
  [[ -n "$BACKEND_LOG" ]] && tail -n 20 "$BACKEND_LOG" >&2 || true
  exit 1
fi

frontend_status="$(http_status http://127.0.0.1:5174/)"
if [[ "$frontend_status" != "000" ]]; then
  frontend_listener_pid="$(listening_pid 5174)"
  frontend_snapshot=""
  frontend_cwd=""
  [[ -n "$frontend_listener_pid" ]] && frontend_snapshot="$(process_snapshot "$frontend_listener_pid")"
  [[ -n "$frontend_listener_pid" ]] && frontend_cwd="$(process_cwd "$frontend_listener_pid")"
  if [[ -z "$frontend_listener_pid" || "$frontend_cwd" != "$FRONTEND_DIR" || "$frontend_snapshot" != *"VITE_BUSINESS_BACKEND_URL=http://127.0.0.1:${BACKEND_PORT}"* ]]; then
    printf 'Business responde en 5174, pero no se pudo verificar que su proxy apunte al backend autorizado en %s. No se reutilizará.\n' "$BACKEND_PORT" >&2
    exit 1
  fi
  printf 'Frontend Business existente verificado y apuntando al backend autorizado (HTTP %s).\n' "$frontend_status"
else
  FRONTEND_LOG="$(mktemp -t xamuko-business-frontend.XXXXXX)"
  (
    cd "$FRONTEND_DIR"
    export VITE_BUSINESS_BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
    exec npm run dev --workspace=@wit/negocios -- --host 127.0.0.1 --port 5174
  ) >"$FRONTEND_LOG" 2>&1 &
  FRONTEND_PID=$!
  printf 'Iniciando Business en http://localhost:5174...\n'
  for _ in {1..60}; do
    frontend_status="$(http_status http://127.0.0.1:5174/)"
    if [[ "$frontend_status" =~ ^[23][0-9][0-9]$ ]]; then
      break
    fi
    sleep 1
  done
fi
frontend_status="$(http_status http://127.0.0.1:5174/)"
if [[ ! "$frontend_status" =~ ^[23][0-9][0-9]$ ]]; then
  printf 'Business no respondió correctamente en el puerto 5174 (HTTP %s).\n' "$frontend_status" >&2
  [[ -n "$FRONTEND_LOG" ]] && tail -n 20 "$FRONTEND_LOG" >&2 || true
  exit 1
fi

printf '\nXAMUKO Business está disponible:\n'
printf '  Aplicación: http://localhost:5174/mis-negocios\n'
printf '  Backend:    http://127.0.0.1:%s/api/v1/health\n' "$BACKEND_PORT"
printf 'Presiona Ctrl+C para detener los servicios iniciados por este script.\n'
wait
