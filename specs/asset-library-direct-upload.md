# 资产库上传链路

## User goal

在资产库中手动上传角色头像或场景资产图片时，上传流程应稳定工作，不依赖 OSS bucket 的浏览器跨域配置。

## Current problem

- 浏览器直接 `PUT` OSS 时，会触发预检请求
- 如果 OSS bucket 未放开当前站点的 `PUT` 跨域，浏览器会报 `TypeError: Failed to fetch`
- 即使签名 URL 正常，只要 bucket CORS 没配好，公网环境仍然会失败

## Design

- 前端改为以 `multipart/form-data` 调用 `/api/oss/upload`
- Node 后端接收文件流并上传到 OSS
- 上传成功后，后端返回 `public_url` 与 `object_key`
- 前端上传后必须检查响应状态和业务返回值

## Acceptance criteria

- 新建角色资产上传头像可成功
- 新建场景资产上传图片可成功
- 浏览器不再依赖 OSS `PUT` 跨域配置
