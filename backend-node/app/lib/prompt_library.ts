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

const DEFAULT_TEMPLATE = 'cinematic-default';
const DIALOGUE_TEMPLATE = 'dramatic-dialogue';
const MYTHIC_TEMPLATE = 'mythic-awakening';
const SUSPENSE_TEMPLATE = 'suspense-pressure';
const TRANSFORMATION_TEMPLATE = 'transformation-spectacle';

const CHINESE_PERIOD = '。';
const CHINESE_SEMICOLON = '；';

const COMMON_QUALITY = [
  '电影感画面组织',
  '主体明确',
  '光影层次清楚',
  '高细节质感',
];

const COMMON_OUTPUT = [
  '不要文字',
  '不要水印',
  '不要 logo',
  '不要海报排版',
];

const COMMON_NEGATIVE = [
  '避免人物五官崩坏',
  '避免手部畸形',
  '避免穿模',
  '避免廉价游戏感',
];

const VIDEO_NEGATIVE = [
  '不要切镜',
  '不要闪回',
  '不要镜头突然跳变',
  '不要字幕',
];

const TEMPLATE_LIBRARY: Record<string, Partial<PromptBlueprint>> = {
  [DEFAULT_TEMPLATE]: {
    style: [ '写实电影感', '叙事性强', '构图克制' ],
    quality: [ '画面稳定', '色彩统一', '主体和背景层次分明' ],
  },
  [DIALOGUE_TEMPLATE]: {
    style: [ '情绪张力明确', '人物关系可读', '氛围克制而压迫' ],
    camera: [ '镜头优先锁定眼神、停顿和角色之间的距离变化' ],
    quality: [ '保留细微表情和呼吸感停顿' ],
  },
  [MYTHIC_TEMPLATE]: {
    style: [ '东方神话史诗感', '冷冽神性气质', '高预算电影级 CG 质感' ],
    effects: [ '高质量粒子拖尾', '能量光晕', '空间涟漪或符文层次' ],
    quality: [ '高光与暗部层次充足', '特效与人物边缘清晰' ],
  },
  [SUSPENSE_TEMPLATE]: {
    style: [ '悬疑压迫感', '低饱和冷调', '空间留白增强不确定性' ],
    camera: [ '镜头运动克制，优先制造观察感和逼近感' ],
    quality: [ '暗部细节可读', '氛围真实，不要过曝' ],
  },
  [TRANSFORMATION_TEMPLATE]: {
    style: [ '短视频爆点感', '华丽变形过程', '高潮段视觉反差明显' ],
    effects: [ '服装或粒子形态变化', '高密度能量爆发', '动作卡点清楚' ],
    quality: [ '变化过程连续', '关键形变节点完整可见' ],
  },
};

const TEMPLATE_KEYWORDS = [
  { name: MYTHIC_TEMPLATE, patterns: [ '神', '神女', '仙', '古风', '法印', '符文', '神轮', '史诗', '粒子', '神性' ] },
  { name: TRANSFORMATION_TEMPLATE, patterns: [ '变装', '蜕变', '换装', '爆发', '觉醒', '进化', '成型', '汇聚' ] },
  { name: SUSPENSE_TEMPLATE, patterns: [ '悬疑', '雨夜', '黑暗', '压迫', '阴影', '监视', '窒息', '追踪', '危机' ] },
  { name: DIALOGUE_TEMPLATE, patterns: [ '对话', '对白', '独白', '凝视', '沉默', '对峙', '争执', '告白' ] },
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

function mergeSection(blueprint: PromptBlueprint, key: keyof PromptBlueprint, extra: unknown[]): void {
  const current = Array.isArray(blueprint[key]) ? blueprint[key] as string[] : [];
  blueprint[key] = uniqueParts([ ...current, ...extra ]) as never;
}

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some(pattern => text.includes(pattern));
}

function normalizeTextList(values: unknown[]): string[] {
  return uniqueParts(values).slice(0, 8);
}

