'use strict';

exports.success = function success(ctx, data) {
  ctx.body = {
    code: 200,
    data,
    message: '',
  };
};

exports.error = function error(ctx, message) {
  ctx.body = {
    code: 0,
    data: null,
    message,
  };
};
