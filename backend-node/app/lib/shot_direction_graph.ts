'use strict';
// @ts-nocheck

import { END, START, StateGraph, StateSchema } from '@langchain/langgraph';
import { z } from 'zod';
import { LLM_JSON_PROTOCOL } from './llm_json_protocol';

const SYSTEM_PROMPT = [
  '你是专业影视分镜导演、剪辑顾问和视频生成提示词顾问。',
  '你的任务是根据同一场景内按顺序排列的镜头，判断每个镜头的叙事走向、情绪推进、前后承接和镜头运动建议。',
  '你只能输出一个 JSON 对象，不要输出解释、Markdown、代码块或额外文本。',
].join('');

const DEFAULT_ANALYSIS = {
  narrative_role: '承接叙事',
  emotional_shift: '保持当前情绪',
  continuity_from_previous: '承接上一镜头',
  continuity_to_next: '引出下一镜头',
  camera_motion_suggestion: '静止',
  shot_type_suggestion: '中景',
  risk_flags: [],
};

const ShotDirectionState = new StateSchema({
  scene: z.any(),
  storyboards: z.array(z.any()).default([]),
  analyses: z.any().default([]),
  raw_output: z.string().default(''),
  error_message: z.string().default(''),
});

function cleanString(value: unknown): string {
  return String(value || '').trim();
}

function cleanStringList(values: unknown): string[] {
  if (Array.isArray(values)) {
    return values.map(cleanString).filter(Boolean);
  }
  const single = cleanString(values);
  return single ? [single] : [];
}

function extractJSONObject(content: string): string {
  const trimmed = cleanString(content)
    .replace(LLM_JSON_PROTOCOL.JSON_FENCE_PREFIX, '')
    .replace(LLM_JSON_PROTOCOL.CODE_FENCE_PREFIX, '')
    .replace(LLM_JSON_PROTOCOL.CODE_FENCE_SUFFIX, '')
    .trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end >= start) {
    return trimmed.slice(start, end + 1).trim();
  }
  return trimmed;
}

function ensureConfigured(config: Record<string, unknown>): void {
  if (!config.deepSeekApiKey) {
    throw new Error('DeepSeek 镜头走向分析未配置：缺少 DEEPSEEK_API_KEY');
  }
  if (!config.deepSeekBaseUrl) {
    throw new Error('DeepSeek 镜头走向分析未配置：缺少 DEEPSEEK_BASE_URL');
  }
  if (!config.deepSeekModel) {
    throw new Error('DeepSeek 镜头走向分析未配置：缺少 DEEPSEEK_MODEL');
  }
}

function normalizeStoryboardForPrompt(storyboard: Record<string, unknown>) {
  return {
    storyboard_id: Number(storyboard.id),
    shot_number: Number(storyboard.shot_number || 0),
    content: cleanString(storyboard.content),
    dialogue: cleanString(storyboard.dialogue),
    shot_type: cleanString(storyboard.shot_type),
    camera_direction: cleanString(storyboard.camera_direction),
    camera_motion: cleanString(storyboard.camera_motion),
    mood: cleanString(storyboard.mood),
    duration: Number(storyboard.duration || 0),
    background: cleanString(storyboard.background),
    notes: cleanString(storyboard.notes),
    characters: cleanStringList(storyboard.character_names),
    assets: cleanStringList(storyboard.asset_names),
  };
}

function buildUserPrompt(
  scene: Record<string, unknown>,
  storyboards: Array<Record<string, unknown>>,
): string {
  const payload = {
    scene: {
      id: Number(scene.id),
      title: cleanString(scene.title),
      description: cleanString(scene.description),
      location: cleanString(scene.location),
      time_of_day: cleanString(scene.time_of_day),
      style_preset: cleanString(scene.style_preset),
      style_notes: cleanString(scene.style_notes),
    },
    storyboards: storyboards.map(normalizeStoryboardForPrompt),
  };

  return `请分析下面这个场景内每个镜头的走向。必须按 storyboards 的顺序逐个输出，且每个镜头必须返回一条分析。

输出 JSON schema:
{
  "analyses": [
    {
      "storyboard_id": 123,
      "narrative_role": "铺垫冲突 | 冲突升级 | 情绪转折 | 信息揭示 | 动作推进 | 收束段落 | 其他明确功能",
      "emotional_shift": "当前镜头内部或相对前后镜头的情绪变化",
      "continuity_from_previous": "它如何承接上一镜头；第一个镜头说明如何开启场景",
      "continuity_to_next": "它如何引出下一镜头；最后一个镜头说明如何收束或悬置",
      "camera_motion_suggestion": "静止 | 推镜 | 拉镜 | 横移 | 跟拍 | 手持轻晃 | 其他简短镜头运动",
      "shot_type_suggestion": "远景 | 全景 | 中景 | 近景 | 特写 | 大特写 | 其他简短景别",
      "risk_flags": ["动作跨度偏大，需要拆镜"]
    }
  ]
}

分析要求:
1. 不要改写原剧情，不要新增人物。
2. 镜头运动建议要服务叙事，不要每个镜头都使用强运动。
3. 如果镜头跨度过大、承接不清、动作不可拍或人物关系不清，请写入 risk_flags。
4. risk_flags 没有问题时返回空数组。
5. 只输出合法 JSON。

场景和镜头数据:
${JSON.stringify(payload, null, 2)}`;
}

