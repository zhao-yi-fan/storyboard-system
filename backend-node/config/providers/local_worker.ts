'use strict';

import { DEFAULT_LOCAL_WORKER } from '../shared/constants';

export function buildLocalWorkerConfig() {
  return {
    localWorkerKey: process.env.LOCAL_WORKER_KEY || '',
    localWorkerOwnerId: Number(process.env.LOCAL_WORKER_OWNER_ID || 0),
    localWorkerLeaseSeconds: DEFAULT_LOCAL_WORKER.LEASE_SECONDS,
  };
}
