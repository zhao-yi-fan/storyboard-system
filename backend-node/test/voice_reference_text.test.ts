import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { describe, it } from 'mocha';

const require = createRequire(import.meta.url);
const { DEFAULT_PROVIDER_MODEL } = require('../config/shared/constants');
const {
  createCharacterVoicePreview,
  generateCharacterVoiceReference,
} = require('../app/lib/ai_clients');

const FIXED_REFERENCE_TEXT = '今天风很轻，我们慢慢把事情说清楚。';

function mockApp() {
  return {
    config: {
      storyboard: {
        dashScopeApiKey: 'test-key',
        dashScopeVoiceBaseUrl: 'https://dashscope.test/api/v1',
        dashScopeVoiceDesignModel: DEFAULT_PROVIDER_MODEL.DASHSCOPE_VOICE_DESIGN,
        dashScopeVoiceTargetModel: 'qwen3-tts-vd-test',
        dashScopeVoiceRequestTimeoutSeconds: 5,
      },
    },
  };
}

describe('test/voice_reference_text.test.ts', () => {
  it('should honor custom preview text and fall back to the fixed line', async () => {
    const character = { id: 8, name: '林婉', description: '温婉端庄' };
    const custom = await createCharacterVoicePreview(mockApp(), character, '', '今晚你先走。');
    assert.equal(custom.previewText, '今晚你先走。');
    const fallback = await createCharacterVoicePreview(mockApp(), character, '', '');
    assert.equal(fallback.previewText, FIXED_REFERENCE_TEXT);
    const trimmed = await createCharacterVoicePreview(mockApp(), character, '', '甲'.repeat(80));
    assert.equal(trimmed.previewText, '甲'.repeat(50));
  });

  it('should send the effective preview text to DashScope', async () => {
    const originalFetch = globalThis.fetch;
    let requestBody: { input?: { preview_text?: unknown } } | null = null;
    const mockFetch = async (_url: string, options: RequestInit) => {
      requestBody = JSON.parse(String(options.body || '{}'));
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            output: {
              voice: 'linwan_8',
              preview_audio: { data: Buffer.from('audio').toString('base64') },
            },
          }),
      };
    };
    Object.assign(globalThis, { fetch: mockFetch });

    try {
      const result = await generateCharacterVoiceReference(
        mockApp(),
        { id: 8, name: '林婉', description: '温婉端庄' },
        '',
        '我叫林婉。过去很多选择让我失去了方向，但这一次，我想亲手改写自己的命运。',
      );

      assert.equal(
        requestBody?.input?.preview_text,
        '我叫林婉。过去很多选择让我失去了方向，但这一次，我想亲手改写自己的命运。',
      );
      assert.equal(
        result.voiceReferenceText,
        '我叫林婉。过去很多选择让我失去了方向，但这一次，我想亲手改写自己的命运。',
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should merge creator direction with character identity instead of replacing it', async () => {
    const preview = await createCharacterVoicePreview(
      mockApp(),
      { id: 8, name: '林婉', description: '温婉端庄，处事克制' },
      '声音略低，语速偏慢',
      '',
    );
    assert.match(preview.voicePrompt, /林婉/);
    assert.match(preview.voicePrompt, /温婉端庄/);
    assert.match(preview.voicePrompt, /声音略低/);
    assert.match(preview.voicePrompt, /3-5 秒/);
  });
});
