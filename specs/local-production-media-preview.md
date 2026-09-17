# 本地预览生产媒体

## Summary

本地开发环境应能显示生产环境已存在的图片、音频和视频，同时继续支持无 OSS 配置时的本地 `storage/` 文件。

## User Goal

开发者使用本地前端和 Node 后端调试生产数据时，媒体资源不能因为本地缺少 OSS 签名配置而显示为碎图或不可播放视频。

## Workflow

1. 从 `backend-node/.env.example` 创建被 Git 忽略的本地 `backend-node/.env`。
2. 开发者通过团队认可的密码管理器或其他安全渠道配置本地 OSS、Seedream 等凭据；仓库不提供从生产服务器复制凭据的脚本。
3. 本地 `ALIYUN_OSS_ENDPOINT` 必须使用公网端点，不得使用仅 ECS 可达的 `*-internal.aliyuncs.com` 地址。
4. 重启 `backend-node`，API 将数据库中的 `/generated/**` 对象键转换成可访问的 OSS 签名 URL。
5. 生产 Nginx 将历史 `/generated/**` 请求代理到 Node 的媒体跳转入口；该入口校验对象键后跳转到新的 OSS 签名 URL，而不从 ECS 本地目录读取生产媒体。
6. 无 OSS 配置时，Node 直接从 `GENERATED_ASSET_DIR` 提供 `/generated/**`，Vite 将同路径代理到 Node。

## API Changes

- 不新增业务 API；媒体跳转入口仅用于兼容静态媒体路径。
- 本地开发服务器新增 `/generated/**` 代理。
- 生产新增内部媒体跳转入口 `/_media/redirect/:objectKey`，用于兼容直接访问的稳定媒体路径。

## Persistence / Async Tasks

- 不修改数据库中的媒体路径。
- OSS 与 Seedream 凭据只写入 git 忽略的本地 `.env` 或受控的本机密钥服务，不得提交到仓库或输出到终端。

## Failure and Retry

- 本地缺少必需的 OSS/Seedream 配置时，生成接口返回明确错误，不尝试从生产服务器读取凭据。
- Seedream 基础地址、模型、超时和角色版式参考可使用代码默认值或本地配置。
- OSS 不可用时，本地生成文件仍可通过 `/generated/**` 读取。

## Acceptance Criteria

- 生产可见的 `/generated/**` 图片和视频在本地 API 中返回有效签名 URL。
- 生产环境访问历史 `/generated/**` 图片和视频时，响应会跳转到有效的 OSS 签名 URL；对象不存在或路径非法时返回 404。
- 本地 `storage/` 文件可通过 Vite 的 `/generated/**` 地址读取。
- 本地生成文件可通过公网 OSS 端点上传；生产服务器仍可继续使用 OSS 内网端点。
- Git 状态和历史中不包含 OSS AccessKey、Secret、Seedream API Key、生产 IP、SSH 用户或生产环境文件路径。
- 本地安全配置并重启 Node 后，Seedream 再生成不再提示缺少 `SEEDREAM_IMAGE_API_KEY`。
- 图片、视频、音频现有数据库字段和生产部署行为不变。

## Validation

- Root: `npm run check:spec:working`
- Frontend: `cd storyboard-app && npm run build`
- Backend: `cd backend-node && npm run build && npm run test`
- Manual: 通过安全渠道配置本地环境，并探测一张授权图片和一段授权视频返回 `2xx`。
