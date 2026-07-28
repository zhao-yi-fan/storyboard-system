'use strict';

import { DEFAULT_PROVIDER_MODEL } from '../../config/shared/constants';

export const GENERATION_STATUS = Object.freeze({
  IDLE: 'idle',
  PENDING: 'pending',
  ANALYZING: 'analyzing',
  GENERATING: 'generating',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  GENERATED: 'generated',
  CONFIRMED: 'confirmed',
});

export const MEDIA_TYPE = Object.freeze({
  COVER: 'cover',
  VIDEO: 'video',
});

export const ASSET_KIND = Object.freeze({
  CHARACTER: 'character',
  SCENE: 'scene',
  PROP: 'prop',
  VOICE: 'voice',
});

export const ENTITY_TYPE = Object.freeze({
  CHARACTER: 'character',
  ASSET: 'asset',
  PROJECT: 'project',
});

export const REFERENCE_TYPE = Object.freeze({
  CHARACTER: 'character',
  SCENE: 'scene',
  PROP: 'prop',
  AUDIO: 'audio',
  COSTUME: 'costume',
  ASSET: 'asset',
});

export const ASSET_SOURCE_TYPE = Object.freeze({
  GENERATED: 'generated',
  LEGACY_IMPORT: 'legacy-import',
  MANUAL_UPLOAD: 'manual-upload',
});

export const VIDEO_MODEL = Object.freeze({
  SEEDANCE_2: 'seedance-2.0',
  WAN_2_7_I2V: DEFAULT_PROVIDER_MODEL.WANX_VIDEO,
});

export const VIDEO_RESOLUTION = Object.freeze({
  SD: '480p',
  HD: '720p',
  FULL_HD: '1080p',
});

export const VIDEO_ASPECT_RATIO = Object.freeze({
  PORTRAIT: '9:16',
});
