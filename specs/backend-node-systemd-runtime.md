# Node 后端 systemd 运行规范

## 用户目标

生产环境中的 Egg.js 服务在服务器重启或 Egg master 异常退出后能够自动恢复，同时继续由 Egg Cluster 管理应用 worker。

## 运行结构

1. systemd 以前台模式启动并守护 Egg master。
2. Egg Cluster 管理 agent worker 和 app worker，并在 app worker 异常退出时重新拉起。
3. `scripts/deploy.sh` 负责安装或更新 unit、启用开机自启、重启服务并执行健康检查。

## 服务状态

- 启动中：systemd 等待 Egg master 及 workers 就绪。
- 运行中：`storyboard-backend-node.service` 为 `active`，8083 健康检查成功。
- 失败：systemd 记录失败状态并按策略重启，日志保留在 journal。
- 停止：systemd 向进程组发送 `SIGTERM`，Egg 执行优雅退出。

## 失败与恢复

- app worker 异常退出：由 Egg Cluster 自动重新拉起。
- Egg master 退出：由 systemd 自动重新启动服务；管理员执行 `systemctl stop` 时不会触发重启。
- ECS 重启：由 systemd 开机自动启动服务。
- 部署启动失败：部署脚本输出 `systemctl status` 和最近的 journal 日志后退出。

## 验收标准

- Node 后端不依赖 PM2 或 `nohup`。
- Egg 以前台模式运行，systemd 能准确跟踪主进程。
- unit 使用 `admin` 用户运行，不以 root 运行应用代码。
- unit 已启用开机自启，并配置异常退出自动重启。
- 部署后的 `/api/health` 检查通过。
