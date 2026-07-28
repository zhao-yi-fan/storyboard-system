'use strict';

import {
  DEFAULT_PROVIDER_BASE_URL,
  DEFAULT_PROVIDER_MODEL,
  DEFAULT_REQUEST_TIMEOUT_SECONDS,
} from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildWanxConfig() {
  return {
    wanxVideoBaseUrl: getStringEnv(
      'WANX_VIDEO_BASE_URL',
      DEFAULT_PROVIDER_BASE_URL.DASHSCOPE,
    ),
    wanxVideoModel: getStringEnv('WANX_VIDEO_MODEL', DEFAULT_PROVIDER_MODEL.WANX_VIDEO),
    wanxTextVideoModel: getStringEnv(
      'WANX_TEXT_VIDEO_MODEL',
      DEFAULT_PROVIDER_MODEL.WANX_TEXT_VIDEO,
    ),
    wanxVideoRequestTimeoutSeconds: getNumberEnv(
      'WANX_VIDEO_REQUEST_TIMEOUT_SECONDS',
      DEFAULT_REQUEST_TIMEOUT_SECONDS.LONG,
    ),
  };
}
