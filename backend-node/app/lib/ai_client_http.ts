'use strict';

import { AI_HTTP } from './ai_client_constants';

type JsonRecord = Record<string, any>;

function buildAuthorizationHeaders(apiKey: string, includeContentType = false) {
  return {
    Authorization: `Bearer ${apiKey}`,
    ...(includeContentType ? { 'Content-Type': AI_HTTP.JSON_CONTENT_TYPE } : {}),
  };
}

export async function postJson(
  url: string,
  apiKey: string,
  payload: unknown,
  timeoutMs: number,
) {
  const response = await fetch(url, {
    method: AI_HTTP.POST_METHOD,
    headers: buildAuthorizationHeaders(apiKey, true),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let data: JsonRecord = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`non-json response: HTTP ${response.status}`);
    }
  }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `${response.status}`;
    const error = new Error(String(message)) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function getJson(
  url: string,
  apiKey: string,
  timeoutMs: number,
) {
  const response = await fetch(url, {
    headers: buildAuthorizationHeaders(apiKey),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let data: JsonRecord = {};
  if (text.trim()) {
    data = JSON.parse(text);
  }
  if (!response.ok) {
    const error = new Error(
      String(data?.error?.message || data?.message || response.status),
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data;
}

export function requireValue(value: unknown, message: string) {
  if (!String(value || '').trim()) {
    throw new Error(message);
  }
}

export function normalizeBaseUrl(value: unknown, fallback: string) {
  return String(value || fallback).replace(/\/$/, '');
}

export function resolveTimeoutMs(
  value: unknown,
  fallbackSeconds: number,
  invalidValueFallbackMs: number,
) {
  return Number(value || fallbackSeconds) * 1000 || invalidValueFallbackMs;
}

export async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function findFirstMessage(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return '';
  }
  const record = value as JsonRecord;
  for (const key of AI_HTTP.MESSAGE_KEYS) {
    if (typeof record[key] === 'string' && record[key].trim()) {
      return record[key].trim();
    }
  }
  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const nested = findFirstMessage(item);
        if (nested) return nested;
      }
    } else if (child && typeof child === 'object') {
      const nested = findFirstMessage(child);
      if (nested) return nested;
    }
  }
  return '';
}

export function findFirstVideoUrl(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return '';
  }
  for (const [key, child] of Object.entries(value as JsonRecord)) {
    if (
      typeof child === 'string' &&
      AI_HTTP.HTTP_PROTOCOL_PATTERN.test(child) &&
      (key.toLowerCase().includes('video') ||
        child.toLowerCase().endsWith(AI_HTTP.MP4_SUFFIX))
    ) {
      return child;
    }
    if (Array.isArray(child)) {
      for (const item of child) {
        const nested = findFirstVideoUrl(item);
        if (nested) return nested;
      }
    } else if (child && typeof child === 'object') {
      const nested = findFirstVideoUrl(child);
      if (nested) return nested;
    }
  }
  return '';
}
