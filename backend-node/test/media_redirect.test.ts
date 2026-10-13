import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

import { describe, it } from 'mocha';

// @ts-expect-error: tests execute as ESM (mocha + Node type stripping) while tsc assumes CJS from package.json
const cjsRequire = createRequire(import.meta.url);
const { generatedObjectKey } = cjsRequire('../app/lib/generated_asset');

describe('retired media stream entry', () => {
  it('does not register a public Node stream route', () => {
    const router = fs.readFileSync('app/router.ts', 'utf8');
    assert.ok(!router.includes('/_media/stream/'));
  });
  it('continues rejecting traversal in persistent generated keys', () => {
    assert.throws(() => generatedObjectKey({ config: { storyboard: {} } }, '/generated/covers/../secrets.txt'));
  });
});
