import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  DEFAULT_AUTH,
  DEFAULT_DATABASE,
  DEFAULT_ENV_PATH,
  DEFAULT_SERVER,
  DEFAULT_STORYBOARD_STORAGE,
} from '../config/shared/constants';

describe('shared configuration defaults', () => {
  it('groups infrastructure defaults by responsibility', () => {
    assert.deepEqual(DEFAULT_ENV_PATH, {
      LOCAL: '.env',
      LEGACY_GO_FALLBACK: '../backend/.env',
    });
    assert.deepEqual(DEFAULT_SERVER, {
      PORT: 8083,
      HOST: '0.0.0.0',
    });
    assert.deepEqual(DEFAULT_DATABASE, {
      HOST: '127.0.0.1',
      PORT: 3306,
      USER: 'root',
      NAME: 'storyboard',
    });
    assert.deepEqual(DEFAULT_STORYBOARD_STORAGE, {
      PUBLIC_APP_BASE_URL: '',
      GENERATED_ASSET_DIR: '../storage',
      GENERATED_ASSET_BASE_PATH: '/generated',
    });
    assert.deepEqual(DEFAULT_AUTH, {
      COOKIE_NAME: 'storyboard_session',
      SESSION_TTL_DAYS: 14,
      BOOTSTRAP_DISPLAY_NAME: '创作者',
      BOOTSTRAP_ROLE_LABEL: '分镜工作室',
    });
  });

  it('prevents runtime mutation of grouped infrastructure defaults', () => {
    assert.equal(Object.isFrozen(DEFAULT_ENV_PATH), true);
    assert.equal(Object.isFrozen(DEFAULT_SERVER), true);
    assert.equal(Object.isFrozen(DEFAULT_DATABASE), true);
    assert.equal(Object.isFrozen(DEFAULT_STORYBOARD_STORAGE), true);
    assert.equal(Object.isFrozen(DEFAULT_AUTH), true);
  });
});
