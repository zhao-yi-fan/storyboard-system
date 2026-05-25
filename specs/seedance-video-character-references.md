# 视频参考图展示与 Seedance 兼容边界

## User goal

在生成镜头视频前，用户需要看到当前镜头关联的角色图和背景资产图，明确本次视频生成的参考素材。

但接入必须遵守当前模型真实能力边界，不能把 Seedance 1.5 Pro 不支持的参考图模式强行塞进请求，导致任务失败。

## Scope

本阶段处理：

- `backend-node` 视频 preview
- `storyboard-app` 视频确认弹窗中的角色/背景参考图展示

不处理：

- Go 后端
- Wanx 视频多参考图
- 切换到支持多参考图的 Seedance Lite I2V 模型

## Design

### 1. 参考图来源与展示

按当前镜头和场景信息收集两类展示素材：

- 角色参考图：按当前镜头关联角色顺序，最多取前 2 个角色
- 背景资产图：按当前镜头已绑定背景资产顺序展示

角色图：

- 优先 `character.design_sheet_url`
- 否则回退 `character.avatar_url`

返回字段包含：

- `reference_images`（仅用于预览展示）
- `missing_references`

### 2. Preview behavior

视频 preview 继续返回：

- `source_image_url`
- `final_prompt`

并新增：

- `reference_images`
- `missing_references`

前端在视频确认弹窗中展示这些角色参考图和背景资产图。

### 3. Seedance generation behavior

当模型为 `seedance-1.5-pro` 时：

- 保留当前 `first_frame`
- 不追加额外 `reference_image`

原因：

- 当前官方文档中，`Seedance 1.5 Pro` 支持：
  - 文生视频
  - 图生视频（首帧 / 首尾帧）
  - 音频
- 额外 `reference images 1-4` 能力对应 `Seedance Lite I2V`，不是 `Seedance 1.5 Pro`

因此视频确认弹窗里的参考图在 `Seedance 1.5 Pro` 模式下只作为人工确认素材，不作为 API 请求参数直接上传。

当模型不是 Seedance 时：

- 维持原逻辑

## Acceptance criteria

- 视频确认弹窗可看到当前镜头的角色参考图和背景资产图
- `Seedance 1.5 Pro` 生成请求只发送首帧，不再因额外参考图触发不兼容的 `r2v` 错误
- 没有角色设定图时回退头像图，不报错
- 没有任何角色参考图时继续可生成
