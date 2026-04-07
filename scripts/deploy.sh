#!/usr/bin/env bash

set -euo pipefail

if [[ "${USER:-}" != "admin" ]]; then
  echo "[deploy] this script must be run as admin" >&2
  echo "[deploy] usage: ssh admin@<ecs> && cd /home/admin/projects/storyboard-system && ./scripts/deploy.sh" >&2
  exit 1
fi

export HOME=/home/admin

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/storyboard-app"
BACKEND_DIR="$ROOT_DIR/backend"
BACKEND_BIN="$BACKEND_DIR/storyboard-backend"
BACKEND_LOG="$BACKEND_DIR/storyboard-backend.log"
API_HEALTH_URL="http://127.0.0.1:8082/api/projects"

log() {
  printf '[deploy] %s\n' "$1"
}

run() {
  log "$1"
  shift
  "$@"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[deploy] missing required command: $1" >&2
    exit 1
  fi
}

require_command git
require_command npm
require_command go
require_command curl
require_command ss
require_command sudo
require_command ffmpeg

cd "$ROOT_DIR"

log "repo: $ROOT_DIR"
log "branch: $(git rev-parse --abbrev-ref HEAD)"
log "commit before pull: $(git rev-parse --short HEAD)"

run "fetch latest main from origin" git fetch origin main
run "fast-forward local main" git pull --ff-only origin main

log "commit after pull: $(git rev-parse --short HEAD)"

run "build frontend" bash -lc "cd '$FRONTEND_DIR' && npm run build"
run "build backend" bash -lc "cd '$BACKEND_DIR' && go build -o storyboard-backend ."

existing_pids="$(ps -eo pid=,args= | awk '$2 == "./storyboard-backend" {print $1}')"
if [[ -n "${existing_pids}" ]]; then
  log "stopping existing backend process(es): ${existing_pids//$'\n'/, }"
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    sudo kill "$pid" || true
  done <<< "$existing_pids"
  sleep 1
fi

if pgrep -f '\./storyboard-backend$' >/dev/null 2>&1; then
  echo "[deploy] backend process still running after graceful stop, forcing kill" >&2
  pgrep -f '\./storyboard-backend$' | while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    sudo kill -9 "$pid" || true
  done
  sleep 1
fi

if [[ -e "$BACKEND_LOG" && ! -w "$BACKEND_LOG" ]]; then
  log "backend log is not writable by admin, resetting ownership"
  sudo rm -f "$BACKEND_LOG"
fi

run "start backend" bash -lc "cd '$BACKEND_DIR' && nohup '$BACKEND_BIN' > '$BACKEND_LOG' 2>&1 < /dev/null &"

log "waiting for backend smoke test"
smoke_ok=0
for _ in {1..20}; do
  if curl -fsS "$API_HEALTH_URL" >/dev/null 2>&1; then
    smoke_ok=1
    break
  fi
  sleep 1
done

if [[ "$smoke_ok" -ne 1 ]]; then
  echo "[deploy] smoke test failed: $API_HEALTH_URL" >&2
  echo "[deploy] recent backend log:" >&2
  tail -n 50 "$BACKEND_LOG" >&2 || true
  exit 1
fi

log "backend listening:"
ss -ltnp | grep 8082 || true

log "backend process:"
ps -eo user=,pid=,args= | awk '$3 == "./storyboard-backend" {print}'

log "smoke test passed"
