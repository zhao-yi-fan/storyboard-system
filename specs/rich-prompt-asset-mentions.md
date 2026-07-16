# 富文本资产引用

## Summary

Prompt 编辑器输入 `@` 后展示项目资产选择器，支持人物、场景、图片、音频和其他资产。选择结果既保存为可读的 `@名称` 文本，也绑定到当前 Storyboard，供生成任务收集真实图片和音频参数。

## User Goal

用户不离开 Prompt 编辑器即可搜索并引用项目资产，通过键盘完成选择，并能确认哪些引用会作为图片或音频传给模型。

## Workflow

1. 用户在空白、标点或段落边界后输入 `@` 和可选关键词。
2. 下拉框按人物、场景、图片资产、音频资产、其他资产分组，并搜索名称、类型和说明。
3. `ArrowUp`、`ArrowDown` 移动高亮项，`Enter` 选择，`Escape` 关闭；高亮项自动滚动到可见区域。
4. 选择人物时绑定 `storyboard_characters`；选择其他资产时绑定 `storyboard_asset_usages`。
5. mention 以不可拆分芯片显示，但 `Storyboard.content` 只保存 `@名称` 纯文本。
6. 视频预览按媒体能力把绑定项分别放入 `reference_images` 和 `audio_reference_assets`。
7. 删除某资产的最后一个 mention 芯片时，同步解除当前 Storyboard 的人物或资产绑定；仍有同资产 mention 时保持绑定。

## Data Shape

- Mention category: `character | scene | image | audio | other`。
- Mention media capability: `image`、`audio` 或空数组。
- 新资产绑定使用 `usage_type=reference_asset`。
- 读取时兼容历史 `scene_background` 绑定。
- 音频预览项包含稳定的 `reference_id`，以及可选的 `character_id` 或 `asset_id`。

## UI States

- 默认态：显示分组、缩略图或媒体图标、资产类型、图片/音频能力和已引用状态。
- 搜索态：名称、类型和说明均参与过滤。
- 键盘态：当前项高亮且保持在可视区域。
- 空态：明确提示没有匹配的人物、场景或其他资产。
- 已引用态：显示勾选，重复选择不重复写入绑定。

## API Changes

- 现有添加/移除 Storyboard 资产接口保持不变，但允许所有项目资产类型。
- 视频预览的 `audio_reference_assets` 支持通用音频资产，返回 `reference_id` 和可选 `asset_id`。
- 不新增数据库字段。

## Persistence / Async Tasks

- 通用资产绑定写入 `storyboard_asset_usages`。
- 音频时长优先读取资产 `meta` 中的 `duration` 或 `duration_seconds`，缺失时使用 ffprobe 探测。
- Seedance 仍执行最多 9 个视觉输入、最多 3 段音频及音频时长限制。

## Failure and Retry

- 不可访问或无法识别时长的音频进入明确的阻断原因，不静默丢弃。
- 图片与音频按类型分流，音频文件不得误传为参考图。
- 绑定失败时保留编辑内容并显示错误，用户可再次选择。
- 删除 mention 后解绑失败时保留参考绑定，并明确提示未移除的资产名称。

## Acceptance Criteria

- Workspace 的 `@` 选择器可看到全部项目资产，而不只是场景背景。
- 鼠标和上下键加 Enter 均可完成选择。
- 选择 mention 后编辑器草稿不会被绑定接口返回值覆盖。
- 已有 mention 芯片后可直接继续输入 `@` 并打开选择器，无需手动补空格。
- 删除芯片后的普通 `@` 不会把前一个 mention 芯片误判为搜索词并重新打开选择器。
- 人物设计图、通用图片资产、人物主语音和通用音频资产均进入对应模型参数。
- 删除某资产的最后一个 mention 芯片后自动解除对应参考绑定；删除重复 mention 中的一个不会误解绑。
- 放大编辑弹窗占据主要视口并使用模糊遮罩，右上角只保留缩小按钮。

## Validation

- Frontend: `cd storyboard-app && npm run build`
- Backend: `cd backend-node && npm run build && npm run test`
- Repo: `npm run check:spec:working`
