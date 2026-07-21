'use strict';

type PromptBeat = {
  label: string;
  description: string;
};

type PromptBlueprint = {
  template: string;
  intro: string;
  subject?: string[];
  action?: string[];
  camera?: string[];
  style?: string[];
  effects?: string[];
  quality?: string[];
  consistency?: string[];
  audio?: string[];
  output?: string[];
  negative?: string[];
  timeline?: PromptBeat[];
};

type PromptDisplayBlock = {
  section: string;
  items: string[];
};

type PromptDisplayToken = {
  type: 'badge' | 'text';
  label?: string;
  text: string;
};

const DEFAULT_TEMPLATE = 'cinematic-default';
const DIALOGUE_TEMPLATE = 'dramatic-dialogue';
const MYTHIC_TEMPLATE = 'mythic-awakening';
const SUSPENSE_TEMPLATE = 'suspense-pressure';
const TRANSFORMATION_TEMPLATE = 'transformation-spectacle';

const CHINESE_PERIOD = '。';
const CHINESE_SEMICOLON = '；';

const COMMON_QUALITY = ['电影感画面组织', '主体明确', '光影层次清楚', '高细节质感'];

const COMMON_OUTPUT = ['不要文字', '不要水印', '不要 logo', '不要海报排版'];

const COMMON_NEGATIVE = ['避免人物五官崩坏', '避免手部畸形', '避免穿模', '避免廉价游戏感'];

const VIDEO_NEGATIVE = ['不要切镜', '不要闪回', '不要镜头突然跳变', '不要字幕'];

const STYLE_PRESET_PROMPT_MAP: Record<string, string> = {
  realistic_cinematic: '写实电影质感，自然光影层次，人物与环境比例真实，整体叙事克制而稳定',
  dark_realism: '阴郁现实主义气质，低饱和冷色调，真实生活颗粒感，压迫而克制的空间氛围',
  mystery_thriller: '悬疑惊悚风格，暗部信息丰富，视觉上保留未知与压迫感，节奏紧绷',
  youthful_bright: '青春清透风格，明亮干净的自然光，肤色通透，画面轻盈有呼吸感',
  japanese_animation: '日式动画叙事感，轮廓清晰，色彩组织明确，情绪表达更直观',
  retro_film: '复古胶片气质，暖色颗粒与轻微褪色感，画面带旧时代电影的时间痕迹',
  warm_poetic: '温暖诗意风格，柔和光线与细腻色调过渡，强调情绪余韵和生活感',
  cold_noir: '冷峻黑色电影气质，硬朗明暗反差，人物关系紧张，都市夜色感更强',
};

const IMAGE_COVER_STYLE_TEMPLATE_MAP: Record<string, string> = {
  realistic_cinematic: DEFAULT_TEMPLATE,
  dark_realism: SUSPENSE_TEMPLATE,
  mystery_thriller: SUSPENSE_TEMPLATE,
  youthful_bright: DEFAULT_TEMPLATE,
  japanese_animation: DEFAULT_TEMPLATE,
  retro_film: DEFAULT_TEMPLATE,
  warm_poetic: DEFAULT_TEMPLATE,
  cold_noir: SUSPENSE_TEMPLATE,
};

const TEMPLATE_LIBRARY: Record<string, Partial<PromptBlueprint>> = {
  [DEFAULT_TEMPLATE]: {
    style: ['写实电影感', '叙事性强', '构图克制'],
    quality: ['画面稳定', '色彩统一', '主体和背景层次分明'],
  },
  [DIALOGUE_TEMPLATE]: {
    style: ['情绪张力明确', '人物关系可读', '氛围克制而压迫'],
    camera: ['镜头优先锁定眼神、停顿和角色之间的距离变化'],
    quality: ['保留细微表情和呼吸感停顿'],
  },
  [MYTHIC_TEMPLATE]: {
    style: ['东方神话史诗感', '冷冽神性气质', '高预算电影级 CG 质感'],
    effects: ['高质量粒子拖尾', '能量光晕', '空间涟漪或符文层次'],
    quality: ['高光与暗部层次充足', '特效与人物边缘清晰'],
  },
  [SUSPENSE_TEMPLATE]: {
    style: ['悬疑压迫感', '低饱和冷调', '空间留白增强不确定性'],
    camera: ['镜头运动克制，优先制造观察感和逼近感'],
    quality: ['暗部细节可读', '氛围真实，不要过曝'],
  },
  [TRANSFORMATION_TEMPLATE]: {
    style: ['短视频爆点感', '华丽变形过程', '高潮段视觉反差明显'],
    effects: ['服装或粒子形态变化', '高密度能量爆发', '动作卡点清楚'],
    quality: ['变化过程连续', '关键形变节点完整可见'],
  },
};

