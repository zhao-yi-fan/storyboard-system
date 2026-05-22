# 资产库直传 OSS

## User goal

在资产库中手动上传角色头像或场景资产图片时，浏览器可以直接把文件上传到 OSS，然后正常创建资产记录。

## Current problem

- 前端会先请求 `/api/oss/sign`
- 再浏览器 `PUT` 到 `upload_url`
- 如果后端签名使用的是 OSS 内网 endpoint，浏览器无法访问，会报 `TypeError: Failed to fetch`

## Design

- Node 后端 `/api/oss/sign` 必须使用 **public OSS endpoint** 生成上传签名 URL
- 前端上传后必须检查 `response.ok`
- 上传失败时给出明确错误，而不是静默继续

## Acceptance criteria

- 新建角色资产上传头像可成功
- 新建场景资产上传图片可成功
- 浏览器不再因为内网 OSS 域名导致 `Failed to fetch`
