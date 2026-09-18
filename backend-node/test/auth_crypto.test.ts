import assert from 'node:assert/strict';

import { describe, it } from 'mocha';

import { generateSessionToken, hashSessionToken } from '../app/lib/auth_crypto';

describe('test/auth_crypto.test.ts', () => {
  it('generates unique non-empty session tokens', () => {
    const first = generateSessionToken();
    const second = generateSessionToken();
    assert.ok(first.length > 0);
    assert.notEqual(first, second);
  });

  it('hashes tokens deterministically with sha256 hex', () => {
    const first = hashSessionToken('token-1');
    assert.equal(first, hashSessionToken('token-1'));
    assert.equal(first.length, 64);
    assert.notEqual(first, hashSessionToken('token-2'));
  });
});
