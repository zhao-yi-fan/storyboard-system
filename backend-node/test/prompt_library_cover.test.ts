import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { buildSceneCoverPrompt, buildStoryboardCoverPrompt } from '../app/lib/prompt_library';
import { REFERENCE_TYPE } from '../app/lib/domain_constants';

const MYTHIC_PHRASES = [
  '东方神话史诗感',
  '冷冽神性气质',
  '高质量粒子拖尾',
  '能量光晕',
  '空间涟漪或符文层次',
];

describe('test/prompt_library_cover.test.ts', () => {
  it('should not use the mythic template for realistic covers containing 神情', () => {
    const result = buildStoryboardCoverPrompt(
      {
        scene_title: '照相馆内会面',
        location: '旧城区废弃照相馆内',
        time_of_day: '夜晚',
        background: '照相馆内会面 · 旧城区废弃照相馆内 · 夜晚',
        characters: ['李明'],
        content: '李明站在照相馆玻璃门前，喉结滚动了一下，他抬手握住门把，脸上带着紧张的神情',
        mood: '紧张凝重',
        style_preset: 'realistic_cinematic',
        notes: '景别：中景\n情绪：紧张凝重',
      },
      [{ type: REFERENCE_TYPE.CHARACTER }],
    );

    assert.equal(result.template, 'cinematic-default');
    for (const phrase of MYTHIC_PHRASES) {
      assert.ok(!result.prompt.includes(phrase), `prompt should not include ${phrase}`);
    }
    assert.ok(result.prompt.includes('写实电影质感，自然光影层次'));
    assert.ok(!result.prompt.includes('realistic_cinematic'));
  });

  it('should route 神秘 mood to suspense instead of mythic when no style preset is set', () => {
    const result = buildStoryboardCoverPrompt(
      {
        content: '老旧木门被推开，暖黄色微光从门内漫出来',
        mood: '神秘',
        style_preset: '',
      },
      [],
    );

    assert.equal(result.template, 'suspense-pressure');
    assert.ok(result.prompt.includes('悬疑压迫感'));
    assert.ok(!result.prompt.includes('东方神话史诗感'));
    assert.ok(!result.prompt.includes('能量光晕'));
  });

  it('should still allow explicit mythic wording without a style preset', () => {
    const result = buildStoryboardCoverPrompt(
      {
        content: '神女抬手，符文在空中展开',
        mood: '庄严',
        style_preset: '',
      },
      [],
    );

    assert.equal(result.template, 'mythic-awakening');
    assert.ok(result.prompt.includes('东方神话史诗感'));
    assert.ok(result.prompt.includes('空间涟漪或符文层次'));
  });

  it('should keep realistic scene covers cinematic even if storyboard text contains 神秘', () => {
    const result = buildSceneCoverPrompt(
      {
        title: '照相馆内会面',
        location: '旧城区废弃照相馆内',
        time_of_day: '夜晚',
        style_preset: 'realistic_cinematic',
      },
      [
        {
          content: '老旧木门被推开，暖黄色微光从门内漫出来',
          mood: '神秘',
          background: '旧城区废弃照相馆内',
          character_names: ['李明'],
        },
      ],
    );

    assert.equal(result.template, 'cinematic-default');
    assert.ok(result.prompt.includes('写实电影质感，自然光影层次'));
    assert.ok(!result.prompt.includes('realistic_cinematic'));
    assert.ok(!result.prompt.includes('东方神话史诗感'));
  });
});
