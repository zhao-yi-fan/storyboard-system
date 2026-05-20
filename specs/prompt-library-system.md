# Prompt Library System

## User goal

让分镜封面、分镜视频、场景封面、角色封面、角色设定图、场景资产封面的提示词不再是平铺直叙的字段拼接，而是生成具备导演语言、镜头节奏和视觉层次的高质量提示词。

## Current problem

- 现有提示词基本是字段直接串接。
- `机位 / 运镜 / 风格 / 情绪 / 特效 / 输出要求` 没有拆层。
- 同样的 `低机位`、`环绕`、`史诗感` 无法扩写成更完整的画面语言。
- 抖音类爆款提示词的价值无法沉淀成系统能力，只能靠手工复制粘贴。

## Scope

本阶段只做后端提示词系统重构，不新增前端编辑器。

接入范围：

- 分镜封面 prompt
- 分镜视频 prompt
- 场景封面 prompt
- 角色封面 prompt
- 角色设定图 prompt
- 场景资产封面 prompt
- 角色主语音 prompt

## Design

### 1. Prompt blueprint

后端使用统一的 prompt blueprint 结构组织提示词要素：

- `subject`
- `action`
- `camera`
- `style`
- `effects`
- `quality`
- `consistency`
- `audio`
- `output`
- `negative`
- `timeline`

### 2. Prompt templates

系统提供一组可复用模板，根据分镜内容、风格预设、风格补充、情绪、动作描述自动选一个最接近的模板：

- `cinematic-default`
- `dramatic-dialogue`
- `mythic-awakening`
- `suspense-pressure`
- `transformation-spectacle`

模板负责补充高阶导演语言，例如：

- 画面气质
- 运镜节奏
- 灯光层次
- 特效密度
- 常见负向约束

### 3. Camera expansion

`camera_direction / camera_motion / shot_type` 不再只原样输出，而要扩写成更完整的中文镜头描述，例如：

- `低机位` -> `低机位仰拍，强化主体压迫感和力量感`
- `环绕` -> `镜头围绕主体平滑环绕，优先展示人物轮廓、服装与空间层次`
- `特写` -> `镜头压到特写，锁定眼神、手部或关键表情细节`

### 4. Video beat expansion

视频 prompt 额外生成 3 段节奏描述：

- 开场
- 中段
- 高潮 / 收束

不是严格时间轴编辑器，而是给模型一个更像短视频导演提示词的节奏结构。

## API behavior

现有 preview 接口继续返回 `final_prompt`，并额外允许返回：

- `template`
- `prompt_blueprint`

旧前端不依赖这些字段也能工作。

## Failure / retry

- 如果没有匹配到特殊模板，回退到 `cinematic-default`
- 如果字段缺失，渲染器跳过对应段落，不报错
- 不改变现有生成任务状态流转

## Acceptance criteria

- 同一条分镜，`previewCoverGeneration` 和 `previewVideoGeneration` 的 `final_prompt` 明显比原先更长、更结构化
- `camera_direction / camera_motion / shot_type` 被扩写，不再只是原词回显
- 风格、情绪、动作、光线、负向约束能自动补足
- 现有生成接口和前端调用无需改动即可继续工作
