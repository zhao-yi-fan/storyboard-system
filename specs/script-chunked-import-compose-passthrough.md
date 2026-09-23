# 小说导入自动分段与合成跳过转码

## Summary

超长小说自动按段落切分、逐段解析入库，不再要求用户手工切；合成视频时已是目标规格的输入跳过转码直接 concat。

## User Goal

几万字小说一次粘贴就能导完；项目合成时不对自家生成的同规格文件做无用功。

## Scope

本次包含：

- `splitScriptIntoChunks`：段落贪心打包，超长单段落硬切。
- `parseAndImport` 新增 `{ append }`：首段重建、后续段追加（`script_text` 拼接、角色按名复用）。
- `importScriptChunked`：分段循环、计数合计、角色跨段去重；controller 切到它。
- `matchesComposeTargetSpec`：ffprobe 预检（1280x720、24fps、h264+aac48k），命中跳过转码；探测失败/无音频流走原路径。

本次不包含：

- 断点续传 UI：中途失败已提交分段保留，重试即整篇重导（首段清空保证幂等）；要续传可对剩余分段调 `parseAndImport` 追加，需前端配合。
- 合成规格变更：目标规格仍是 1280x720/24fps。

## Current Problem

- 超 12000 字直接报错，用户手工切。
- 合成时每个输入都 scale+fps+转码，自家文件也被重转。

## Workflow

1. 导入：切分 → 首段重建 → 后续段追加 → 合计返回（含 `chunk_count`）。
2. 合成：物化输入 → 预检命中则直用，否则转码 → concat。

## Resume

分段失败时错误 `data` 带 `{ completed_chunks, total_chunks, skipped_chunks, text_hash }`，
成功返回也带 `text_hash`（文本 sha256）。前端"继续导入剩余分段"按钮原样回传文本 +
`resume_from_chunk = skipped + completed` + `text_hash`：

- 后端重切（确定性切分）后跳过前 N 段，全程 append 不再清空。
- 文本 hash 不一致直接拒绝（切分会对不上），提示重新完整导入。
- 已提交分段不重复计费；重试整篇重导仍可用（首段清空保证幂等）。

## Data Shape

无表结构变更。导入结果多 `chunk_count`；`parseAndImport` 结果多 `character_names`（供跨段去重）。

## UI States

无前端改动（导入页忽略结果计数，类型已同步 `chunk_count`）。

## API Changes

- `POST /projects/:id/import-script` 返回加 `chunk_count`；行为：超长自动分段。

## Persistence / Async Tasks

- 每分段独立事务；失败回滚当段，已提交分段保留。
- 合成仍是同步长任务（见限流/幂等 spec）。

## Failure and Retry

- 某段解析失败：整请求抛错，已提交分段保留；重试整篇重导（首段清空），会重复计费剩余分段——长篇失败重试成本见 spec 后续项。
- 预检/转码失败：回退原路径，不挡合成。

## Acceptance

- [ ] 3 万字小说一次导入成功，章节数 ≈ 手工分段之和。
- [ ] 同规格输入合成跳过转码（看日志/耗时），异规格照常转码。
- [ ] 后端 `npm run typecheck && npm run lint && npm run test` 通过；前端 typecheck+lint 通过。
