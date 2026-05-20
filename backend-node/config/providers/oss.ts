'use strict';

import { getStringEnv } from '../shared/env';

export function buildOssConfig() {
  return {
    aliyunOssEndpoint: getStringEnv('ALIYUN_OSS_ENDPOINT', ''),
    aliyunOssPublicEndpoint: getStringEnv('ALIYUN_OSS_PUBLIC_ENDPOINT', ''),
    aliyunOssAccessKeyId: getStringEnv('ALIYUN_OSS_ACCESS_KEY_ID', ''),
    aliyunOssAccessKeySecret: getStringEnv('ALIYUN_OSS_ACCESS_KEY_SECRET', ''),
    aliyunOssBucket: getStringEnv('ALIYUN_OSS_BUCKET', ''),
  };
}
