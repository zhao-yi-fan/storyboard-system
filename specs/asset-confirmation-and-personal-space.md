# 剧内资产确认与个人空间

## Summary

建立“项目归属 -> 剧内资产确认 -> 按集资产需求 -> 版本确认 -> 个人空间 -> 跨剧导入/保存”的资产工作流。图片生成统一使用 Seedream，不再向用户暴露或回退到其他图片模型。

## User Goal

创作者导入剧本后，能按集确认角色、场景和道具需求，生成并选择可用版本，再进入分镜制作；可复用资产保存到个人空间，并以快照方式导入其他项目。

## Workflow

1. 用户创建项目，项目归属于当前登录账号。
2. 导入剧本后生成按集的角色、场景和道具需求，并进入资产确认页。
3. 用户按集并按人物、场景、道具分类查看需求，使用 Seedream 批量补齐缺失图片或单项重新生成。
4. 每次生成形成新版本；当前版本即实际采用版本，不再增加无业务作用的逐项确认操作。
5. 用户可把已确认资产保存到个人空间。
6. 用户可从个人空间导入资产到当前项目；导入结果是项目快照，不与源资产联动。
7. 旧项目首次进入资产确认页时，按现有分镜角色关联和场景封面幂等回填需求，不重新生成或覆盖媒体。

## Data Shape

- Project ownership: `projects.user_id`。
- Project name: 仅约束同一用户的有效项目名唯一；软删除项目和其他用户项目不占用名称。
- Asset requirement: `project_id`、`chapter_id`、`kind`、`name`、`description`、`status`、`linked_entity_type/id`。
- Asset version: `owner_user_id`、`scope_type`、`entity_type/id`、`file_url`、`model`、`prompt`、`status`、`is_current`。
- Personal asset: `user_id`、`kind`、`name`、`description`、媒体地址、来源项目和来源实体。

## UI States

- 资产准备页：加载、分类空需求、待生成、生成中、生成失败、可用。
- 个人空间：加载、空状态、导入中、导入成功、导入失败。
- 非项目所有者访问项目资源时显示无权限错误，不泄露项目内容。

## API Changes

- `GET /projects/:id/asset-requirements`
- `POST /projects/:id/asset-requirements/generate`
- `POST /asset-requirements/:id/confirm`
- `GET /personal-assets`
- `POST /personal-assets/:id/import-to-project`
- `POST /characters/:id/save-to-personal`
- `POST /assets/:id/save-to-personal`
- `GET /characters/:id/versions`、`GET /assets/:id/versions`
- `POST /characters/:id/versions/:versionId/set-current`、资产对应接口

## Persistence / Async Tasks

- 图片生成结果写入 `asset_versions`，失败原因写入需求记录；已有媒体直接视为可用。
- 项目实体继续存储当前生效媒体地址，兼容 Workspace 和现有生成接口。
- 旧项目回填会把现有角色图和场景封面登记为 `legacy-import` 版本，原角色、场景和镜头记录保持不变。
- 个人空间与项目资产之间仅保存来源信息，不自动同步。

## Failure and Retry

- 单项生成失败只标记该需求失败，可重新生成，不影响其他需求。
- 已有旧图片的单项再生成失败时保留旧图片预览，但需求状态和错误信息保持失败；前端直接显示接口返回的失败原因。
- 批量生成只处理待生成和失败项，不重复生成已有可用版本。
- 批量生成返回逐项结果，不因单项失败回滚已成功图片。
- 导入和保存校验当前用户所有权，失败不产生半成品记录。
- 剧本解析失败时软删除本次新建的项目壳，允许用户修正后用原名称重试。

## Acceptance Criteria

- 项目列表和项目资源只对所有者可见。
- 导入剧本后可按集并分类查看人物、场景、道具需求。
- 图片生成只调用 Seedream，生成结果可切换并确认版本。
- 已确认资产可保存到个人空间，并可导入其他项目。
- 现有 Workspace、角色和资产接口保持兼容。
- 历史项目即使没有 `asset_requirements`，也能在确认页看到已有角色和场景媒体，并可进入原项目资产编辑页。

## Validation

- Backend: `cd backend-node && npm run build && npm run test`
- Frontend: `cd storyboard-app && npm run build`
- Spec guard: `npm run check:spec:working`
