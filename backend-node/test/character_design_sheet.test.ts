import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { buildCharacterDesignPrompt } from '../app/lib/prompt_library';
import * as CharacterServiceNamespace from '../app/service/character';

const CharacterService: any =
  (CharacterServiceNamespace as any).default || CharacterServiceNamespace;

describe('test/character_design_sheet.test.ts', () => {
  it('uses a fixed horizontal design-sheet layout prompt', () => {
    const result = buildCharacterDesignPrompt({
      name: '林婉',
      description: '温婉端庄，白色长裙',
    });

    assert.ok(result.prompt.includes('唯一上传的人物参考图是角色外观的唯一事实来源'));
    assert.ok(result.prompt.includes('横向画布'));
    assert.ok(result.prompt.includes('正面全身、标准侧面全身和背面全身三视图'));
    assert.ok(result.prompt.includes('左上区域展示同一角色的高质量头肩特写'));
    assert.ok(result.prompt.includes('右侧展示简洁的人体比例辅助线和身高标尺'));
    assert.ok(result.prompt.includes('不得据此重新设计角色'));
    assert.ok(result.prompt.includes('不要输出大段文字，避免乱码'));
  });

  it('collects only the character reference image for design-sheet generation', () => {
    const service = Object.create(CharacterService.prototype);
    service.app = {
      config: {
        storyboard: {
          publicAppBaseUrl: '',
          generatedAssetBasePath: '/generated',
        },
      },
    };

    const result = service.collectDesignReferenceImages({
      name: '林婉',
      avatar_url: 'https://example.com/lin-wan.png',
    });

    assert.equal(result.avatarUrl, 'https://example.com/lin-wan.png');
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.references, [
      {
        type: 'character-reference',
        name: '林婉 角色参考图',
        url: 'https://example.com/lin-wan.png',
        source: 'character.avatar_url',
      },
    ]);
    assert.equal('layoutUrl' in result, false);
  });
});
