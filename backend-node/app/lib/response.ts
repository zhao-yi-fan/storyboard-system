'use strict';

type ApiContext = {
  body: {
    code: number;
    data: unknown;
    message: string;
  };
};

export function success(ctx: ApiContext, data: unknown) {
  ctx.body = {
    code: 200,
    data,
    message: '',
  };
}

export function error(ctx: ApiContext, message: string) {
  ctx.body = {
    code: 0,
    data: null,
    message,
  };
}
