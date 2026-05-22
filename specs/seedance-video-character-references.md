# Seedance 视频角色参考图

## User goal

在使用 Seedance 生成镜头视频时，除了首帧图，还要把当前镜头关联角色的三视图/角色设定图作为参考图一并传入，降低角色形象漂移。

## Scope

本阶段只处理：

- `backend-node` 视频 preview
- `backend-node` Seedance 视频实际生成
- `storyboard-app` 视频确认弹窗中的角色参考图展示

不处理：

- Go 后端
- Wanx 视频多参考图
- 场景资产参考图视频输入

## Design

### 1. 参考图来源

按当前镜头关联角色顺序，最多取前 2 个角色：

- 优先 `character.design_sheet_url`
- 否则回退 `character.avatar_url`

返回字段包含：

- `reference_images`
- `missing_references`

### 2. Preview behavior

视频 preview 继续返回：

- `source_image_url`
- `final_prompt`

并新增：

- `reference_images`
- `missing_references`

前端在视频确认弹窗中展示这些角色参考图。

### 3. Seedance generation behavior

当模型为 `seedance-1.5-pro` 时：

- 保留当前 `first_frame`
- 追加角色参考图为 `content` 中的 `image_url`
- `role` 使用 `reference_image`

当模型不是 Seedance 时：

- 维持原逻辑

## Acceptance criteria

- 视频确认弹窗可看到当前镜头将引用的角色参考图
- Seedance 生成请求除首帧外，还会带上角色参考图
- 没有角色设定图时回退头像图，不报错
- 没有任何角色参考图时继续可生成，只是不附加该输入
