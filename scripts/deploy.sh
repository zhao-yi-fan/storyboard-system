#!/usr/bin/env bash

set -euo pipefail

if [[ "${USER:-}" != "admin" ]]; then
  echo "[deploy] this script must be run as admin" >&2
  echo "[deploy] releases go through GitHub Actions; see DEPLOY.md (manual runs are for debugging only)" >&2
  exit 1
fi

export HOME=/home/admin

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/storyboard-app"
NODE_BACKEND_DIR="$ROOT_DIR/backend-node"
NODE_BACKEND_SERVICE="storyboard-backend-node.service"
NODE_BACKEND_UNIT_SOURCE="$ROOT_DIR/scripts/systemd/$NODE_BACKEND_SERVICE"
NODE_BACKEND_UNIT_TARGET="/etc/systemd/system/$NODE_BACKEND_SERVICE"
NODE_API_HEALTH_URL="http://127.0.0.1:8083/api/health"
NGINX_SITE_SOURCE="$ROOT_DIR/scripts/nginx/storyboard-8081.conf"
NGINX_SITE_TARGET="/etc/nginx/conf.d/storyboard-8081.conf"

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
require_command curl
require_command ss
require_command sudo
require_command ffmpeg
require_command systemctl
require_command nginx

cd "$ROOT_DIR"

log "repo: $ROOT_DIR"
log "branch: $(git rev-parse --abbrev-ref HEAD)"
log "commit before pull: $(git rev-parse --short HEAD)"

run "fetch latest main from origin" git fetch origin main
log "local-only commits (empty means clean fast-forward): $(git log --oneline origin/main..HEAD | head -5)"
run "fast-forward local main" git merge --ff-only origin/main

log "commit after pull: $(git rev-parse --short HEAD)"

run "install frontend dependencies" bash -lc "cd '$FRONTEND_DIR' && NODE_OPTIONS=--max-old-space-size=640 npm install --no-audit --no-fund --prefer-offline --include=optional"
run "typecheck frontend" bash -lc "cd '$FRONTEND_DIR' && npm run typecheck"
run "build frontend" bash -lc "cd '$FRONTEND_DIR' && npm run build"
run "install backend-node dependencies" bash -lc "cd '$NODE_BACKEND_DIR' && npm install"
run "typecheck backend-node" bash -lc "cd '$NODE_BACKEND_DIR' && npm run typecheck"
run "build backend-node dist" bash -lc "cd '$NODE_BACKEND_DIR' && npm run build"

run "install nginx 8081 site" sudo install -m 0644 "$NGINX_SITE_SOURCE" "$NGINX_SITE_TARGET"
run "remove legacy nginx 8081 site" sudo rm -f /etc/nginx/conf.d/vue-admin.conf
run "validate nginx configuration" sudo nginx -t
run "reload nginx" sudo systemctl reload nginx

if ! sudo systemctl is-active --quiet "$NODE_BACKEND_SERVICE"; then
  log "stopping legacy daemonized backend-node process if present"
  bash -lc "cd '$NODE_BACKEND_DIR' && npm run stop >/dev/null 2>&1 || true"
  sleep 1
fi

run "install backend-node systemd unit" sudo install -m 0644 "$NODE_BACKEND_UNIT_SOURCE" "$NODE_BACKEND_UNIT_TARGET"
run "reload systemd units" sudo systemctl daemon-reload
run "enable backend-node service" sudo systemctl enable "$NODE_BACKEND_SERVICE"
run "restart backend-node service" sudo systemctl restart "$NODE_BACKEND_SERVICE"

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

log "backend-node listening:"
ss -ltnp | grep 8083 || true

log "backend-node service:"
sudo systemctl status "$NODE_BACKEND_SERVICE" --no-pager || true

log "backend-node smoke test passed"
