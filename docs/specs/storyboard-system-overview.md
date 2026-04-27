# Storyboard System Overview Spec

## Summary
Storyboard System 是一个面向个人创作流程的 AI 漫剧分镜制作系统。系统从剧本/脚本文本出发，完成项目、章节、场景、镜头的结构化管理，并串联角色资产、场景资产、镜头封面、单镜头视频、场景视频和项目总片的生成与播放。当前系统定位为“个人生产工具原型”，强调可用性、媒体生产闭环和快速迭代，而不是多用户 SaaS。

## Goals
- 支持从文本脚本快速生成章节、场景、镜头草稿。
- 支持在工作台中编辑和管理镜头结构化信息。
- 支持生成镜头封面、场景封面、角色封面、角色主设定图、角色主语音参考。
- 支持生成单镜头视频，并向场景视频、项目总片合成扩展。
- 支持角色和场景资产在后续封面/视频生成中作为参考输入。
- 支持媒体历史、当前版本切换和失败状态追踪。
- 支持媒体资源统一存储到 OSS，并通过签名 URL 对外访问。
- 保持本地开发 -> GitHub -> ECS 部署链路稳定可重复。

## Non-Goals
- 不做多用户协作、权限体系和组织管理。
- 不做完整商业化后台、运营系统或计费系统。
- 不承诺视频生成阶段精准对白、精准口型同步或高质量成片级后期。
- 不在当前阶段实现复杂时间线编辑器、专业剪辑器或大规模任务调度平台。

## System Scope
系统当前分为 6 个主要子域：
1. 项目与分镜结构管理。
2. 角色与资产库管理。
3. 图像生成链路。
4. 视频生成与合成链路。
5. 媒体存储与分发。
6. 部署与线上运行。

## Tech Stack
### Frontend
- React 18 + TypeScript
- Vite 6
- React Router 7
- Radix UI / shadcn 风格组件
- Tailwind CSS 4
- Lucide React
- Sonner（全局提示）

### Backend
- Go 1.25
- Gin
- MySQL
- go-sql-driver/mysql
- joho/godotenv

### Media / Infra
- Alibaba Cloud OSS 作为主媒体存储
- CDN / OSS 直链访问媒体
- ffmpeg 用于场景/项目视频合成和部分视频转码
- ECS 作为运行环境
- Nginx 作为前端静态资源和 API 反向代理入口

### AI / Model Providers
- 阿里云百炼 / DashScope
  - 图像生成：Qwen Image、Wan 2.7 Image Pro
  - 视频生成：Wan 2.7 I2V、Wan 2.6 I2V Flash（兼容保留）
  - 语音参考生成：Qwen Voice Design / TTS 链路
- 火山方舟
  - 脚本解析：Ark 大模型
  - 视频生成：Seedance 通道（当前生产实际跑的是兼容的 1.5 Pro 通道）

## Core Data Model
### Project
项目是创作的顶层容器，包含章节、角色、场景资产、项目总片等。

关键字段：
- `id`
- `name`
- `description`
- `status`
- `pinned_at`
- `deleted_at`
- `video_url`
- `video_preview_url`
- `video_status`
- `video_error`
- `video_duration`

### Chapter
章节归属于项目，包含场景列表。

### Scene
场景归属于章节，包含镜头列表、场景封面、场景视频。

关键字段：
- `title`
- `location`
- `time_of_day`
- `description`
- `cover_url`
- `cover_preview_url`
- `video_url`
- `video_preview_url`
- `video_status`
- `video_error`
- `video_duration`

### Storyboard
镜头归属于场景，是系统的核心生产单元。

关键字段：
- `shot_number`
- `sort_order`
- `content`
- `background`
- `camera_direction`
- `camera_motion`
- `shot_type`
- `mood`
- `style_preset`
- `style_notes`
- `dialogue`
- `notes`
- `duration`
- `thumbnail_url`
- `thumbnail_preview_url`
- `video_url`
- `video_preview_url`
- `video_status`
- `video_error`
- `video_duration`

### Character
角色归属于项目，作为镜头生成时的人物参考源。

关键字段：
- `name`
- `description`
- `avatar_url`
- `avatar_preview_url`
- `design_sheet_url`
- `design_sheet_preview_url`
- `voice_reference_url`
- `voice_reference_duration`
- `voice_reference_text`
- `voice_name`
- `voice_prompt`

### Asset
资产归属于项目，可选关联角色。

关键字段：
- `name`
- `type`
- `description`
- `file_url`
- `thumbnail_url`
- `cover_url`
- `meta_json`

### StoryboardMediaGeneration
记录镜头级封面/视频历史。

关键字段：
- `storyboard_id`
- `media_type` (`cover` / `video`)
- `model`
- `status`
- `result_url`
- `preview_url`
- `source_url`
- `error_message`
- `is_current`
- `meta_json`
- `deleted_at`

