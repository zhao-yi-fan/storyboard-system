'use strict';

module.exports = (app: any) => {
  const { router, controller } = app;

  router.get('/api/health', controller.health.index);
  router.post('/api/auth/login', controller.auth.login);
  router.post('/api/auth/logout', controller.auth.logout);
  router.get('/api/auth/me', controller.auth.me);

  router.get('/api/projects', controller.project.index);
  router.post('/api/projects', controller.project.create);
  router.get('/api/projects/:id', controller.project.show);
  router.put('/api/projects/:id', controller.project.update);
  router.delete('/api/projects/:id', controller.project.destroy);
  router.post('/api/projects/:id/pin', controller.project.pin);
  router.delete('/api/projects/:id/pin', controller.project.unpin);
  router.post('/api/projects/:id/import-script', controller.project.importScript);
  router.post('/api/projects/:id/compose-video', controller.project.composeVideo);
  router.get('/api/projects/:id/asset-requirements', controller.assetWorkspace.requirements);
  router.post(
    '/api/projects/:id/asset-requirements/generate',
    controller.assetWorkspace.generateRequirements,
  );

  router.get('/api/projects/:id/chapters', controller.chapter.indexByProject);
  router.post('/api/projects/:id/chapters', controller.chapter.create);
  router.get('/api/projects/:id/characters', controller.character.indexByProject);
  router.post('/api/projects/:id/characters', controller.character.create);
  router.get('/api/projects/:id/assets', controller.asset.indexByProject);
  router.post('/api/projects/:id/assets', controller.asset.create);

  router.get('/api/chapters/:id', controller.chapter.show);
  router.put('/api/chapters/:id', controller.chapter.update);
  router.delete('/api/chapters/:id', controller.chapter.destroy);
  router.get('/api/chapters/:id/scenes', controller.scene.indexByChapter);
  router.post('/api/chapters/:id/scenes', controller.scene.create);

  router.get('/api/scenes/:id', controller.scene.show);
  router.put('/api/scenes/:id', controller.scene.update);
  router.post('/api/scenes/:id/optimize-prompt', controller.scene.optimizePrompt);
  router.delete('/api/scenes/:id', controller.scene.destroy);
  router.get('/api/scenes/:id/cover-generation-preview', controller.scene.previewCoverGeneration);
  router.get('/api/scenes/:id/generation-references', controller.scene.generationReferences);
  router.post('/api/scenes/:id/generate-cover', controller.scene.generateCover);
  router.post('/api/scenes/:id/analyze-shot-directions', controller.scene.analyzeShotDirections);
  router.get('/api/scenes/:id/shot-direction-analyses', controller.scene.shotDirectionAnalyses);
  router.post('/api/scenes/:id/compose-video', controller.scene.composeVideo);
  router.get('/api/scenes/:id/media-generations', controller.scene.mediaGenerations);
  router.post(
    '/api/scenes/:id/media-generations/:generationId/set-current',
    controller.scene.setMediaGenerationCurrent,
  );
  router.delete(
    '/api/scenes/:id/media-generations/:generationId',
    controller.scene.deleteMediaGeneration,
  );
  router.get(
    '/api/scenes/:id/media-generations/:generationId/frames',
    controller.scene.videoFrames,
  );
  router.post(
    '/api/scenes/:id/media-generations/:generationId/frames',
    controller.scene.createVideoFrame,
  );
  router.delete(
    '/api/scenes/:id/media-generations/:generationId/frames/:frameId',
    controller.scene.deleteVideoFrame,
  );
  router.post(
    '/api/scenes/:id/media-generations/:generationId/clips',
    controller.scene.createVideoClip,
  );
  router.get('/api/scenes/:id/video-generation-preview', controller.scene.previewVideoGeneration);
  router.post('/api/scenes/:id/generate-video', controller.scene.generateVideo);
  router.post('/api/scenes/:id/upload-cover', controller.scene.uploadCover);
  router.post('/api/scenes/:id/characters', controller.scene.addCharacter);
  router.delete('/api/scenes/:id/characters/:characterId', controller.scene.removeCharacter);
  router.post('/api/scenes/:id/assets', controller.scene.addAsset);
  router.delete('/api/scenes/:id/assets/:assetId', controller.scene.removeAsset);
  router.get('/api/scenes/:id/storyboards', controller.storyboard.indexByScene);

  router.get('/api/storyboards/:id', controller.storyboard.show);
  router.get('/api/storyboards/:id/media-generations', controller.storyboard.mediaGenerations);

  router.get('/api/characters/:id', controller.character.show);
  router.put('/api/characters/:id', controller.character.update);
  router.delete('/api/characters/:id', controller.character.destroy);
  router.get(
    '/api/characters/:id/design-sheet-generation-preview',
    controller.character.previewDesignSheetGeneration,
  );
  router.get(
    '/api/characters/:id/voice-reference-generation-preview',
    controller.character.previewVoiceReferenceGeneration,
  );
  router.post(
    '/api/characters/:id/generate-design-sheet',
    controller.character.generateDesignSheet,
  );
  router.post(
    '/api/characters/:id/generate-voice-reference',
    controller.character.generateVoiceReference,
  );
  router.post(
    '/api/characters/:id/upload-voice-reference',
    controller.character.uploadVoiceReference,
  );
  router.get('/api/characters/:id/assets', controller.asset.indexByCharacter);
  router.post('/api/characters/:id/save-to-personal', controller.assetWorkspace.saveCharacter);
  router.get('/api/characters/:id/versions', controller.assetWorkspace.characterVersions);
  router.get(
    '/api/characters/:id/voice-versions',
    controller.assetWorkspace.characterVoiceVersions,
  );
  router.post(
    '/api/characters/:id/voice-versions/:versionId/set-current',
    controller.assetWorkspace.setCharacterVoiceVersion,
  );
  router.post(
    '/api/characters/:id/versions/:versionId/set-current',
    controller.assetWorkspace.setCharacterVersion,
  );

  router.put('/api/assets/:id', controller.asset.update);
  router.get('/api/assets/:id', controller.asset.show);
  router.delete('/api/assets/:id', controller.asset.destroy);
  router.get('/api/assets/:id/cover-generation-preview', controller.asset.previewCoverGeneration);
  router.post('/api/assets/:id/generate-cover', controller.asset.generateCover);
  router.post('/api/assets/:id/save-to-personal', controller.assetWorkspace.saveAsset);
  router.get('/api/assets/:id/versions', controller.assetWorkspace.assetVersions);
  router.post(
    '/api/assets/:id/versions/:versionId/set-current',
    controller.assetWorkspace.setAssetVersion,
  );

  router.post('/api/asset-requirements/:id/confirm', controller.assetWorkspace.confirmRequirement);
  router.get('/api/personal-assets', controller.assetWorkspace.personalIndex);
  router.post(
    '/api/personal-assets/:id/import-to-project',
    controller.assetWorkspace.importPersonal,
  );

  router.get('/api/oss/sign', controller.oss.sign);
  router.post('/api/oss/upload', controller.oss.upload);
};
