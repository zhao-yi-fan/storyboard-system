#!/usr/bin/env bash

set -euo pipefail

if [[ "${USER:-}" != "admin" ]]; then
  echo "[deploy] this script must be run as admin" >&2
  echo "[deploy] usage: ssh <deploy-user>@<ecs-host> && cd <deploy-directory> && ./scripts/deploy.sh" >&2
  exit 1
fi

export HOME=/home/admin

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/storyboard-app"
BACKEND_DIR="$ROOT_DIR/backend"
BACKEND_BIN="$BACKEND_DIR/storyboard-backend"
BACKEND_LOG="$BACKEND_DIR/storyboard-backend.log"
NODE_BACKEND_DIR="$ROOT_DIR/backend-node"
NODE_BACKEND_SERVICE="storyboard-backend-node.service"
NODE_BACKEND_UNIT_SOURCE="$ROOT_DIR/scripts/systemd/$NODE_BACKEND_SERVICE"
NODE_BACKEND_UNIT_TARGET="/etc/systemd/system/$NODE_BACKEND_SERVICE"
API_HEALTH_URL="http://127.0.0.1:8082/api/projects"
NODE_API_HEALTH_URL="http://127.0.0.1:8083/api/health"

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
require_command systemctl

cd "$ROOT_DIR"

log "repo: $ROOT_DIR"
log "branch: $(git rev-parse --abbrev-ref HEAD)"
log "commit before pull: $(git rev-parse --short HEAD)"

run "fetch latest main from origin" git fetch origin main
run "fast-forward local main" git pull --ff-only origin main

log "commit after pull: $(git rev-parse --short HEAD)"

run "install frontend dependencies" bash -lc "cd '$FRONTEND_DIR' && NODE_OPTIONS=--max-old-space-size=640 npm install --no-audit --no-fund --prefer-offline --include=optional"
run "build frontend" bash -lc "cd '$FRONTEND_DIR' && npm run build"
run "build backend" bash -lc "cd '$BACKEND_DIR' && go build -o storyboard-backend ."
run "install backend-node dependencies" bash -lc "cd '$NODE_BACKEND_DIR' && npm install"
run "build backend-node dist" bash -lc "cd '$NODE_BACKEND_DIR' && npm run build"

existing_pids="$(pgrep -f 'storyboard-backend$' || true)"
if [[ -n "${existing_pids}" ]]; then
  log "stopping existing backend process(es): ${existing_pids//$'\n'/, }"
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    sudo kill "$pid" || true
  done <<< "$existing_pids"
  sleep 1
fi

if pgrep -f 'storyboard-backend$' >/dev/null 2>&1; then
  echo "[deploy] backend process still running after graceful stop, forcing kill" >&2
  pgrep -f 'storyboard-backend$' | while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    sudo kill -9 "$pid" || true
  done
  sleep 1
fi

if ! sudo systemctl is-active --quiet "$NODE_BACKEND_SERVICE"; then
  log "stopping legacy daemonized backend-node process if present"
  bash -lc "cd '$NODE_BACKEND_DIR' && npm run stop >/dev/null 2>&1 || true"
  sleep 1
fi

if [[ -e "$BACKEND_LOG" && ! -w "$BACKEND_LOG" ]]; then
  log "backend log is not writable by admin, resetting ownership"
  sudo rm -f "$BACKEND_LOG"
fi

run "start backend" bash -lc "cd '$BACKEND_DIR' && nohup '$BACKEND_BIN' > '$BACKEND_LOG' 2>&1 < /dev/null &"
run "install backend-node systemd unit" sudo install -m 0644 "$NODE_BACKEND_UNIT_SOURCE" "$NODE_BACKEND_UNIT_TARGET"
run "reload systemd units" sudo systemctl daemon-reload
run "enable backend-node service" sudo systemctl enable "$NODE_BACKEND_SERVICE"
run "restart backend-node service" sudo systemctl restart "$NODE_BACKEND_SERVICE"

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

log "waiting for backend-node smoke test"
node_smoke_ok=0
for _ in {1..30}; do
  if curl -fsS "$NODE_API_HEALTH_URL" >/dev/null 2>&1; then
    node_smoke_ok=1
    break
  fi
  sleep 1
done

if [[ "$node_smoke_ok" -ne 1 ]]; then
  echo "[deploy] backend-node smoke test failed: $NODE_API_HEALTH_URL" >&2
  echo "[deploy] backend-node service status:" >&2
  sudo systemctl status "$NODE_BACKEND_SERVICE" --no-pager >&2 || true
  echo "[deploy] recent backend-node journal:" >&2
  sudo journalctl -u "$NODE_BACKEND_SERVICE" -n 80 --no-pager >&2 || true
  exit 1
fi

log "backend listening:"
ss -ltnp | grep 8082 || true
ss -ltnp | grep 8083 || true

log "backend process:"
ps -eo user=,pid=,args= | grep 'storyboard-backend$' | grep -v grep || true
sudo systemctl status "$NODE_BACKEND_SERVICE" --no-pager || true

log "smoke test passed"
