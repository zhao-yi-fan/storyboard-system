'use strict';

const Controller = require('egg').Controller;

class HealthController extends Controller {
  async index() {
    this.ctx.body = { status: 'ok' };
  }
}

module.exports = HealthController;
