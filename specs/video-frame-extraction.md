# 视频版本前端抽帧与跨片段参考

## Summary
允许用户从任意生成成功的视频历史版本中截取图片或视频。确认图片保存为该视频版本的附属抽帧并绑定为片段视觉参考；截取视频保存为当前片段的一条新视频历史版本。

## User Goal
用户希望复用上一段视频中的人物状态、构图和环境，维持相邻片段的视觉连续性，同时避免为时间轴缩略图和未确认画面产生 OSS 存储。

## Scope
本次包含：
- 浏览器内视频拖动、播放、缩略图采样和 Canvas 抽帧。
- 仅上传用户确认的一张高清帧。
- 将抽帧绑定到本片段或同集下一片段。
- 抽帧进入 Seedream 首帧参考和 Seedance 参考素材模式。
- 选择至少 4 秒的视频区间，并将服务端裁剪结果保存到视频版本列表。

本次不包含：
- 抽取视频片段或批量上传缩略图。
- 自动将抽帧设为片段首帧。
- 跨章节绑定或修改用户 Prompt。

## Workflow
1. 用户从当前视频或任意成功历史版本打开“抽帧”。
2. 浏览器加载视频 Blob，用户播放或拖动到 0.1 秒精度的时间点。
3. 浏览器使用 Canvas 生成临时 WebP 预览；关闭弹窗时释放全部 Blob URL。
4. 用户选择“插入本片段”或“插入下一片段”。
5. 前端仅上传当前确认帧，后端保存来源版本和目标片段绑定。
6. 目标片段后续生成时将该帧作为 `video_frame` 视觉参考。
7. 用户切换到“截取视频”，通过双滑块选择开始和结束时间。
8. 后端校验区间并使用 ffmpeg 裁剪，成功后新增一条非当前视频历史版本。

## Data Shape
- `scene_video_frames`
  - `project_id`
  - `source_scene_id`
  - `source_generation_id`
  - `timestamp_ms`
  - `file_url`
  - `preview_url`
- `scene_video_frame_usages`
  - `frame_id`
  - `target_scene_id`
  - `usage_type`

## UI States
- 视频加载中、缩略图采样中、可播放/拖动状态。
- 跨域或 Canvas 不可用的持久错误。
- 上传保存中、保存成功和保存失败。
- 无下一片段时禁用“插入下一片段”并说明原因。
- 视频模式显示开始、结束和区间时长，不足 4 秒时阻止保存。

## API Changes
- `GET /api/scenes/:sceneId/media-generations/:generationId/frames`
- `POST /api/scenes/:sceneId/media-generations/:generationId/frames`
- `DELETE /api/scenes/:sceneId/media-generations/:generationId/frames/:frameId`
- `POST /api/scenes/:sceneId/media-generations/:generationId/clips`

## Persistence / Async Tasks
- `(source_generation_id, timestamp_ms)` 唯一，同一 100ms 时间点复用已有记录。
- 只有确认帧上传 OSS；预览和缩略图只存在浏览器内存。
- 数据库写入失败时删除本次已上传对象。
- 删除时解除目标绑定并软删除抽帧；已启动生成任务不受影响。
- 截取视频复用 `scene_media_generations`，记录来源版本、起止时间和真实时长。

## Failure and Retry
- 来源视频必须为成功状态且存在结果 URL。
- 图片仅允许 WebP、JPEG、PNG，最大 10MB。
- 来源和目标片段必须属于同一项目，下一片段必须属于同一章节。
- 时间点必须处于视频有效时长内。
- 视频截取区间必须位于来源视频内且不少于 4 秒。
- 浏览器无法读取视频或 Canvas 被跨域污染时不上传、不写库，可重新打开重试。

## Acceptance Criteria
- 15 秒视频最多产生 30 张临时缩略图，关闭弹窗后释放 Blob URL。
- 任意成功历史版本均可抽帧，不要求先设为当前。
- 保存后来源版本显示抽帧数量，目标片段的真实参考图展示抽帧来源和时间点。
- 抽帧计入 Seedance 9 张限制；指定首帧模式下进入已排除参考列表。
- 最后一个片段不能绑定到下一片段。
- 截取视频成功后出现在视频历史列表，但不自动切换为当前版本。

## Validation
- Frontend: `cd storyboard-app && npm run build`
- Backend: `cd backend-node && npm run build && npm run test`
- Repo: `npm run check:spec:working`
