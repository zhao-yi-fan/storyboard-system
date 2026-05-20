'use strict';

export function getStringEnv(key: string, fallback = ''): string {
  return process.env[key] || fallback;
}

export function getNumberEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw == null || raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}
