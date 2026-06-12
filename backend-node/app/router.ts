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
  router.delete('/api/scenes/:id', controller.scene.destroy);
  router.get('/api/scenes/:id/cover-generation-preview', controller.scene.previewCoverGeneration);
  router.post('/api/scenes/:id/generate-cover', controller.scene.generateCover);
  router.post('/api/scenes/:id/generate-storyboard-covers', controller.scene.generateStoryboardCovers);
  router.post('/api/scenes/:id/compose-video', controller.scene.composeVideo);
  router.get('/api/scenes/:id/storyboards', controller.storyboard.indexByScene);
  router.post('/api/scenes/:id/storyboards', controller.storyboard.create);

  router.get('/api/storyboards/:id', controller.storyboard.show);
  router.put('/api/storyboards/:id', controller.storyboard.update);
  router.delete('/api/storyboards/:id', controller.storyboard.destroy);
  router.get('/api/storyboards/:id/media-generations', controller.storyboard.mediaGenerations);
  router.post('/api/storyboards/:id/media-generations/:generationId/set-current', controller.storyboard.setMediaGenerationCurrent);
  router.delete('/api/storyboards/:id/media-generations/:generationId', controller.storyboard.deleteMediaGeneration);
  router.get('/api/storyboards/:id/cover-generation-preview', controller.storyboard.previewCoverGeneration);
  router.get('/api/storyboards/:id/video-generation-preview', controller.storyboard.previewVideoGeneration);
  router.post('/api/storyboards/:id/generate-cover', controller.storyboard.generateCover);
  router.post('/api/storyboards/:id/upload-cover', controller.storyboard.uploadCover);
  router.post('/api/storyboards/:id/generate-video', controller.storyboard.generateVideo);
  router.post('/api/storyboards/:id/characters', controller.storyboard.addCharacter);
  router.delete('/api/storyboards/:id/characters/:characterId', controller.storyboard.removeCharacter);
  router.post('/api/storyboards/:id/assets', controller.storyboard.addAsset);
  router.delete('/api/storyboards/:id/assets/:assetId', controller.storyboard.removeAsset);

  router.get('/api/characters/:id', controller.character.show);
  router.put('/api/characters/:id', controller.character.update);
  router.delete('/api/characters/:id', controller.character.destroy);
  router.get('/api/characters/:id/design-sheet-generation-preview', controller.character.previewDesignSheetGeneration);
  router.get('/api/characters/:id/voice-reference-generation-preview', controller.character.previewVoiceReferenceGeneration);
  router.post('/api/characters/:id/generate-design-sheet', controller.character.generateDesignSheet);
  router.post('/api/characters/:id/generate-voice-reference', controller.character.generateVoiceReference);
  router.get('/api/characters/:id/assets', controller.asset.indexByCharacter);

  router.put('/api/assets/:id', controller.asset.update);
  router.delete('/api/assets/:id', controller.asset.destroy);
  router.get('/api/assets/:id/cover-generation-preview', controller.asset.previewCoverGeneration);
  router.post('/api/assets/:id/generate-cover', controller.asset.generateCover);

  router.get('/api/oss/sign', controller.oss.sign);
  router.post('/api/oss/upload', controller.oss.upload);
};
