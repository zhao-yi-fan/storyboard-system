'use strict';

import { getNumberEnv, getStringEnv } from '../shared/env';

export type RateLimitRule = {
  name: string;
  pattern: RegExp;
  windowSeconds: number;
  maxRequests: number;
  keyBy: 'user' | 'ip';
};

function parsePatterns(raw: string, fallback: string[]): RegExp[] {
  const sources = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const patterns: RegExp[] = [];
  for (const item of sources.length ? sources : fallback) {
    try {
      patterns.push(new RegExp(item));
    } catch {
      // 无效的自定义正则直接丢弃，用 fallback 兜底也不至于启动崩溃。
    }
  }
  return patterns.length ? patterns : fallback.map((item) => new RegExp(item));
}

export function buildRateLimitConfig(): { rules: RateLimitRule[] } {
  const billedPatterns = parsePatterns(getStringEnv('RATE_LIMIT_BILLED_PATTERNS', ''), [
    '/api/scenes/\\d+/generate-video$',
    '/api/scenes/\\d+/generate-cover$',
    '/api/scenes/\\d+/analyze-shot-directions$',
    '/api/scenes/optimize-description$',
    '/api/scenes/\\d+/optimize-',
    '/api/storyboards/\\d+/generate-',
    '/api/characters/\\d+/generate-',
    '/api/assets/\\d+/generate-cover$',
    '/api/projects/\\d+/import-script$',
  ]);
  const heavyPatterns = parsePatterns(getStringEnv('RATE_LIMIT_HEAVY_PATTERNS', ''), [
    '/api/projects/\\d+/compose-video$',
    '/api/scenes/\\d+/compose-video$',
    '/api/scenes/\\d+/resume-video$',
    '/api/scenes/\\d+/upload-cover$',
    '/api/characters/\\d+/upload-voice-reference$',
    '/api/oss/upload$',
  ]);
  return {
    rules: [
      ...billedPatterns.map((pattern) => ({
        name: 'billed',
        pattern,
        windowSeconds: getNumberEnv('RATE_LIMIT_BILLED_WINDOW_SECONDS', 600),
        maxRequests: getNumberEnv('RATE_LIMIT_BILLED_MAX_REQUESTS', 10),
        keyBy: 'user' as const,
      })),
      ...heavyPatterns.map((pattern) => ({
        name: 'heavy',
        pattern,
        windowSeconds: getNumberEnv('RATE_LIMIT_HEAVY_WINDOW_SECONDS', 600),
        maxRequests: getNumberEnv('RATE_LIMIT_HEAVY_MAX_REQUESTS', 20),
        keyBy: 'user' as const,
      })),
      {
        name: 'login',
        pattern: new RegExp('^/api/auth/login$'),
        windowSeconds: getNumberEnv('RATE_LIMIT_LOGIN_WINDOW_SECONDS', 600),
        maxRequests: getNumberEnv('RATE_LIMIT_LOGIN_MAX_REQUESTS', 20),
        keyBy: 'ip' as const,
      },
    ],
  };
}
