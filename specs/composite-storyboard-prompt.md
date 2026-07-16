# 完整多镜号 Prompt

## Summary

> 本文为历史兼容说明。新的业务模型以 `scene-owned-generation.md` 为准：片段代表一次 4-15 秒视频生成，镜号只存在于 `Scene.prompt`。

历史 Storyboard 代表一次 4-15 秒视频生成，但 Prompt 内可以描述多个镜号和镜头切换。迁移后 `Scene.prompt` 是完整 Prompt 的唯一创意内容来源。

## User Goal

创作者可以在一个编辑器内直接控制环境、人物站位、景别、机位、运镜、情绪和台词，并通过独立滑杆明确控制生成时长。

## Workflow

1. 打开历史普通镜头时，前端用已有结构化字段组装完整 Prompt 草稿，但不立即保存。
2. 用户在富文本编辑器内修改 Prompt，并用 `@` 绑定角色或场景资产。
3. 保存或生成前将完整文本写入 `Storyboard.content`。
4. 用户在生成规格中拖动时长滑杆；Prompt 内的时间段只描述镜头节奏，不控制生成参数。
5. 视频预览和正式生成使用同一份最终 Prompt 和滑杆参数。
6. 首帧生成只使用公共描述、第一个镜号和画面约束。

## Data Shape

- `Storyboard.content`: 最多 10,000 字符的完整 Prompt。
- `@` 资产引用行为以 `specs/rich-prompt-asset-mentions.md` 为准。
- `prompt_mode`: 预览返回 `composite` 或 `legacy`。
- `duration`: 前端滑杆显式提交、后端校验后的真实视频时长。
- 原有镜头结构化字段继续保留，用于历史数据和旧客户端兼容，但完整 Prompt 模式不再用它们扩写生成内容。

## UI States

- 普通历史内容：展示自动组装、尚未持久化的完整草稿。
- 编辑态：显示字数计数和 `@` mention 芯片。
- 参数态：Seedance 提供 4-15 秒整数步进滑杆；Wan 固定 5 秒。
- 失败态：超过 10,000 字符或提交模型不支持的时长时，阻止保存或生成并显示原因。
- 预览态：展示 Prompt 模式、用户选择的时长、素材和最终提交原文。

## API Changes

- 视频预览响应增加 `prompt_mode`，并返回校验后的 `duration`。
- 完整 Prompt 模式和 legacy 模式都使用请求中的 `duration`，不解析 Prompt 时间段。
- 现有请求参数和结构化字段不删除。

## Persistence / Async Tasks

- 不新增数据库字段或迁移。
- 媒体生成记录 `meta_json` 保存 `prompt_mode` 和实际生成规格。
- 异步任务直接使用预览阶段冻结的 `final_prompt`，避免任务启动后内容漂移。

## Failure and Retry

- Seedance 时长必须是滑杆提交的 4-15 整数秒。
- Wan 仅允许 5 秒。
- 调整滑杆或模型后重新获取预览即可重试。

## Acceptance Criteria

- Workspace 不再显示景别、机位、运镜、情绪、台词、风格和备注的独立镜头控件。
- Seedance 时长滑杆拖到几秒，预览和正式请求就使用几秒；Prompt 时间段不会覆盖该值。
- 多镜号完整原文不会被 Prompt Library 重复扩写，也不会追加“不要切镜”。
- 首帧 Prompt 不包含第二个及后续镜号。
- 保存后刷新保持用户原文，不再次覆盖。
- 普通旧内容仍可通过旧生成逻辑兼容处理。

## Validation

- Frontend: `cd storyboard-app && npm run build`
- Backend: `cd backend-node && npm run build && npm run test`
- Repo: `npm run check:spec:working`
