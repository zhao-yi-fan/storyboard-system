# storyboard-system

AI 分镜与短剧生成系统：输入小说文本 → 解析结构化分镜 → 编辑角色 / 场景 / 对话 / 提示词 → 生成封面图 → 生成分镜视频 → 合成最终成片。

## 仓库结构

| 目录                 | 说明                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| `storyboard-app/`    | React 19 + Vite 8 前端，详见其 README                                 |
| `backend-node/`      | Egg.js（Node 22）业务后端，唯一在维护的后端，MySQL 持久化             |
| `backend/`           | Go + Gin 旧后端，**已冻结，不要改**                                   |
| `specs/`             | 产品与工作流规格（新功能先查/先写 spec）                              |
| `scripts/`           | 部署与自检脚本                                                        |
| `.github/workflows/` | `checks.yml`（typecheck + lint + test + build）与 `deploy.yml`（ECS） |

## 本地启动

```bash
# 1. 数据库：本机 MySQL 建库（默认库名 storyboard，见 backend-node/config/shared/constants.ts）
#    表结构由后端启动时自动建好，无需手动导入

# 2. 后端
cd backend-node && npm install && npm run dev

# 3. 前端
cd storyboard-app && npm install && npm run dev
```

环境变量分别参考 `backend-node/.env.example` 和 `storyboard-app/.env.example`。

## 门禁（本地先跑，再 push）

```bash
npm run typecheck   # 根目录：前后端 tsc
npm run lint        # 根目录：全部 ESLint，0 warning 通过
(cd backend-node && npm test)          # mocha，90+ 用例
(cd storyboard-app && npm test)        # vitest，45+ 用例
```

`main` 分支 push 后：GitHub Actions 跑 Checks，成功后自动部署到 ECS（`DEPLOY.md`）。

## 给 AI 协作者

先读 `AGENTS.md`（开发规范），Node 后端规范、响应格式 `{ code, data, message }`、AI Provider 配置约束都在里面。
