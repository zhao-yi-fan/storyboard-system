# <Feature Name>

## Summary

一句话说明改动目标和影响流程。

## User Goal

用户想完成什么事，当前为什么不够好。

## Scope

本次包含：
-

-

本次不包含：
-

-

## Current Problem

当前行为、限制、错误点或缺失能力。

## Workflow

1.
2.
3.

## Data Shape

涉及实体、字段、状态：

- Entity:
  - `field`
  - `field`

## UI States

如果涉及前端：

- 默认态
- 加载态
- 空态
- 成功态
- 失败态
- 重试态
- 历史/当前版本态

如果不涉及前端：

- 无前端交互或界面状态改动

## API Changes

- `GET /...`
- `POST /...`

如果没有：

- 无新增或修改 API

## Persistence / Async Tasks

说明：

- 数据库字段变化
- 长任务状态流转
- 错误记录
- 重试方式
- 历史版本策略

如果没有：

- 无数据库或异步任务变更

## Failure and Retry

-
-

## Acceptance Criteria

-
-
-

## Validation

- Frontend: `cd storyboard-app && npm run build`
- Backend: `cd backend-node && npm run test`
- Manual:
  -