export function parseShotDirectionResponse(content: string) {
  const normalized = extractJSONObject(content);
  try {
    return JSON.parse(normalized);
  } catch {
    throw new Error('DeepSeek 镜头走向分析失败：模型未返回合法 JSON');
  }
}

export function buildFallbackAnalysis(
  storyboard: Record<string, unknown>,
  index: number,
  total: number,
) {
  return {
    storyboard_id: Number(storyboard.id),
    ...DEFAULT_ANALYSIS,
    emotional_shift: cleanString(storyboard.mood) || DEFAULT_ANALYSIS.emotional_shift,
    continuity_from_previous:
      index === 0 ? '开启当前场景' : DEFAULT_ANALYSIS.continuity_from_previous,
    continuity_to_next:
      index === total - 1 ? '收束当前场景段落' : DEFAULT_ANALYSIS.continuity_to_next,
    camera_motion_suggestion:
      cleanString(storyboard.camera_motion) || DEFAULT_ANALYSIS.camera_motion_suggestion,
    shot_type_suggestion:
      cleanString(storyboard.shot_type) || DEFAULT_ANALYSIS.shot_type_suggestion,
    risk_flags: [],
  };
}

export function normalizeShotDirectionAnalyses(
  raw: unknown,
  storyboards: Array<Record<string, unknown>>,
) {
  const rawItems = Array.isArray((raw as any)?.analyses)
    ? (raw as any).analyses
    : Array.isArray(raw)
      ? raw
      : [];
  const byStoryboardId = new Map<number, Record<string, unknown>>();
  for (const item of rawItems) {
    const storyboardId = Number((item as any)?.storyboard_id || (item as any)?.id || 0);
    if (storyboardId > 0 && !byStoryboardId.has(storyboardId)) {
      byStoryboardId.set(storyboardId, item as Record<string, unknown>);
    }
  }

  return storyboards.map((storyboard, index) => {
    const fallback = buildFallbackAnalysis(storyboard, index, storyboards.length);
    const item = byStoryboardId.get(Number(storyboard.id)) || {};
    return {
      storyboard_id: fallback.storyboard_id,
      narrative_role: cleanString(item.narrative_role) || fallback.narrative_role,
      emotional_shift: cleanString(item.emotional_shift) || fallback.emotional_shift,
      continuity_from_previous:
        cleanString(item.continuity_from_previous) || fallback.continuity_from_previous,
      continuity_to_next: cleanString(item.continuity_to_next) || fallback.continuity_to_next,
      camera_motion_suggestion:
        cleanString(item.camera_motion_suggestion) || fallback.camera_motion_suggestion,
      shot_type_suggestion: cleanString(item.shot_type_suggestion) || fallback.shot_type_suggestion,
      risk_flags: cleanStringList(item.risk_flags),
    };
  });
}

async function requestShotDirectionAnalysis(
  config: Record<string, unknown>,
  scene: Record<string, unknown>,
  storyboards: Array<Record<string, unknown>>,
) {
  ensureConfigured(config);
  const response = await fetch(
    `${String(config.deepSeekBaseUrl).replace(LLM_JSON_PROTOCOL.TRAILING_SLASH_PATTERN, '')}/chat/completions`,
    {
      method: LLM_JSON_PROTOCOL.POST_METHOD,
      headers: {
        Authorization: `Bearer ${config.deepSeekApiKey}`,
        'Content-Type': LLM_JSON_PROTOCOL.CONTENT_TYPE,
      },
      body: JSON.stringify({
        model: config.deepSeekModel,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(scene, storyboards) },
        ],
      }),
      signal: AbortSignal.timeout((Number(config.deepSeekRequestTimeoutSeconds) || 180) * 1000),
    },
  );

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `DeepSeek 镜头走向分析失败: ${body?.error?.message || `HTTP ${response.status}`}`,
    );
  }

  const content = cleanString(body?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error('DeepSeek 镜头走向分析失败：返回内容为空');
  }
  return { raw: content, parsed: parseShotDirectionResponse(content) };
}

export function buildShotDirectionGraph(options: {
  config: Record<string, unknown>;
  persistResults: (analyses: Array<Record<string, unknown>>) => Promise<void>;
}) {
  return new StateGraph(ShotDirectionState)
    .addNode('load_context', async (state) => ({
      scene: state.scene,
      storyboards: [...state.storyboards].sort(
        (a, b) =>
          Number(a.sort_order || a.shot_number || 0) - Number(b.sort_order || b.shot_number || 0),
      ),
    }))
    .addNode('analyze_shots', async (state) => {
      if (!state.storyboards.length) {
        return { analyses: [], raw_output: '' };
      }
      const result = await requestShotDirectionAnalysis(
        options.config,
        state.scene,
        state.storyboards,
      );
      return { analyses: result.parsed, raw_output: result.raw };
    })
    .addNode('validate_results', async (state) => ({
      analyses: normalizeShotDirectionAnalyses(state.analyses, state.storyboards),
    }))
    .addNode('persist_results', async (state) => {
      await options.persistResults(state.analyses);
      return {};
    })
    .addEdge(START, 'load_context')
    .addEdge('load_context', 'analyze_shots')
    .addEdge('analyze_shots', 'validate_results')
    .addEdge('validate_results', 'persist_results')
    .addEdge('persist_results', END)
    .compile();
}
