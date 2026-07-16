'use strict';
// @ts-nocheck

const Controller = require('egg').Controller;
const response = require('../lib/response');

class AssetWorkspaceController extends Controller {
  userId() {
    return Number(this.ctx.state.currentUser.id);
  }

  async requirements() {
    try {
      const projectId = Number(this.ctx.params.id);
      const chapterId = Number(this.ctx.query.chapter_id || 0) || null;
      response.success(
        this.ctx,
        await this.ctx.service.assetWorkspace.listRequirements(projectId, chapterId),
      );
    } catch (error) {
      response.error(this.ctx, error.message);
    }
  }

  async generateRequirements() {
    try {
      const projectId = Number(this.ctx.params.id);
      const chapterId = Number(this.ctx.request.body?.chapter_id || 0) || null;
      const requirementId = Number(this.ctx.request.body?.requirement_id || 0) || null;
      response.success(
        this.ctx,
        await this.ctx.service.assetWorkspace.generateRequirements(
          projectId,
          chapterId,
          requirementId,
        ),
      );
    } catch (error) {
      response.error(this.ctx, error.message);
    }
  }

  async confirmRequirement() {
    try {
      response.success(
        this.ctx,
        await this.ctx.service.assetWorkspace.confirmRequirement(Number(this.ctx.params.id)),
      );
    } catch (error) {
      response.error(this.ctx, error.message);
    }
  }

  async personalIndex() {
    try {
      response.success(
        this.ctx,
        await this.ctx.service.assetWorkspace.listPersonal(this.userId(), this.ctx.query.kind),
      );
    } catch (error) {
      response.error(this.ctx, error.message);
    }
  }

  async importPersonal() {
    try {
      response.success(
        this.ctx,
        await this.ctx.service.assetWorkspace.importPersonal(
          Number(this.ctx.params.id),
          Number(this.ctx.request.body?.project_id),
          this.userId(),
          Number(this.ctx.request.body?.requirement_id || 0) || null,
        ),
      );
    } catch (error) {
      response.error(this.ctx, error.message);
    }
  }

  async saveCharacter() {
    try {
      response.success(
        this.ctx,
        await this.ctx.service.assetWorkspace.saveCharacterToPersonal(
          Number(this.ctx.params.id),
          this.userId(),
        ),
      );
    } catch (error) {
      response.error(this.ctx, error.message);
    }
  }

  async saveAsset() {
    try {
      response.success(
        this.ctx,
        await this.ctx.service.assetWorkspace.saveAssetToPersonal(
          Number(this.ctx.params.id),
          this.userId(),
        ),
      );
    } catch (error) {
      response.error(this.ctx, error.message);
    }
  }

  async characterVersions() {
    await this.versions('character');
  }
  async assetVersions() {
    await this.versions('asset');
  }
  async setCharacterVersion() {
    await this.setVersion('character');
  }
  async setAssetVersion() {
    await this.setVersion('asset');
  }

  async versions(entityType) {
    try {
      response.success(
        this.ctx,
        await this.ctx.service.assetWorkspace.listVersions(entityType, Number(this.ctx.params.id)),
      );
    } catch (error) {
      response.error(this.ctx, error.message);
    }
  }

  async setVersion(entityType) {
    try {
      response.success(
        this.ctx,
        await this.ctx.service.assetWorkspace.setCurrentVersion(
          entityType,
          Number(this.ctx.params.id),
          Number(this.ctx.params.versionId),
          this.userId(),
        ),
      );
    } catch (error) {
      response.error(this.ctx, error.message);
    }
  }
}

module.exports = AssetWorkspaceController;
