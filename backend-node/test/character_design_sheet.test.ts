import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  ENTITY_TYPE,
  GENERATION_STATUS,
} from '../app/lib/domain_constants';
import { buildCharacterDesignPrompt } from '../app/lib/prompt_library';
import * as CharacterServiceNamespace from '../app/service/character';
import * as AssetWorkspaceServiceNamespace from '../app/service/asset_workspace';

const CharacterService: any =
  (CharacterServiceNamespace as any).default || CharacterServiceNamespace;
const AssetWorkspaceService: any =
  (AssetWorkspaceServiceNamespace as any).default || AssetWorkspaceServiceNamespace;

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
    assert.ok(result.prompt.includes('仅当人物参考图中明确存在'));
    assert.ok(result.prompt.includes('没有明显配饰时省略该区域'));
    assert.ok(result.prompt.includes('不得为了填充版面虚构配饰'));
  });

  it('uses an edited final prompt and rejects empty or oversized overrides', () => {
    const service = Object.create(CharacterService.prototype);
    assert.equal(
      service.resolveDesignPrompt({ name: '林婉' }, '  用户调整后的主设定图 Prompt  '),
      '用户调整后的主设定图 Prompt',
    );
    assert.throws(
      () => service.resolveDesignPrompt({ name: '林婉' }, '   '),
      /最终 Prompt 不能为空/,
    );
    assert.throws(
      () => service.resolveDesignPrompt({ name: '林婉' }, 'a'.repeat(10001)),
      /不能超过 10000 个字符/,
    );
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

  it('preserves the previous design sheet and applies the new current version atomically', async () => {
    const calls: Array<{ kind: string; sql?: string; params?: unknown[] }> = [];
    const connection = {
      async beginTransaction() {
        calls.push({ kind: 'begin' });
      },
      async query(sql: string) {
        calls.push({ kind: 'query', sql });
        return [[], []];
      },
      async execute(sql: string, params: unknown[]) {
        calls.push({ kind: 'execute', sql, params });
        return [{ insertId: 42 }, []];
      },
      async commit() {
        calls.push({ kind: 'commit' });
      },
      async rollback() {
        calls.push({ kind: 'rollback' });
      },
      release() {
        calls.push({ kind: 'release' });
      },
    };
    const service = Object.create(AssetWorkspaceService.prototype);
    service.app = {
      mysqlPool: {
        async query() {
          return [[{ user_id: 7 }], []];
        },
        async getConnection() {
          return connection;
        },
      },
      config: {
        storyboard: {
          generatedAssetBasePath: '/generated',
          publicAppBaseUrl: '',
        },
      },
    };

    await service.recordCharacterDesignSheetVersion(
      {
        id: 8,
        project_id: 30,
        design_sheet_url: '/generated/characters/old.png',
        avatar_url: '/generated/characters/reference.png',
      },
      '/generated/characters/new.png',
      '角色设定 prompt',
    );

    const statements = calls
      .filter((call) => call.kind === 'execute')
      .map((call) => String(call.sql).replace(/\s+/g, ' ').trim());
    assert.equal(statements.filter((sql) => sql.startsWith('INSERT INTO asset_versions')).length, 2);
    assert.ok(statements.some((sql) => sql.includes("source_type) VALUES (?, 'project', 'character'")));
    assert.ok(statements.some((sql) => sql.startsWith('UPDATE characters SET design_sheet_url')));
    const versionInserts = calls.filter(
      (call) =>
        call.kind === 'execute' &&
        String(call.sql).replace(/\s+/g, ' ').trim().startsWith('INSERT INTO asset_versions'),
    );
    assert.deepEqual(versionInserts[0].params, [
      7,
      8,
      '/generated/characters/old.png',
      '/generated/characters/reference.png',
    ]);
    assert.deepEqual(versionInserts[1].params, [
      7,
      8,
      '/generated/characters/new.png',
      '/generated/characters/reference.png',
      '角色设定 prompt',
    ]);
    assert.equal(calls.some((call) => call.kind === 'commit'), true);
    assert.equal(calls.some((call) => call.kind === 'rollback'), false);
  });

  it('restores a succeeded design-sheet version as the character current image', async () => {
    const writes: Array<{ sql: string; params: unknown[] }> = [];
    const versionRow = {
      id: 11,
      entity_type: ENTITY_TYPE.CHARACTER,
      entity_id: 8,
      file_url: '/generated/characters/old.png',
      preview_url: '',
      status: GENERATION_STATUS.SUCCEEDED,
      is_current: 1,
      user_id: 7,
    };
    const connection = {
      async beginTransaction() {},
      async execute(sql: string, params: unknown[]) {
        writes.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
        return [{ affectedRows: 1 }, []];
      },
      async commit() {},
      async rollback() {},
      release() {},
    };
    const service = Object.create(AssetWorkspaceService.prototype);
    service.app = {
      mysqlPool: {
        async query(sql: string) {
          if (sql.includes('JOIN characters')) return [[versionRow], []];
          return [[versionRow], []];
        },
        async getConnection() {
          return connection;
        },
      },
      config: {
        storyboard: {
          generatedAssetBasePath: '/generated',
          publicAppBaseUrl: '',
        },
      },
    };

    const versions = await service.setCurrentVersion(
      ENTITY_TYPE.CHARACTER,
      8,
      11,
      7,
    );

    assert.ok(
      writes.some(
        (write) =>
          write.sql.startsWith('UPDATE characters SET design_sheet_url') &&
          write.params[0] === '/generated/characters/old.png' &&
          write.params[1] === 8,
      ),
    );
    assert.equal(versions[0].id, 11);
    assert.equal(versions[0].is_current, true);
  });
});
