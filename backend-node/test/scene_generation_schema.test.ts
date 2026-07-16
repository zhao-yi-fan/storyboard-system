import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { hasCompleteLegacySceneMapping } from '../app/lib/scene_generation_schema';

describe('test/scene_generation_schema.test.ts', () => {
  it('accepts one independent scene mapping for every legacy storyboard', () => {
    assert.equal(
      hasCompleteLegacySceneMapping(
        [{ id: 11 }, { id: 12 }],
        [{ legacy_storyboard_id: 11 }, { legacy_storyboard_id: 12 }],
      ),
      true,
    );
  });

  it('rejects missing or duplicate storyboard mappings', () => {
    assert.equal(
      hasCompleteLegacySceneMapping([{ id: 11 }, { id: 12 }], [{ legacy_storyboard_id: 11 }]),
      false,
    );
    assert.equal(
      hasCompleteLegacySceneMapping(
        [{ id: 11 }, { id: 12 }],
        [{ legacy_storyboard_id: 11 }, { legacy_storyboard_id: 11 }],
      ),
      false,
    );
  });
});
