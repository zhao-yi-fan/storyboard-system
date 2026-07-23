'use strict';

import {
  DEFAULT_DASHSCOPE_BASE_URL,
  DEFAULT_WANX_TEXT_VIDEO_MODEL,
  DEFAULT_WANX_VIDEO_MODEL,
  DEFAULT_WANX_VIDEO_TIMEOUT_SECONDS,
} from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildWanxConfig() {
  return {
    wanxVideoBaseUrl: getStringEnv('WANX_VIDEO_BASE_URL', DEFAULT_DASHSCOPE_BASE_URL),
    wanxVideoModel: getStringEnv('WANX_VIDEO_MODEL', DEFAULT_WANX_VIDEO_MODEL),
    wanxTextVideoModel: getStringEnv('WANX_TEXT_VIDEO_MODEL', DEFAULT_WANX_TEXT_VIDEO_MODEL),
    wanxVideoRequestTimeoutSeconds: getNumberEnv(
      'WANX_VIDEO_REQUEST_TIMEOUT_SECONDS',
      DEFAULT_WANX_VIDEO_TIMEOUT_SECONDS,
    ),
  };
}
