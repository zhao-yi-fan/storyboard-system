# Deploy

## Standard flow

### Local
1. Develop locally in `/Users/zhaoyifan/Desktop/myProject/storyboard-system`
2. Push to GitHub:

```bash
git push origin main
```

### ECS
1. SSH into the server as `admin`

```bash
ssh admin@8.152.208.234
```

2. Run the single deploy script

```bash
cd /home/admin/projects/storyboard-system
./scripts/deploy.sh
```

## Important rules

- Do not run `git pull` as `root` inside `/home/admin/projects/storyboard-system`
- Git operations on ECS must run as `admin`
- The deploy script handles:
  - `git fetch` + `git pull --ff-only origin main`
  - frontend build
  - Go backend build + restart on `8082`
  - Egg backend build/runtime dependency install + restart on `8083`
  - smoke testing `http://127.0.0.1:8082/api/projects`
  - smoke testing `http://127.0.0.1:8083/api/health`

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
