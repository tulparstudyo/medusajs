#!/usr/bin/env bash
#
# Backend (9000), CDN (9080) ve vitrin (8000) durdur, derle, yeniden baslat.
#
#   ./restart.sh             derle ve yayin surumunu baslat (pnpm start)
#   ./restart.sh --dev       derlemeden gelistirme modunda baslat (pnpm dev)
#   ./restart.sh --no-build  derlemeden yayin surumunu baslat
#   ./restart.sh --stop      yalnizca durdur
#
# Surecler terminal kapansa da calisir. Gunlukler ve PID dosyalari logs/ altindadir:
#   tail -f logs/backend.log

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
CDN="$ROOT/cdn"
LOGS="$ROOT/logs"

MODE=start
BUILD=1
for arg in "$@"; do
  case "$arg" in
    --dev) MODE=dev; BUILD=0 ;;
    --no-build) BUILD=0 ;;
    --stop) MODE=stop ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "Bilinmeyen parametre: $arg" >&2; exit 1 ;;
  esac
done

step() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }

if ! command -v pnpm >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
fi
command -v pnpm >/dev/null 2>&1 || { echo "pnpm bulunamadi." >&2; exit 1; }

mkdir -p "$LOGS"

port_pids() {
  ss -ltnpH "sport = :$1" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u || true
}

stop_app() {
  local name="$1" port="$2" pidfile="$LOGS/$1.pid"

  if [ -f "$pidfile" ]; then
    local pid
    pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "  $name: surec grubu $pid kapatiliyor"
      kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  fi

  for _ in $(seq 1 25); do
    [ -z "$(port_pids "$port")" ] && return 0
    sleep 0.4
  done

  for pid in $(port_pids "$port"); do
    echo "  Port $port: PID $pid zorla kapatiliyor"
    kill -KILL "$pid" 2>/dev/null || true
  done
  sleep 1

  if [ -n "$(port_pids "$port")" ]; then
    echo "Port $port hala dolu. Sureci elle kapatip tekrar deneyin." >&2
    exit 1
  fi
}

start_app() {
  local name="$1" dir="$2" script="$3"
  (cd "$dir" && setsid nohup pnpm "$script" >"$LOGS/$name.log" 2>&1 < /dev/null & echo $! >"$LOGS/$name.pid")
  echo "  $name: PID $(cat "$LOGS/$name.pid"), gunluk $LOGS/$name.log"
}

wait_backend() {
  for _ in $(seq 1 90); do
    curl -fs http://127.0.0.1:9000/health >/dev/null 2>&1 && return 0
    sleep 2
  done
  echo "Backend 3 dakikada acilmadi. Gunluk: $LOGS/backend.log" >&2
  tail -n 30 "$LOGS/backend.log" >&2
  exit 1
}

step "Vitrin, backend ve CDN durduruluyor"
stop_app frontend 8000
stop_app backend 9000
stop_app cdn 9080
