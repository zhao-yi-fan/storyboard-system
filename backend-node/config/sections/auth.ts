'use strict';

import {
  DEFAULT_AUTH_BOOTSTRAP_DISPLAY_NAME,
  DEFAULT_AUTH_BOOTSTRAP_ROLE_LABEL,
  DEFAULT_AUTH_COOKIE_NAME,
  DEFAULT_AUTH_SESSION_TTL_DAYS,
} from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildAuthConfig() {
  return {
    bootstrapAccount: getStringEnv('AUTH_BOOTSTRAP_ACCOUNT', ''),
    bootstrapPassword: getStringEnv('AUTH_BOOTSTRAP_PASSWORD', ''),
    bootstrapDisplayName: getStringEnv('AUTH_BOOTSTRAP_DISPLAY_NAME', DEFAULT_AUTH_BOOTSTRAP_DISPLAY_NAME),
    bootstrapRoleLabel: getStringEnv('AUTH_BOOTSTRAP_ROLE_LABEL', DEFAULT_AUTH_BOOTSTRAP_ROLE_LABEL),
    sessionCookieName: getStringEnv('AUTH_SESSION_COOKIE_NAME', DEFAULT_AUTH_COOKIE_NAME),
    sessionTtlDays: getNumberEnv('AUTH_SESSION_TTL_DAYS', DEFAULT_AUTH_SESSION_TTL_DAYS),
    publicPaths: [
      '/api/health',
      '/api/auth/login',
      '/api/auth/logout',
    ],
  };
}
