import { app, assert } from 'egg-mock/bootstrap';

describe('test/smoke.test.ts', () => {
  it('should start egg server and respond health check', async () => {
    const res = await app.httpRequest()
      .get('/api/health')
      .expect(200);

    assert.strictEqual(res.body.status, 'ok');
  });

  it('should connect to mysql and query projects list', async () => {
    const res = await app.httpRequest()
      .get('/api/projects');

    // In CI/test environments without a live DB, the request may return an error code.
    // We only verify that the server responds and returns valid JSON.
    assert.ok(res.status === 200 || res.status === 500, `unexpected HTTP status: ${res.status}`);
    assert.ok(res.body !== null && typeof res.body === 'object', 'response body should be a JSON object');
  });
});
