import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { describe, it } from 'mocha';

const require = createRequire(import.meta.url);
const { createCharacterVoicePreview } = require('../app/lib/ai_clients');
const CharacterService = require('../app/service/character');

const FIXED_REFERENCE_TEXT = '今天风很轻，我们慢慢把事情说清楚。';

function mockApp() {
  return { config: { storyboard: {} }, logger: {} };
}

function mockCharacterService(pool: { execute: (...args: unknown[]) => Promise<unknown> }) {
  const service = Object.create(CharacterService.prototype);
  Object.defineProperty(service, 'pool', { value: pool, configurable: true });
  Object.defineProperty(service, 'app', { value: mockApp(), configurable: true });
  Object.defineProperty(service, 'ctx', {
    value: {
      service: {
        assetVersioning: { recordVoiceVersion: async () => undefined },
      },
    },
    configurable: true,
  });
  Object.defineProperty(service, 'findById', {
    value: async () => ({ id: 8, name: '林婉', voice_name: 'linwan_8' }),
    configurable: true,
  });
  return service;
}

describe('test/voice_reference_params.test.ts', () => {
  it('honors custom preview text and falls back to the fixed line', async () => {
    const character = { id: 8, name: '林婉', description: '温婉端庄' };
    const custom = await createCharacterVoicePreview(mockApp(), character, '', '今晚你先走。');
    assert.equal(custom.previewText, '今晚你先走。');
    const fallback = await createCharacterVoicePreview(mockApp(), character, '', '   ');
    assert.equal(fallback.previewText, FIXED_REFERENCE_TEXT);
    const trimmed = await createCharacterVoicePreview(mockApp(), character, '', '甲'.repeat(80));
    assert.equal(trimmed.previewText, '甲'.repeat(50));
  });

  it('keeps preferred_name within the 16-char provider limit', async () => {
    for (const id of [8, 999, 12345]) {
      const preview = await createCharacterVoicePreview(
        mockApp(),
        { id, name: '林婉端庄温柔克制', description: '' },
        '',
        '',
      );
      assert.ok(
        preview.preferredVoiceName.length <= 16,
        `${preview.preferredVoiceName} exceeds 16 chars`,
      );
      assert.ok(preview.preferredVoiceName.endsWith(`_${id}`));
    }
  });

  it('manual upload claims atomically and returns current on loss', async () => {
    const executed: unknown[][] = [];
    const loserPool = {
      execute: async (...args: unknown[]) => {
        executed.push(args);
        return [{ affectedRows: 0 }, []];
      },
    };
    const loser = mockCharacterService(loserPool);
    const current = await loser.uploadVoiceReference(8, '/generated/characters/manual.wav');
    assert.equal(current.voice_name, 'linwan_8');
    const claim = executed.find(
      (args) =>
        typeof args[0] === 'string' &&
        (args[0] as string).includes("voice_reference_status != 'generating'"),
    );
    assert.ok(claim, 'upload should claim with a conditional update');
  });
});
