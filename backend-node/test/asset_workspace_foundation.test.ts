import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import * as AiClientsNamespace from '../app/lib/ai_clients';
import * as AssetServiceNamespace from '../app/service/asset';
import * as AssetWorkspaceServiceNamespace from '../app/service/asset_workspace';
import * as ScriptImportNamespace from '../app/lib/script_import';
import { GENERATION_STATUS } from '../app/lib/domain_constants';

const aiClients: any = (AiClientsNamespace as any).default || AiClientsNamespace;
const scriptImport: any = (ScriptImportNamespace as any).default || ScriptImportNamespace;
const AssetService: any = (AssetServiceNamespace as any).default || AssetServiceNamespace;
const AssetWorkspaceService: any =
  (AssetWorkspaceServiceNamespace as any).default || AssetWorkspaceServiceNamespace;

describe('test/asset_workspace_foundation.test.ts', () => {
  it('exposes Seedream as the only image generation client', () => {
    assert.equal(typeof aiClients.generateSeedreamImage, 'function');
    assert.equal(aiClients.generateWanxImage, undefined);
    assert.equal(aiClients.generateWanxImageWithReferences, undefined);
    assert.equal(aiClients.generateOpenAIImage, undefined);
  });

  it('keeps per-scene prop requirements during script normalization', () => {
    const { parsed } = scriptImport.normalizeLLMStoryboardDocument({
      characters: [],
      chapters: [
        {
          title: '第一集',
          summary: '测试',
          order: 1,
          scenes: [
            {
              title: '雨夜小巷',
              summary: '角色找到钥匙',
              location: '旧城区小巷',
              time_of_day: '夜',
              order: 1,
              characters: [],
              props: [{ name: '铜钥匙', description: '表面有月牙划痕' }],
              storyboards: [
                {
                  order: 1,
                  shot_number: 1,
                  visual_description: '一把铜钥匙落在积水里',
                  dialogue: '',
                  duration_seconds: 5,
                  shot_type: '特写',
                  camera_angle: '俯视',
                  mood: '悬疑',
                  notes: '',
                  characters: [],
                },
              ],
            },
          ],
        },
      ],
    });

    assert.deepEqual(parsed.chapters[0].scenes[0].props, [
      { name: '铜钥匙', description: '表面有月牙划痕' },
    ]);
  });

  it('keeps the asset API string contract while storing valid JSON metadata', () => {
    const service = Object.create(AssetService.prototype);
    assert.equal(service.normalizeMetaForApi({ description: '雨夜旧城区' }), '雨夜旧城区');
    assert.equal(service.normalizeMetaForApi('{"description":"废弃照相馆"}'), '废弃照相馆');
    assert.equal(service.serializeMeta('雨夜旧城区'), '{"description":"雨夜旧城区"}');
  });

  it('keeps a failed regeneration visible when the previous media still exists', () => {
    const service = Object.create(AssetWorkspaceService.prototype);
    assert.equal(
      service.deriveRequirementStatus(GENERATION_STATUS.FAILED, true),
      GENERATION_STATUS.FAILED,
    );
    assert.equal(
      service.deriveRequirementStatus(GENERATION_STATUS.GENERATING, true),
      GENERATION_STATUS.GENERATING,
    );
    assert.equal(
      service.deriveRequirementStatus(GENERATION_STATUS.CONFIRMED, true),
      GENERATION_STATUS.CONFIRMED,
    );
    assert.equal(
      service.deriveRequirementStatus(GENERATION_STATUS.GENERATED, true),
      GENERATION_STATUS.GENERATED,
    );
    assert.equal(
      service.deriveRequirementStatus(GENERATION_STATUS.FAILED, false),
      GENERATION_STATUS.FAILED,
    );
    assert.equal(
      service.deriveRequirementStatus(GENERATION_STATUS.GENERATED, false),
      GENERATION_STATUS.PENDING,
    );
  });
});
