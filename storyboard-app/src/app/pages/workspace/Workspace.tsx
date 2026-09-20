import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  type AIGenerationPreview,
  ossApi,
  sceneApi,
  type StoryboardMediaGeneration,
} from "../../api";
import { type VideoPreview } from "../../components/workspace/dialogs/VideoPreviewDialog";
import {
  PROMPT_MENTION_CATEGORY,
  type PromptMentionOption,
} from "../../components/workspace/RichPromptEditor";
import { WorkspaceHeader } from "../../components/workspace/WorkspaceHeader";
import { ENTITY_TYPE, GENERATION_STATUS, MEDIA_TYPE } from "../../constants/domain";
import { useShotDraft } from "./useShotDraft";
import { useWorkspaceCharacterAsset } from "./useWorkspaceCharacterAsset";
import { useWorkspaceCover } from "./useWorkspaceCover";
import { useWorkspaceData } from "./useWorkspaceData";
import { useWorkspaceSceneMedia } from "./useWorkspaceSceneMedia";
import { useWorkspaceShotScene } from "./useWorkspaceShotScene";
import { useWorkspaceVideoGeneration } from "./useWorkspaceVideoGeneration";
import type { ShotFormState } from "./Workspace.helpers";
import {
  buildShotFormState,
  emptyShotForm,
  getAssetMentionPresentation,
  getProjectVideoPreviewSrc,
} from "./Workspace.helpers";
import styles from "./Workspace.module.scss";
import {
  GenerationDialogs,
  ManageDialogs,
  PreviewDialogs,
  PromptDialogs,
} from "./WorkspaceDialogs";
import { WorkspacePreviewStage } from "./WorkspacePreviewStage";
import { WorkspaceSceneRail } from "./WorkspaceSceneRail";
import { WorkspaceSettingsPanel } from "./WorkspaceSettingsPanel";

