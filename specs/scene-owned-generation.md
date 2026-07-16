# 片段级生成与镜号 Prompt

## Summary

片段（数据库 `Scene`）是一次封面和视频生成的唯一业务实体。镜号只存在于片段 Prompt 中，不再作为可独立生成的 Storyboard 层级展示或写入。

## User Goal

创作者选择一个片段后，直接编辑包含多个镜号的 Prompt、绑定参考资产并生成一个片段视频，避免“分镜生成视频、视频 Prompt 内又有多个镜头”的重复层级。

## Scope

本次包含：

- 片段级 Prompt、角色引用、资产引用、封面、视频和媒体历史。
- 每个可见的历史 Storyboard 幂等提升为一个独立片段，并携带自己的 Prompt、引用和媒体历史。
- 剧本解析直接生成片段和片段内镜号 Prompt。
- Workspace 隐藏并停止创建 Storyboard。

本次不包含：

- 立即物理删除历史 Storyboard 表和旧兼容接口。
- 将 Prompt 内镜号恢复为可独立生成的视频实体。

## Workflow

1. 用户选择集和片段。
2. 在片段 Prompt 中编写或调整多个 `镜号：N`。
3. 使用 `@` 为片段绑定角色、场景或道具参考。
4. 保存片段 Prompt，设置时长、分辨率和音频。
5. 预览并生成一次片段封面或片段视频。
6. 在片段级历史中切换或删除版本。

## Data Shape

- `scenes.prompt`: 完整片段 Prompt，最多 10,000 字符。
- `scenes.generation_duration`: 当前片段生成时长。
- `scene_characters`: 片段角色引用。
- `scene_asset_usages`: 片段资产引用。
- `scene_media_generations`: 片段封面和视频历史。
- `storyboards`: 迁移后只作为 legacy 审计数据，不承接新写入。

## UI States

- 默认态：片段列表、当前片段视频、参考区和 Prompt 编辑器。
- 空态：当前集没有片段，提供新建片段入口。
- 加载态：片段详情或历史加载中。
- 生成态：当前片段持续显示生成状态。
- 失败态：片段保存或生成失败时显示持久错误。
- 历史态：片段封面和视频历史可切换当前版本。

## API Changes

- `GET /api/scenes/:id/media-generations`
- `POST /api/scenes/:id/media-generations/:generationId/set-current`
- `DELETE /api/scenes/:id/media-generations/:generationId`
- `GET /api/scenes/:id/video-generation-preview`
- `POST /api/scenes/:id/generate-video`
- `POST /api/scenes/:id/upload-cover`
- `POST/DELETE /api/scenes/:id/characters`
- `POST/DELETE /api/scenes/:id/assets`

## Persistence / Async Tasks

- 启动迁移只拆分和提升数据，不删除 Storyboard。
- 已删除片段下遗留的孤儿 Storyboard 不恢复为可见片段。
- 原场景下有多个 Storyboard 时，第一个复用原 Scene，其余每个 Storyboard 新建一个 Scene。
- 新片段顺序按原场景顺序、原 Storyboard 顺序展开。
- 每个新片段只获得对应 Storyboard 的 Prompt、角色、资产、封面、视频和媒体历史。
- 原场景级 ffmpeg 合成视频不作为任何拆分片段的历史版本。
- 新生成任务和结果只写入片段字段及片段媒体历史。

## Failure and Retry

- Prompt 超过 10,000 字符时拒绝保存和生成。
- 片段缺少 Prompt 时拒绝生成。
- 旧 Storyboard 没有成功视频时，对应片段保持无视频或失败状态，可单独重新生成。
- 旧数据迁移使用时间戳和唯一 legacy generation id 保证幂等。

## Acceptance Criteria

- Workspace 不展示分镜层级和分镜数量。
- 新建片段后不新增 Storyboard 记录。
- 每个片段只产生一个当前视频，镜号仅存在于 Prompt。
- 每个旧 Storyboard 都对应一个独立片段，已有 Prompt、引用、封面和媒体历史不会与其他 Storyboard 混合。
- 项目总片继续按片段顺序合成。

## Validation

- Repo: `npm run check:spec:working`
- Backend: `cd backend-node && npm run build && npm run test`
- Frontend: `cd storyboard-app && npm run build`
