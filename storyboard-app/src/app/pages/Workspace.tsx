import {
  Camera,
  Film,
  Loader2,
  Maximize2,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Save,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { type AIGenerationPreview, ossApi, sceneApi, type StoryboardMediaGeneration } from "../api";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import {
  CoverReferencePanel,
  PromptReferenceStatus,
} from "../components/workspace/CoverReferencePanel";
import {
  type VideoPreview,
} from "../components/workspace/dialogs/VideoPreviewDialog";
import {
  PromptOptimizeButton,
} from "../components/workspace/PromptOptimizationDialog";
import {
  PROMPT_MENTION_CATEGORY,
  type PromptMentionOption,
  RichPromptEditor,
} from "../components/workspace/RichPromptEditor";
import { VideoGenerationSettings } from "../components/workspace/VideoGenerationSettings";
import { WorkspaceHeader } from "../components/workspace/WorkspaceHeader";
import { ENTITY_TYPE, GENERATION_STATUS, MEDIA_TYPE } from "../constants/domain";
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
  FIXED_VIDEO_ASPECT_RATIO,
  formatShotNumber,
  getAssetMentionPresentation,
  getGenerationPreviewSrc,
  getProjectVideoPreviewSrc,
  getSceneNavigatorThumbnailSrc,
  getStoryboardPreviewSrc,
  getStoryboardVideoPreviewSrc,
  VIDEO_MODEL_OPTIONS,
} from "./Workspace.helpers";
import styles from "./Workspace.module.scss";
import {
  GenerationDialogs,
  ManageDialogs,
  PreviewDialogs,
  PromptDialogs,
} from "./WorkspaceDialogs";

