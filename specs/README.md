# Specs Workflow

## Purpose

`specs/` 用来记录会影响产品流程、接口语义、异步任务状态、生成行为的数据与交互设计。

这套流程面向当前仓库的单人开发场景，目标是防止高影响改动在实现时“只有代码，没有约束”。

## When You Must Add or Update a Spec

以下改动必须补 spec：

1. 新增用户可见流程
   - 新页面
   - 新弹窗主流程
   - 新批量操作
   - 新导入、生成、上传、合成链路
2. 修改核心 workflow
   - 项目、章节、场景、镜头、资产库
   - 封面生成、视频生成、合成播放
   - 用户操作路径发生变化
3. API 契约变化
   - 新增接口
   - 修改请求参数
   - 修改响应结构
   - 修改错误码或状态字段语义
4. 数据结构或持久化变化
   - 新增、删除、重命名字段
   - 修改数据库表写入规则
   - 新增状态值
   - 修改历史记录、当前版本逻辑
5. 异步任务和状态流变化
   - 生成任务
   - 上传任务
   - 转码任务
   - 合成任务
   - 重试、失败恢复、状态可见性变化
6. AI 行为规则变化
   - prompt 拼装逻辑
   - 模型参数来源
   - 参考图、角色、首帧策略
   - 预览参数和真实提交参数不一致的修复或调整
7. 鉴权和路由守卫变化
   - 登录态
   - 会话态
   - 路由进入条件
   - 资源访问边界

边界默认值：
- 只要改动会影响“用户如何操作”或“系统如何记录状态”，就补 spec。
- 拿不准时默认补一个短 spec。

## When a Spec Is Usually Not Needed

以下改动默认可不补 spec：

- 纯样式微调
- 纯文案修改
- 不改变行为的重构
- 测试补充
- lint、prettier、构建脚本调整
- 局部 bugfix 且不改接口、状态语义、用户流程

如果一个 bugfix 改了接口、状态流或用户操作路径，仍然需要补 spec。

## Spec Template

新增 spec 时复制 [`specs/_template.md`](/Users/zhaoyifan/Desktop/myProject/storyboard-system/specs/_template.md:1)。

模板中的硬性要求：

- 非 trivial spec 必须有 `User Goal`
- 非 trivial spec 必须有 `Workflow`
- 非 trivial spec 必须有 `Acceptance Criteria`
- 涉及前端流程必须写 `UI States`
- 涉及接口变化必须写 `API Changes`
- 涉及任务状态、生成、上传、历史版本必须写 `Persistence / Async Tasks`

## File Naming

- 统一使用 kebab-case
- 优先使用“业务域 + 变更主题”的命名方式
- 示例：
  - `storyboard-batch-video-regeneration.md`
  - `asset-library-video-history.md`
  - `auth-session-refresh.md`

不建议：
- `new-feature.md`
- `update1.md`
- `temp.md`

## Recommended Workflow

单人开发默认按下面顺序执行：

1. 开始做功能前，先判断是否属于高影响改动。
2. 如果是，先新建或更新 `specs/*.md`，哪怕先写短版。
3. 再实现代码。
4. 实现后运行 `npm run check:spec`。
5. 最后运行最小相关验证：
   - 前端改动：`cd storyboard-app && npm run build`
   - 后端改动：`cd backend-node && npm run test`

## Local Guard Script

仓库根目录提供本地自检：

- `npm run check:spec`
  - 默认检查 staged diff
- `npm run check:spec:working`
  - 检查 working tree diff

也可以直接运行：

- `node scripts/check-spec-guard.mjs`
- `node scripts/check-spec-guard.mjs --working-tree`

如果你明确在做无行为变化重构，可以临时使用：

- `node scripts/check-spec-guard.mjs --allow-no-spec`

这个参数只建议偶尔使用，不建议当作日常默认流程。
