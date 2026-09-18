import assert from 'node:assert/strict';

import { describe, it } from 'mocha';

import * as AuthServiceNamespace from '../app/service/auth';

const AuthService: any =
  (AuthServiceNamespace as { default?: { prototype: object } }).default || AuthServiceNamespace;

function makeService(pool: unknown) {
  const service = Object.create(AuthService.prototype);
  Object.defineProperty(service, 'pool', { value: pool });
  return service;
}

const ACTIVE_ROW = {
  id: 3,
  account: 'editor',
  password_hash: 'hash',
  password_salt: 'salt',
  display_name: '剪辑师',
  role_label: '分镜工作室',
  is_active: 1,
  last_login_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('test/auth.test.ts', () => {
  it('maps active rows and null rows', async () => {
    const service = makeService({ query: async () => [[ACTIVE_ROW]] });
    const found = await service.findUserByAccount('editor');
    assert.equal(found.account, 'editor');
    assert.equal(found.display_name, '剪辑师');
    const missing = makeService({ query: async () => [[]] });
    assert.equal(await missing.findUserByAccount('ghost'), null);
  });

  it('rejects empty account or password on create', async () => {
    const service = makeService({ query: async () => [[]] });
    await assert.rejects(service.createUser({ account: '', password: 'x' }), /账号和密码不能为空/);
    await assert.rejects(service.createUser({ account: 'a', password: '' }), /账号和密码不能为空/);
  });

  it('rejects duplicate accounts', async () => {
    const service = makeService({ query: async () => [[ACTIVE_ROW]] });
    await assert.rejects(
      service.createUser({ account: 'editor', password: 'x' }),
      /账号已存在/,
    );
  });

  it('builds cookie options with expiry', () => {
    const service = Object.create(AuthService.prototype);
    const expiresAt = new Date('2026-02-01T00:00:00.000Z');
    assert.deepEqual(service.buildCookieOptions(expiresAt), {
      httpOnly: true,
      sameSite: 'lax',
      overwrite: true,
      expires: expiresAt,
    });
  });
});