## Current Functional Scope
### 1. Script Import
- 支持文本剧本导入。
- 后端调用 Ark 模型解析脚本，生成章节、场景、镜头草稿。
- 导入页支持结构预览、进度展示和错误提示。

### 2. Workspace
- 支持章节/场景树浏览。
- 支持镜头网格视图与列表视图切换。
- 支持镜头详情编辑。
- 支持插入镜头、删除镜头、保存修改。
- 支持场景级操作：生成场景封面、批量生成镜头封面、生成场景视频、播放场景视频。
- 支持项目级操作：生成总片、播放总片。

### 3. Asset Library
- 支持角色资产与场景资产两类切换。
- 右侧详情抽屉支持拖拽宽度。
- 角色支持：
  - 上传/生成角色封面
  - 生成主设定图
  - 生成主语音参考
  - 展示是否已有主设定图 / 角色语音标识
- 场景资产支持：
  - 上传图片
  - 生成封面
- 项目列表支持：
  - 删除项目
  - 置顶/取消置顶
  - 重命名项目

### 4. Cover Generation
当前支持以下封面生成入口：
- 镜头封面
- 场景封面
- 角色封面
- 角色主设定图
- 场景资产封面

共性特征：
- 生成前可预览模型、参数、提示词。
- 支持参考图优先策略。
- 生成成功后自动保存原图和 WebP 缩略图。
- 支持封面历史、设为当前、删除历史。

### 5. Video Generation
#### Storyboard Video
- 支持镜头级视频生成。
- 当前支持的视频模型入口：
  - Wan 2.7 I2V
  - Wan 2.6 I2V Flash（兼容保留）
  - Seedance（当前生产为兼容通道，不等于真实 2.0 模型 ID）
- 生成前支持预览详细参数和最终 prompt。
- 支持历史版本、设为当前、删除历史。

#### Scene Video
- 对同一场景下成功镜头视频按顺序合成。
- 支持重新合成。
- 支持场景视频播放弹窗和打开原视频。

#### Project Video
- 对项目内场景视频进一步合成项目总片。
- 支持总片播放弹窗和打开原视频。

### 6. Voice Reference
- 角色支持通过 AI 生成主语音参考。
- 生成结果绑定到角色，用于后续对白/音频驱动链路。
- 当前系统已落角色级语音参考字段与生成入口。
- 未来可扩展到 `dialogue -> TTS -> Seedance 音频输入`。

## Media Storage Strategy
### Current Strategy
- 主媒体存储：OSS
- OSS 访问：签名 URL
- 数据库内继续保存业务稳定路径或逻辑映射，不直接依赖某个固定 CDN 域名作为主数据。

### Image Strategy
- 原图保留
- 同时生成 preview 图（WebP）
- 列表/卡片优先读取 preview
- 放大/全屏读取原图

### Video Strategy
- 当前统一不再额外生成 preview mp4
- `video_preview_url` 逻辑上直接回退到 `video_url`
- CDN 用于解决分发速度，减少因二次压缩带来的画质损失

## AI Generation UX Rules
- 所有关键 AI 生成入口在真正调用前，均应尽量支持“参数 + prompt 预览 + 二次确认”。
- 失败记录应保留在历史中，便于排障和追溯。
- 生成中的状态必须在历史或详情中有可见反馈。
- 若生成链路依赖已有参考图/封面/语音参考，应在弹窗中明确展示来源。

## Deployment Workflow
标准工作流：
1. 本地开发。
2. 本地提交到 GitHub `main`。
3. ECS 由 `admin` 用户执行 `scripts/deploy.sh`。
4. 部署脚本完成：
   - `git pull --ff-only`
   - 前端 build
   - 后端 build
   - 重启后端进程
   - smoke test

重要约束：
- 不直接在 ECS 上手改业务代码作为主流程。
- 生产变更以本地仓库为源头。

## Known Constraints
- 当前系统主要面向单人使用。
- 角色一致性和视频对白仍在持续演进中。
- Seedance 入口名与真实生产模型通道目前尚未完全一致，需要后续校正。
- 媒体生成失败场景依赖历史记录和后端日志排查，不是完整任务平台。
- 自动化测试体系较弱，当前依赖人工验证和线上 smoke test。

## Next Recommended Specs
建议后续按模块拆分详细 spec：
1. `character-voice-reference.md`
2. `seedance-audio-driven-video.md`
3. `project-video-composition.md`
4. `media-storage-and-cdn.md`
5. `script-import-ark-workflow.md`
6. `prompt-preview-and-confirmation.md`

## Acceptance Snapshot
截至当前版本，系统已具备以下闭环：
- 文本导入 -> 项目结构生成
- 角色/资产管理 -> 封面生成
- 镜头封面 -> 镜头视频 -> 场景视频 -> 项目总片
- 媒体 OSS 存储与线上访问
- GitHub -> ECS 标准部署

该系统当前应被定义为：
> 已完成核心生产闭环的个人创作型 AI 漫剧分镜工具，而不是多用户商业化 SaaS 产品。
