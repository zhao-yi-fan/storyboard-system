# 资产需求同步与工作台主题统一

## Summary

资产需求按集与项目级角色、场景、道具实体持续对账，并将 Workspace 统一到资产库的黑灰底、紫色强调视觉体系。

## User Goal

用户按集查看资产需求时，看到的清单必须反映当前分镜和项目资产，不因历史回填、改名或删除产生漏项和悬空项；资产库与工作台应属于同一套产品视觉。

## Scope

本次包含：

- 增加可重复执行的 `syncAssetRequirements(projectId, chapterId)`。
- 读取资产需求前增量同步角色、场景和道具需求。
- 修复缺失、重复、悬空绑定和媒体状态漂移。
- 统一 AssetLibrary 与 Workspace 的页面级颜色变量和 Workspace 关键区域配色。

本次不包含：

- 集级角色换装或场景版本覆盖。
- 修改现有项目资产、个人资产和版本 API 契约。
- 修改 Workspace 布局或生成业务。

## Current Problem

历史回填只在项目完全没有需求时执行，部分漏记无法修复；项目资产改名或删除后需求可能继续显示旧快照或悬空。Workspace 使用亮灰蓝背景和青绿色强调，而资产库使用黑灰背景和紫色强调，视觉不统一。

## Workflow

1. 用户进入资产确认页并选择某一集或全部资产。
2. 后端锁定项目并从当前分镜角色关联、片段场景和道具关联计算期望需求。
3. 后端更新已有需求、插入缺失需求、合并重复需求并软删除不再存在的角色/场景需求。
4. 前端展示同步后的按集清单；多集仍可共享同一个项目资产。
5. 用户进入 Workspace 时看到与资产库一致的黑灰底和紫色交互强调。

## Data Shape

涉及实体、字段、状态：

- `asset_requirements`：`project_id`、`chapter_id`、`kind`、`name`、`description`、`linked_entity_type/id`、`source_count`、`status`。
- `characters` / `assets`：仍为项目级实体，可被多个按集需求引用。
- `asset_versions`：继续保存项目资产版本，不新增集级版本字段。

## UI States

- Workspace 默认态、选中态、加载态、失败态和弹窗统一使用黑灰表面与紫色强调。
- 图片、视频和生成状态行为不变。

## API Changes

- 无新增或修改 API。
- `GET /projects/:id/asset-requirements` 在返回前执行幂等同步。

## Persistence / Async Tasks

- 同步以项目行锁串行执行，同一输入重复执行不会新增重复需求。
- 有媒体的需求状态为 `generated`，已经确认且媒体仍存在时保留 `confirmed`。
- 没有媒体时保留 `generating` / `failed`，其他状态回到 `pending`。
- 解析产生但尚未绑定到分镜的道具需求保留；已删除实体会按同名项目资产重绑或创建空项目资产。

## Failure and Retry

- 同步过程使用事务，失败时回滚，不返回半同步结果。
- 资产生成失败状态和错误信息保留，用户可继续单项重试。
- 项目不存在或指定集不属于项目时返回明确错误。

## Acceptance Criteria

- 部分已有需求的项目仍能补齐遗漏的角色和场景需求。
- 对同一项目和集连续同步两次，需求数量和绑定保持稳定。
- 已删除角色/场景不会留下可用状态的悬空需求。
- 多集可以分别显示需求，但共享同一个项目资产实体。
- Workspace 与 AssetLibrary 使用同一套页面颜色变量，主强调色一致。

## Validation

- Frontend: `cd storyboard-app && npm run build`
- Backend: `cd backend-node && npm run build && npm run test`
- Spec guard: `npm run check:spec:working`
- Manual:
  - 打开已有部分需求的项目，确认缺失项自动补齐且刷新不重复。
  - 对比资产库与 Workspace 的背景、面板和主操作颜色。
