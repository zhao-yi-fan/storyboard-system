'use strict';
import {
  buildPromptBlueprint,
  normalizeTextList,
  renderPromptBlueprint,
  resolveStylePresetPrompt,
  selectImageCoverTemplate,
  selectPromptTemplate,
  uniqueParts,
} from './prompt_blueprint';

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
 * 构建场景资产封面 prompt。
 * @param {Record<string, unknown>} asset 资产字段。
 * @returns {{template: string, blueprint: PromptBlueprint, prompt: string}} 模板、blueprint 和最终 prompt。
 * @example
 * buildAssetCoverPrompt({ name: "CG背景", type: "scene", meta: "便利店外景" })
 * // => { template: "cinematic-default", blueprint: {...}, prompt: "..." }
 */
import type { AssetEntity } from './entity';

export function buildAssetCoverPrompt(asset: AssetEntity) {
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