const TEMPLATE_KEYWORDS = [
  {
    name: MYTHIC_TEMPLATE,
    patterns: ['神女', '神明', '仙', '古风', '法印', '符文', '神轮', '史诗', '粒子', '神性'],
  },
  {
    name: TRANSFORMATION_TEMPLATE,
    patterns: ['变装', '蜕变', '换装', '爆发', '觉醒', '进化', '成型', '汇聚'],
  },
  {
    name: SUSPENSE_TEMPLATE,
    patterns: ['悬疑', '神秘', '雨夜', '黑暗', '压迫', '阴影', '监视', '窒息', '追踪', '危机'],
  },
  {
    name: DIALOGUE_TEMPLATE,
    patterns: ['对话', '对白', '独白', '凝视', '沉默', '对峙', '争执', '告白'],
  },
];

function uniqueParts(values: unknown[]): string[] {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    parts.push(text);
  }
  return parts;
}

function sentence(label: string, values: unknown[]): string {
  const parts = uniqueParts(values);
  if (!parts.length) {
    return '';
  }
  return `${label}：${parts.join(CHINESE_SEMICOLON)}${CHINESE_PERIOD}`;
}

function mergeSection(
  blueprint: PromptBlueprint,
  key: keyof PromptBlueprint,
  extra: unknown[],
): void {
  const current = Array.isArray(blueprint[key]) ? (blueprint[key] as string[]) : [];
  blueprint[key] = uniqueParts([...current, ...extra]) as never;
}

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

function normalizeTextList(values: unknown[]): string[] {
  return uniqueParts(values).slice(0, 8);
}

function toDisplayItems(values: unknown[]): string[] {
  return uniqueParts(values);
}

function expandShotType(shotType: string): string[] {
  const value = String(shotType || '').trim();
  if (!value) {
    return [];
  }
  const clauses = [`景别采用${value}`];
  if (value.includes('特写')) {
    clauses.push('镜头压近到关键表情、眼神或手部细节');
  } else if (value.includes('近景')) {
    clauses.push('优先展示人物上半身表演与情绪细节');
  } else if (value.includes('中景')) {
    clauses.push('兼顾人物动作和环境关系');
  } else if (value.includes('全景') || value.includes('远景')) {
    clauses.push('完整交代主体与空间结构');
  }
  return clauses;
}

function expandCameraDirection(direction: string): string[] {
  const value = String(direction || '').trim();
  if (!value) {
    return [];
  }
  const clauses = [`机位使用${value}`];
  if (value.includes('低机位') || value.includes('仰拍')) {
    clauses.push('低机位仰拍强化主体压迫感与力量感');
  }
  if (value.includes('高机位') || value.includes('俯拍')) {
    clauses.push('高机位俯视强化人物处境与空间关系');
  }
  if (value.includes('平视')) {
    clauses.push('平视镜头保持真实观察感');
  }
  if (value.includes('侧')) {
    clauses.push('保留人物轮廓线和空间纵深');
  }
  if (value.includes('背')) {
    clauses.push('利用背身或背肩关系制造代入感');
  }
  return clauses;
}

function expandCameraMotion(motion: string): string[] {
  const value = String(motion || '').trim();
  if (!value) {
    return [];
  }
  const clauses = [`运镜方向采用${value}`];
  if (value.includes('推')) {
    clauses.push('镜头向主体缓慢逼近，逐步收紧注意力');
  }
  if (value.includes('拉')) {
    clauses.push('镜头后撤时保留空间信息和情绪余量');
  }
  if (value.includes('环绕')) {
    clauses.push('镜头围绕主体平滑环绕，展示人物轮廓、服装和空间层次');
  }
  if (value.includes('跟')) {
    clauses.push('镜头跟随主体动作，保证动势连续');
  }
  if (value.includes('摇') || value.includes('移')) {
    clauses.push('镜头横向转移时保持节奏平顺，不要突兀抖动');
  }
  if (value.includes('手持')) {
    clauses.push('手持感控制在可读范围内，避免晕眩抖动');
  }
  return clauses;
}

