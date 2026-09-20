# 视频生成超时与续查

## Summary

视频云端任务的等待窗口耗尽不再记为失败，而是落可续查的 `timeout` 态；前端提供“继续等待任务结果”入口，凭已持久化的云端任务 ID 续查到终态，避免把实际成功的任务误判掉。

## User Goal

用户发起一次视频生成后，如果后端等待窗口先耗尽，任务在云端可能仍在执行并最终成功。之前这种 Case 会被记为失败，用户只能重新提交（重复扣费），而云端成功的结果被丢弃。

## Scope

本次包含：

- `GENERATION_STATUS.TIMEOUT = 'timeout'`（前后端常量）。
- `VideoTimeoutError`：携带云端 `taskId` 的超时错误；Wanx 等待窗口耗尽抛它而非普通 Error；Seedance 无限轮询改为同窗口有界等待，耗尽抛它。
- 万相提交任务后持久化 `provider_task_id`（此前只有 Seedance 持久化）。
- `sceneVideo.resumeVideoGeneration` / `storyboardVideo.resumeVideoGeneration`：凭 `provider_task_id` 续查到终态，成功走与初次生成同一落库路径。
- `POST /api/scenes/:id/resume-video`；前端超时态展示 + “继续等待任务结果”按钮。

本次不包含：

- storyboard 侧 controller/路由（其 `generateVideo` 本来就没有路由，resume 只做到 service 层）。
- 封面图等其他生成通道的超时语义（仍按原逻辑）。

## Current Problem

- Wanx：`deadline` 一到抛“视频生成任务超时”，catch 直接写 `FAILED`；云端任务可能几分钟后成功，结果丢失。
- Seedance：`while (true)` 永不超时，卡住即 promise 永久挂起，服务重启则丢失，DB 里 forever `GENERATING`。
- Wanx 的 `task_id` 只活在日志里，无法续查；前端只有“重新生成”（建新任务），没有“继续等之前那个”。

## Workflow

1. 生成提交后持久化 `provider_task_id` 到 generation `meta_json`。
2. 等待窗口耗尽 → 抛 `VideoTimeoutError` → service 落 `timeout` 态（不清空已有可播放地址，不记失败）。
3. 用户在超时提示上点“继续等待任务结果” → `POST /scenes/:id/resume-video`。
4. 后端按 `model` 选择对应 provider 轮询器续查：
   - 成功 → 同一 `applySucceededVideoGeneration` 落库 → `succeeded`。
   - 再次超时 → 回到 `timeout`，可重复续查。
   - 云端明确失败 → `failed`。
5. `generating` 态的记录拒绝续查（后台仍在等待，直接返回现状）。

## Data Shape

涉及实体、字段、状态：

- Scene / Storyboard: `video_status` 新增 `'timeout'`（VARCHAR 长度足够），`video_error` 存超时文案。
- SceneMediaGeneration / StoryboardMediaGeneration: `status` 新增 `'timeout'`；`meta_json.provider_task_id` 为续查凭证（Wanx 新增）。
- Entity:
  - `GENERATION_STATUS.TIMEOUT`

## UI States

- 默认态：无变化。
- 超时态：预览区红色提示盒，标题“视频生成超时，任务可能仍在云端执行” + 错误文案 + “继续等待任务结果”按钮。
- 续查中：按钮置灰“正在继续等待…”，走已有 5s 轮询自动刷新。
- 成功态：续查成功后与正常生成一致（视频可播、海报、置顶）。
- 失败态：云端明确失败才显示原失败盒。

## API Changes

- `POST /api/scenes/:id/resume-video`（body 可选 `generation_id`，不传取最近一条视频记录）
  - `=> { code: 200, data: { scene, resumed: boolean }, message: "" }`
  - `resumed: false` 表示任务仍在等待（generating）或再次超时；仍抛错表示记录不可续查。

## Persistence / Async Tasks

说明：

- 无表结构变更；状态值新增 `'timeout'`，落在既有 VARCHAR 列。
- 长任务状态流转：`generating → timeout → generating → succeeded|timeout|failed`。
- 错误记录：超时文案写入 `video_error` / `error_message`，与失败区分。
- 重试方式：续查复用同一云端任务（不重复扣费）；重新生成仍走原入口（建新任务）。

## Failure and Retry

- 续查窗口再次耗尽：回到 `timeout`，用户可再次点击继续等待。
- 续查时云端返回明确失败：落 `failed`，与普通失败一致展示。
- 续查记录缺少 `provider_task_id`（超时语义上线前遗留的老记录）：明确报错“无法继续等待，请重新生成”。

## Acceptance

- [ ] Wanx 超时后 DB 为 `timeout` 而非 `failed`，且 `meta_json` 内有 `provider_task_id`。
- [ ] Seedance 长时间无终态会停轮询落 `timeout`，不再无限挂起。
- [ ] 超时后点“继续等待”，云端成功则视频落库可播；云端仍在跑则保持可续查。
- [ ] 后端 `npm run typecheck && npm run lint && npm run test` 通过；前端 `typecheck + lint + build` 通过。
