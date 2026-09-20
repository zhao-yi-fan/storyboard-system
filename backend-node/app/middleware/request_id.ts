'use strict';

const { randomUUID } = require('node:crypto');

const INCOMING_REQUEST_ID_PATTERN = /^[\w-]{1,64}$/;
const REQUEST_ID_HEADER = 'X-Request-Id';

type MiddlewareContext = {
  state: Record<string, unknown>;
  get(name: string): string;
  set(name: string, value: string): void;
};

module.exports =
  () =>
  async function requestId(ctx: MiddlewareContext, next: () => Promise<void>) {
    const incoming = ctx.get(REQUEST_ID_HEADER);
    const requestId =
      incoming && INCOMING_REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
    ctx.state.requestId = requestId;
    ctx.set(REQUEST_ID_HEADER, requestId);
    await next();
  };
