'use strict';

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scryptCallback);
const AUTH_CRYPTO_SPEC = Object.freeze({
  PASSWORD_KEY_LENGTH: 64,
  ENCODING: 'hex',
  SESSION_TOKEN_BYTES: 32,
});

export async function hashPassword(password: string, salt?: string) {
  const effectiveSalt = salt || randomBytes(16).toString(AUTH_CRYPTO_SPEC.ENCODING);
  const derived = (await scryptAsync(
    password,
    effectiveSalt,
    AUTH_CRYPTO_SPEC.PASSWORD_KEY_LENGTH,
  )) as Buffer;
  return {
    salt: effectiveSalt,
    hash: derived.toString(AUTH_CRYPTO_SPEC.ENCODING),
  };
}

export async function verifyPassword(password: string, salt: string, passwordHash: string) {
  const derived = (await scryptAsync(
    password,
    salt,
    AUTH_CRYPTO_SPEC.PASSWORD_KEY_LENGTH,
  )) as Buffer;
  const expected = Buffer.from(passwordHash, AUTH_CRYPTO_SPEC.ENCODING);
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}

export function generateSessionToken() {
  return randomBytes(AUTH_CRYPTO_SPEC.SESSION_TOKEN_BYTES).toString(
    AUTH_CRYPTO_SPEC.ENCODING,
  );
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest(AUTH_CRYPTO_SPEC.ENCODING);
}
