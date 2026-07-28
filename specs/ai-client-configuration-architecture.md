# AI Client Configuration Architecture

## Summary

统一 Node 后端 AI Provider 的模型、尺寸、清晰度、超时、轮询和协议常量来源，
让后续新增或修改生成能力时复用同一套配置分层，避免在业务客户端中重新声明默认值。

## User Goal

开发者在新增图片、视频、语音模型或调整 Provider 参数时，应当能快速确认：

- 环境可配置默认值放在哪里。
- 客户端固定协议参数放在哪里。
- 哪些相同值应当合并。
- 哪些当前数值相同，但因为业务语义不同而必须分开。
- 如何在不改变生成逻辑的前提下完成重构和验证。

## Scope

本规范覆盖：

- `backend-node/config/shared/constants.ts`
- `backend-node/config/providers/*.ts`
- `backend-node/app/lib/ai_client_constants.ts`
- `backend-node/app/lib/ai_client_http.ts`
- `backend-node/app/lib/ai_clients.ts`
- 直接调用 `ai_clients.ts` 的 service 和测试

本规范不覆盖：

- Prompt 模板内容，参见 `specs/prompt-library-system.md`。
- 数据库生成任务状态设计。
- 前端模型选择交互。
- Provider 密钥、真实凭据和部署环境变量值。

## Current Problem

历史实现曾在 `ai_clients.ts` 中同时声明以下内容：

- Provider Base URL。
- 模型名称。
- 图片尺寸。
- 视频清晰度、比例和默认时长。
- 图片、视频、语音超时。
- 轮询间隔。
- 音频格式、语言和采样率。
- HTTP 和 Provider 状态协议字段。

其中部分值已经存在于配置层，部分相同数值使用了多个不同变量名。这会造成：

- 环境配置默认值和运行时兜底值漂移。
- 修改一个模型名称时遗漏另一个副本。
- 无法判断两个相同数值是同一约束，还是碰巧相等。
- Provider 客户端同时承担配置、HTTP、响应解析和业务编排职责。

## Architecture

### 1. 环境默认值：配置层是唯一来源

以下值必须首先定义在 `backend-node/config/shared/constants.ts`：

- Provider Base URL。
- 可由环境变量覆盖的模型 ID。
- 可由环境变量覆盖的请求超时秒数。

Provider 配置文件 `backend-node/config/providers/*.ts` 负责：

1. 读取环境变量。
2. 使用 shared constants 作为默认值。
3. 输出到 `app.config.storyboard`。

`ai_clients.ts` 不得重新写一份相同的模型字符串或超时秒数。

```ts
// config/shared/constants.ts
export const DEFAULT_PROVIDER_BASE_URL = Object.freeze({
  DASHSCOPE: "...",
  ARK: "...",
});

export const DEFAULT_PROVIDER_MODEL = Object.freeze({
  SEEDREAM_IMAGE: "...",
  WANX_VIDEO: "...",
});

export const DEFAULT_REQUEST_TIMEOUT_SECONDS = Object.freeze({
  STANDARD: 180,
  LONG: 300,
});
```

同类配置必须通过同一个冻结对象暴露，调用方使用
`DEFAULT_PROVIDER_MODEL.SEEDREAM_IMAGE` 这类路径表达所属类别。不要再为每个值创建
“每个模型一个顶层常量”式的平铺导出，否则配置项增加后难以检索和归类。

配置层的非 Provider 默认值同样按职责归组：

- `DEFAULT_ENV_PATH`
- `DEFAULT_SERVER`
- `DEFAULT_DATABASE`
- `DEFAULT_STORYBOARD_STORAGE`
- `DEFAULT_AUTH`

业务模块内只有一个使用方的规格不必提升到 shared constants，但同一能力的多个字段应使用
局部冻结对象，例如 `CHARACTER_DESIGN_SPEC`、`VOICE_REFERENCE_SPEC` 和
`FRAME_UPLOAD_SPEC`。单个独立常量、正则或不共享的提示词不需要为了形式统一而包装成对象。

