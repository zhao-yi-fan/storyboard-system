import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  ASSET_KIND,
  ASSET_SOURCE_TYPE,
  ENTITY_TYPE,
  GENERATION_STATUS,
  MEDIA_TYPE,
  VIDEO_MODEL,
  VIDEO_RESOLUTION,
} from '../app/lib/domain_constants';

describe('domain constants', () => {
  it('keeps persisted generation and media protocol values stable', () => {
    assert.deepEqual(GENERATION_STATUS, {
      IDLE: 'idle',
      PENDING: 'pending',
      ANALYZING: 'analyzing',
      GENERATING: 'generating',
      SUCCEEDED: 'succeeded',
      FAILED: 'failed',
      GENERATED: 'generated',
      CONFIRMED: 'confirmed',
    });
    assert.deepEqual(MEDIA_TYPE, { COVER: 'cover', VIDEO: 'video' });
  });

  it('keeps asset, entity, source, model, and resolution values stable', () => {
    assert.deepEqual(ASSET_KIND, {
      CHARACTER: 'character',
      SCENE: 'scene',
      PROP: 'prop',
      VOICE: 'voice',
    });
    assert.deepEqual(ENTITY_TYPE, {
      CHARACTER: 'character',
      ASSET: 'asset',
      PROJECT: 'project',
    });
    assert.deepEqual(ASSET_SOURCE_TYPE, {
      GENERATED: 'generated',
      LEGACY_IMPORT: 'legacy-import',
      MANUAL_UPLOAD: 'manual-upload',
    });
    assert.deepEqual(VIDEO_MODEL, {
      SEEDANCE_2: 'seedance-2.0',
      WAN_2_7_I2V: 'wan2.7-i2v',
    });
    assert.deepEqual(Object.values(VIDEO_RESOLUTION), ['480p', '720p', '1080p']);
  });

  it('prevents runtime mutation of shared protocol objects', () => {
    assert.equal(Object.isFrozen(GENERATION_STATUS), true);
    assert.equal(Object.isFrozen(MEDIA_TYPE), true);
    assert.equal(Object.isFrozen(ASSET_KIND), true);
  });
});
