# Seedance 2.0 角色参考图与主语音参考

## User goal

生成镜头视频前，用户需要确认当前镜头的角色、背景参考图，以及每个角色的主语音参考。Seedance 2.0 生成时必须传入当前镜头所有角色的主语音参考，保证同一角色跨镜头音色一致。

## Scope

- `backend-node` 视频 preview 和生成请求。
- `storyboard-app` 视频确认弹窗展示角色/背景参考图、角色主语音和阻断原因。
- 资产库角色详情支持生成或上传/替换角色主语音参考。
- 不修改冻结的 Go `backend/`。

## Design

### 1. 参考图来源与展示

- 背景资产图：当前镜头已绑定背景资产，来源 `asset.cover_url || asset.file_url`。
- 角色图：当前镜头绑定角色的 `character.design_sheet_url`，沿用当前最多前 2 个角色的展示逻辑。
- 参考图继续用于生成前确认；当前视频生成请求只把首帧作为图像输入。

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
- 不能单独只传音频，必须至少包含参考视频或图片；本项目要求使用首帧图。

### 3. Seedance generation behavior

当模型为 `seedance-2.0` 时：

- 实际方舟模型 ID：`doubao-seedance-2-0-260128`。
- 请求 `content` 包含文本、首帧图和所有角色主语音参考。
- 每段音频按以下结构传入：

```json
{
  "type": "audio_url",
  "audio_url": { "url": "<角色主语音URL>" },
  "role": "reference_audio"
}
```

如果当前镜头任一角色缺少主语音，或音频数量/时长超过 Seedance 2.0 限制，后端阻止生成，不自动截断、不丢弃第 4 个角色音频。

## Acceptance criteria

- 视频确认弹窗可看到当前镜头的角色参考图、背景资产图和所有角色主语音。
- 缺少任一角色主语音时，Seedance 2.0 视频生成按钮不可用，后端也会阻止生成。
- 参考音频超过 3 段或总时长超过 15 秒时阻止生成。
- Seedance 2.0 请求体正确包含 `reference_audio` 音频项。
