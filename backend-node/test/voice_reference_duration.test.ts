import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, it } from 'mocha';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const { normalizeAudioDuration } = require('../app/lib/media');
const CharacterService = require('../app/service/character');

async function hasAudioTools() {
  try {
    await execFileAsync('ffmpeg', ['-version']);
    await execFileAsync('ffprobe', ['-version']);
    return true;
  } catch {
    return false;
  }
}

async function createToneBuffer(durationSeconds: number) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storyboard-test-tone-'));
  const outputPath = path.join(workDir, 'tone.wav');
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=440:duration=${durationSeconds}`,
      '-ar',
      '24000',
      '-ac',
      '1',
      outputPath,
    ]);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

describe('test/voice_reference_duration.test.ts', () => {
  it('should trim generated voice references longer than 5 seconds', async function () {
    if (!(await hasAudioTools())) this.skip();
    const buffer = await createToneBuffer(6.2);

    const result = await normalizeAudioDuration(buffer, {
      minSeconds: 3,
      maxSeconds: 5,
      extension: 'wav',
      label: '生成的主语音参考',
    });

    assert.equal(result.wasTrimmed, true);
    assert.ok(
      result.originalDuration > 5,
      `expected original duration > 5, got ${result.originalDuration}`,
    );
    assert.ok(
      result.duration >= 4.8 && result.duration <= 5.05,
      `expected trimmed duration around 5, got ${result.duration}`,
    );
  });

  it('should keep generated voice references within 3-5 seconds unchanged', async function () {
    if (!(await hasAudioTools())) this.skip();
    const buffer = await createToneBuffer(4);

    const result = await normalizeAudioDuration(buffer, {
      minSeconds: 3,
      maxSeconds: 5,
      extension: 'wav',
      label: '生成的主语音参考',
    });

    assert.equal(result.wasTrimmed, false);
    assert.equal(result.audioBuffer, buffer);
    assert.ok(
      result.duration >= 3.9 && result.duration <= 4.1,
      `expected duration around 4, got ${result.duration}`,
    );
  });

  it('should reject generated voice references shorter than 3 seconds', async function () {
    if (!(await hasAudioTools())) this.skip();
    const buffer = await createToneBuffer(2);

    await assert.rejects(
      () =>
        normalizeAudioDuration(buffer, {
          minSeconds: 3,
          maxSeconds: 5,
          extension: 'wav',
          label: '生成的主语音参考',
        }),
      /低于目标下限 3\.0秒/,
    );
  });

  it('should persist a retryable failure without storing rejected audio', async () => {
    const executedQueries: unknown[] = [];
    const fakeService = {
      app: {},
      pool: {
        execute: async (...args: unknown[]) => {
          executedQueries.push(args);
        },
      },
      findById: async () => ({ id: 8, name: '林婉' }),
      generateVoiceReferenceAudio: async () => ({
        voiceName: 'linwan_8',
        voicePrompt: '年轻女性，克制',
        voiceReferenceText: '我叫林婉。',
        audioBuffer: Buffer.from('short-audio'),
        extension: 'wav',
      }),
      normalizeGeneratedVoiceReferenceAudio: async () => {
        throw new Error('生成的主语音参考只有 2.0秒，低于目标下限 3.0秒。');
      },
      storeGeneratedVoiceReferenceAudio: async () => {
        throw new Error('should not store rejected audio');
      },
    };

    await assert.rejects(
      () => CharacterService.prototype.generateVoiceReference.call(fakeService, 8, '', ''),
      /低于目标下限 3\.0秒/,
    );
    assert.equal(executedQueries.length, 2);
    assert.match(String(executedQueries[0]?.[0]), /voice_reference_status = 'generating'/);
    assert.match(String(executedQueries[1]?.[0]), /voice_reference_status = 'failed'/);
  });
});
