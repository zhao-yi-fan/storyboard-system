# AI Prompt 优化

## Summary

在 Workspace 的片段 Prompt 编辑器中增加 AI 优化能力，使用现有 DeepSeek 模型把自由文本整理为更规范、可生成的多镜号 Prompt。AI 结果只作为候选稿，用户明确确认后才替换编辑器内容。

## User Goal

创作者可以保留原始剧情意图和资产引用，同时让 AI 补齐镜号结构、镜头语言和生成约束，且不会因误触直接覆盖现有 Prompt。

## Scope

本次包含：

- 当前片段 Prompt 的 DeepSeek 优化。
- 原文与候选稿对照、失败重试、取消和确认替换。
- 保留 `@角色`、`@场景`、台词、时间段和已有镜号事实。

本次不包含：

- 自动保存或自动生成视频。
- 新增模型配置、数据库字段或 Prompt 版本表。
- AI 自动新增资产绑定。

## Workflow

1. 用户在片段 Prompt 编辑器点击“AI 优化”。
2. 前端把当前未保存草稿提交给片段优化接口。
3. DeepSeek 返回规范化候选稿，原 Prompt 和数据库内容均保持不变。
4. 弹窗并排展示原文与候选稿。
5. 用户取消时不产生任何修改；点击“确认替换”时才把候选稿写入当前编辑器草稿。
6. 替换后的草稿继续通过现有保存或生成前自动保存流程持久化。

## Data Shape

- Request:
  - `prompt`: 当前片段 Prompt，1-10,000 字符。
- Response:
  - `original_prompt`
  - `optimized_prompt`
  - `model`
- 不新增数据库字段。

## UI States

- 默认态：编辑器标题旁展示“AI 优化”按钮。
- 加载态：打开确认弹窗并显示 DeepSeek 正在整理。
- 成功态：展示原文与候选稿，可确认替换。
- 失败态：弹窗内持久显示错误和重试按钮。
- 确认态：仅替换编辑器草稿，不自动保存或生成。

## API Changes

- `POST /api/scenes/:id/optimize-prompt`

## Persistence / Async Tasks

- 优化接口不写数据库，不创建媒体任务。
- 用户确认后仅更新前端草稿，持久化仍由现有片段保存流程负责。

## Failure and Retry

- 空 Prompt 或超过 10,000 字符时前后端均阻止请求。
- DeepSeek 未配置、超时或返回空内容时保留原文并允许重试。
- DeepSeek 返回超过 10,000 字符时拒绝候选稿，避免生成无法保存的内容。

## Acceptance Criteria

- 未点击“确认替换”时，编辑器和数据库 Prompt 均不变化。
- 优化结果保留已有 `@名称` 引用，不擅自添加不存在的角色、场景、剧情或台词。
- 有多个镜号时按原顺序整理；没有镜号时可以根据原文合理拆分镜号。
- 确认替换后 Rich Prompt 编辑器能继续恢复已有资产 mention 芯片。
- 优化失败时原文不丢失，并可在弹窗内重试。

## Validation

- Repo: `npm run check:spec:working`
- Backend: `cd backend-node && npm run build && npm run test`
- Frontend: `cd storyboard-app && npm run build`
