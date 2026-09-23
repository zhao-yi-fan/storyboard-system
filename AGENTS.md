# AGENTS.md

## 项目概述

本仓库是一个 AI 分镜与短剧生成系统。

主要工作流程：

1. 输入小说文本
2. 解析为结构化的分镜
3. 编辑分镜、角色、场景、对话和提示词
4. 生成分镜封面图
5. 基于图片和素材生成分镜视频
6. 使用 ffmpeg 合成最终视频

本项目由兴趣驱动，但应作为真实的产品工作流工具来对待。优先选择清晰的用户流程、可恢复的任务状态和明确的数据结构，而非一次性演示。

## 仓库结构

- `storyboard-app/`：React + Vite 前端，最初由 Figma Make 生成，后整理为可维护的应用代码。
- `backend/`：Go + Gin 后端，使用 MySQL 持久化，集成外部 AI/OSS/视频生成服务。
- `specs/`：产品和工作流规格说明。
- `scripts/`：部署和工具脚本。
- `DEPLOY.md`：ECS 部署说明。

## 开发原则

- 除非必要，保持现有结构和命名风格。
- 保持生成或 AI 辅助 UI 代码的可维护性：提取可复用组件、移除无用代码、避免大型无结构文件。
- 本项目有一个代码风格 skill（`storyboard-code-style`）；进行可维护性重构和 UI 清理时，优先遵循该规范。
- 对于长时间运行的 AI 生成任务，优先使用明确的类型和状态值。
- 保持 AI 工作流用户可控：加载、成功、失败、重试、预览和编辑状态应在相关位置可见。
- 不要将失败隐藏在短暂的 Toast 提示中；持久化的任务级错误通常更有用。
- 不要提交密钥、API Key、访问令牌或真实凭证。

## 前端开发指南

- 前端代码位于 `storyboard-app/`。
- 项目已使用 TypeScript 风格结构时，继续沿用 React + TypeScript 风格。
- 实际可行时，将 API 调用和数据处理逻辑与展示组件分离。
- 对于图片和视频密集的界面，优先使用缩略图、懒加载、稳定的布局尺寸和局部更新。
- 避免在列表视图中加载全尺寸生成素材，除非用户明确打开预览。
- 保留 Figma 设计意图（如适用），但优先保证可读的组件结构和可预测的状态处理。

常用命令：

```bash
cd storyboard-app
npm run dev
npm run build
```

## 后端开发指南

> [!IMPORTANT]
> **Go 后端项目（`backend/`）已完全弃用并冷冻，目前所有的业务开发、API 变更均只能在 Node 后端（`backend-node/`）中进行。不要修改 `backend/` 下的任何代码。**

### Node 后端开发规范（`backend-node/`）

- 使用 Egg.js 框架进行开发，代码结构遵循 MVC 规范（`controller`、`service`、`middleware`、`lib` 等）。
- 保持数据响应格式的统一：
  - 成功：`{ code: 200, data, message: "" }`
  - 失败：`{ code: 0, data: null, message }`
- 重视 AI/长任务的异步状态追踪和失败记录，不要仅依赖内存缓存或短暂 Toast 提示，必须持久化到 MySQL 数据库中。
- 新增或修改 AI Provider、模型、尺寸、清晰度、超时、轮询和音频规格时，必须遵循 `specs/ai-client-configuration-architecture.md`，复用配置层和 AI 客户端公共模块，禁止在业务客户端中重复声明默认值。
- 表结构唯一来源是 `backend-node/app/lib/*_schema.ts`，随应用启动自动执行；禁止手写 SQL 建表，新表必须进 ensure 体系并在 `schema_migrations` 留记录。

常用命令：

```bash
cd backend-node
npm run build
npm run dev
npm run test
```

## 规格驱动开发

添加功能时，先在 `specs/` 中查找相关规格说明。如果不存在且功能非平凡，应在实现前创建或更新简洁的 Markdown 规格文档。

好的规格文档应定义：

- 用户目标
- 工作流程步骤
- 数据结构
- UI 状态
- 失败和重试行为
- 验收标准

规格文档为普通 Markdown 文件。Cursor 规则或 Codex 指令应引用这些规格，而非重复完整的产品需求。

## 验证

完成前运行最小相关验证（`backend/` Go 项目已冻结，不要动）：

- 前端变更：在 `storyboard-app/` 下执行 `npm run typecheck && npm run lint && npm run build`
- 后端变更：在 `backend-node/` 下执行 `npm run typecheck && npm run lint && npm run test`
- 根目录可执行 `npm run typecheck` 跑两边类型检查，`npm run lint` 跑全部 lint

如果无法运行验证，在最终回复中说明原因。
