'use strict';
import type { PromptBeat, PromptBlueprint, PromptDisplayBlock, PromptDisplayToken } from './prompt_blueprint';
import { toDisplayItems,uniqueParts } from './prompt_blueprint';

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
        .map((item: any) => {
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
    ? options.timeline.map((item: any) => String(item?.label || '').trim()).filter(Boolean)
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
