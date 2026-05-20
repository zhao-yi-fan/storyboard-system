'use strict';

export const EMPTY_STRING = '';

export function toNullableString(value: unknown): string {
  return value == null ? EMPTY_STRING : String(value);
}

export function toTrimmedString(value: unknown): string {
  return toNullableString(value).trim();
}

export function toNullableNumber(value: unknown): number {
  return value == null ? 0 : Number(value);
}

export function toNullableDate(value: unknown): string | null {
  return value ? new Date(String(value)).toISOString() : null;
}

export function hasOwn(payload: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(payload, key);
}

export function toPositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return parsed > 0 ? parsed : fallback;
}
