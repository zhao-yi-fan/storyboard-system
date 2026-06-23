import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  buildShotDirectionGraph,
  normalizeShotDirectionAnalyses,
  parseShotDirectionResponse,
} from '../app/lib/shot_direction_graph';

describe('test/shot_direction.test.ts', () => {
  it('should reject invalid model JSON', () => {
    assert.throws(
      () => parseShotDirectionResponse('不是 JSON'),
      /模型未返回合法 JSON/
    );
  });

  it('should return an empty result for an empty scene', () => {
    assert.deepStrictEqual(normalizeShotDirectionAnalyses({ analyses: [] }, []), []);
  });

  it('should run the graph without an LLM call when the scene has no shots', async () => {
    let persisted: unknown = null;
    const graph = buildShotDirectionGraph({
      config: {},
      persistResults: async analyses => {
        persisted = analyses;
      },
    });

    const result = await graph.invoke({
      scene: { id: 1, title: '空场景' },
      storyboards: [],
      analyses: [],
      raw_output: '',
      error_message: '',
    });

    assert.deepStrictEqual(result.analyses, []);
    assert.deepStrictEqual(persisted, []);
  });

  it('should fill missing storyboard analyses with safe defaults', () => {
    const storyboards = [
      { id: 10, shot_number: 1, mood: '紧张', shot_type: '近景', camera_motion: '推镜' },
      { id: 11, shot_number: 2, mood: '', shot_type: '', camera_motion: '' },
    ];
    const result = normalizeShotDirectionAnalyses(
      {
        analyses: [
          {
            storyboard_id: 10,
            narrative_role: '冲突升级',
            emotional_shift: '紧张 -> 爆发',
            camera_motion_suggestion: '手持轻晃',
          },
        ],
      },
      storyboards
    );

    assert.equal(result.length, 2);
    assert.equal(result[0].narrative_role, '冲突升级');
    assert.equal(result[0].camera_motion_suggestion, '手持轻晃');
    assert.equal(result[1].storyboard_id, 11);
    assert.equal(result[1].continuity_to_next, '收束当前场景段落');
    assert.equal(result[1].shot_type_suggestion, '中景');
  });
});
