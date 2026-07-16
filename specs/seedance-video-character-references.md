# Seedance 2.0 角色参考图与主语音参考

## User goal

生成镜头视频前，用户需要确认当前镜头的角色、背景参考图，以及每个角色的主语音参考。Seedance 2.0 生成时必须传入当前镜头所有角色的主语音参考，保证同一角色跨镜头音色一致。

## Scope

- `backend-node` 视频 preview 和生成请求。
- `storyboard-app` 视频确认弹窗展示角色/背景参考图、角色主语音和阻断原因。
- `storyboard-app` 提供分辨率、时长和有声开关，并把预览参数原样用于真实生成。
- 资产库角色详情支持生成或上传/替换角色主语音参考。
- 不修改冻结的 Go `backend/`。

## Design

### 1. 参考图来源与展示

- 背景资产图：当前镜头已绑定背景资产，来源 `asset.cover_url || asset.file_url`。
- 角色图：当前镜头绑定角色的 `character.design_sheet_url`，沿用当前最多前 2 个角色的展示逻辑。
- Seedance 视觉输入分为互斥的两种模式：
  - 首帧模式只发送 `first_frame`，不发送角色、场景或音频参考素材。
  - 参考素材模式不发送 `first_frame`，发送当前片段绑定的角色、场景和音频参考素材。
- 视频预览只把本次实际发送的素材放入 `reference_images` 和 `audio_reference_assets`。
- 首帧模式下被排除的绑定图片放入 `omitted_reference_images`，用于向用户解释未发送原因。

### 2. 角色主语音参考

视频 preview 返回：

- `audio_reference_assets`：当前镜头所有绑定角色的 `voice_reference_url`。
- `missing_audio_references`：缺少主语音参考的角色名。
- `audio_reference_total_duration`：参考音频总时长。
- `audio_reference_limits`：Seedance 2.0 限制。
- `blocking_reasons`：缺主语音、超过上限或总时长超限等阻断原因。

Seedance 2.0 音频限制：

- 格式：`wav`、`mp3`。
- 单段时长：`[2, 15]` 秒。
- 最多 3 段参考音频。
- 所有参考音频总时长不超过 15 秒。
- 不能单独只传音频，必须至少包含参考图片；本项目在参考素材模式下执行该校验。

### 3. Seedance generation behavior

当模型为 `seedance-2.0` 时：

- 实际方舟模型 ID：`doubao-seedance-2-0-260128`。
- 请求 `content` 始终包含文本，并根据模式二选一：首帧，或角色/场景/音频参考素材。
- 首帧与 `reference_image`、`reference_audio` 不得混用；请求构造器必须在发送前拒绝非法组合。
- 分辨率支持 `480p`、`720p`、`1080p`，时长支持 4-15 秒。
- 默认规格为 `720p / 5秒 / 有声`；旧调用省略分辨率时仍按 `480p` 处理。
- 参考素材模式最多支持 9 张参考图，超过上限时阻止生成，不静默丢弃。
- 每段音频按以下结构传入：

```json
{
  "type": "audio_url",
  "audio_url": { "url": "<角色主语音URL>" },
  "role": "reference_audio"
}
```

有声开启时，如果当前镜头任一角色缺少主语音，或音频数量/时长超过 Seedance 2.0 限制，后端阻止生成，不自动截断、不丢弃第 4 个角色音频。无声模式不收集参考音频，也不执行主语音阻断。

### 4. 异步任务追踪

- 创建 Seedance 任务后，立即把返回的任务 ID 写入媒体生成记录 `meta_json.provider_task_id`。
- 不设置任务级总轮询时限；只要方舟状态仍为 `queued` 或 `running`，本地记录就保持 `generating`。
- 每次创建和查询请求仍保留独立网络超时，避免单个失联连接永久占用 worker。
- 查询发生网络超时或服务端 `5xx` 时继续轮询；明确的鉴权或参数类 `4xx` 仍作为失败处理。
- 只有方舟明确返回 `succeeded`、`failed` 或 `cancelled` 时，才把本地生成记录更新为对应终态。
- 已获得 `provider_task_id` 的记录可以通过方舟查询接口继续核对和恢复，不应因本地等待时间较长而创建重复任务。

## Acceptance criteria

- 视频确认弹窗可看到当前镜头的角色参考图、背景资产图和所有角色主语音。
- 开启首帧时，确认弹窗明确提示绑定的参考素材不会发送；关闭首帧时才发送这些素材。
- 缺少任一角色主语音时，Seedance 2.0 视频生成按钮不可用，后端也会阻止生成。
- 参考音频超过 3 段或总时长超过 15 秒时阻止生成。
- Seedance 2.0 请求体正确包含 `reference_audio` 音频项。
- Seedance 2.0 请求体正确包含预览中展示的 `reference_image` 图像项。
- Seedance 2.0 请求体不会同时包含 `first_frame` 和任何 `reference_*` 媒体项。
- 无声模式请求使用 `generate_audio: false`，且生成 prompt 不包含音频要求。
- Seedance 任务超过 5 分钟仍处于排队或生成状态时，本地继续轮询，不标记为超时失败。
- 媒体生成记录在远端任务创建后包含 `provider_task_id`。