export default function Workspace() {
  const navigate = useNavigate();
  const {
    loading,
    chapters,
    setChapters,
    scenes,
    storyboards,
    setStoryboards,
    mediaGenerations,
    setMediaGenerations,
    selectedProject,
    selectedChapter,
    setSelectedChapter,
    selectedScene,
    setSelectedScene,
    selectedShot,
    setSelectedShot,
    setExpandedChapters,
    generationReferences,
    setGenerationReferences,
    isLoadingGenerationReferences,
    generationReferenceError,
    setGenerationReferenceError,
    projectCharacters,
    projectAssets,
    isLoadingProjectCharacters,
    isLoadingProjectAssets,
    loadStoryboards,
    loadMediaGenerations,
    loadGenerationReferences,
    applyClipSceneUpdate,
    applySceneUpdate,
    applyProjectUpdate,
    applyStoryboardsRefresh,
    applyMediaMutation,
    loadProjectCharacters,
    loadProjectAssets,
    loadScenes,
    loadProjects,
    toggleChapter,
    selectScene,
  } = useWorkspaceData();
  const [hoveredSceneIndex, setHoveredSceneIndex] = useState<number | null>(null);
  const [isEpisodeRailCollapsed, setIsEpisodeRailCollapsed] = useState(false);
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
    items?: { src: string; alt: string }[];
    currentIndex?: number;
  } | null>(null);
  const [frameExtractionGeneration, setFrameExtractionGeneration] =
    useState<StoryboardMediaGeneration | null>(null);
  const [sceneCoverGenerationPreview] = useState<AIGenerationPreview | null>(null);
  const [previewSceneVideo, setPreviewSceneVideo] = useState<VideoPreview | null>(null);
  const [previewProjectVideo, setPreviewProjectVideo] = useState<VideoPreview | null>(null);
  const [shotForm, setShotForm] = useState<ShotFormState>(emptyShotForm);
  const shotCoverInputRef = useRef<HTMLInputElement>(null);
  const initializedShotFormKeyRef = useRef("");

  // Load projects on mount
  useEffect(() => {
    void loadProjects();
    // Project selection is initialized once from the URL or persisted project id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const formKey = selectedShot ? `${selectedScene?.id ?? 0}:${selectedShot.id}` : "";
    if (formKey === initializedShotFormKeyRef.current) return;
    initializedShotFormKeyRef.current = formKey;
    setShotForm(buildShotFormState(selectedShot, selectedScene));
  }, [selectedScene, selectedShot]);

  const filteredShots = selectedScene
    ? storyboards.filter((shot) => shot.scene_id === selectedScene.id)
    : [];
  const composableShots = filteredShots.filter(
    (shot) => shot.video_status === GENERATION_STATUS.SUCCEEDED && !!shot.video_url,
  );
  const promptMentionOptions: PromptMentionOption[] = [
    ...projectCharacters.map((character) => ({
      id: character.id,
      kind: ENTITY_TYPE.CHARACTER,
      name: character.name,
      imageUrl: character.design_sheet_url ?? character.avatar_url,
      isBound: !!selectedShot?.characters?.some((item) => item.id === character.id),
      category: PROMPT_MENTION_CATEGORY.CHARACTER,
      description: character.description ?? "人物资产",
      media: [
        ...(character.design_sheet_url ? (["image"] as const) : []),
        ...(character.voice_reference_url ? (["audio"] as const) : []),
      ],
      searchText: `${character.voice_name ?? ""} 人物 角色`,
    })),
    ...projectAssets.map((asset) => {
      const presentation = getAssetMentionPresentation(asset);
      return {
        id: asset.id,
        kind: ENTITY_TYPE.ASSET,
        name: asset.name,
        imageUrl:
          presentation.category === PROMPT_MENTION_CATEGORY.AUDIO
            ? (asset.thumbnail_url ?? asset.cover_url)
            : (asset.cover_url ?? asset.file_url ?? asset.thumbnail_url),
        isBound: !!selectedShot?.assets?.some((item) => item.id === asset.id),
        category: presentation.category,
        description: asset.meta ?? asset.type ?? "项目资产",
        media: presentation.media,
        searchText: `${asset.type ?? ""} ${asset.meta ?? ""}`,
      };
    }),
  ];
  const activeChapterForSceneCreation = selectedChapter ?? chapters[0] ?? null;

  const { isSavingShot, saveShotDraftBeforeGeneration, handleSaveShot } = useShotDraft({
    selectedShot,
    selectedScene,
    shotForm,
    getActiveVideoDuration: () => activeVideoDuration,
    applyClipSceneUpdate,
  });

  const {
    generatingVideoId,
    setGeneratingVideoId,
    selectedVideoModel,
    setSelectedVideoResolution,
    setSelectedVideoDuration,
    setGenerateVideoAudio,
    useFirstFrameForVideo,
    setUseFirstFrameForVideo,
    isLoadingVideoPreview,
    videoGenerationPreview,
    isVideoConfirmOpen,
    activeVideoResolution,
    activeVideoDuration,
    activeVideoAudio,
    previewVideoSpecLabel,
    handleVideoModelChange,
    pollStoryboardVideo,
    stopVideoPolling,
    handleGenerateVideo,
    confirmGenerateVideo,
    handleVideoConfirmOpenChange,
  } = useWorkspaceVideoGeneration({
    selectedShot,
    isSavingShot,
    // Lazily bound: declared below via useShotDraft; only invoked in event handlers.
    saveShotDraftBeforeGeneration,
    applyClipSceneUpdate,
    loadMediaGenerations,
    setMediaGenerations,
  });

  const calculateTotalDuration = () => {
    return selectedScene?.generation_duration ?? activeVideoDuration;
  };

  const {
    generatingCoverId,
    isLoadingCoverPreview,
    coverGenerationPreview,
    coverGenerationError,
    setCoverGenerationError,
    coverGenerations,
    isCoverConfirmOpen,
    setIsCoverConfirmOpen,
    openCoverHistoryPreview,
    openGenerationReferencePreview,
    handleGenerateCover,
    confirmGenerateCover,
    handleManageCharactersForCover,
    handleManageAssetsForCover,
  } = useWorkspaceCover({
    selectedShot,
    mediaGenerations,
    generationReferences,
    isSavingShot,
    saveShotDraftBeforeGeneration,
    setPreviewImage,
    applyClipSceneUpdate,
    loadMediaGenerations,
    setGenerationReferences,
    onManageCharacters: () => void handleOpenManageCharacters(),
    onManageAssets: () => void handleOpenManageAssets(),
  });

  const handleRequestUploadShotCover = () => {
    shotCoverInputRef.current?.click();
  };

  const handleUploadShotCover = async (file: File) => {
    if (!selectedShot) {
      return;
    }
    try {
      const uploadedUrl = await ossApi.uploadFileToOss(file);
      const result = await sceneApi.uploadSceneCover(selectedShot.id, uploadedUrl);
      applyMediaMutation(result);
      toast.success("首帧上传成功");
    } catch (error) {
      console.error("Failed to upload storyboard cover:", error);
      toast.error(error instanceof Error ? error.message : "首帧上传失败");
    } finally {
      if (shotCoverInputRef.current) {
        shotCoverInputRef.current.value = "";
      }
    }
  };

  const {
    isSceneCoverConfirmOpen,
    setIsSceneCoverConfirmOpen,
    isBatchSceneCoverConfirmOpen,
    setIsBatchSceneCoverConfirmOpen,
    isSceneVideoConfirmOpen,
    setIsSceneVideoConfirmOpen,
    isProjectVideoConfirmOpen,
    setIsProjectVideoConfirmOpen,
    isComposingProjectVideo,
    deleteTargetGeneration,
    setDeleteTargetGeneration,
    activeMediaActionKey,
    confirmGenerateSceneCover,
    confirmBatchGenerateSceneCovers,
    confirmComposeSceneVideo,
    handleComposeProjectVideo,
    confirmComposeProjectVideo,
    handleSetCurrentGeneration,
    handleRequestDeleteGeneration,
    confirmDeleteGeneration,
    handleInsertVideoFrame,
    handleCreateVideoClip,
  } = useWorkspaceSceneMedia({
    selectedProject,
    selectedScene,
    selectedShot,
    frameExtractionGeneration,
    setSelectedShot,
    setMediaGenerations,
    applySceneUpdate,
    applyClipSceneUpdate,
    applyProjectUpdate,
    applyStoryboardsRefresh,
    applyMediaMutation,
    loadMediaGenerations,
    loadGenerationReferences,
  });

  const {
    isManageCharactersOpen,
    setIsManageCharactersOpen,
    isManageAssetsOpen,
    setIsManageAssetsOpen,
    activeCharacterActionKey,
    activeAssetActionKey,
    handleOpenManageCharacters,
    handleAddStoryboardCharacter,
    handleRemoveStoryboardCharacter,
    handleOpenManageAssets,
    handleAddStoryboardAsset,
    handleRemoveStoryboardAsset,
    handleSelectPromptMention,
    handleRemovePromptMentions,
  } = useWorkspaceCharacterAsset({
    selectedProject,
    selectedShot,
    applyClipSceneUpdate,
    loadGenerationReferences,
    loadProjectCharacters,
    loadProjectAssets,
  });

  const {
    deleteTargetScene,
    setDeleteTargetScene,
    isPromptFullscreenOpen,
    setIsPromptFullscreenOpen,
    isPromptOptimizationOpen,
    setIsPromptOptimizationOpen,
    isOptimizingPrompt,
    promptOptimizationOriginal,
    promptOptimizationCandidate,
    promptOptimizationModel,
    promptOptimizationError,
    newSceneForm,
    setNewSceneForm,
    descriptionOptimization,
    setDescriptionOptimization,
    isCreateSceneOpen,
    setIsCreateSceneOpen,
    sceneInsertSortOrder,
    setSceneInsertSortOrder,
    isCreatingScene,
    handleRequestDeleteScene,
    confirmDeleteScene,
    updateShotForm,
    requestPromptOptimization,
    confirmPromptOptimization,
    resetNewSceneForm,
    openCreateSceneDialog,
    requestDescriptionOptimization,
    confirmDescriptionOptimization,
    handleCreateScene,
  } = useWorkspaceShotScene({
    selectedProject,
    selectedChapter,
    selectedScene,
    selectedShot,
    activeChapterForSceneCreation,
    shotForm,
    setShotForm,
    setSelectedScene,
    setSelectedShot,
    setStoryboards,
    setChapters,
    setSelectedChapter,
    setExpandedChapters,
    loadScenes,
    loadStoryboards,
  });

  const videoGenerations = mediaGenerations.filter((item) => item.media_type === MEDIA_TYPE.VIDEO);
  const currentVideoGeneration =
    videoGenerations.find(
      (item) => item.is_current && item.status === GENERATION_STATUS.SUCCEEDED && item.result_url,
    ) ?? null;
  const selectedSceneIndex = selectedScene
    ? scenes.findIndex((scene) => scene.id === selectedScene.id)
    : -1;
  const nextSceneInChapter =
    selectedSceneIndex >= 0 && selectedSceneIndex < scenes.length - 1
      ? scenes[selectedSceneIndex + 1]
      : null;
  const liveGenerationReferences = generationReferences
    ? {
        ...generationReferences,
        mappings: generationReferences.mappings.map((mapping) => ({
          ...mapping,
          is_mentioned: !!mapping.mention && shotForm.content.includes(mapping.mention),
        })),
        bound_without_mentions: generationReferences.mappings
          .filter((mapping) => !mapping.mention || !shotForm.content.includes(mapping.mention))
          .map((mapping) => mapping.name),
        unbound_mentions: promptMentionOptions
          .filter((option) => !option.isBound && shotForm.content.includes(`@${option.name}`))
          .map((option) => option.name),
        recognized_bound_mentions: promptMentionOptions
          .filter((option) => option.isBound && shotForm.content.includes(`@${option.name}`))
          .map((option) => option.name),
      }
    : null;

  useEffect(() => {
    if (selectedShot?.video_status === GENERATION_STATUS.GENERATING) {
      setGeneratingVideoId(selectedShot.id);
      pollStoryboardVideo(selectedShot.id);
      return;
    }

    if (selectedShot?.id !== generatingVideoId) {
      stopVideoPolling();
      setGeneratingVideoId(null);
    }
    // Polling is keyed only by the selected clip and its persisted generation status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShot?.id, selectedShot?.video_status]);

  return (
    <div className={`storyboard-product-shell storyboard-workspace dark ${styles.page}`}>
      <WorkspaceHeader
        project={selectedProject}
        sceneCount={scenes.length}
        totalDuration={calculateTotalDuration()}
        composingProjectVideo={isComposingProjectVideo}
        projectVideoPreviewSrc={getProjectVideoPreviewSrc(selectedProject)}
        onBack={() => void navigate("/projects")}
        onOpenAssetConfirmation={() =>
          void (selectedProject && navigate(`/asset-confirmation?project=${selectedProject.id}`))
        }
        onComposeProjectVideo={handleComposeProjectVideo}
        onPreviewProjectVideo={() =>
          selectedProject &&
          setPreviewProjectVideo({
            src: getProjectVideoPreviewSrc(selectedProject),
            originalSrc: selectedProject.video_url ?? undefined,
            title: `《${selectedProject.name}》项目总片`,
          })
        }
      />

      <div className={styles.workspaceBody}>
        <WorkspaceSceneRail
          loading={loading}
          chapters={chapters}
          scenes={scenes}
          selectedChapter={selectedChapter}
          selectedScene={selectedScene}
          selectedProject={selectedProject}
          isEpisodeRailCollapsed={isEpisodeRailCollapsed}
          setIsEpisodeRailCollapsed={setIsEpisodeRailCollapsed}
          hoveredSceneIndex={hoveredSceneIndex}
          setHoveredSceneIndex={setHoveredSceneIndex}
          activeChapterForSceneCreation={activeChapterForSceneCreation}
          toggleChapter={toggleChapter}
          selectScene={selectScene}
          openCreateSceneDialog={openCreateSceneDialog}
          handleRequestDeleteScene={handleRequestDeleteScene}
        />
        <WorkspacePreviewStage
          selectedShot={selectedShot}
          isEpisodeRailCollapsed={isEpisodeRailCollapsed}
          currentVideoGeneration={currentVideoGeneration}
          setFrameExtractionGeneration={setFrameExtractionGeneration}
          videoGenerations={videoGenerations}
          activeMediaActionKey={activeMediaActionKey}
          handleSetCurrentGeneration={(generation) => void handleSetCurrentGeneration(generation)}
          handleRequestDeleteGeneration={handleRequestDeleteGeneration}
        />

        <WorkspaceSettingsPanel
          selectedShot={selectedShot}
          selectedScene={selectedScene}
          shotForm={shotForm}
          updateShotForm={updateShotForm}
          promptMentionOptions={promptMentionOptions}
          handleSelectPromptMention={handleSelectPromptMention}
          handleRemovePromptMentions={handleRemovePromptMentions}
          isOptimizingPrompt={isOptimizingPrompt}
          requestPromptOptimization={requestPromptOptimization}
          setIsPromptFullscreenOpen={setIsPromptFullscreenOpen}
          useFirstFrameForVideo={useFirstFrameForVideo}
          setUseFirstFrameForVideo={setUseFirstFrameForVideo}
          selectedVideoModel={selectedVideoModel}
          handleVideoModelChange={handleVideoModelChange}
          activeVideoResolution={activeVideoResolution}
          activeVideoDuration={activeVideoDuration}
          activeVideoAudio={activeVideoAudio}
          setSelectedVideoResolution={setSelectedVideoResolution}
          setSelectedVideoDuration={setSelectedVideoDuration}
          setGenerateVideoAudio={setGenerateVideoAudio}
          generatingVideoId={generatingVideoId}
          isLoadingVideoPreview={isLoadingVideoPreview}
          isSavingShot={isSavingShot}
          handleGenerateVideo={handleGenerateVideo}
          handleSaveShot={handleSaveShot}
          handleRequestDeleteScene={handleRequestDeleteScene}
          coverGenerations={coverGenerations}
          liveGenerationReferences={liveGenerationReferences}
          isLoadingGenerationReferences={isLoadingGenerationReferences}
          generationReferenceError={generationReferenceError}
          coverGenerationError={coverGenerationError}
          generatingCoverId={generatingCoverId}
          isLoadingCoverPreview={isLoadingCoverPreview}
          handleGenerateCover={handleGenerateCover}
          handleRequestUploadShotCover={handleRequestUploadShotCover}
          handleOpenManageCharacters={handleOpenManageCharacters}
          handleOpenManageAssets={handleOpenManageAssets}
          openGenerationReferencePreview={openGenerationReferencePreview}
          openCoverHistoryPreview={openCoverHistoryPreview}
          setPreviewImage={setPreviewImage}
          setCoverGenerationError={setCoverGenerationError}
          setGenerationReferenceError={setGenerationReferenceError}
        />
      </div>

      <input
        ref={shotCoverInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className={styles.hiddenInput}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleUploadShotCover(file);
        }}
      />

      <PromptDialogs
        isPromptFullscreenOpen={isPromptFullscreenOpen}
        setIsPromptFullscreenOpen={setIsPromptFullscreenOpen}
        selectedScene={selectedScene}
        selectedShot={selectedShot}
        shotContent={shotForm.content}
        promptMentionOptions={promptMentionOptions}
        isOptimizingPrompt={isOptimizingPrompt}
        updateShotForm={updateShotForm}
        handleSelectPromptMention={handleSelectPromptMention}
        handleRemovePromptMentions={handleRemovePromptMentions}
        requestPromptOptimization={requestPromptOptimization}
        isPromptOptimizationOpen={isPromptOptimizationOpen}
        promptOptimizationOriginal={promptOptimizationOriginal}
        promptOptimizationCandidate={promptOptimizationCandidate}
        promptOptimizationModel={promptOptimizationModel}
        promptOptimizationError={promptOptimizationError}
        setIsPromptOptimizationOpen={setIsPromptOptimizationOpen}
        confirmPromptOptimization={confirmPromptOptimization}
        descriptionOptimization={descriptionOptimization}
        setDescriptionOptimization={setDescriptionOptimization}
        requestDescriptionOptimization={requestDescriptionOptimization}
        confirmDescriptionOptimization={confirmDescriptionOptimization}
      />
      <ManageDialogs
        isManageCharactersOpen={isManageCharactersOpen}
        setIsManageCharactersOpen={setIsManageCharactersOpen}
        isManageAssetsOpen={isManageAssetsOpen}
        setIsManageAssetsOpen={setIsManageAssetsOpen}
        selectedShot={selectedShot}
        selectedScene={selectedScene}
        selectedProject={selectedProject}
        projectCharacters={projectCharacters}
        projectAssets={projectAssets}
        isLoadingProjectCharacters={isLoadingProjectCharacters}
        isLoadingProjectAssets={isLoadingProjectAssets}
        activeCharacterActionKey={activeCharacterActionKey}
        activeAssetActionKey={activeAssetActionKey}
        loadProjectCharacters={loadProjectCharacters}
        loadProjectAssets={loadProjectAssets}
        handleAddStoryboardCharacter={handleAddStoryboardCharacter}
        handleRemoveStoryboardCharacter={handleRemoveStoryboardCharacter}
        handleAddStoryboardAsset={handleAddStoryboardAsset}
        handleRemoveStoryboardAsset={handleRemoveStoryboardAsset}
      />
      <GenerationDialogs
        isCreateSceneOpen={isCreateSceneOpen}
        sceneInsertSortOrder={sceneInsertSortOrder}
        sceneCount={scenes.length}
        newSceneForm={newSceneForm}
        isCreatingScene={isCreatingScene}
        optimizingDescription={descriptionOptimization.loading}
        setIsCreateSceneOpen={setIsCreateSceneOpen}
        setSceneInsertSortOrder={setSceneInsertSortOrder}
        resetNewSceneForm={resetNewSceneForm}
        setNewSceneForm={(draft) => {
          setNewSceneForm(draft);
        }}
        requestDescriptionOptimization={requestDescriptionOptimization}
        handleCreateScene={handleCreateScene}
        isCoverConfirmOpen={isCoverConfirmOpen}
        setIsCoverConfirmOpen={setIsCoverConfirmOpen}
        selectedScene={selectedScene}
        coverGenerationPreview={coverGenerationPreview}
        openGenerationReferencePreview={openGenerationReferencePreview}
        handleManageCharactersForCover={handleManageCharactersForCover}
        handleManageAssetsForCover={handleManageAssetsForCover}
        confirmGenerateCover={confirmGenerateCover}
        isSceneCoverConfirmOpen={isSceneCoverConfirmOpen}
        setIsSceneCoverConfirmOpen={setIsSceneCoverConfirmOpen}
        sceneCoverGenerationPreview={sceneCoverGenerationPreview}
        confirmGenerateSceneCover={confirmGenerateSceneCover}
        isBatchSceneCoverConfirmOpen={isBatchSceneCoverConfirmOpen}
        setIsBatchSceneCoverConfirmOpen={setIsBatchSceneCoverConfirmOpen}
        filteredShotCount={filteredShots.length}
        confirmBatchGenerateSceneCovers={confirmBatchGenerateSceneCovers}
        isSceneVideoConfirmOpen={isSceneVideoConfirmOpen}
        setIsSceneVideoConfirmOpen={setIsSceneVideoConfirmOpen}
        composableShotCount={composableShots.length}
        confirmComposeSceneVideo={confirmComposeSceneVideo}
        isProjectVideoConfirmOpen={isProjectVideoConfirmOpen}
        setIsProjectVideoConfirmOpen={setIsProjectVideoConfirmOpen}
        selectedProject={selectedProject}
        confirmComposeProjectVideo={confirmComposeProjectVideo}
        isVideoConfirmOpen={isVideoConfirmOpen}
        videoGenerationPreview={videoGenerationPreview}
        previewVideoSpecLabel={previewVideoSpecLabel}
        selectedVideoModel={selectedVideoModel}
        activeVideoDuration={activeVideoDuration}
        useFirstFrameForVideo={useFirstFrameForVideo}
        selectedShot={selectedShot}
        handleVideoConfirmOpenChange={handleVideoConfirmOpenChange}
        setUseFirstFrameForVideo={setUseFirstFrameForVideo}
        confirmGenerateVideo={confirmGenerateVideo}
        deleteTargetGeneration={deleteTargetGeneration}
        setDeleteTargetGeneration={setDeleteTargetGeneration}
        confirmDeleteGeneration={confirmDeleteGeneration}
        deleteTargetScene={deleteTargetScene}
        setDeleteTargetScene={setDeleteTargetScene}
        confirmDeleteScene={confirmDeleteScene}
      />
      <PreviewDialogs
        previewImage={previewImage}
        setPreviewImage={setPreviewImage}
        frameExtractionGeneration={frameExtractionGeneration}
        setFrameExtractionGeneration={setFrameExtractionGeneration}
        selectedScene={selectedScene}
        nextSceneInChapter={nextSceneInChapter}
        handleInsertVideoFrame={handleInsertVideoFrame}
        handleCreateVideoClip={handleCreateVideoClip}
        previewSceneVideo={previewSceneVideo}
        setPreviewSceneVideo={setPreviewSceneVideo}
        previewProjectVideo={previewProjectVideo}
        setPreviewProjectVideo={setPreviewProjectVideo}
      />
    </div>
  );
}
