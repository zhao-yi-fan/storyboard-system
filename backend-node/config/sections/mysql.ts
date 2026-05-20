'use strict';

import {
  DEFAULT_DB_HOST,
  DEFAULT_DB_NAME,
  DEFAULT_DB_PORT,
  DEFAULT_DB_USER,
} from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildMysqlConfig() {
  return {
    host: getStringEnv('DB_HOST', DEFAULT_DB_HOST),
    port: getNumberEnv('DB_PORT', DEFAULT_DB_PORT),
    user: getStringEnv('DB_USER', DEFAULT_DB_USER),
    password: getStringEnv('DB_PASSWORD', ''),
    database: getStringEnv('DB_NAME', DEFAULT_DB_NAME),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
    timezone: 'Z',
  };
}
