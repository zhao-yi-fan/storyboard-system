'use strict';
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
import type { CharacterEntity, SceneEntity, StoryboardEntity } from './entity';
import { buildPromptBlueprint, buildVideoTimeline, expandCameraDirection, expandCameraMotion, expandShotType, normalizeTextList, renderPromptBlueprint,selectPromptTemplate, summarizeVideoContent, VIDEO_NEGATIVE } from './prompt_blueprint';

export function buildStoryboardVideoPrompt(
  storyboard: Partial<StoryboardEntity>,
  scene: Partial<SceneEntity>,
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
            .map((item: CharacterEntity) => String(item?.name || '').trim())
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
