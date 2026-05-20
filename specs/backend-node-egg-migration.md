# Backend Node Egg Migration

## Summary

将现有 Go 后端迁移到 `backend-node/` 下的 Egg.js 项目，保留现有 `/api` 路径和响应结构，并让前端默认联调 Node 版后端。

当前目标不是占位兼容，而是覆盖现有主工作流：

- `GET /api/health`
- `projects / chapters / scenes / storyboards / characters / assets` 全量 CRUD
- `POST /api/projects/:id/import-script`
- `GET /api/oss/sign`
- 场景封面、镜头封面、镜头视频
- 角色封面、角色设定图、角色主语音参考
- 资产封面
- 场景视频合成、项目总片合成
- `storyboard_media_generations` 历史与 current 切换

前端开发态默认通过 Vite `/api` 代理指向 `backend-node`，不再优先联调 Go 版后端。

## Requirements

- Node 后端目录固定为 `backend-node/`
- 使用 Egg.js，采用 CommonJS JavaScript，优先降低前端工程师接手门槛
- 保持统一响应格式与当前 Go 后端一致：
  - 成功：`{ code: 200, data, message: "" }`
  - 失败：`{ code: 0, data: null, message }`
- 默认连接同一个 MySQL 数据库，沿用现有表结构
- 生成资产继续兼容本地存储和 OSS 两种模式
- 前端统一使用 `/api`
- Node 本地默认端口使用 `8083`，避免与现有 Go 后端 `8082` 冲突

## Architecture

- `backend-node/config/`
  - Egg 配置、端口、数据库、provider、OSS、公共资源前缀
- `backend-node/app/router.js`
  - 与现有 Go `/api` 路由保持一致
- `backend-node/app/controller/`
  - 参数校验、响应包装、错误处理
- `backend-node/app/service/`
  - 业务逻辑和数据库调用
- `backend-node/app/lib/`
  - MySQL 行映射、生成资产路径、OSS、本地文件处理、AI provider 封装、ffmpeg 辅助
- `storyboard-app/vite.config.ts`
  - 开发态 `/api` 代理到 `backend-node`

## Migration Notes

- 数据库存储沿用现有表结构与状态字段
- 前端不改业务 API 调用点，只调整开发代理目标
- 生产切换时只需要把 nginx `/api` 从 Go 版切到 Node 版
- Go 后端在迁移期间仍可保留，作为对照与回退

## Acceptance

- `backend-node/` 可安装依赖并静态加载通过
- `GET /api/health` 返回成功
- 主工作流接口可直接访问 MySQL 和外部 provider
- 响应结构与前端现有请求约定兼容
- `storyboard-app` 构建通过，并默认联调 Node 版后端
