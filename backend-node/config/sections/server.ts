'use strict';

import { DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT } from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildServerConfig() {
  return {
    port: getNumberEnv('SERVER_PORT', DEFAULT_SERVER_PORT),
    hostname: getStringEnv('SERVER_HOST', DEFAULT_SERVER_HOST),
  };
}
