import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { describe, it } from 'mocha';

const require = createRequire(import.meta.url);
const StoryboardReferenceService = require('../app/service/storyboard_reference');

const service = Object.create(StoryboardReferenceService.prototype);

describe('test/storyboard_helpers.test.ts', () => {
  it('parses boolean flags from mixed input', () => {
    assert.equal(service.parseBooleanFlag(true), true);
    assert.equal(service.parseBooleanFlag('false'), false);
    assert.equal(service.parseBooleanFlag('0'), false);
    assert.equal(service.parseBooleanFlag('off'), false);
    assert.equal(service.parseBooleanFlag(undefined), true);
    assert.equal(service.parseBooleanFlag(null, false), false);
    assert.equal(service.parseUseFirstFrame('true'), true);
    assert.equal(service.parseGenerateAudio(''), true);
  });

  it('normalizes video duration per model', () => {
    assert.equal(service.normalizeVideoDuration('seedance-2.0', 8), 8);
    assert.equal(service.normalizeVideoDuration('wan2.7-i2v', 5), 5);
    assert.throws(() => service.normalizeVideoDuration('wan2.7-i2v', 8));
    assert.throws(() => service.normalizeVideoDuration('seedance-2.0', 99));
  });

  it('normalizes video resolution per model', () => {
    assert.equal(service.normalizeVideoResolution('seedance-2.0', '720p'), '720p');
    assert.equal(service.normalizeVideoResolution('wan2.7-i2v', '720p'), '720p');
    assert.throws(() => service.normalizeVideoResolution('seedance-2.0', '4k'));
  });

  it('detects audio assets by type and extension', () => {
    assert.equal(service.isAudioAsset({ type: 'voice', file_url: 'a.txt' }), true);
    assert.equal(service.isAudioAsset({ type: 'scene', file_url: 'a.mp3' }), true);
    assert.equal(service.isAudioAsset({ type: 'scene', file_url: 'a.png' }), false);
    assert.equal(service.getAssetFileExtension({ file_url: 'https://x/y.PNG?w=1' }), 'png');
    assert.equal(service.getAssetFileExtension({ file_url: 'https://x/noext' }), '');
  });

  it('classifies asset reference types', () => {
    assert.equal(service.getAssetReferenceType({ type: '场景', file_url: 'a.png' }), 'scene');
    assert.equal(service.getAssetReferenceType({ type: 'voice', file_url: 'a.mp3' }), 'audio');
    assert.equal(service.getAssetReferenceType({ type: '道具', file_url: 'a.png' }), 'prop');
    assert.equal(
      service.getAssetReferenceType({ type: 'unknown-thing', file_url: 'a.png' }),
      'asset',
    );
  });

  it('resolves style preset/notes with storyboard priority', () => {
    const scene = { style_preset: 'scene-preset', style_notes: 'scene-notes' };
    const storyboard = { style_preset: 'shot-preset', style_notes: '' };
    assert.equal(service.resolveStoryboardStylePreset(scene, storyboard), 'shot-preset');
    assert.equal(service.resolveStoryboardStyleNotes(scene, storyboard), 'scene-notes');
    assert.equal(
      service.resolveStoryboardStylePreset({ style_preset: '' }, { style_preset: '' }),
      '',
    );
  });

  it('detects the seedance video model', () => {
    assert.equal(service.isSeedanceVideoModel('seedance-2.0'), true);
    assert.equal(service.isSeedanceVideoModel('wan2.7-i2v'), false);
  });
});