### 2. 客户端协议常量：按职责分组

`backend-node/app/lib/ai_client_constants.ts` 保存不适合由环境变量覆盖、
但会被 Provider 请求或响应逻辑复用的稳定参数。

使用浅层、明确的对象分组：

- `AI_HTTP`
- `AI_REQUEST_TIMEOUT`
- `AI_POLL_INTERVAL_MS`
- `AI_IMAGE_SIZE`
- `AI_IMAGE_DEFAULT`
- `AI_VIDEO_DEFAULT`
- `AI_VOICE_DEFAULT`
- `AI_TASK_STATUS`
- `SEEDANCE_CONTENT`
- `WANX_MEDIA_TYPE`

对象必须使用 `Object.freeze`，防止运行时修改。

### 3. HTTP 与响应解析：独立帮助模块

`backend-node/app/lib/ai_client_http.ts` 负责：

- 带 Bearer Token 的 JSON GET/POST。
- 请求超时。
- Base URL 标准化。
- 必填配置检查。
- Provider 嵌套错误消息解析。
- Provider 嵌套视频地址解析。
- 轮询等待。

Provider 业务函数不应再次复制通用 JSON 解析和错误状态包装。

如果某个 Provider 的响应行为不同，例如必须保留其特有 header、异步提交格式或
非标准错误结构，可以保留一个 Provider 专用请求分支；不要为了形式统一改变错误语义。

### 4. AI 客户端：只保留 Provider 编排

`backend-node/app/lib/ai_clients.ts` 负责：

- 从 `app.config.storyboard` 读取最终配置。
- 构造 Provider 请求 payload。
- 调用共享 HTTP 帮助函数。
- 执行 Provider 特有任务轮询。
- 把 Provider 响应转换为现有业务返回值。
- 保持已有导出名称兼容。

该文件不得重新声明模型、尺寸、分辨率、超时、轮询间隔或音频规格常量。

## Constant Deduplication Rules

### 应当合并

满足以下全部条件时，使用一个常量：

1. 表达同一个协议或业务含义。
2. 生命周期一致。
3. 修改时必须同步变化。

示例：

- Seedance payload 构造和真实提交函数的默认清晰度。
- Seedance payload 构造和真实提交函数的默认画面比例。
- 多个视频生成分支共同使用的默认视频时长。
- 图片和视频请求共同使用的通用无效超时兜底值。

### 不应仅因数值相同而合并

如果含义或未来调整方向不同，即使当前值相同，也保留不同字段。

示例：

- `AI_IMAGE_DEFAULT.WATERMARK` 与 `AI_VIDEO_DEFAULT.WATERMARK`
  当前都可能是 `false`，但 Provider 能力和产品策略可以独立调整。
- Seedream、Wanx、Seedance 的环境超时字段。
  当前可能存在相同默认秒数，但用户可能需要分别覆盖。

判断标准不是“值是否相等”，而是“修改其中一个时，另一个是否必然同步修改”。

## Naming Rules

- Provider 地址：`DEFAULT_PROVIDER_BASE_URL.<PROVIDER>`
- Provider 模型：`DEFAULT_PROVIDER_MODEL.<PROVIDER_OR_CAPABILITY>`
- 请求超时档位：`DEFAULT_REQUEST_TIMEOUT_SECONDS.<TIER>`
- 基础设施默认值：`DEFAULT_<RESPONSIBILITY>.<FIELD>`
- 模块内能力规格：`<CAPABILITY>_SPEC.<FIELD>`
- 时间必须带单位：`*_SECONDS` 或 `*_MS`
- 图片尺寸：`AI_IMAGE_SIZE.<PURPOSE>`
- 视频输出规格：`AI_VIDEO_DEFAULT.<FIELD>`
- 语音输出规格：`AI_VOICE_DEFAULT.<FIELD>`
- Provider 状态：`AI_TASK_STATUS.<PROVIDER>_<STATUS>`

禁止使用含义错误的名称，例如用 `DEFAULT_IMAGE_DURATION_SECONDS` 表示视频时长。

