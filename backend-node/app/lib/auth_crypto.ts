'use strict';

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_ENCODING = 'hex';
const SESSION_TOKEN_BYTES = 32;

export async function hashPassword(password: string, salt?: string) {
  const effectiveSalt = salt || randomBytes(16).toString(PASSWORD_ENCODING);
  const derived = await scryptAsync(password, effectiveSalt, PASSWORD_KEY_LENGTH) as Buffer;
  return {
    salt: effectiveSalt,
    hash: derived.toString(PASSWORD_ENCODING),
  };
}

export async function verifyPassword(password: string, salt: string, passwordHash: string) {
  const derived = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH) as Buffer;
  const expected = Buffer.from(passwordHash, PASSWORD_ENCODING);
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}

export function generateSessionToken() {
  return randomBytes(SESSION_TOKEN_BYTES).toString(PASSWORD_ENCODING);
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest(PASSWORD_ENCODING);
}
