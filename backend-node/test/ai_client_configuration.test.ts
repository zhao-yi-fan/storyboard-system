import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  AI_IMAGE_SIZE,
  AI_POLL_INTERVAL_MS,
  AI_REQUEST_TIMEOUT,
  AI_VIDEO_DEFAULT,
  AI_VOICE_DEFAULT,
} from '../app/lib/ai_client_constants';
import {
  findFirstMessage,
  findFirstVideoUrl,
  normalizeBaseUrl,
  resolveTimeoutMs,
} from '../app/lib/ai_client_http';
import {
  DEFAULT_PROVIDER_BASE_URL,
  DEFAULT_PROVIDER_MODEL,
  DEFAULT_REQUEST_TIMEOUT_SECONDS,
} from '../config/shared/constants';

describe('AI client configuration', () => {
  it('groups provider defaults by configuration category', () => {
    assert.equal(DEFAULT_PROVIDER_BASE_URL.DASHSCOPE, 'https://dashscope.aliyuncs.com/api/v1');
    assert.equal(DEFAULT_PROVIDER_MODEL.SEEDREAM_IMAGE, 'doubao-seedream-4-5-251128');
    assert.equal(DEFAULT_PROVIDER_MODEL.WANX_VIDEO, 'wan2.7-i2v');
    assert.equal(
      AI_REQUEST_TIMEOUT.SEEDREAM_SECONDS,
      DEFAULT_REQUEST_TIMEOUT_SECONDS.STANDARD,
    );
    assert.equal(
      AI_REQUEST_TIMEOUT.WANX_VIDEO_SECONDS,
      DEFAULT_REQUEST_TIMEOUT_SECONDS.LONG,
    );
    assert.equal(
      AI_REQUEST_TIMEOUT.VOICE_SECONDS,
      DEFAULT_REQUEST_TIMEOUT_SECONDS.VOICE,
    );
  });

  it('keeps media dimensions, polling, and voice specifications centralized', () => {
    assert.deepEqual(AI_IMAGE_SIZE, {
      STORYBOARD_COVER: '2560x1440',
      CHARACTER_DESIGN_SHEET: '2304x1600',
    });
    assert.deepEqual(AI_POLL_INTERVAL_MS, {
      WANX_VIDEO: 15000,
      SEEDANCE_VIDEO: 10000,
    });
    assert.equal(AI_VIDEO_DEFAULT.WANX_RESOLUTION, '720P');
    assert.equal(AI_VIDEO_DEFAULT.SEEDANCE_RESOLUTION, '480p');
    assert.equal(AI_VOICE_DEFAULT.SAMPLE_RATE, 24000);
    assert.equal(AI_VOICE_DEFAULT.RESPONSE_FORMAT, 'wav');
  });

  it('preserves timeout fallback and recursive response parsing behavior', () => {
    assert.equal(resolveTimeoutMs(undefined, 180, 300000), 180000);
    assert.equal(resolveTimeoutMs('invalid', 180, 300000), 300000);
    assert.equal(normalizeBaseUrl('https://example.com/', ''), 'https://example.com');
    assert.equal(findFirstMessage({ output: [{ msg: 'provider failed' }] }), 'provider failed');
    assert.equal(
      findFirstVideoUrl({ output: { result: 'https://example.com/result.mp4' } }),
      'https://example.com/result.mp4',
    );
  });

  it('freezes grouped defaults against runtime mutation', () => {
    assert.equal(Object.isFrozen(DEFAULT_PROVIDER_BASE_URL), true);
    assert.equal(Object.isFrozen(DEFAULT_PROVIDER_MODEL), true);
    assert.equal(Object.isFrozen(DEFAULT_REQUEST_TIMEOUT_SECONDS), true);
    assert.equal(Object.isFrozen(AI_REQUEST_TIMEOUT), true);
    assert.equal(Object.isFrozen(AI_IMAGE_SIZE), true);
    assert.equal(Object.isFrozen(AI_VIDEO_DEFAULT), true);
    assert.equal(Object.isFrozen(AI_VOICE_DEFAULT), true);
  });
});
