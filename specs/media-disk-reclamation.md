# 生成物磁盘回收

## Summary

用户删除历史版本时同步删除不再被引用的文件；每日凌晨巡检本地盘，删除超过保留期且无任何数据行引用的孤儿文件。被顶替的旧版本不自动删（历史可回放）。

## User Goal

生成物只增不减会撑爆 ECS 磁盘。用户明确丢弃的版本应立即释放空间；崩溃残留（先落盘、没写库）应被巡检捡走；还能回放的历史版本一个不动。

## Scope

本次包含：

- `reclaimGeneratedPaths`：删前做全表引用检查（两 generation 表 + scenes/storyboards/characters/assets），只认未软删除的行；逐个 best-effort，失败只记日志。
- 用户删 history（scene `remove`、storyboard `deleteMediaGeneration`）末尾接回收。
- `app/schedule/reclaim_media.ts`：每天 03:00 单 worker 扫本地盘，默认保留 24 小时、单次上限 500 个。

本次不包含：

- 被置顶顶替的旧版本自动删除（历史支持 set-current 回放，删了等于破坏功能；要做需另定保留策略）。
- OSS 模式巡检（bucket 可能混有非本应用对象，不敢按前缀全扫；用户删除链路的 OSS 单文件删除正常工作）。
- 已软删除整行（scene/角色/资产）的级联清盘（引用检查认有效行，被删实体的文件由巡检按孤儿处理）。

## Current Problem

- 删除 history 只做 softDelete，文件永久残留。
- `deleteGeneratedAsset` 只被帧截取临时文件使用。
- store 落盘与 DB 更新之间崩溃会留下无主文件。

## Workflow

1. 用户删 history：softDelete → 回退/清空实体引用 → `reclaimGeneratedPaths`（有别的有效行引用则跳过）。
2. 每日巡检：递归本地生成物根目录 → mtime 超保留期 → 无引用 → 删除（dryRun 模式只列不清）。

## Data Shape

无表结构变更。引用检查覆盖的列见 `URL_COLUMNS`（`media_reclamation.ts`）。

## UI States

无前端改动。用户删 history 后对应文件即释放；历史回放不受影响。

## API Changes

无。

## Persistence / Async Tasks

- 回收失败不抛错，不影响删除接口主流程返回。
- 巡检异常只记日志；单次上限防止失控。

## Failure and Retry

- 误删防护三层：生成物路径校验（含 `..` 拦截，复用 `generatedObjectKey`）、有效行引用检查、24 小时保留期（进行中的上传/生成远短于此）。
- 清回收粒度：`RECLAIM_SWEEP_GRACE_HOURS`、`RECLAIM_SWEEP_MAX_FILES`。

## Acceptance

- [ ] 用户删 history 后，无别的引用的文件从磁盘消失；仍被实体引用的保留。
- [ ] 巡检 dry-run 列出的都是无主旧文件；新文件（保留期内）不动。
- [ ] 后端 `npm run typecheck && npm run lint && npm run test` 通过。