function buildVideoTimeline(
  content: string,
  mood: string,
  motion: string,
  duration: number,
): PromptBeat[] {
  const safeContent = String(content || '').trim() || '主体动作逐步展开';
  const safeMood = String(mood || '').trim() || '情绪持续累积';
  const safeMotion = String(motion || '').trim() || '镜头平稳推进';
  const structuredBeats = parseStructuredVideoBeats(safeContent);
  if (structuredBeats.length) {
    return structuredBeats;
  }
  return [
    {
      label: '开场',
      description: `先建立主体和空间关系，${safeMotion}，让观众迅速读清画面核心`,
    },
    {
      label: '中段',
      description: `重点呈现${safeContent}，让动作和表演逐步升级，保持连续运动`,
    },
    {
      label: duration >= 8 ? '高潮' : '收束',
      description: `${safeMood}在末段完成集中释放，给出最强视觉瞬间并稳定收束画面`,
    },
  ];
}

function parseStructuredVideoBeats(content: string): PromptBeat[] {
  const text = String(content || '').trim();
  if (!text) {
    return [];
  }

  const beatPatterns: Array<{ label: string; regex: RegExp }> = [
    {
      label: '开场',
      regex:
        /(?:首段|开场|0\s*[-~—至到]\s*\d+\s*秒)\s*[:：]\s*([\s\S]*?)(?=(?:中段|中场|\d+\s*[-~—至到]\s*\d+\s*秒)\s*[:：]|(?:尾段|结尾|收束|高潮|结尾段)\s*[:：]|$)/i,
    },
    {
      label: '中段',
      regex:
        /(?:中段|中场|\d+\s*[-~—至到]\s*\d+\s*秒)\s*[:：]\s*([\s\S]*?)(?=(?:尾段|结尾|收束|高潮|结尾段)\s*[:：]|$)/i,
    },
    { label: '收束', regex: /(?:尾段|结尾|收束|高潮|结尾段)\s*[:：]\s*([\s\S]*?)$/i },
  ];

  const beats = beatPatterns
    .map(({ label, regex }) => {
      const match = text.match(regex);
      const description = String(match?.[1] || '')
        .replace(/\s+/g, ' ')
        .replace(/[。；;，,\s]+$/g, '')
        .trim();
      return description ? { label, description } : null;
    })
    .filter(Boolean) as PromptBeat[];

  return beats;
}

