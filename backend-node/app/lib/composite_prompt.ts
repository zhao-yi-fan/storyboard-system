'use strict';

export const COMPOSITE_PROMPT_MAX_LENGTH = 10000;

const SINGLE_FRAME_CONSTRAINT =
  '只生成一张完整的单幅画面，禁止多格漫画、拼贴、分屏或同时展示多个镜头。';

export function normalizeCompositePrompt(value: unknown) {
  return String(value || '').trim();
}

export function assertCompositePromptLength(value: unknown) {
  const prompt = normalizeCompositePrompt(value);
  if (prompt.length > COMPOSITE_PROMPT_MAX_LENGTH) {
    throw new Error(`提示词最多支持 ${COMPOSITE_PROMPT_MAX_LENGTH} 个字符`);
  }
  return prompt;
}

export function isCompositeStoryboardPrompt(value: unknown) {
  const prompt = normalizeCompositePrompt(value);
  return (
    /(?:^|\n)\s*镜号[：:]/.test(prompt) && /\[(?:环境光影|人物站位|要求|画面)\][：:]/.test(prompt)
  );
}

function extractPictureSection(prompt: string) {
  const match = prompt.match(/\[画面\][：:]\s*([\s\S]*?)(?=\n\s*(?:\[[^\]\n]+\][：:]|【)|$)/);
  return match ? `[画面]：${match[1].trim()}` : '';
}

export function extractFirstShotCoverPrompt(value: unknown) {
  const prompt = assertCompositePromptLength(value);
  if (!isCompositeStoryboardPrompt(prompt)) {
    return [prompt, SINGLE_FRAME_CONSTRAINT].filter(Boolean).join('\n\n');
  }

  const shotMatches = Array.from(prompt.matchAll(/(?:^|\n)\s*镜号[：:]/g));
  const firstShotIndex = shotMatches[0]?.index ?? -1;
  if (firstShotIndex < 0) {
    return [prompt, SINGLE_FRAME_CONSTRAINT].filter(Boolean).join('\n\n');
  }
  const secondShotIndex = shotMatches[1]?.index ?? prompt.length;
  const pictureIndex = prompt.indexOf('[画面]', firstShotIndex);
  const firstShotEnd =
    pictureIndex >= 0 && pictureIndex < secondShotIndex ? pictureIndex : secondShotIndex;
  const common = prompt.slice(0, firstShotIndex).trim();
  const firstShot = prompt
    .slice(firstShotIndex, firstShotEnd)
    .trim()
    .replace(/\s*\|\s*台词\s*&\s*音效[：:][\s\S]*$/i, '')
    .trim();
  const picture = extractPictureSection(prompt);
  return [common, firstShot, picture, SINGLE_FRAME_CONSTRAINT].filter(Boolean).join('\n\n');
}

export function buildCompositeVideoPrompt(
  value: unknown,
  options: { audio?: boolean; useFirstFrame?: boolean } = {},
) {
  const prompt = assertCompositePromptLength(value);
  const execution: string[] = [];
  if (options.audio === false) {
    execution.push('本次输出无声视频，不生成对白、旁白、环境音或背景音乐。');
  }
  if (options.useFirstFrame) {
    execution.push('以提供的首帧作为画面起点，保持人物身份、服装、场景和构图连续。');
  }
  return [prompt, execution.length ? `[本次生成执行要求]：${execution.join('')}` : '']
    .filter(Boolean)
    .join('\n\n');
}
