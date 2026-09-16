'use strict';

const Service = require('egg').Service;
const { optimizeStoryboardPrompt } = require('../lib/prompt_optimizer');
const { optimizeSceneDescription } = require('../lib/scene_description_optimizer');

type StoryboardConfig = Record<string, unknown>;

type OptimizePromptPayload = {
  prompt?: string;
};

type OptimizeDescriptionPayload = {
  description?: string;
  title?: string;
};

type SceneData = {
  title?: string;
  generation_duration?: number;
};

class ScenePromptService extends Service {
  async optimizePrompt(id: number | string, payload: OptimizePromptPayload): Promise<{ original_prompt: string; optimized_prompt: string; model: string }> {
    const scene: SceneData = await (this.ctx).service.scene.findById(id);
    if (!scene) {
      throw new Error('scene not found');
    }

    return await optimizeStoryboardPrompt(this.config.storyboard as StoryboardConfig, payload.prompt, {
      title: scene.title,
      duration: scene.generation_duration,
    });
  }

  async optimizeDescription(payload: OptimizeDescriptionPayload): Promise<{ original_description: string; optimized_description: string; model: string }> {
    return await optimizeSceneDescription(this.config.storyboard as StoryboardConfig, payload);
  }
}

module.exports = ScenePromptService;