function summarizeVideoContent(content: string): string {
  const text = String(content || '').trim();
  if (!text) {
    return '';
  }
  if (parseStructuredVideoBeats(text).length) {
    const headline = text
      .replace(/【[\s\S]*?】/g, ' ')
      .split(/[。；;\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .find((item) => !/(首段|中段|尾段|开场|高潮|收束)\s*[:：]/.test(item));
    return headline || '按分段分镜脚本推进完整动作和情绪变化';
  }
  return text;
}

export function selectPromptTemplate(values: unknown[]): string {
  const combined = uniqueParts(values).join(' ').toLowerCase();
  for (const template of TEMPLATE_KEYWORDS) {
    if (includesAny(combined, template.patterns)) {
      return template.name;
    }
  }
  return DEFAULT_TEMPLATE;
}

function resolveStylePresetPrompt(stylePreset: unknown): string {
  return STYLE_PRESET_PROMPT_MAP[String(stylePreset || '').trim()] || '';
}

function selectImageCoverTemplate(stylePreset: unknown, values: unknown[]): string {
  const preset = String(stylePreset || '').trim();
  if (preset) {
    return IMAGE_COVER_STYLE_TEMPLATE_MAP[preset] || DEFAULT_TEMPLATE;
  }
  return selectPromptTemplate(values);
}

export function buildPromptBlueprint(input: Partial<PromptBlueprint>): PromptBlueprint {
  const template = input.template || DEFAULT_TEMPLATE;
  const templateDefaults = TEMPLATE_LIBRARY[template] || TEMPLATE_LIBRARY[DEFAULT_TEMPLATE] || {};
  const blueprint: PromptBlueprint = {
    template,
    intro: String(input.intro || '').trim(),
    subject: [],
    action: [],
    camera: [],
    style: [],
    effects: [],
    quality: [],
    consistency: [],
    audio: [],
    output: [],
    negative: [],
    timeline: Array.isArray(input.timeline) ? input.timeline : [],
  };

  mergeSection(blueprint, 'subject', [
    ...(templateDefaults.subject || []),
    ...(input.subject || []),
  ]);
  mergeSection(blueprint, 'action', [...(templateDefaults.action || []), ...(input.action || [])]);
  mergeSection(blueprint, 'camera', [...(templateDefaults.camera || []), ...(input.camera || [])]);
  mergeSection(blueprint, 'style', [...(templateDefaults.style || []), ...(input.style || [])]);
  mergeSection(blueprint, 'effects', [
    ...(templateDefaults.effects || []),
    ...(input.effects || []),
  ]);
  mergeSection(blueprint, 'quality', [
    ...COMMON_QUALITY,
    ...(templateDefaults.quality || []),
    ...(input.quality || []),
  ]);
  mergeSection(blueprint, 'consistency', [
    ...(templateDefaults.consistency || []),
    ...(input.consistency || []),
  ]);
  mergeSection(blueprint, 'audio', [...(templateDefaults.audio || []), ...(input.audio || [])]);
  mergeSection(blueprint, 'output', [
    ...COMMON_OUTPUT,
    ...(templateDefaults.output || []),
    ...(input.output || []),
  ]);
  mergeSection(blueprint, 'negative', [
    ...COMMON_NEGATIVE,
    ...(templateDefaults.negative || []),
    ...(input.negative || []),
  ]);

  return blueprint;
}

export function renderPromptBlueprint(blueprint: PromptBlueprint): string {
  const sections = [
    `${blueprint.intro}${CHINESE_PERIOD}`,
    sentence('主体与画面核心', blueprint.subject || []),
    sentence('动作与叙事重点', blueprint.action || []),
    sentence('镜头设计', blueprint.camera || []),
    sentence('风格气质', blueprint.style || []),
    sentence('特效与氛围', blueprint.effects || []),
    sentence('一致性要求', blueprint.consistency || []),
    sentence('音频要求', blueprint.audio || []),
    sentence('画质与完成度', blueprint.quality || []),
    sentence('输出要求', blueprint.output || []),
    sentence('负向约束', blueprint.negative || []),
  ];
  if (Array.isArray(blueprint.timeline) && blueprint.timeline.length) {
    sections.push(
      sentence(
        '节奏分段',
        blueprint.timeline.map((item) => `${item.label}：${item.description}`),
      ),
    );
  }
  return sections.filter(Boolean).join('\n');
}

/**
 * 把结构化 prompt blueprint 转成前端可直接渲染的分段展示块。
 * @param {PromptBlueprint} blueprint 结构化提示词对象。
 * @returns {PromptDisplayBlock[]} 展示区块数组。
 * @example
 * buildPromptDisplayBlocks({ intro: "生成视频", subject: ["李明"], output: ["单镜头"] })
 * // => [{ section: "主体与画面核心", items: ["李明"] }, ...]
 */
export function buildPromptDisplayBlocks(blueprint: PromptBlueprint): PromptDisplayBlock[] {
  const blocks: PromptDisplayBlock[] = [];
  const sectionMap: Array<{ section: string; items: unknown[] }> = [
    { section: '主体与画面核心', items: blueprint.subject || [] },
    { section: '动作与叙事重点', items: blueprint.action || [] },
    { section: '镜头设计', items: blueprint.camera || [] },
    { section: '风格气质', items: blueprint.style || [] },
    { section: '特效与氛围', items: blueprint.effects || [] },
    { section: '一致性要求', items: blueprint.consistency || [] },
    { section: '音频要求', items: blueprint.audio || [] },
    { section: '画质与完成度', items: blueprint.quality || [] },
    { section: '输出要求', items: blueprint.output || [] },
    { section: '负向约束', items: blueprint.negative || [] },
  ];

  for (const entry of sectionMap) {
    const items = toDisplayItems(entry.items);
    if (!items.length) {
      continue;
    }
    blocks.push({ section: entry.section, items });
  }

  const timelineItems = Array.isArray(blueprint.timeline)
    ? blueprint.timeline
        .map((item) => {
          const label = String(item?.label || '').trim();
          const description = String(item?.description || '').trim();
          if (!label || !description) {
            return '';
          }
          return `${label}：${description}`;
        })
        .filter(Boolean)
    : [];
  if (timelineItems.length) {
    blocks.push({ section: '节奏分段', items: timelineItems });
  }

  return blocks;
}

/**
 * 把视频 prompt 相关信息转成类似控制台可读的标签流。
 * @param {object} options 视频 prompt 输入摘要。
 * @returns {PromptDisplayToken[]} 标签流 token 数组。
 * @example
 * buildPromptDisplayTokens({ finalPrompt: "镜头缓慢推进", characters: ["李明"], useFirstFrame: true })
 * // => [{ type: "badge", label: "角色", text: "李明" }, ...]
 */
export function buildPromptDisplayTokens(options: {
  finalPrompt: string;
  sceneTitle?: unknown;
  characters?: unknown[];
  stylePreset?: unknown;
  cameraDirection?: unknown;
  cameraMotion?: unknown;
  audio?: boolean;
  useFirstFrame?: boolean;
  hasSourceImage?: boolean;
  timeline?: PromptBeat[];
}): PromptDisplayToken[] {
  const tokens: PromptDisplayToken[] = [];
  const sceneTitle = String(options.sceneTitle || '').trim();
  const stylePreset = String(options.stylePreset || '').trim();
  const cameraDirection = String(options.cameraDirection || '').trim();
  const cameraMotion = String(options.cameraMotion || '').trim();
  const finalPrompt = String(options.finalPrompt || '').trim();
  const characters = uniqueParts(Array.isArray(options.characters) ? options.characters : []);
  const timelineLabels = Array.isArray(options.timeline)
    ? options.timeline.map((item) => String(item?.label || '').trim()).filter(Boolean)
    : [];

  if (options.useFirstFrame) {
    tokens.push({
      type: 'badge',
      label: '首帧图',
      text: options.hasSourceImage ? '已使用' : '将自动补首帧',
    });
  }
  if (sceneTitle) {
    tokens.push({ type: 'badge', label: '场景', text: sceneTitle });
  }
  if (characters.length) {
    tokens.push({ type: 'badge', label: '角色', text: characters.join('、') });
  }
  if (stylePreset) {
    tokens.push({ type: 'badge', label: '风格', text: stylePreset });
  }
  if (cameraDirection || cameraMotion) {
    tokens.push({
      type: 'badge',
      label: '运镜',
      text: [cameraDirection, cameraMotion].filter(Boolean).join(' / '),
    });
  }
  if (options.audio) {
    tokens.push({ type: 'badge', label: '音频', text: '有声' });
  }
  if (timelineLabels.length) {
    tokens.push({ type: 'badge', label: '节奏', text: timelineLabels.join(' / ') });
  }
  if (finalPrompt) {
    tokens.push({ type: 'text', text: finalPrompt });
  }

  return tokens;
}

/**
 * 构建镜头首帧生成 prompt。
 * @param {Record<string, unknown>} fields 镜头和场景字段摘要。
 * @param {Array<{ type: string }>} references 参考图摘要数组。
 * @returns {{template: string, blueprint: PromptBlueprint, prompt: string}} 模板、blueprint 和最终 prompt。
 * @example
 * buildStoryboardCoverPrompt({ scene_title: "便利店门口", content: "李明抬头" }, [{ type: "character" }])
 * // => { template: "cinematic-default", blueprint: {...}, prompt: "..." }
 */
export function buildStoryboardCoverPrompt(
  fields: Record<string, unknown>,
  references: Array<{ type: string }>,
) {
  const stylePresetPrompt = resolveStylePresetPrompt(fields.style_preset);
  const template = selectImageCoverTemplate(fields.style_preset, [
    fields.style_notes,
    fields.content,
    fields.mood,
    fields.dialogue,
    fields.notes,
  ]);
  const blueprint = buildPromptBlueprint({
    template,
    intro: '为漫剧分镜系统生成单镜头封面图',
    subject: normalizeTextList([
      fields.scene_title ? `场景为${fields.scene_title}` : '',
      fields.location ? `地点位于${fields.location}` : '',
      fields.time_of_day ? `时间是${fields.time_of_day}` : '',
      fields.background ? `环境主体是${fields.background}` : '',
      Array.isArray(fields.characters) && fields.characters.length
        ? `主要人物包括${fields.characters.join('、')}`
        : '',
    ]),
    action: normalizeTextList([
      fields.content ? `核心动作是${fields.content}` : '',
      fields.dialogue ? `台词氛围聚焦${fields.dialogue}` : '',
      fields.notes ? `补充叙事重点${fields.notes}` : '',
      fields.mood ? `情绪状态为${fields.mood}` : '',
    ]),
    camera: normalizeTextList(['封面图只保留一个决定性瞬间，不做多画格拼贴']),
    style: normalizeTextList([
      stylePresetPrompt ? `风格基调采用${stylePresetPrompt}` : '',
      fields.style_notes ? `风格补充强调${fields.style_notes}` : '',
      '适合作为剧情分镜封面，不做广告海报式排版',
    ]),
    consistency: references.length
      ? ['保持参考图中的角色造型、服装结构、发型和场景材质一致']
      : ['人物和环境关系清楚，主体识别度稳定'],
    output: ['横版 16:9', '单幅完整镜头封面'],
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}

/**
 * 构建镜头视频生成 prompt。
 * @param {Record<string, unknown>} storyboard 镜头字段。
 * @param {Record<string, unknown>} scene 所属场景字段。
 * @param {number} duration 视频时长秒数。
 * @returns {{template: string, blueprint: PromptBlueprint, prompt: string}} 模板、blueprint 和最终 prompt。
 * @example
 * buildStoryboardVideoPrompt({ content: "李明抬头", camera_motion: "缓推" }, { title: "便利店门口" }, 5)
 * // => { template: "cinematic-default", blueprint: {...}, prompt: "..." }
 */
export function buildStoryboardVideoPrompt(
  storyboard: Record<string, unknown>,
  scene: Record<string, unknown>,
  duration: number,
  options: { audio?: boolean; useFirstFrame?: boolean } = {},
) {
  const audioEnabled = options.audio !== false;
  const useFirstFrame = options.useFirstFrame !== false;
  const characters =
    Array.isArray(storyboard.character_names) && storyboard.character_names.length
      ? storyboard.character_names
      : Array.isArray(storyboard.characters)
        ? storyboard.characters
            .map((item: Record<string, unknown>) => String(item?.name || '').trim())
            .filter(Boolean)
        : [];
  const template = selectPromptTemplate([
    storyboard.style_preset,
    scene.style_preset,
    storyboard.style_notes,
    scene.style_notes,
    storyboard.content,
    storyboard.mood,
    storyboard.dialogue,
    storyboard.notes,
  ]);
  const summarizedContent = summarizeVideoContent(String(storyboard.content || ''));
  const blueprint = buildPromptBlueprint({
    template,
    intro: useFirstFrame
      ? `基于输入首帧图像生成一个${duration}秒的单镜头电影分镜视频`
      : `基于文本和参考素材生成一个${duration}秒的单镜头电影分镜视频`,
    subject: normalizeTextList([
      scene.title ? `场景为${scene.title}` : '',
      storyboard.background ? `背景环境为${storyboard.background}` : '',
      characters.length ? `主要人物包括${characters.join('、')}` : '',
    ]),
    action: normalizeTextList([
      summarizedContent ? `核心动作是${summarizedContent}` : '',
      storyboard.dialogue ? `人物对白或台词氛围围绕${storyboard.dialogue}` : '',
      storyboard.notes ? `补充动作提示${storyboard.notes}` : '',
      storyboard.mood ? `情绪推进围绕${storyboard.mood}` : '',
    ]),
    camera: normalizeTextList([
      ...expandShotType(String(storyboard.shot_type || '')),
      ...expandCameraDirection(String(storyboard.camera_direction || '')),
      ...expandCameraMotion(String(storyboard.camera_motion || '')),
      useFirstFrame
        ? '保持首帧主体和构图一致，所有变化都在同一镜头内完成'
        : '保持主体、场景和构图连续，所有变化都在同一镜头内完成',
    ]),
    style: normalizeTextList([
      storyboard.style_preset || scene.style_preset
        ? `风格预设偏向${storyboard.style_preset || scene.style_preset}`
        : '',
      storyboard.style_notes || scene.style_notes
        ? `风格补充强调${storyboard.style_notes || scene.style_notes}`
        : '',
    ]),
    audio: audioEnabled ? ['自动生成环境音和氛围声', '不要旁白'] : [],
    consistency: ['动作连续', '光影稳定', '人物结构和服装一致', '不要突然改脸或改服装'],
    negative: VIDEO_NEGATIVE,
    output: ['单镜头连续动作', '画面收束稳定', '镜头语言清楚'],
    timeline: buildVideoTimeline(
      String(storyboard.content || ''),
      String(storyboard.mood || ''),
      String(storyboard.camera_motion || ''),
      duration,
    ),
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}

/**
 * 构建场景封面生成 prompt。
 * @param {Record<string, unknown>} scene 场景字段。
 * @param {Array<Record<string, unknown>>} storyboards 场景下镜头列表。
 * @returns {{template: string, blueprint: PromptBlueprint, prompt: string}} 模板、blueprint 和最终 prompt。
 * @example
 * buildSceneCoverPrompt({ title: "便利店门口", location: "街角" }, [{ content: "李明抬头" }])
 * // => { template: "cinematic-default", blueprint: {...}, prompt: "..." }
 */
export function buildSceneCoverPrompt(
  scene: Record<string, unknown>,
  storyboards: Array<Record<string, unknown>>,
) {
  const backgrounds = uniqueParts(storyboards.map((item) => item.background)).slice(0, 3);
  const characters = uniqueParts(
    storyboards.flatMap((item) =>
      Array.isArray(item.character_names) ? item.character_names : [],
    ),
  ).slice(0, 5);
  const moods = uniqueParts(storyboards.map((item) => item.mood)).slice(0, 4);
  const content = uniqueParts(storyboards.map((item) => item.content)).slice(0, 4);
  const stylePresetPrompt = resolveStylePresetPrompt(scene.style_preset);
  const template = selectImageCoverTemplate(scene.style_preset, [
    scene.style_notes,
    scene.description,
    ...moods,
    ...content,
  ]);
  const blueprint = buildPromptBlueprint({
    template,
    intro: '为漫画场景生成一张代表性横版封面图',
    subject: normalizeTextList([
      scene.title ? `场景标题为${scene.title}` : '',
      scene.location ? `地点位于${scene.location}` : '',
      scene.time_of_day ? `时间是${scene.time_of_day}` : '',
      scene.description ? `场景描述为${scene.description}` : '',
      backgrounds.length ? `环境重点包括${backgrounds.join('、')}` : '',
      characters.length ? `主要人物包括${characters.join('、')}` : '',
    ]),
    action: normalizeTextList([
      content.length ? `关键镜头摘要包括${content.join('；')}` : '',
      moods.length ? `场景主情绪包括${moods.join('、')}` : '',
    ]),
    camera: ['只生成一张完整场景代表图，不要多画格，不要机械并排多个镜头'],
    style: normalizeTextList([
      stylePresetPrompt ? `风格基调采用${stylePresetPrompt}` : '',
      scene.style_notes ? `风格补充强调${scene.style_notes}` : '',
      '适合作为场景树封面和场景头部预览',
    ]),
    output: ['横版 16:9', '单幅完整场景封面'],
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}

/**
 * 构建角色封面图 prompt。
 * @param {Record<string, unknown>} character 角色字段。
 * @returns {{template: string, blueprint: PromptBlueprint, prompt: string}} 模板、blueprint 和最终 prompt。
 * @example
 * buildCharacterCoverPrompt({ name: "林婉", description: "温婉端庄" })
 * // => { template: "cinematic-default", blueprint: {...}, prompt: "..." }
 */
export function buildCharacterCoverPrompt(character: Record<string, unknown>) {
  const template = selectPromptTemplate([character.description]);
  const blueprint = buildPromptBlueprint({
    template,
    intro: '为漫剧分镜系统生成一张角色封面头像',
    subject: normalizeTextList([
      character.name ? `角色名称为${character.name}` : '',
      character.description ? `角色描述为${character.description}` : '',
    ]),
    action: ['突出人物识别度和角色气质，不引入剧情性大动作'],
    camera: ['单人角色肖像构图', '画面聚焦头肩或半身，背景简洁'],
    style: ['适合在资产库中展示', '不要夸张漫画化脸部比例'],
    output: ['单人角色头像或半身封面', '构图干净'],
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}

/**
 * 构建角色主设定图 prompt。
 * @param {Record<string, unknown>} character 角色字段。
 * @returns {{template: string, blueprint: PromptBlueprint, prompt: string}} 模板、blueprint 和最终 prompt。
 * @example
 * buildCharacterDesignPrompt({ name: "林婉", description: "温婉端庄，外柔内刚" })
 * // => { template: "mythic-awakening", blueprint: {...}, prompt: "..." }
 */
export function buildCharacterDesignPrompt(character: Record<string, unknown>) {
  const template = DEFAULT_TEMPLATE;
  const blueprint = buildPromptBlueprint({
    template,
    intro: '为漫剧分镜系统生成高细节角色主设定板',
    subject: normalizeTextList([
      character.name ? `角色名称为${character.name}` : '',
      character.description ? `角色描述为${character.description}` : '',
      '唯一上传的人物参考图是角色外观的唯一事实来源，严格保持脸型、五官、发型、发色、年龄、体型、服装款式、服装颜色、服装材质以及参考图中实际存在的配饰一致',
      '版式描述只规定信息排布，不得据此重新设计角色，不得增加参考图中不存在的服装、首饰或人物特征',
    ]),
    action: [
      '输出最终定稿级角色主设定板，作为后续镜头封面和角色一致性的核心参考图',
      '重点呈现面部细节、妆容、发型和服装结构；发饰、耳饰、项链、腰饰、刺绣纹样及特殊面料仅在参考图中明确存在时呈现',
      '确保人物气质、年龄感、身形比例和服装细节在所有视角下稳定一致',
    ],
    camera: [
      '横向画布，画面中央从左到右排列正面全身、标准侧面全身和背面全身三视图',
      '三个全身视图保持相同身高、相同比例、相同服装和自然站立姿势，采用接近正交投影的视角，避免广角和透视畸变',
      '左上区域展示同一角色的高质量头肩特写，左侧展示从角色服装提取的主要配色板',
      '仅当人物参考图中明确存在具有辨识度的特殊材质、配饰、武器或随身物品时，才在左下区域展示对应局部细节；简单角色或没有明显配饰时省略该区域，并重新平衡版面留白',
      '右侧展示简洁的人体比例辅助线和身高标尺，右下区域展示缩小的完整角色比例图',
    ],
    style: [
      '页面像专业角色设定板，不是剧情插画，不是海报',
      '背景保持纯白或浅灰，不要剧情场景、环境背景或复杂道具',
      '版式整洁清晰，各区域间距规整，具有专业动画、游戏和影视制作角色模型设定板的信息层级',
      '不要电影光效、粒子、景深、逆光或复杂阴影，不要生成海报或单张剧情插画',
    ],
    quality: [
      '面料质感清晰；刺绣、提花、金属、珠玉等细节只呈现参考图中实际存在的内容',
      '头像区突出皮肤、眼睛、嘴唇和发丝；首饰细节仅在参考图中实际存在时呈现',
      '设定板各信息区分辨率充足，局部细节可读',
    ],
    consistency: [
      '脸型、五官、发型、发色、服装结构、身材比例以及参考图中实际存在的配饰位置完全一致',
      '不要换脸，不要改动参考图中已有发饰，不要丢失已有首饰和衣纹细节，也不得新增参考图中不存在的配饰',
      '所有区域都是同一个角色的技术视图，不得混入其他角色或不同脸型、不同服装版本',
    ],
    output: [
      '单张完整横版角色主设定板，不裁切头部、手、脚或服装',
      '不要输出大段文字，避免乱码，只保留简洁分区线、配色色块、标尺和视觉标记',
      '必选内容包含三视图、头像、配色和人体比例；材质与配饰信息区为按需内容，没有明显材质或配饰时直接省略',
      '不得为了填充版面虚构配饰、花纹、武器、道具或服装细节',
    ],
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}

/**
 * 构建场景资产封面 prompt。
 * @param {Record<string, unknown>} asset 资产字段。
 * @returns {{template: string, blueprint: PromptBlueprint, prompt: string}} 模板、blueprint 和最终 prompt。
 * @example
 * buildAssetCoverPrompt({ name: "CG背景", type: "scene", meta: "便利店外景" })
 * // => { template: "cinematic-default", blueprint: {...}, prompt: "..." }
 */
export function buildAssetCoverPrompt(asset: Record<string, unknown>) {
  const template = selectPromptTemplate([asset.type, asset.meta, asset.name]);
  const blueprint = buildPromptBlueprint({
    template,
    intro: '为漫剧分镜系统生成一张场景资产封面图',
    subject: normalizeTextList([
      asset.name ? `资产名称为${asset.name}` : '',
      asset.type ? `资产类型为${asset.type}` : '',
      asset.meta ? `资产说明为${asset.meta}` : '',
    ]),
    action: ['突出单一场景资产的结构、材质和空间氛围'],
    camera: ['以清晰可读的横版构图展示资产主体'],
    style: ['适合作为背景或场景资产预览'],
    output: ['横版 16:9', '单一场景资产封面'],
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}

/**
 * 构建角色主语音参考的文本 prompt。
 * @param {Record<string, unknown>} character 角色字段。
 * @returns {{template: string, blueprint: PromptBlueprint, prompt: string}} 模板、blueprint 和最终 prompt。
 * @example
 * buildCharacterVoicePromptText({ name: "林婉", description: "温婉端庄" })
 * // => { template: "cinematic-default", blueprint: {...}, prompt: "..." }
 */
export function buildCharacterVoicePromptText(
  character: Record<string, unknown>,
  userDirection = '',
) {
  const template = selectPromptTemplate([character.description]);
  const blueprint = buildPromptBlueprint({
    template,
    intro: '为漫剧角色设计一段稳定可复用的中文主语音',
    subject: normalizeTextList([
      character.name ? `角色名为${character.name}` : '',
      character.description ? `人设描述为${character.description}` : '',
    ]),
    style: ['自然真人感', '适合剧情对白', '声音气质贴合角色而不过度表演'],
    action: normalizeTextList([
      userDirection ? `创作者补充要求：${userDirection}` : '',
    ]),
    audio: ['吐字清晰', '口语节奏自然', '一句 3-5 秒短句', '不要主持腔', '不要广告腔'],
    output: ['生成 3-5 秒短句参考音频', '适合作为主语音参考'],
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}
