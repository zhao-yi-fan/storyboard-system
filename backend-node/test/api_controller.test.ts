import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { ApiController } from '../app/lib/api_controller';

type TestContext = {
  params: Record<string, string>;
  body?: {
    code: number;
    data: unknown;
    message: string;
  };
};

describe('ApiController', () => {
  it('parses only positive integer route ids', () => {
    const parseId = Reflect.get(ApiController.prototype, 'parseId') as (
      this: { ctx: TestContext },
      param?: string,
    ) => number | null;
    const target = { ctx: { params: { id: '12', projectId: '7' } } };

    assert.equal(parseId.call(target), 12);
    assert.equal(parseId.call(target, 'projectId'), 7);
    target.ctx.params.id = '-1';
    assert.equal(parseId.call(target), null);
  });

  it('keeps the unified response contract for success and failure', async () => {
    const respond = Reflect.get(ApiController.prototype, 'respond') as (
      this: { ctx: TestContext },
      operation: () => Promise<unknown>,
    ) => Promise<void>;
    const target: { ctx: TestContext } = { ctx: { params: {} } };

    await respond.call(target, async () => ({ id: 1 }));
    assert.deepEqual(target.ctx.body, {
      code: 200,
      data: { id: 1 },
      message: '',
    });

    await respond.call(target, async () => {
      throw new Error('expected failure');
    });
    assert.deepEqual(target.ctx.body, {
      code: 0,
      data: null,
      message: 'expected failure',
    });
  });
});
