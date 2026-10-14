# Deploy

生产发布唯一入口是 push to `main`：GitHub Actions（`.github/workflows/deploy.yml`）
自动 SSH 到 ECS 跑 `scripts/deploy.sh`。**禁止为发版直连 ECS 手动跑脚本**；
SSH 只用于部署失败后的排障和只读检查。
Actions 在启动脚本前先快进到最新 main，确保本次发布使用更新后的部署步骤。

## Standard flow

1. Develop locally in `<repo-root>`
2. Commit and push to GitHub:

```bash
git push origin main
```

3. Watch the Actions run and verify it is green:

```bash
gh run watch
```

4. Verify production:

```bash
curl -s https://popreels.zhaoyifan.top/api/health/deep
```

项目资产页面使用 `/projects/<projectId>/assets?view=all&chapter=<chapterId>`，
避免与打包目录 `/assets/` 重名。发布后必须检查新地址直接打开和刷新；
旧 `/assets?project=<id>`、`/assets/?project=<id>` 应返回 SPA，再由前端跳转到新地址，
并保留集数、页签和选中资产。另检查首页引用的 `/assets/*.js`、`/assets/*.css`
仍返回正确资源，不返回 SPA HTML。

## Important rules

- Do not run `git pull` as `root` inside the deployment directory.
- Git operations on ECS must run as the configured deployment user.
- Never deploy by SSHing into ECS and running the script by hand; all releases go
  through Actions so every deploy is logged and reproducible.
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

生产媒体由业务 API 返回一小时 OSS 公网 HTTPS 签名，浏览器直接读取私有 OSS。
`/generated/**` 与 `/_media/stream/**` 已关闭并返回 404；不再经 ECS 转发媒体。
数据库仍保存稳定 `/generated/**` 对象键。本地未配置 OSS 时仍可使用静态文件。
部署会在切换 Nginx 前更新 OSS CORS；生产 `PUBLIC_APP_BASE_URL` 必须是
`https://popreels.zhaoyifan.top`。详细行为见 `specs/browser-private-oss-media.md`。

Browser-side video frame extraction fetches a signed video and draws it to Canvas. Configure the
media bucket CORS to allow `GET` and `HEAD` from the production origin and
`http://localhost:5173`, and expose `Content-Length`, `Content-Range`, `ETag` and `Accept-Ranges`. Without this rule, the
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
