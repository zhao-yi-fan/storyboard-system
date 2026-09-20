'use strict';

import { getStringEnv } from '../shared/env';

export function buildCorsConfig() {
  const raw = getStringEnv('CORS_ALLOWED_ORIGINS', '');
  const allowedOrigins = raw
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return { allowedOrigins };
}