## Adding a New Provider or Model

1. 检查 `config/shared/constants.ts` 的对应分类对象是否已有相同 Provider 默认值。
2. 在 `config/providers/` 创建或更新配置构造器。
3. 模型和超时通过 `app.config.storyboard` 进入运行时。
4. 将固定尺寸、清晰度、格式和状态协议加入 `ai_client_constants.ts` 的对应分组。
5. 优先复用 `ai_client_http.ts`。
6. 在 `ai_clients.ts` 中只实现 Provider payload、轮询和结果映射。
7. 不为 shared constants 创建只改名、不增加语义的客户端别名入口。
8. 添加配置契约测试和 Provider payload/结果测试。
9. 执行残留扫描，确认客户端文件没有重新出现模型、尺寸和超时硬编码。

## Failure and Retry

- 重构不得改变现有错误消息、HTTP 状态附加方式或重试条件。
- 非 JSON 响应的处理语义必须保持不变。
- 轮询成功、失败、取消状态集合必须有契约测试。
- Seedance 临时网络失败继续重试，4xx 继续立即失败。
- Wanx 继续受总超时 deadline 限制。
- 无效自定义超时值的兜底行为必须保持兼容。

## Test Constant Usage

测试是否使用枚举对象取决于测试目的，不允许全局机械替换。

以下位置应使用领域或 AI 客户端常量：

- service、controller 或 helper 的调用参数。
- 流程测试构造的内部状态。
- 媒体类型、资产类型、实体类型和模型选择。
- 测试准备阶段使用的尺寸、清晰度、比例和默认时长。
- 仅验证业务分支的内部结果比较。

以下位置必须保留字面量：

- `domain_constants.test.ts` 和 `ai_client_configuration.test.ts` 的常量契约预期。
- 数据库 SQL 文本和参数序列化契约。
- HTTP 或 Provider 最终 payload 的协议预期。
- 模拟第三方返回的原始状态和响应字段。
- JSON 序列化的精确输出。
- 用户可见错误消息。

禁止没有验证价值的自比较：

```ts
assert.equal(GENERATION_STATUS.SUCCEEDED, GENERATION_STATUS.SUCCEEDED);
```

常量契约测试应当用字面量锁定真实协议值：

```ts
assert.equal(GENERATION_STATUS.SUCCEEDED, "succeeded");
```

流程测试应当通过常量表达调用意图：

```ts
const result = await service.setCurrent(
  MEDIA_TYPE.VIDEO,
  GENERATION_STATUS.SUCCEEDED,
);
```

## Compatibility Invariants

- 环境变量名称不变。
- `app.config.storyboard` 字段名称不变。
- Provider 请求 endpoint、header 和 payload 字段不变。
- 图片尺寸、视频清晰度、画面比例、默认时长和音频规格不变。
- 模型 ID 不变。
- 对外函数签名和返回结构不变。
- `SEEDREAM_DESIGN_SHEET_SIZE` 等已有导出在调用方迁移完成前保持兼容。

## Acceptance Criteria

- `ai_clients.ts` 中没有运行时模型 ID、尺寸、清晰度、超时或轮询常量声明。
- 可配置模型和超时只以 `config/shared/constants.ts` 为默认值来源。
- 客户端固定协议参数集中在 `ai_client_constants.ts`。
- 通用 HTTP 与嵌套响应解析集中在 `ai_client_http.ts`。
- 相同含义的重复常量已经合并。
- 相同数值但不同语义的字段有明确分组。
- 新增测试验证默认值来源、冻结状态、超时兜底和响应解析行为。
- 后端 build、lint 和完整测试通过。

## Validation

```bash
cd backend-node
npm run build
npm run lint
npm run test
```

建议额外执行：

```bash
rg -n '^const (DEFAULT_|.*TIMEOUT|.*INTERVAL|.*SIZE|.*RESOLUTION|.*MODEL)' \
  backend-node/app/lib/ai_clients.ts
```

预期不应发现新的运行时配置常量。
