'use strict';

import { DEFAULT_DATABASE } from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildMysqlConfig() {
  return {
    host: getStringEnv('DB_HOST', DEFAULT_DATABASE.HOST),
    port: getNumberEnv('DB_PORT', DEFAULT_DATABASE.PORT),
    user: getStringEnv('DB_USER', DEFAULT_DATABASE.USER),
    password: getStringEnv('DB_PASSWORD', ''),
    database: getStringEnv('DB_NAME', DEFAULT_DATABASE.NAME),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
    timezone: 'Z',
  };
}
