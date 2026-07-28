'use strict';
// @ts-nocheck

const { ApiController } = require('../lib/api_controller');

class AssetWorkspaceController extends ApiController {
  userId() {
    return Number(this.ctx.state.currentUser.id);
  }

  async requirements() {
    const projectId = Number(this.ctx.params.id);
    const chapterId = Number(this.ctx.query.chapter_id || 0) || null;
    await this.respond(() =>
      this.ctx.service.assetWorkspace.listRequirements(projectId, chapterId),
    );
  }

  async generateRequirements() {
    const projectId = Number(this.ctx.params.id);
    const chapterId = Number(this.ctx.request.body?.chapter_id || 0) || null;
    const requirementId = Number(this.ctx.request.body?.requirement_id || 0) || null;
    await this.respond(() =>
      this.ctx.service.assetWorkspace.generateRequirements(
        projectId,
        chapterId,
        requirementId,
      ),
    );
  }

  async confirmRequirement() {
    await this.respond(() =>
      this.ctx.service.assetWorkspace.confirmRequirement(Number(this.ctx.params.id)),
    );
  }

  async personalIndex() {
    await this.respond(() =>
      this.ctx.service.assetWorkspace.listPersonal(this.userId(), this.ctx.query.kind),
    );
  }

  async importPersonal() {
    await this.respond(() =>
      this.ctx.service.assetWorkspace.importPersonal(
        Number(this.ctx.params.id),
        Number(this.ctx.request.body?.project_id),
        this.userId(),
        Number(this.ctx.request.body?.requirement_id || 0) || null,
      ),
    );
  }

  async saveCharacter() {
    await this.respond(() =>
      this.ctx.service.assetWorkspace.saveCharacterToPersonal(
        Number(this.ctx.params.id),
        this.userId(),
      ),
    );
  }

  async saveAsset() {
    await this.respond(() =>
      this.ctx.service.assetWorkspace.saveAssetToPersonal(
        Number(this.ctx.params.id),
        this.userId(),
      ),
    );
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

  async characterVoiceVersions() {
    await this.respond(() =>
      this.ctx.service.assetWorkspace.listVoiceVersions(Number(this.ctx.params.id)),
    );
  }

  async setCharacterVoiceVersion() {
    await this.respond(() =>
      this.ctx.service.assetWorkspace.setCurrentVoiceVersion(
        Number(this.ctx.params.id),
        Number(this.ctx.params.versionId),
        this.userId(),
      ),
    );
  }

  async versions(entityType) {
    await this.respond(() =>
      this.ctx.service.assetWorkspace.listVersions(entityType, Number(this.ctx.params.id)),
    );
  }

  async setVersion(entityType) {
    await this.respond(() =>
      this.ctx.service.assetWorkspace.setCurrentVersion(
        entityType,
        Number(this.ctx.params.id),
        Number(this.ctx.params.versionId),
        this.userId(),
      ),
    );
  }
}

module.exports = AssetWorkspaceController;
