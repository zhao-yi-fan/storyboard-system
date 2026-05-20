'use strict';
// @ts-nocheck

export function success(ctx: any, data: unknown) {
  ctx.body = {
    code: 200,
    data,
    message: '',
  };
}

export function error(ctx: any, message: string) {
  ctx.body = {
    code: 0,
    data: null,
    message,
  };
}
