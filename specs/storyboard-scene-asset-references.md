# 镜头背景资产引用

## User goal

在工作台的镜头详情中，用户可以为当前镜头手动添加或删除场景背景资产，并让这些背景资产在视频生成时作为真实参考图传给模型。

## Workflow

1. 用户在镜头详情里查看当前已关联的背景资产。
2. 用户点击 `管理背景资产`。
3. 在弹窗里从当前项目的场景/背景资产库中选择加入，或移除已绑定资产。
4. 视频生成预览弹窗展示本次会实际传入的：
   - 首帧图
   - 背景资产参考图
   - 角色参考图
5. Seedance 视频生成时，把背景资产图和角色图一起作为 `reference_image` 传入。

## Data shape

- `storyboard_asset_usages`
  - `storyboard_id`
  - `asset_id`
  - `usage_type = scene_background`

- `Storyboard`
  - `assets?: Asset[]`
  - `asset_names?: string[]`

## UI states

- 详情抽屉：
  - 显示已绑定背景资产 badge
  - 支持直接删除
  - 支持打开管理弹窗

- 管理弹窗：
  - 显示当前镜头已绑定资产
  - 显示当前项目可用背景资产
  - 支持加入镜头和移除

- 视频预览弹窗：
  - 在 `参考图输入` 区块展示背景资产和角色参考图
  - 若缺失背景资产或角色参考图，显示缺失提示

## Acceptance criteria

- 镜头详情中可以手动添加和删除背景资产
- `GET /api/storyboards/:id` 和镜头列表返回里包含背景资产信息
- Seedance 视频 preview 会展示背景资产参考图
- Seedance 实际视频生成会把背景资产图一起传入
