# AGENTS.md

## Project Overview

This repository is an AI storyboard and comic-drama generation system.

The main workflow is:

1. Input novel text.
2. Parse it into structured shots.
3. Edit shots, characters, scenes, dialogue, and prompts.
4. Generate shot cover images.
5. Generate shot videos from images and assets.
6. Compose final videos with ffmpeg.

The project is interest-driven, but treat it as a real product workflow tool. Prefer clear user flows, recoverable task states, and explicit data structures over one-off demos.

## Repository Layout

- `storyboard-app/`: React + Vite frontend generated initially from Figma Make, then organized into maintainable app code.
- `backend/`: Go + Gin backend with MySQL persistence and external AI/OSS/video generation integrations.
- `specs/`: Product and workflow specifications.
- `scripts/`: Deployment and utility scripts.
- `DEPLOY.md`: Deployment notes for ECS.

## Development Principles

- Preserve the existing structure and naming style unless a change is required.
- Keep generated or AI-assisted UI code maintainable: extract reusable components, remove dead code, and avoid large unstructured files.
- This project has a repo-local code-style skill at `.codex/skills/storyboard-code-style/SKILL.md`; for maintainability refactors and UI cleanup, follow it preferentially.
- Prefer explicit types and status values for long-running AI generation work.
- Keep AI workflows user-controllable: loading, success, failed, retry, preview, and edit states should be visible where relevant.
- Do not hide failures behind only transient toasts; persistent task-level errors are usually more useful.
- Do not commit secrets, API keys, access tokens, or real credential values.

## Frontend Guidance

- Frontend code lives in `storyboard-app/`.
- Use React with TypeScript-style structure where the project already does so.
- Keep API calls and data-shaping logic separate from presentational components when practical.
- For image and video heavy screens, prefer thumbnails, lazy loading, stable layout dimensions, and localized updates.
- Avoid loading full-size generated assets in list views unless the user explicitly opens a preview.
- Preserve Figma-originated visual intent when useful, but prioritize readable component structure and predictable state handling.

Useful commands:

```bash
cd storyboard-app
npm run dev
npm run build
```

## Backend Guidance

> [!IMPORTANT]
> **Go 后端项目（`backend/`）已完全弃用并冷冻，目前所有的业务开发、API 变更均只能在 Node 后端（`backend-node/`）中进行。不要修改 `backend/` 下的任何代码。**

### Node 后端开发规范 (`backend-node/`)
- 使用 Egg.js 框架进行开发，代码结构遵循 MVC 规范（`controller`, `service`, `middleware`, `lib` 等）。
- 保持数据响应格式的统一：
  - 成功：`{ code: 200, data, message: "" }`
  - 失败：`{ code: 0, data: null, message }`
- 重视 AI/长任务的异步状态追踪和失败记录，不要仅依赖内存缓存或短暂 Toast 提示，必须持久化到 MySQL 数据库中。

Useful commands:

```bash
cd backend-node
npm run build
npm run dev
npm run test
```

## Specification-Driven Work

When adding a feature, first look for a related spec in `specs/`. If no spec exists and the feature is non-trivial, create or update a concise Markdown spec before implementation.

A good spec should define:

- User goal.
- Workflow steps.
- Data shape.
- UI states.
- Failure and retry behavior.
- Acceptance criteria.

SDD documents are normal Markdown files. Cursor rules or Codex instructions should reference these specs rather than duplicating full product requirements.

## Validation

Run the smallest relevant validation before finishing:

- Frontend changes: `npm run build` from `storyboard-app/`.
- Backend changes: `go build ./...` from `backend/`.
- Go formatting: `gofmt -w` on changed Go files.

If validation cannot be run, explain why in the final response.
