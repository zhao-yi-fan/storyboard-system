'use strict';

const { ApiController } = require('../lib/api_controller');

class LocalWorkerController extends ApiController {
  async claim() {
    await this.respond(() => this.ctx.service.localVideoJob.claim());
  }
  async heartbeat() {
    const body = this.ctx.request.body || {};
    await this.respond(() =>
      this.ctx.service.localVideoJob.update(
        Number(this.ctx.params.id),
        String(body.token || ''),
        body.stage,
        body.prompt_id,
      ),
    );
  }
  async firstFrame() {
    await this.respond(() =>
      this.ctx.service.localVideoJob.firstFrame(
        Number(this.ctx.params.id),
        this.ctx.get('x-task-token'),
      ),
    );
  }
  async sign() {
    await this.respond(() =>
      this.ctx.service.localVideoJob.sign(
        Number(this.ctx.params.id),
        String(this.ctx.request.body?.token || ''),
      ),
    );
  }
  async complete() {
    const body = this.ctx.request.body || {};
    await this.respond(() =>
      this.ctx.service.localVideoJob.complete(
        Number(this.ctx.params.id),
        String(body.token || ''),
        String(body.object_key || ''),
      ),
    );
  }
  async fail() {
    const body = this.ctx.request.body || {};
    await this.respond(() =>
      this.ctx.service.localVideoJob.fail(
        Number(this.ctx.params.id),
        String(body.token || ''),
        body.error,
      ),
    );
  }
}

module.exports = LocalWorkerController;
