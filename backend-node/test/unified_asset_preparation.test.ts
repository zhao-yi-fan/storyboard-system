import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { describe, it } from 'mocha';

// @ts-expect-error: tests execute as ESM while the app's tsc assumes CJS
const require = createRequire(import.meta.url);
const RequirementService = require('../app/service/asset_requirement');

function serviceFor(rows: Record<string, unknown>[], fail = false) {
  const service = Object.create(RequirementService.prototype);
  const generated: number[] = [];
  const writes: unknown[][] = [];
  Object.defineProperty(service, 'app', {
    value: {
      mysqlPool: {
        execute: async (_sql: string, params: unknown[]) => {
          writes.push(params);
          return [];
        },
      },
      config: { storyboard: {} },
    },
  });
  service.ctx = {
    service: {
      character: {
        generateDesignSheet: async (id: number) => {
          generated.push(id);
          if (fail) throw new Error('provider failed');
        },
      },
      asset: {
        generateCover: async (id: number) => {
          generated.push(id);
        },
      },
    },
    logger: { error: () => undefined },
  };
  service.listRequirements = async () => rows;
  return { service, generated, writes };
}

describe('unified asset preparation', () => {
  const rows = [
    {
      id: 1,
      linked_entity_type: 'character',
      linked_entity_id: 29,
      status: 'pending',
      can_generate: true,
      file_url: '',
    },
    {
      id: 2,
      linked_entity_type: 'character',
      linked_entity_id: 29,
      status: 'pending',
      can_generate: true,
      file_url: '',
    },
    {
      id: 3,
      linked_entity_type: 'character',
      linked_entity_id: 30,
      status: 'failed',
      can_generate: true,
      file_url: '/old.png',
    },
    {
      id: 4,
      linked_entity_type: 'character',
      linked_entity_id: 31,
      status: 'pending',
      generation_status: 'generating',
      can_generate: true,
      file_url: '',
    },
    {
      id: 5,
      linked_entity_type: 'character',
      linked_entity_id: 32,
      status: 'pending',
      can_generate: false,
      file_url: '',
    },
  ];
  it('filters missing images and generates each shared entity only once', async () => {
    const { service, generated } = serviceFor(rows);
    const result = await service.generateRequirements(19, null, null, true);
    assert.deepEqual(generated, [29]);
    assert.equal(result.find((row: { id: number }) => row.id === 2).reused, true);
    assert.equal(result.find((row: { id: number }) => row.id === 5).status, 'blocked');
  });
  it('does not retry a failed shared entity twice within a batch', async () => {
    const { service, generated } = serviceFor(rows, true);
    const result = await service.generateRequirements(19, null, null, true);
    assert.deepEqual(generated, [29]);
    assert.equal(result[1].status, 'failed');
  });
  it('retains the legacy default and permits explicit regeneration with an old image', async () => {
    const { service, generated } = serviceFor(rows);
    await service.generateRequirements(19, null, 3);
    assert.deepEqual(generated, [30]);
  });
  it('keeps legacy batch retries when missing_only is omitted', async () => {
    const { service, generated } = serviceFor(rows);
    await service.generateRequirements(19, null, null);
    assert.deepEqual(generated, [29, 30]);
  });
  it('reconciles successful entity tasks while retaining failed regeneration media', async () => {
    const { service, writes } = serviceFor([]);
    delete service.listRequirements;
    service.syncAssetRequirements = async () => undefined;
    service.queryRequirements = async () => [
      {
        id: 1,
        project_id: 19,
        chapter_id: 1,
        linked_entity_type: 'character',
        linked_entity_id: 29,
        character_avatar_url: '/generated/ref.png',
        status: 'failed',
        error_message: 'old error',
        file_url: '/generated/new.png',
        entity_generation_status: 'succeeded',
      },
      {
        id: 2,
        project_id: 19,
        chapter_id: 2,
        linked_entity_type: 'character',
        linked_entity_id: 29,
        character_avatar_url: '/generated/ref.png',
        status: 'generating',
        file_url: '/generated/new.png',
        entity_generation_status: 'succeeded',
      },
      {
        id: 3,
        project_id: 19,
        chapter_id: 1,
        linked_entity_type: 'asset',
        linked_entity_id: 1,
        status: 'failed',
        file_url: '/generated/old.png',
        entity_generation_status: 'failed',
        entity_generation_error: 'provider error',
      },
    ];
    const result = await service.listRequirements(19, null);
    assert.equal(writes.length, 1);
    assert.equal(result[0].status, 'generated');
    assert.equal(result[0].generation_error, '');
    assert.equal(result[1].status, 'generated');
    assert.equal(result[2].file_url, '/generated/old.png');
    assert.equal(result[2].generation_error, 'provider error');
  });
});
