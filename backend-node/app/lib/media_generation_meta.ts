'use strict';

export function parseMediaGenerationMeta(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (Buffer.isBuffer(value)) return parseMediaGenerationMeta(value.toString('utf8'));
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function serializeMediaGenerationMeta(value: unknown): string {
  if (!value) return '';
  if (Buffer.isBuffer(value)) return serializeMediaGenerationMeta(value.toString('utf8'));
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') return JSON.stringify(value);
  return '';
}
