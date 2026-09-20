# 生成类接口限流与并发幂等

## Summary

AI 计费接口与重 CPU 接口加滑动窗口限流；所有生成入口加原子抢占，并发双击只有一笔真正开工，输家返回进行中的现状而不建新任务。

## User Goal

用户（或脚本）连点/重试时，不应产生重复的计费任务与重复的 ffmpeg 合成；恶意刷接口应被挡在业务之前。

## Scope

本次包含：

- `rateLimit` 中间件：内存滑动窗口，三档规则，失败开路，429 + 统一错误体 + `Retry-After`。
- 9 处原子抢占：scene/storyboard 视频、project/scene 合成、scene/storyboard/asset 封面、角色设定图、角色语音。
- `config.proxy = true`（nginx 后取真 IP）；`.env.example` 文档化阈值。

本次不包含：

- `import-script` 的原子守卫（无线状态字段可查，限流覆盖即可）。
- 精确跨 worker 限流（内存桶 per-worker，近似但有界；要精确需 MySQL 存窗口）。

## Current Problem

- 计费接口（视频/封面/语音/脚本解析）与重 CPU 接口（合成）零限流。
- scene 视频的 `GENERATING` 守卫是先查后写，并发可同时通过；封面三处完全无守卫。

## Workflow

1. 请求先过 `rateLimit`：命中规则且超窗 → 429；计数器异常 → 放行。
2. 生成入口先原子抢占：
   - 父表有状态列 → 条件 `UPDATE ... WHERE status != 'generating'`，看 `affectedRows`。
   - 守卫在子表（封面 generation 行）→ 事务锁父行后复查。
3. 输家返回现状（前端已有轮询会继续等赢家的任务）；赢家建 generation 行失败时回滚抢占为失败态。

## Data Shape

无表结构变更。复用既有状态列（`video_status`、`cover_status`、`design_sheet_status`、`voice_reference_status`）与 generation 行状态。

## UI States

无前端改动：输家返回的结构与赢家一致，前端轮询逻辑不变。

## API Changes

无新增 API。超限时 HTTP 429 + `{ code: 0, data: null, message: '请求过于频繁，请稍后再试' }` + `Retry-After` 秒数。

## Persistence / Async Tasks

- 抢占与建行之间崩溃：赢家建 generation 行失败会把状态回滚为失败，避免烂在 generating。
- 封面事务只锁父行做复查，不持有长事务；模型调用仍在事务外。

## Failure and Retry

- 限流误伤：调大对应 env 阈值后重启。
- 输家被返回进行中但赢家随后失败：前端轮到失败态，用户可重试（与原来一致）。

## Acceptance

- [ ] 同一生成接口 10 分钟内超限返回 429 + `Retry-After`。
- [ ] 并发双击只产生一个云端任务 / 一次合成（看 generation 行数与账单）。
- [ ] 后端 `npm run typecheck && npm run lint && npm run test` 通过。