function expandShotType(shotType: string): string[] {
  const value = String(shotType || '').trim();
  if (!value) {
    return [];
  }
  const clauses = [ `景别采用${value}` ];
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
  const clauses = [ `机位使用${value}` ];
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
  const clauses = [ `运镜方向采用${value}` ];
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

function buildVideoTimeline(content: string, mood: string, motion: string, duration: number): PromptBeat[] {
  const safeContent = String(content || '').trim() || '主体动作逐步展开';
  const safeMood = String(mood || '').trim() || '情绪持续累积';
  const safeMotion = String(motion || '').trim() || '镜头平稳推进';
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

export function selectPromptTemplate(values: unknown[]): string {
  const combined = uniqueParts(values).join(' ').toLowerCase();
  for (const template of TEMPLATE_KEYWORDS) {
    if (includesAny(combined, template.patterns)) {
      return template.name;
    }
  }
  return DEFAULT_TEMPLATE;
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

  mergeSection(blueprint, 'subject', [ ...(templateDefaults.subject || []), ...(input.subject || []) ]);
  mergeSection(blueprint, 'action', [ ...(templateDefaults.action || []), ...(input.action || []) ]);
  mergeSection(blueprint, 'camera', [ ...(templateDefaults.camera || []), ...(input.camera || []) ]);
  mergeSection(blueprint, 'style', [ ...(templateDefaults.style || []), ...(input.style || []) ]);
  mergeSection(blueprint, 'effects', [ ...(templateDefaults.effects || []), ...(input.effects || []) ]);
  mergeSection(blueprint, 'quality', [ ...COMMON_QUALITY, ...(templateDefaults.quality || []), ...(input.quality || []) ]);
  mergeSection(blueprint, 'consistency', [ ...(templateDefaults.consistency || []), ...(input.consistency || []) ]);
  mergeSection(blueprint, 'audio', [ ...(templateDefaults.audio || []), ...(input.audio || []) ]);
  mergeSection(blueprint, 'output', [ ...COMMON_OUTPUT, ...(templateDefaults.output || []), ...(input.output || []) ]);
  mergeSection(blueprint, 'negative', [ ...COMMON_NEGATIVE, ...(templateDefaults.negative || []), ...(input.negative || []) ]);

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
    sections.push(sentence('节奏分段', blueprint.timeline.map(item => `${item.label}：${item.description}`)));
  }
  return sections.filter(Boolean).join(' ');
}

export function buildStoryboardCoverPrompt(fields: Record<string, unknown>, references: Array<{ type: string }>) {
  const template = selectPromptTemplate([
    fields.style_preset,
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
      Array.isArray(fields.characters) && fields.characters.length ? `主要人物包括${fields.characters.join('、')}` : '',
    ]),
    action: normalizeTextList([
      fields.content ? `核心动作是${fields.content}` : '',
      fields.dialogue ? `台词氛围聚焦${fields.dialogue}` : '',
      fields.notes ? `补充叙事重点${fields.notes}` : '',
      fields.mood ? `情绪状态为${fields.mood}` : '',
    ]),
    camera: normalizeTextList([
      ...expandShotType(String(fields.shot_type || '')),
      ...expandCameraDirection(String(fields.camera_direction || '')),
      '封面图只保留一个决定性瞬间，不做多画格拼贴',
    ]),
    style: normalizeTextList([
      fields.style_preset ? `风格预设偏向${fields.style_preset}` : '',
      fields.style_notes ? `风格补充强调${fields.style_notes}` : '',
      '适合作为剧情分镜封面，不做广告海报式排版',
    ]),
    consistency: references.length
      ? [ '保持参考图中的角色造型、服装结构、发型和场景材质一致' ]
      : [ '人物和环境关系清楚，主体识别度稳定' ],
    output: [ '横版 16:9', '单幅完整镜头封面' ],
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}

export function buildStoryboardVideoPrompt(storyboard: Record<string, unknown>, scene: Record<string, unknown>, duration: number) {
  const characters = Array.isArray(storyboard.character_names) && storyboard.character_names.length
    ? storyboard.character_names
    : Array.isArray(storyboard.characters)
      ? storyboard.characters.map((item: Record<string, unknown>) => String(item?.name || '').trim()).filter(Boolean)
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
  const blueprint = buildPromptBlueprint({
    template,
    intro: `基于输入首帧图像生成一个${duration}秒的单镜头电影分镜视频`,
    subject: normalizeTextList([
      scene.title ? `场景为${scene.title}` : '',
      storyboard.background ? `背景环境为${storyboard.background}` : '',
      characters.length ? `主要人物包括${characters.join('、')}` : '',
    ]),
    action: normalizeTextList([
      storyboard.content ? `核心动作是${storyboard.content}` : '',
      storyboard.dialogue ? `人物对白或台词氛围围绕${storyboard.dialogue}` : '',
      storyboard.notes ? `补充动作提示${storyboard.notes}` : '',
      storyboard.mood ? `情绪推进围绕${storyboard.mood}` : '',
    ]),
    camera: normalizeTextList([
      ...expandShotType(String(storyboard.shot_type || '')),
      ...expandCameraDirection(String(storyboard.camera_direction || '')),
      ...expandCameraMotion(String(storyboard.camera_motion || '')),
      '保持首帧主体和构图一致，所有变化都在同一镜头内完成',
    ]),
    style: normalizeTextList([
      storyboard.style_preset || scene.style_preset ? `风格预设偏向${storyboard.style_preset || scene.style_preset}` : '',
      storyboard.style_notes || scene.style_notes ? `风格补充强调${storyboard.style_notes || scene.style_notes}` : '',
    ]),
    audio: [
      '自动生成环境音和氛围声',
      '不要旁白',
    ],
    consistency: [ '动作连续', '光影稳定', '人物结构和服装一致', '不要突然改脸或改服装' ],
    negative: VIDEO_NEGATIVE,
    output: [ '单镜头连续动作', '画面收束稳定', '镜头语言清楚' ],
    timeline: buildVideoTimeline(String(storyboard.content || ''), String(storyboard.mood || ''), String(storyboard.camera_motion || ''), duration),
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}

export function buildSceneCoverPrompt(scene: Record<string, unknown>, storyboards: Array<Record<string, unknown>>) {
  const backgrounds = uniqueParts(storyboards.map(item => item.background)).slice(0, 3);
  const characters = uniqueParts(storyboards.flatMap(item => Array.isArray(item.character_names) ? item.character_names : [])).slice(0, 5);
  const moods = uniqueParts(storyboards.map(item => item.mood)).slice(0, 4);
  const content = uniqueParts(storyboards.map(item => item.content)).slice(0, 4);
  const template = selectPromptTemplate([
    scene.style_preset,
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
    camera: [ '只生成一张完整场景代表图，不要多画格，不要机械并排多个镜头' ],
    style: normalizeTextList([
      scene.style_preset ? `风格预设偏向${scene.style_preset}` : '',
      scene.style_notes ? `风格补充强调${scene.style_notes}` : '',
      '适合作为场景树封面和场景头部预览',
    ]),
    output: [ '横版 16:9', '单幅完整场景封面' ],
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}

export function buildCharacterCoverPrompt(character: Record<string, unknown>) {
  const template = selectPromptTemplate([ character.description ]);
  const blueprint = buildPromptBlueprint({
    template,
    intro: '为漫剧分镜系统生成一张角色封面头像',
    subject: normalizeTextList([
      character.name ? `角色名称为${character.name}` : '',
      character.description ? `角色描述为${character.description}` : '',
    ]),
    action: [ '突出人物识别度和角色气质，不引入剧情性大动作' ],
    camera: [ '单人角色肖像构图', '画面聚焦头肩或半身，背景简洁' ],
    style: [ '适合在资产库中展示', '不要夸张漫画化脸部比例' ],
    output: [ '单人角色头像或半身封面', '构图干净' ],
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}

export function buildCharacterDesignPrompt(character: Record<string, unknown>, mode: string) {
  const template = selectPromptTemplate([ character.description, mode ]);
  const blueprint = buildPromptBlueprint({
    template,
    intro: '为漫剧分镜系统生成角色主设定图',
    subject: normalizeTextList([
      character.name ? `角色名称为${character.name}` : '',
      character.description ? `角色描述为${character.description}` : '',
    ]),
    action: [
      mode === 'draft'
        ? '快速确定角色长相、发型、服装和整体气质'
        : '输出最终定稿级角色设定板，作为后续镜头封面的核心参考图',
    ],
    camera: [
      '单张角色设定板内包含正面全身、侧面全身、背面全身和半身近景头像',
      '保证不同视角下的比例、服装结构和配饰位置一致',
    ],
    style: [ '背景保持纯净浅色或白底', '不要剧情场景，不要复杂道具' ],
    consistency: [ '脸型、五官、发型、发色、服装结构、配饰位置和身材比例完全一致' ],
    output: [ '单张完整设定板', '不要文字说明' ],
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}

export function buildAssetCoverPrompt(asset: Record<string, unknown>) {
  const template = selectPromptTemplate([ asset.type, asset.meta, asset.name ]);
  const blueprint = buildPromptBlueprint({
    template,
    intro: '为漫剧分镜系统生成一张场景资产封面图',
    subject: normalizeTextList([
      asset.name ? `资产名称为${asset.name}` : '',
      asset.type ? `资产类型为${asset.type}` : '',
      asset.meta ? `资产说明为${asset.meta}` : '',
    ]),
    action: [ '突出单一场景资产的结构、材质和空间氛围' ],
    camera: [ '以清晰可读的横版构图展示资产主体' ],
    style: [ '适合作为背景或场景资产预览' ],
    output: [ '横版 16:9', '单一场景资产封面' ],
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}

export function buildCharacterVoicePromptText(character: Record<string, unknown>) {
  const template = selectPromptTemplate([ character.description ]);
  const blueprint = buildPromptBlueprint({
    template,
    intro: '为漫剧角色设计一段稳定可复用的中文主语音',
    subject: normalizeTextList([
      character.name ? `角色名为${character.name}` : '',
      character.description ? `人设描述为${character.description}` : '',
    ]),
    style: [ '自然真人感', '适合剧情对白', '声音气质贴合角色而不过度表演' ],
    audio: [ '吐字清晰', '口语节奏自然', '不要主持腔', '不要广告腔' ],
    output: [ '适合作为主语音参考' ],
  });
  return {
    template,
    blueprint,
    prompt: renderPromptBlueprint(blueprint),
  };
}
