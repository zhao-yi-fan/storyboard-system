import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'mocha';

const require = createRequire(import.meta.url);
const {
  createCharacterVoicePreview,
  generateCharacterVoiceReference,
} = require('../app/lib/ai_clients');

const FIXED_REFERENCE_TEXT = '这一次，我不会再退让，也不会再逃避，我要亲手改写命运。';

function mockApp() {
  return {
    config: {
      storyboard: {
        dashScopeApiKey: 'test-key',
        dashScopeVoiceBaseUrl: 'https://dashscope.test/api/v1',
        dashScopeVoiceDesignModel: 'qwen-voice-design',
        dashScopeVoiceTargetModel: 'qwen3-tts-vd-test',
        dashScopeVoiceRequestTimeoutSeconds: 5,
      },
    },
  };
}

describe('test/voice_reference_text.test.ts', () => {
  it('should always use the fixed short reference text in previews', async () => {
    const character = { id: 8, name: '林婉', description: '温婉端庄' };
    for (const customText of [
      '',
      '今晚你先走。',
      '我叫林婉。过去很多选择让我失去了方向，但这一次，我想亲手改写自己的命运。',
    ]) {
      const preview = await createCharacterVoicePreview(mockApp(), character, '', customText);
      assert.equal(preview.previewText, FIXED_REFERENCE_TEXT);
    }
  });

  it('should send the fixed short reference text to DashScope', async () => {
    const originalFetch = globalThis.fetch;
    let requestBody: any = null;
    (globalThis as any).fetch = async (_url: string, options: any) => {
      requestBody = JSON.parse(String(options.body || '{}'));
      return {
        ok: true,
        text: async () => JSON.stringify({
          output: {
            voice: 'linwan_8',
            preview_audio: { data: Buffer.from('audio').toString('base64') },
          },
        }),
      };
    };

    try {
      const result = await generateCharacterVoiceReference(
        mockApp(),
        { id: 8, name: '林婉', description: '温婉端庄' },
        '',
        '我叫林婉。过去很多选择让我失去了方向，但这一次，我想亲手改写自己的命运。'
      );

      assert.equal(requestBody?.input?.preview_text, FIXED_REFERENCE_TEXT);
      assert.equal(result.voiceReferenceText, FIXED_REFERENCE_TEXT);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
