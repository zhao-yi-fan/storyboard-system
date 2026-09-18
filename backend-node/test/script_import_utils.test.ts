import assert from 'node:assert/strict';

import { describe, it } from 'mocha';

import { uniqueNonEmpty } from '../app/lib/script_import';

describe('test/script_import_utils.test.ts', () => {
  it('dedupes and drops empty strings', () => {
    assert.deepEqual(uniqueNonEmpty([' 林婉 ', '', '林婉', '  ', '李明']), ['林婉', '李明']);
  });

  it('handles empty input', () => {
    assert.deepEqual(uniqueNonEmpty([]), []);
    assert.deepEqual(uniqueNonEmpty([null, undefined, '']), []);
  });
});
