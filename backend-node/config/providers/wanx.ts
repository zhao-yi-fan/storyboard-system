'use strict';

import {
  DEFAULT_DASHSCOPE_BASE_URL,
  DEFAULT_WANX_MODEL,
  DEFAULT_WANX_REFERENCE_MODEL,
  DEFAULT_WANX_TEXT_VIDEO_MODEL,
  DEFAULT_WANX_TIMEOUT_SECONDS,
  DEFAULT_WANX_VIDEO_MODEL,
  DEFAULT_WANX_VIDEO_TIMEOUT_SECONDS,
} from '../shared/constants';
import { getNumberEnv, getStringEnv } from '../shared/env';

export function buildWanxConfig() {
  return {
    wanxBaseUrl: getStringEnv('WANX_BASE_URL', DEFAULT_DASHSCOPE_BASE_URL),
    wanxModel: getStringEnv('WANX_MODEL', DEFAULT_WANX_MODEL),
    wanxReferenceModel: getStringEnv('WANX_REFERENCE_MODEL', DEFAULT_WANX_REFERENCE_MODEL),
    wanxRequestTimeoutSeconds: getNumberEnv('WANX_REQUEST_TIMEOUT_SECONDS', DEFAULT_WANX_TIMEOUT_SECONDS),
    wanxVideoBaseUrl: getStringEnv('WANX_VIDEO_BASE_URL', DEFAULT_DASHSCOPE_BASE_URL),
    wanxVideoModel: getStringEnv('WANX_VIDEO_MODEL', DEFAULT_WANX_VIDEO_MODEL),
    wanxTextVideoModel: getStringEnv('WANX_TEXT_VIDEO_MODEL', DEFAULT_WANX_TEXT_VIDEO_MODEL),
    wanxVideoRequestTimeoutSeconds: getNumberEnv('WANX_VIDEO_REQUEST_TIMEOUT_SECONDS', DEFAULT_WANX_VIDEO_TIMEOUT_SECONDS),
  };
}
