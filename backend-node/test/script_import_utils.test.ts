import assert from 'node:assert/strict';

import { describe, it } from 'mocha';

import { splitScriptIntoChunks, uniqueNonEmpty } from '../app/lib/script_import';

describe('test/script_import_utils.test.ts', () => {
  it('dedupes and drops empty strings', () => {
    assert.deepEqual(uniqueNonEmpty([' 林婉 ', '', '林婉', '  ', '李明']), ['林婉', '李明']);
  });

  it('handles empty input', () => {
    assert.deepEqual(uniqueNonEmpty([]), []);
    assert.deepEqual(uniqueNonEmpty([null, undefined, '']), []);
  });

  it('keeps short text in a single chunk', () => {
    assert.deepEqual(splitScriptIntoChunks('  第一章内容  ', 100), ['第一章内容']);
    assert.deepEqual(splitScriptIntoChunks('', 100), []);
  });

  it('packs paragraphs greedily without exceeding the limit', () => {
    const chunks = splitScriptIntoChunks('aaa\n\nbbb\n\nccc', 8);
    assert.deepEqual(chunks, ['aaa\n\nbbb', 'ccc']);
    for (const chunk of chunks) assert.ok(chunk.length <= 8);
  });

  it('hard-slices a single overlong paragraph', () => {
    const chunks = splitScriptIntoChunks('abcdefghij', 4);
    assert.deepEqual(chunks, ['abcd', 'efgh', 'ij']);
  });
});
