'use strict';
// @ts-nocheck

const DEFAULT_MAX_SCRIPT_CHARS = 12000;
const JSON_CONTENT_TYPE = 'application/json';
const POST_METHOD = 'POST';
const JSON_FENCE_PREFIX = /^```json/;
const CODE_FENCE_PREFIX = /^```/;
const CODE_FENCE_SUFFIX = /```$/;
const TRAILING_SLASH_PATTERN = /\/$/;

const SYSTEM_PROMPT = '你是一个影视分镜整理助手。你的任务是把任意小说片段、剧本文本或叙事内容整理成可直接导入分镜系统的结构化 JSON。你只能输出一个 JSON 对象，不要输出解释、不要输出 Markdown、不要输出代码块、不要输出额外文本。没有明确章节时，自动合理分章；至少输出 1 个章节、每章至少 1 个场景、每个场景至少 1 个分镜。characters 字段只能填写人物/角色名字，绝对不能填写场景标题、地点、时间、氛围描述、镜头描述，也不能把多个信息用标点连接成一个字符串。每个 storyboard 都必须填写 visual_description，不能留空；如果原文没有直接描写，也要根据上下文补出可视化画面描述。';

type DeepSeekConfig = {
  deepSeekApiKey?: string;
  deepSeekBaseUrl?: string;
  deepSeekModel?: string;
  deepSeekRequestTimeoutSeconds?: number;
};

function buildSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [ 'chapters', 'characters' ],
    properties: {
      chapters: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [ 'title', 'summary', 'order', 'scenes' ],
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            order: { type: 'integer' },
            scenes: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                additionalProperties: false,
                required: [ 'title', 'summary', 'location', 'time_of_day', 'order', 'characters', 'storyboards' ],
                properties: {
                  title: { type: 'string' },
                  summary: { type: 'string' },
                  location: { type: 'string' },
                  time_of_day: { type: 'string' },
                  order: { type: 'integer' },
                  characters: { type: 'array', items: { type: 'string' } },
                  storyboards: {
                    type: 'array',
                    minItems: 1,
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: [ 'order', 'shot_number', 'visual_description', 'dialogue', 'duration_seconds', 'shot_type', 'camera_angle', 'mood', 'notes', 'characters' ],
                      properties: {
                        order: { type: 'integer' },
                        shot_number: { type: 'integer' },
                        visual_description: { type: 'string' },
                        dialogue: { type: 'string' },
                        duration_seconds: { type: 'number' },
                        shot_type: { type: 'string' },
                        camera_angle: { type: 'string' },
                        mood: { type: 'string' },
                        notes: { type: 'string' },
                        characters: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      characters: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [ 'name', 'description', 'appearance', 'tags' ],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            appearance: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  };
}

function buildUserPrompt(scriptText: string): string {
  return `请将下面的文本整理为章节、场景、分镜和角色结构，并且只返回一个 JSON 对象。JSON 必须严格满足下面这个 schema 的字段结构与必填要求。\n\n额外要求：\n1. characters 数组里只能出现角色名称，例如“李明”“林婉”“神秘男人”。\n2. 不允许把“旧城区雨夜小巷”“夜晚，十二点前”“废弃照相馆门口”这类地点、时间、场景描述写进 characters。\n3. 如果某个场景没有明确人物，可以返回空数组，不要编造地点词充当角色名。\n4. 每个 storyboard 的 visual_description 都必须有值，不能为空，必须写成可以直接拿去生成画面的中文描述。\n5. 如果原文主要是心理、回忆或对话，也要把它转换成可拍摄的画面描述，不要遗漏 visual_description。\n6. shot_type、camera_angle、mood、notes 允许简洁，但 visual_description 绝不能空。\n\nSchema:\n${JSON.stringify(buildSchema(), null, 2)}\n\n文本内容：\n${scriptText}`;
}

function extractJSONObject(content: string): string {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start >= 0 && end >= start) {
    return content.slice(start, end + 1).trim();
  }
  return content.trim();
}

function ensureConfigured(config: DeepSeekConfig): void {
  if (!config.deepSeekApiKey) {
    throw new Error('DeepSeek 解析未配置：缺少 DEEPSEEK_API_KEY');
  }
  if (!config.deepSeekBaseUrl) {
    throw new Error('DeepSeek 解析未配置：缺少 DEEPSEEK_BASE_URL');
  }
  if (!config.deepSeekModel) {
    throw new Error('DeepSeek 解析未配置：缺少 DEEPSEEK_MODEL');
  }
}

export async function parseScriptWithDeepSeek(config: DeepSeekConfig, scriptText: string) {
  const cleaned = String(scriptText || '').trim();
  if (!cleaned) {
    throw new Error('script text is empty');
  }
  if (cleaned.length > DEFAULT_MAX_SCRIPT_CHARS) {
    throw new Error('文本过长，请分段导入或缩短内容');
  }

  ensureConfigured(config);

  const resp = await fetch(`${String(config.deepSeekBaseUrl).replace(TRAILING_SLASH_PATTERN, '')}/chat/completions`, {
    method: POST_METHOD,
    headers: {
      Authorization: `Bearer ${config.deepSeekApiKey}`,
      'Content-Type': JSON_CONTENT_TYPE,
    },
    body: JSON.stringify({
      model: config.deepSeekModel,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(cleaned) },
      ],
    }),
    signal: AbortSignal.timeout((config.deepSeekRequestTimeoutSeconds || 180) * 1000),
  });

  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(`DeepSeek 解析失败: ${body?.error?.message || `HTTP ${resp.status}`}`);
  }

  const content = String(body?.choices?.[0]?.message?.content || '').trim();
  if (!content) {
    throw new Error('DeepSeek 解析失败：返回内容为空');
  }

  const normalized = extractJSONObject(
    content.replace(JSON_FENCE_PREFIX, '').replace(CODE_FENCE_PREFIX, '').replace(CODE_FENCE_SUFFIX, '').trim()
  );

  let document;
  try {
    document = JSON.parse(normalized);
  } catch {
    throw new Error('DeepSeek 解析失败：模型未返回合法 JSON');
  }

  return { cleaned, document };
}
