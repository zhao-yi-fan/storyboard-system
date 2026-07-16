import assert from 'node:assert/strict';
import {
  parseMediaGenerationMeta,
  serializeMediaGenerationMeta,
} from '../app/lib/media_generation_meta';

describe('test/media_generation_meta.test.ts', () => {
  it('parses MySQL JSON objects without converting them to [object Object]', () => {
    assert.deepEqual(parseMediaGenerationMeta({ duration: 8, resolution: '1080p' }), {
      duration: 8,
      resolution: '1080p',
    });
  });

  it('parses JSON strings and buffers', () => {
    assert.deepEqual(parseMediaGenerationMeta('{"duration":5}'), { duration: 5 });
    assert.deepEqual(parseMediaGenerationMeta(Buffer.from('{"duration":6}')), { duration: 6 });
  });

  it('ignores malformed legacy metadata instead of crashing version switching', () => {
    assert.deepEqual(parseMediaGenerationMeta('[object Object]'), {});
  });

  it('serializes object metadata before database writes and API responses', () => {
    assert.equal(
      serializeMediaGenerationMeta({ duration: 12, generate_audio: false }),
      '{"duration":12,"generate_audio":false}',
    );
  });
});
