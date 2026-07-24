# Deploy

## Standard flow

### Local

1. Develop locally in `<repo-root>`
2. Push to GitHub:

```bash
git push origin main
```

### ECS

1. SSH into the server as `admin`

```bash
ssh <deploy-user>@<ecs-host>
```

2. Run the single deploy script

```bash
cd <deploy-directory>
./scripts/deploy.sh
```

## Important rules

- Do not run `git pull` as `root` inside the deployment directory.
- Git operations on ECS must run as the configured deployment user.
- The deploy script handles:
  - `git fetch` + `git pull --ff-only origin main`
  - frontend build
  - Egg backend build/runtime dependency install
  - installation, enablement, and restart of `storyboard-backend-node.service` on `8083`
  - smoke testing `http://127.0.0.1:8083/api/health`

The retired Go backend in `backend/` is not built, started, restarted, or health-checked by the
deployment flow.

## Node backend process supervision

The production Egg.js service runs in the foreground under systemd:

- systemd service: `storyboard-backend-node.service`
- service account: `admin`
- Egg master recovery: systemd with `Restart=always`
- app worker recovery: Egg Cluster
- logs: `journalctl -u storyboard-backend-node.service`
- boot startup: enabled by `scripts/deploy.sh`

Useful read-only checks:

```bash
sudo systemctl status storyboard-backend-node.service
sudo journalctl -u storyboard-backend-node.service -n 100 --no-pager
```

## OSS CORS for browser frame extraction

Browser-side video frame extraction fetches a signed video and draws it to Canvas. Configure the
media bucket CORS to allow `GET` and `HEAD` from the production origin and
`http://localhost:5173`, and expose `Content-Length` and `Accept-Ranges`. Without this rule, the
frame dialog reports a persistent cross-origin error and does not upload or create a database row.

Apply the rule using the backend environment credentials:

```bash
cd backend-node
npm run configure:oss-cors
```

## One-time SSH check for admin

If `admin` cannot talk to GitHub yet:

```bash
ssh -T git@github.com
```

If host verification is missing, add GitHub to `known_hosts`:

```bash
ssh-keyscan github.com >> ~/.ssh/known_hosts
chmod 600 ~/.ssh/known_hosts
```
