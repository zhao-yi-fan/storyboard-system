'use strict';

const Service = require('egg').Service;

const {
  assertCompositePromptLength,
  extractFirstShotCoverPrompt,
} = require('../lib/composite_prompt');
import type {
  AssetEntity,
  CharacterEntity,
  ReferenceInputItem,
  ReferenceMapping,
  SceneEntity,
  SceneVideoFrameEntity,
  VideoFrameReferenceItem,
} from '../lib/entity';

class SceneReferenceService extends Service {
  /**
   * 生成场景封面用的最终 prompt 文本。
   * @param {object} scene 场景对象，例如 `{ title: "便利店门口" }`。
   * @param {Array} storyboards 场景下镜头列表，例如 `[{ content: "李明抬头" }]`。
   * @returns {string} 最终 prompt 文本。
   * @example
   * service.buildCoverPrompt({ title: "便利店门口" }, [{ content: "李明抬头" }])
   * // => "..."
   */
  buildCoverPrompt(scene: SceneEntity) {
    const prompt = assertCompositePromptLength(scene.prompt || scene.description || '');
    if (!prompt) throw new Error('片段 Prompt 不能为空');
    return extractFirstShotCoverPrompt(prompt);
  }

  buildGenerationReferenceState(
    scene: SceneEntity,
    references: ReferenceInputItem[],
    missing: string[],
    projectReferenceNames: string[] = [],
  ) {
    const prompt = String(scene.prompt || scene.description || '');
    const boundNames = new Set(
      [
        ...(Array.isArray(scene.characters) ? scene.characters : []),
        ...(Array.isArray(scene.assets) ? scene.assets : []),
        ...(Array.isArray(scene.video_frame_references) ? scene.video_frame_references : []),
      ]
        .map((item) => String('name' in item && item.name ? item.name : '').trim())
        .filter(Boolean),
    );
    const typeLabels: Record<string, string> = {
      character: '角色主设定图',
      scene: '场景参考图',
      prop: '道具参考图',
      costume: '服装参考图',
      asset: '图片参考',
      video_frame: '视频抽帧',
    };
    const mappings: ReferenceMapping[] = references.map((reference, index) => {
      const name = String(reference.name || '').trim();
      const mention = name ? `@${name}` : '';
      const isMentioned = !!mention && prompt.includes(mention);
      const subject = `${typeLabels[String(reference.type || '')] || '图片参考'}「${name}」`;
      return {
        index: index + 1,
        name,
        type: reference.type as string,
        source: reference.source as string,
        mention,
        is_mentioned: isMentioned,
        prompt_text: isMentioned
          ? `参考图${index + 1}：${subject}，对应 Prompt 中的 ${mention}。`
          : `参考图${index + 1}：${subject}，作为当前片段已绑定的视觉参考。`,
      };
    });
    const boundWithoutMentions = mappings
      .filter((mapping) => !mapping.is_mentioned)
      .map((mapping) => mapping.name);
    const knownNames = Array.from(
      new Set(projectReferenceNames.map((name) => String(name || '').trim()).filter(Boolean)),
    );
    const unboundMentions = knownNames.filter(
      (name) => prompt.includes(`@${name}`) && !boundNames.has(name),
    );

    return {
      reference_images: references,
      missing_references: missing,
      mappings,
      bound_without_mentions: boundWithoutMentions,
      unbound_mentions: unboundMentions,
      recognized_bound_mentions: Array.from(boundNames).filter((name) =>
        prompt.includes(`@${name}`),
      ),
    };
  }

  async generationReferencesForScene(scene: SceneEntity) {
    const [{ references, missing }, characters, assets] = await Promise.all([
      this.ctx.service.storyboardReference.selectReferenceImages(scene, scene),
      this.ctx.service.character.findByProjectId(scene.project_id),
      this.ctx.service.asset.findByProjectId(scene.project_id),
    ]);
    const frameReferences = this.buildVideoFrameReferences(scene.video_frame_references || []);
    return this.buildGenerationReferenceState(
      scene,
      [...references, ...frameReferences],
      missing,
      [...(characters as CharacterEntity[]), ...(assets as AssetEntity[])].map((item) => item.name),
    );
  }

  buildVideoFrameReferences(frames: SceneVideoFrameEntity[]): VideoFrameReferenceItem[] {
    return frames.map((frame) => {
      const seconds = (Number(frame.timestamp_ms || 0) / 1000).toFixed(1);
      const sceneTitle = String(frame.source_scene_title || `片段${frame.source_scene_id}`);
      return {
        type: 'video_frame',
        name: `${sceneTitle} ${seconds}s 抽帧`,
        url: frame.file_url,
        source: `来源片段「${sceneTitle}」的视频版本 #${frame.source_generation_id}，时间点 ${seconds}s`,
        frame_id: frame.id,
      };
    });
  }

  async generationReferences(id: number) {
    const scene = await this.ctx.service.scene.findById(id);
    if (!scene) throw new Error('scene not found');
    return await this.generationReferencesForScene(scene);
  }

  buildReferenceMappedPrompt(prompt: string, mappings: ReferenceMapping[]) {
    if (!mappings.length) return prompt;
    return `【参考图对应关系】\n${mappings.map((mapping) => mapping.prompt_text).join('\n')}\n\n${prompt}`;
  }

  /**
   * 预览场景封面生成参数和 prompt。
   * @param {number} id 场景 id，例如 `21`。
   * @returns {Promise<object>} 预览信息，包含字段摘要、模板和最终 prompt。
   * @example
   * await service.previewCoverGeneration(21)
   * // => { action: "scene-cover", model: "seedream-4.5", final_prompt: "..." }
   */
}

module.exports = SceneReferenceService;
