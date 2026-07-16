import assert from 'node:assert/strict';
import * as SceneServiceNamespace from '../app/service/scene';

const SceneService: any =
  (SceneServiceNamespace as { default?: { prototype: object } }).default || SceneServiceNamespace;

describe('scene generation reference mapping', () => {
  it('keeps reference order and describes mention bindings in the final prompt', () => {
    const service = Object.create(SceneService.prototype);
    const state = service.buildGenerationReferenceState(
      {
        prompt: '镜号：1 | @女神 站在 @神殿 中。',
        characters: [{ name: '女神' }],
        assets: [{ name: '神殿' }],
      },
      [
        {
          type: 'scene',
          name: '神殿',
          source: 'asset.cover_url',
          url: 'https://example.com/scene.png',
        },
        {
          type: 'character',
          name: '女神',
          source: 'character.design_sheet_url',
          url: 'https://example.com/character.png',
        },
      ],
      [],
      ['女神', '神殿', '未绑定角色'],
    );

    assert.deepEqual(
      state.mappings.map((item: any) => [item.index, item.name, item.is_mentioned]),
      [
        [1, '神殿', true],
        [2, '女神', true],
      ],
    );
    assert.deepEqual(state.bound_without_mentions, []);
    assert.deepEqual(state.unbound_mentions, []);

    const prompt = service.buildReferenceMappedPrompt('首镜头正文', state.mappings);
    assert.match(prompt, /参考图1：场景参考图「神殿」/);
    assert.match(prompt, /对应 Prompt 中的 @女神/);
    assert.ok(prompt.endsWith('首镜头正文'));
  });

  it('reports bound images missing from the prompt and mentioned assets missing a binding', () => {
    const service = Object.create(SceneService.prototype);
    const state = service.buildGenerationReferenceState(
      {
        prompt: '镜号：1 | @未绑定角色 出场。',
        characters: [{ name: '女神' }],
        assets: [],
      },
      [
        {
          type: 'character',
          name: '女神',
          source: 'character.design_sheet_url',
          url: 'https://example.com/character.png',
        },
      ],
      ['scene-background'],
      ['女神', '未绑定角色'],
    );

    assert.deepEqual(state.bound_without_mentions, ['女神']);
    assert.deepEqual(state.unbound_mentions, ['未绑定角色']);
    assert.deepEqual(state.missing_references, ['scene-background']);
  });
});
