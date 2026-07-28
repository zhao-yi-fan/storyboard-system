'use strict';

export const LLM_JSON_PROTOCOL = Object.freeze({
  CONTENT_TYPE: 'application/json',
  POST_METHOD: 'POST',
  TRAILING_SLASH_PATTERN: /\/$/,
  JSON_FENCE_PREFIX: /^```json/,
  CODE_FENCE_PREFIX: /^```/,
  CODE_FENCE_SUFFIX: /```$/,
});