function SceneInsertDivider({
  position,
  disabled,
  revealed = false,
  onInsert,
}: {
  position: number;
  disabled?: boolean;
  revealed?: boolean;
  onInsert: (position: number) => void;
}) {
  return (
    <div className={styles.insertDivider} aria-label={`在第 ${position} 个位置插入片段`}>
      <button
        type="button"
        disabled={disabled}
        className={revealed ? styles.insertButtonRevealed : styles.insertButton}
        onClick={() => onInsert(position)}
        title={`在片段 ${position} 插入新片段`}
      >
        <Plus className={styles.insertIcon} />
      </button>
      <span className={revealed ? styles.insertLineRevealed : styles.insertLine} />
    </div>
  );
}

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

  const countPromptShots = (prompt?: string) =>
    Math.max(1, (String(prompt ?? "").match(/(?:^|\n)\s*镜号\s*[：:]/g) ?? []).length);

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
        <div
          className={
            isEpisodeRailCollapsed
              ? `storyboard-glass-panel ${styles.sceneRailCollapsed}`
              : `storyboard-glass-panel ${styles.sceneRail}`
          }
        >
          {!isEpisodeRailCollapsed ? (
            <aside className={styles.chapterRail}>
              <div className={styles.chapterRailTitle}>选集</div>
              <div className={styles.chapterList}>
                {chapters.map((chapter, index) => {
                  const active = selectedChapter?.id === chapter.id;
                  return (
                    <button
                      key={chapter.id}
                      type="button"
                      title={chapter.title}
                      aria-label={`第 ${index + 1} 集：${chapter.title}`}
                      className={active ? styles.chapterButtonActive : styles.chapterButton}
                      onClick={() => {
                        if (!active) void toggleChapter(chapter.id);
                      }}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </aside>
          ) : null}

          <aside className={styles.sceneNavigator}>
            <div className={styles.sceneNavigatorHeader}>
              <div className={styles.sceneNavigatorTitleRow}>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={styles.railToggle}
                  onClick={() => setIsEpisodeRailCollapsed((collapsed) => !collapsed)}
                  aria-label={isEpisodeRailCollapsed ? "展开选集" : "收起选集"}
                  title={isEpisodeRailCollapsed ? "展开选集" : "收起选集"}
                >
                  {isEpisodeRailCollapsed ? (
                    <PanelLeftOpen className={styles.icon} />
                  ) : (
                    <PanelLeftClose className={styles.icon} />
                  )}
                </Button>
                <div className={styles.sceneNavigatorTitleWrap}>
                  <div className={styles.sceneNavigatorTitle}>
                    {selectedChapter?.title ?? "请选择章节"}
                  </div>
                  <div className={styles.sceneCount}>{scenes.length} 个片段</div>
                </div>
              </div>
              <div className={styles.sceneNavigatorActions}>
                <DropdownMenu>
                  <DropdownMenuTrigger className={styles.sceneMenuTrigger}>
                    <MoreHorizontal className={styles.icon} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={styles.dropdownContent}>
                    <DropdownMenuItem
                      onClick={() => openCreateSceneDialog(scenes.length + 1)}
                      disabled={!activeChapterForSceneCreation}
                    >
                      <Plus className={styles.icon} />
                      新建片段
                    </DropdownMenuItem>
                    {selectedScene ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => handleRequestDeleteScene(selectedScene)}
                      >
                        <Trash2 className={styles.icon} />
                        删除当前片段
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className={styles.sceneListScroll}>
              {loading ? (
                <div className={styles.loadingState}>
                  <Loader2 className={styles.loadingIcon} />
                  正在加载
                </div>
              ) : !selectedProject ? (
                <div className={styles.noProject}>请从项目列表进入工作台</div>
              ) : (
                <div className={styles.sceneList}>
                  {!scenes.length ? (
                    <SceneInsertDivider
                      position={1}
                      disabled={!selectedProject}
                      onInsert={openCreateSceneDialog}
                    />
                  ) : null}
                  {scenes.map((scene, sceneIndex) => {
                    const activeScene = selectedScene?.id === scene.id;
                    return (
                      <div key={scene.id}>
                        <SceneInsertDivider
                          position={sceneIndex + 1}
                          disabled={!selectedProject}
                          revealed={
                            hoveredSceneIndex === sceneIndex || hoveredSceneIndex === sceneIndex - 1
                          }
                          onInsert={openCreateSceneDialog}
                        />
                        <section
                          className={styles.sceneItem}
                          onMouseEnter={() => setHoveredSceneIndex(sceneIndex)}
                          onMouseLeave={() => setHoveredSceneIndex(null)}
                        >
                          <button
                            type="button"
                            className={activeScene ? styles.sceneButtonActive : styles.sceneButton}
                            onClick={() => void selectScene(scene)}
                          >
                            <span
                              className={
                                activeScene ? styles.sceneMarkerActive : styles.sceneMarker
                              }
                            />
                            <span className={styles.sceneThumbnail}>
                              {getSceneNavigatorThumbnailSrc(scene) ? (
                                <img
                                  src={getSceneNavigatorThumbnailSrc(scene)}
                                  alt={`${scene.title}片段封面`}
                                  loading="lazy"
                                  decoding="async"
                                  className={styles.sceneThumbnailImage}
                                />
                              ) : (
                                <Film className={styles.scenePlaceholderIcon} aria-hidden="true" />
                              )}
                            </span>
                            <span className={styles.sceneText}>
                              <span
                                className={
                                  activeScene ? styles.sceneIndexActive : styles.sceneIndex
                                }
                              >
                                片段-{sceneIndex + 1}
                              </span>
                              <span
                                className={
                                  activeScene ? styles.sceneTitleActive : styles.sceneTitle
                                }
                              >
                                {scene.title}
                              </span>
                            </span>
                            <Badge className={styles.shotCountBadge}>
                              {countPromptShots(scene.prompt)} 镜号
                            </Badge>
                          </button>
                        </section>
                        {sceneIndex === scenes.length - 1 ? (
                          <SceneInsertDivider
                            position={scenes.length + 1}
                            disabled={!selectedProject}
                            revealed={hoveredSceneIndex === sceneIndex}
                            onInsert={openCreateSceneDialog}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>

        <main
          className={
            isEpisodeRailCollapsed
              ? `storyboard-center-stage ${styles.centerStageCollapsed}`
              : `storyboard-center-stage ${styles.centerStage}`
          }
        >
          <div className={styles.previewStage}>
            {selectedShot ? (
              <div className={styles.previewContainer}>
                {selectedShot.video_status === GENERATION_STATUS.GENERATING ? (
                  <div className={`storyboard-media-frame ${styles.generatingPreview}`}>
                    <Loader2 className={styles.previewLoadingIcon} />
                    <span className={styles.generatingText}>视频生成中，状态会自动刷新</span>
                  </div>
                ) : getStoryboardVideoPreviewSrc(selectedShot) ? (
                  <div className={`storyboard-media-frame ${styles.videoPreview}`}>
                    <video
                      key={getStoryboardVideoPreviewSrc(selectedShot)}
                      src={getStoryboardVideoPreviewSrc(selectedShot)}
                      controls
                      playsInline
                      className={styles.video}
                    />
                    {currentVideoGeneration ? (
                      <button
                        type="button"
                        className={styles.extractButton}
                        onClick={() => setFrameExtractionGeneration(currentVideoGeneration)}
                      >
                        <Scissors className={styles.actionIcon} /> 截取
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className={`storyboard-media-frame ${styles.emptyVideoPreview}`}>
                    {getStoryboardPreviewSrc(selectedShot) ? (
                      <img
                        src={getStoryboardPreviewSrc(selectedShot)}
                        alt=""
                        className={styles.coverBackdrop}
                      />
                    ) : null}
                    <div className={styles.playPlaceholder}>
                      <Play className={styles.playPlaceholderIcon} />
                    </div>
                    <span className={styles.emptyVideoText}>点击右侧“生视频”开始生成</span>
                  </div>
                )}

                {selectedShot.video_status === GENERATION_STATUS.FAILED &&
                selectedShot.video_error ? (
                  <div className={styles.videoError}>
                    <div className={styles.videoErrorTitle}>视频生成失败</div>
                    <div className={styles.videoErrorMessage}>{selectedShot.video_error}</div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className={styles.emptySelection}>
                <Camera className={styles.emptySelectionIcon} />
                <p className={styles.emptySelectionText}>从左侧选择一个片段</p>
              </div>
            )}
          </div>

          <div className={styles.history}>
            <div className={styles.historyTitle}>History</div>
            <div className={styles.historyList}>
              {videoGenerations.map((generation, index) => (
                <div
                  key={generation.id}
                  className={generation.is_current ? styles.historyItemCurrent : styles.historyItem}
                >
                  {getGenerationPreviewSrc(generation) ? (
                    <video
                      src={getGenerationPreviewSrc(generation)}
                      muted
                      className={styles.historyVideo}
                    />
                  ) : (
                    <div className={styles.historyStatus}>{generation.status}</div>
                  )}
                  <button
                    type="button"
                    className={styles.historyVersionButton}
                    onClick={() => void handleSetCurrentGeneration(generation)}
                    disabled={
                      generation.is_current ||
                      generation.status !== GENERATION_STATUS.SUCCEEDED ||
                      !generation.result_url ||
                      activeMediaActionKey === "set-current:" + generation.id
                    }
                    title={
                      generation.status !== GENERATION_STATUS.SUCCEEDED || !generation.result_url
                        ? "该版本未生成成功，不能切换"
                        : generation.is_current
                          ? "当前版本"
                          : "设为当前版本"
                    }
                  >
                    {generation.status === GENERATION_STATUS.SUCCEEDED
                      ? `v${videoGenerations.length - index}`
                      : generation.status === GENERATION_STATUS.FAILED
                        ? "失败"
                        : "生成中"}
                  </button>
                  {generation.status === GENERATION_STATUS.SUCCEEDED && generation.result_url ? (
                    <button
                      type="button"
                      className={styles.historyExtractButton}
                      onClick={() => setFrameExtractionGeneration(generation)}
                      aria-label="从该视频版本截取图片或视频"
                      title="截取图片或视频"
                    >
                      <Scissors className={styles.historyIcon} />
                    </button>
                  ) : null}
                  {generation.extracted_frames?.length ? (
                    <span className={styles.extractedFrameCount}>
                      {generation.extracted_frames.length} 帧
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className={styles.historyDeleteButton}
                    onClick={() => handleRequestDeleteGeneration(generation)}
                    aria-label="删除历史版本"
                  >
                    <X className={styles.historyIcon} />
                  </button>
                </div>
              ))}
              {!videoGenerations.length ? (
                <div className={styles.historyEmpty}>还没有视频历史版本</div>
              ) : null}
            </div>
          </div>
        </main>

        <aside className={`storyboard-glass-panel ${styles.settingsPanel}`}>
          {selectedShot ? (
            <>
              <div className={styles.settingsScroll}>
                <CoverReferencePanel
                  key={selectedShot.id}
                  currentCoverUrl={getStoryboardPreviewSrc(selectedShot)}
                  references={liveGenerationReferences}
                  isLoadingReferences={isLoadingGenerationReferences}
                  referenceError={generationReferenceError}
                  generationError={coverGenerationError}
                  isGenerating={
                    generatingCoverId === selectedShot.id || isLoadingCoverPreview || isSavingShot
                  }
                  history={coverGenerations.map((generation, index) => ({
                    id: generation.id,
                    src: getGenerationPreviewSrc(generation),
                    label: `v${coverGenerations.length - index}`,
                    isCurrent: !!generation.is_current,
                    status: generation.status,
                  }))}
                  onGenerate={() => void handleGenerateCover()}
                  onUpload={handleRequestUploadShotCover}
                  onManageCharacters={() => void handleOpenManageCharacters()}
                  onManageAssets={() => void handleOpenManageAssets()}
                  onPreviewCurrent={() => {
                    const src = selectedShot.thumbnail_url || getStoryboardPreviewSrc(selectedShot);
                    if (src) setPreviewImage({ src, alt: "当前首帧" });
                  }}
                  onPreviewReference={openGenerationReferencePreview}
                  onPreviewHistory={(generationId) => {
                    const generation = coverGenerations.find((item) => item.id === generationId);
                    if (generation) openCoverHistoryPreview(generation);
                  }}
                  onDismissError={() => {
                    setCoverGenerationError("");
                    setGenerationReferenceError("");
                  }}
                />

                <section className={styles.promptSection}>
                  <div className={styles.promptHeader}>
                    <div className={styles.promptTitleRow}>
                      <span className={styles.promptTitle}>提示词</span>
                      <span className={styles.shotNumber}>
                        #{formatShotNumber(selectedShot.shot_number)}
                      </span>
                    </div>
                    <div className={styles.promptActions}>
                      <PromptOptimizeButton
                        compact
                        loading={isOptimizingPrompt}
                        disabled={!shotForm.content.trim()}
                        onClick={() => void requestPromptOptimization()}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className={styles.fullscreenButton}
                        onClick={() => setIsPromptFullscreenOpen(true)}
                        aria-label="全屏编辑提示词"
                      >
                        <Maximize2 className={styles.fullscreenIcon} />
                      </Button>
                    </div>
                  </div>
                  <PromptReferenceStatus references={liveGenerationReferences} />
                  <RichPromptEditor
                    key={"inline-prompt-" + selectedShot.id}
                    value={shotForm.content}
                    options={promptMentionOptions}
                    onChange={(value) => updateShotForm("content", value)}
                    onSelectMention={handleSelectPromptMention}
                    onRemoveMentions={handleRemovePromptMentions}
                  />
                  <div className={styles.mentionHint}>输入 @ 引用资产</div>
                </section>

                <section className={styles.firstFrameSection}>
                  <div className={styles.firstFrameSetting}>
                    <div>
                      <div className={styles.firstFrameTitle}>指定首帧控制开场</div>
                      <div className={styles.firstFrameDescription}>
                        关闭时使用角色和场景参考素材生成视频
                      </div>
                    </div>
                    <Switch
                      checked={useFirstFrameForVideo}
                      onCheckedChange={setUseFirstFrameForVideo}
                    />
                  </div>
                </section>
              </div>

              <div className={styles.generateFooter}>
                <div className={styles.generationSettings}>
                  <Select value={selectedVideoModel} onValueChange={handleVideoModelChange}>
                    <SelectTrigger className={styles.modelSelect}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={styles.selectContent}>
                      {VIDEO_MODEL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <VideoGenerationSettings
                    model={selectedVideoModel}
                    aspectRatio={FIXED_VIDEO_ASPECT_RATIO}
                    resolution={activeVideoResolution}
                    duration={activeVideoDuration}
                    generateAudio={activeVideoAudio}
                    onResolutionChange={setSelectedVideoResolution}
                    onDurationChange={setSelectedVideoDuration}
                    onGenerateAudioChange={setGenerateVideoAudio}
                  />
                </div>
                <div className={styles.generateActions}>
                  <Button
                    className={styles.generateVideoButton}
                    onClick={() => void handleGenerateVideo()}
                    disabled={
                      generatingVideoId === selectedShot.id || isLoadingVideoPreview || isSavingShot
                    }
                  >
                    {generatingVideoId === selectedShot.id || isLoadingVideoPreview ? (
                      <Loader2 className={styles.generateActionIcon} />
                    ) : (
                      <Play className={styles.generateActionIcon} />
                    )}
                    生视频
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={styles.generateMenuTrigger}>
                      <MoreHorizontal className={styles.actionIcon} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className={styles.selectContent}>
                      <DropdownMenuItem
                        onClick={() => void handleSaveShot()}
                        disabled={isSavingShot}
                      >
                        <Save className={styles.actionIcon} />
                        保存片段 Prompt
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => selectedScene && handleRequestDeleteScene(selectedScene)}
                      >
                        <Trash2 className={styles.actionIcon} />
                        删除片段
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.settingsEmpty}>
              <div>
                <Camera className={styles.settingsEmptyIcon} />
                <p className={styles.emptySelectionText}>选择片段后编辑生成参数</p>
              </div>
            </div>
          )}
        </aside>
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
