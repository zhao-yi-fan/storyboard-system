'use strict';
'use strict';

export type PromptBeat = {
  label: string;
  description: string;
};

export type PromptBlueprint = {
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

export type PromptDisplayBlock = {
  section: string;
  items: string[];
};

export type PromptDisplayToken = {
  type: 'badge' | 'text';
  label?: string;
  text: string;
};

export const PROMPT_TEMPLATE = Object.freeze({
  DEFAULT: 'cinematic-default',
  DIALOGUE: 'dramatic-dialogue',
  MYTHIC: 'mythic-awakening',
  SUSPENSE: 'suspense-pressure',
  TRANSFORMATION: 'transformation-spectacle',
});

const CHINESE_PERIOD = '。';
const CHINESE_SEMICOLON = '；';

const COMMON_QUALITY = ['电影感画面组织', '主体明确', '光影层次清楚', '高细节质感'];

const COMMON_OUTPUT = ['不要文字', '不要水印', '不要 logo', '不要海报排版'];

const COMMON_NEGATIVE = ['避免人物五官崩坏', '避免手部畸形', '避免穿模', '避免廉价游戏感'];

export const VIDEO_NEGATIVE = ['不要切镜', '不要闪回', '不要镜头突然跳变', '不要字幕'];

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
  realistic_cinematic: PROMPT_TEMPLATE.DEFAULT,
  dark_realism: PROMPT_TEMPLATE.SUSPENSE,
  mystery_thriller: PROMPT_TEMPLATE.SUSPENSE,
  youthful_bright: PROMPT_TEMPLATE.DEFAULT,
  japanese_animation: PROMPT_TEMPLATE.DEFAULT,
  retro_film: PROMPT_TEMPLATE.DEFAULT,
  warm_poetic: PROMPT_TEMPLATE.DEFAULT,
  cold_noir: PROMPT_TEMPLATE.SUSPENSE,
};

const TEMPLATE_LIBRARY: Record<string, Partial<PromptBlueprint>> = {
  [PROMPT_TEMPLATE.DEFAULT]: {
    style: ['写实电影感', '叙事性强', '构图克制'],
    quality: ['画面稳定', '色彩统一', '主体和背景层次分明'],
  },
  [PROMPT_TEMPLATE.DIALOGUE]: {
    style: ['情绪张力明确', '人物关系可读', '氛围克制而压迫'],
    camera: ['镜头优先锁定眼神、停顿和角色之间的距离变化'],
    quality: ['保留细微表情和呼吸感停顿'],
  },
  [PROMPT_TEMPLATE.MYTHIC]: {
    style: ['东方神话史诗感', '冷冽神性气质', '高预算电影级 CG 质感'],
    effects: ['高质量粒子拖尾', '能量光晕', '空间涟漪或符文层次'],
    quality: ['高光与暗部层次充足', '特效与人物边缘清晰'],
  },
  [PROMPT_TEMPLATE.SUSPENSE]: {
    style: ['悬疑压迫感', '低饱和冷调', '空间留白增强不确定性'],
    camera: ['镜头运动克制，优先制造观察感和逼近感'],
    quality: ['暗部细节可读', '氛围真实，不要过曝'],
  },
  [PROMPT_TEMPLATE.TRANSFORMATION]: {
    style: ['短视频爆点感', '华丽变形过程', '高潮段视觉反差明显'],
    effects: ['服装或粒子形态变化', '高密度能量爆发', '动作卡点清楚'],
    quality: ['变化过程连续', '关键形变节点完整可见'],
  },
};

const TEMPLATE_KEYWORDS = [
  {
    name: PROMPT_TEMPLATE.MYTHIC,
    patterns: ['神女', '神明', '仙', '古风', '法印', '符文', '神轮', '史诗', '粒子', '神性'],
  },
  {
    name: PROMPT_TEMPLATE.TRANSFORMATION,
    patterns: ['变装', '蜕变', '换装', '爆发', '觉醒', '进化', '成型', '汇聚'],
  },
  {
    name: PROMPT_TEMPLATE.SUSPENSE,
    patterns: ['悬疑', '神秘', '雨夜', '黑暗', '压迫', '阴影', '监视', '窒息', '追踪', '危机'],
  },
  {
    name: PROMPT_TEMPLATE.DIALOGUE,
    patterns: ['对话', '对白', '独白', '凝视', '沉默', '对峙', '争执', '告白'],
  },
];

export function uniqueParts(values: unknown[]): string[] {
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
  return patterns.some((pattern: any) => text.includes(pattern));
}

export function normalizeTextList(values: unknown[]): string[] {
  return uniqueParts(values).slice(0, 8);
}

export function toDisplayItems(values: unknown[]): string[] {
  return uniqueParts(values);
}

export function expandShotType(shotType: string): string[] {
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

export function expandCameraDirection(direction: string): string[] {
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

export function expandCameraMotion(motion: string): string[] {
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

export function buildVideoTimeline(
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

export function summarizeVideoContent(content: string): string {
  const text = String(content || '').trim();
  if (!text) {
    return '';
  }
  if (parseStructuredVideoBeats(text).length) {
    const headline = text
      .replace(/【[\s\S]*?】/g, ' ')
      .split(/[。；;\n]/)
      .map((item: any) => item.trim())
      .filter(Boolean)
      .find((item: any) => !/(首段|中段|尾段|开场|高潮|收束)\s*[:：]/.test(item));
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
  return PROMPT_TEMPLATE.DEFAULT;
}

export function resolveStylePresetPrompt(stylePreset: unknown): string {
  return STYLE_PRESET_PROMPT_MAP[String(stylePreset || '').trim()] || '';
}

export function selectImageCoverTemplate(stylePreset: unknown, values: unknown[]): string {
  const preset = String(stylePreset || '').trim();
  if (preset) {
    return IMAGE_COVER_STYLE_TEMPLATE_MAP[preset] || PROMPT_TEMPLATE.DEFAULT;
  }
  return selectPromptTemplate(values);
}

export function buildPromptBlueprint(input: Partial<PromptBlueprint>): PromptBlueprint {
  const template = input.template || PROMPT_TEMPLATE.DEFAULT;
  const templateDefaults =
    TEMPLATE_LIBRARY[template] || TEMPLATE_LIBRARY[PROMPT_TEMPLATE.DEFAULT] || {};
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
        blueprint.timeline.map((item: any) => `${item.label}：${item.description}`),
      ),
    );
  }
  return sections.filter(Boolean).join('\n');
}
