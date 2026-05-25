# 镜头手动上传首帧

## User goal

用户在生成视频前，可以直接为当前镜头上传一张首帧图，而不是必须先调用图像模型生成首帧。

上传后的首帧需要立即参与：

- 右侧镜头详情预览
- 首帧历史
- 视频生成时的 `first_frame` 输入

## Workflow

1. 用户在工作台右侧 `镜头详情 -> 首帧图` 区块点击 `上传首帧`
2. 前端通过现有 `/api/oss/upload` 上传图片到 OSS
3. 前端调用新的镜头接口，把上传后的 OSS 路径设为当前首帧
4. 后端：
   - 更新当前镜头的 `thumbnail_url / thumbnail_preview_url`
   - 新建一条 `storyboard_media_generations` 记录，类型为 `cover`
   - 将该记录设为当前首帧版本
5. 前端刷新当前镜头和首帧历史，用户可以直接继续生成视频

## API

新增：

- `POST /api/storyboards/:id/upload-cover`

请求体：

```json
{
  "thumbnail_url": "/generated/uploads/xxx.png"
}
```

响应体沿用媒体变更结构：

```json
{
  "storyboard": {},
  "media_generations": []
}
```

## UI

工作台右侧 `首帧图` 区块新增：

- `上传首帧`
- 隐藏文件选择器，仅接受 `image/*`

第一版不新增：

- 首帧裁剪
- 拖拽排序
- 从本地视频抽帧

## Notes

- 手动上传首帧不经过大模型，不消耗图像模型额度
- 第一版直接复用原图作为 `thumbnail_preview_url`
- 如果后续需要更小的缩略图，可再补专门的预览图生成

## Acceptance criteria

- 用户可为任意镜头上传首帧图
- 上传后无需刷新页面，当前镜头首帧立即可见
- 上传后会出现在首帧历史里，并成为当前版本
- 生成视频时，若开启 `使用当前首帧`，会使用这张手动上传的图片
