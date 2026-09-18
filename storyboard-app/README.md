# Storyboard App（前端）

AI 分镜与短剧工作台前端：React 19 + Vite 8 单页应用。从小说文本解析分镜，编辑角色 / 场景 / 镜头与提示词，生成封面图与分镜视频并预览合成。

## 启动

```bash
npm install
cp .env.example .env   # 按需改 VITE_API_PROXY_TARGET
npm run dev            # http://localhost:5173，/api 代理到 backend-node
```

后端在 `../backend-node`（Egg.js + MySQL），先起后端再联调，见仓库根 `README.md`。

## 常用命令

| 命令            | 说明                                   |
| --------------- | -------------------------------------- |
| `npm run dev`   | 本地开发                               |
| `npm run build` | 生产构建（含 chunk 拆分，见 vite.config） |
| `npm run test`  | Vitest 单测（`src/**/*.test.*`）        |
| `npm run typecheck` | `tsc --noEmit`（CI 门禁）            |
| `npm run lint` / `lint:fix` | ESLint，0 warning 通过          |
| `npm run format` / `format:check` | Prettier                     |

## 路由（`src/app/routes.tsx`）

`/` → `/projects` · `/login` · `/projects` · `/import` · `/workspace` · `/assets` · `/asset-confirmation` · `/personal-assets`

## 目录

- `src/app/pages/` —— 页面（Workspace / AssetLibrary 等）+ 同目录 hooks（`useWorkspace*`、`useAsset*`）与 helpers
- `src/app/components/` —— `workspace/`（编辑器、对话框、hooks）、`assets/`、`ui/`（Radix 封装）
- `src/app/api/` —— `client.ts` 统一请求 + 按域拆分的 `api/*.ts` 与 `api/types/*.ts`
- `src/app/lib/` —— 纯函数（compositePrompt 等），优先加单测
- `src/app/constants/domain.ts` —— 枚举与状态值前后端对齐

## 约定

- 长任务（封面 / 视频生成）用明确 status 值 + 持久化展示，不要只靠 Toast
- 大 hooks 保持单职责；可复用逻辑下沉到 `components/.../hooks`
- 新增用户可见流程先看 `/specs` 有没有对应规格
