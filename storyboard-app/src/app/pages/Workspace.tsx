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
import { ImagePreviewDialog } from "../components/shared/ImagePreviewDialog";
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
import { ConfirmationDialog } from "../components/workspace/dialogs/ConfirmationDialog";
import { CoverGenerationDialog } from "../components/workspace/dialogs/CoverGenerationDialog";
import { CreateSceneDialog } from "../components/workspace/dialogs/CreateSceneDialog";
import { FullscreenPromptDialog } from "../components/workspace/dialogs/FullscreenPromptDialog";
import { ManageReferencesDialog } from "../components/workspace/dialogs/ManageReferencesDialog";
import { SceneCoverGenerationDialog } from "../components/workspace/dialogs/SceneCoverGenerationDialog";
import { VideoGenerationDialog } from "../components/workspace/dialogs/VideoGenerationDialog";
import {
  type VideoPreview,
  VideoPreviewDialog,
} from "../components/workspace/dialogs/VideoPreviewDialog";
import {
  PromptOptimizationDialog,
  PromptOptimizeButton,
} from "../components/workspace/PromptOptimizationDialog";
import {
  PROMPT_MENTION_CATEGORY,
  type PromptMentionOption,
  RichPromptEditor,
} from "../components/workspace/RichPromptEditor";
import { VideoFrameExtractionDialog } from "../components/workspace/VideoFrameExtractionDialog";
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
  emptyDescriptionOptimization,
  emptyShotForm,
  FIXED_VIDEO_ASPECT_RATIO,
  formatPromptForDisplay,
  formatShanghaiDateTime,
  getAssetMentionPresentation,
  getGenerationPreviewSrc,
  getProjectVideoPreviewSrc,
  getSceneNavigatorThumbnailSrc,
  getStoryboardPreviewSrc,
  getStoryboardVideoPreviewSrc,
  VIDEO_MODEL_OPTIONS,
} from "./Workspace.helpers";
import styles from "./Workspace.module.scss";

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

  const formatShotNumber = (num?: number) => String(num ?? 0).padStart(3, "0");

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

      <FullscreenPromptDialog
        open={isPromptFullscreenOpen}
        sceneTitle={selectedScene?.title ?? "未命名片段"}
        editorKey={`fullscreen-prompt-${selectedShot?.id ?? 0}`}
        value={shotForm.content}
        options={promptMentionOptions}
        optimizing={isOptimizingPrompt}
        onOpenChange={setIsPromptFullscreenOpen}
        onChange={(value) => updateShotForm("content", value)}
        onSelectMention={(option) => void handleSelectPromptMention(option)}
        onRemoveMentions={(options) => void handleRemovePromptMentions(options)}
        onOptimize={() => void requestPromptOptimization()}
      />
      <PromptOptimizationDialog
        open={isPromptOptimizationOpen}
        originalPrompt={promptOptimizationOriginal}
        optimizedPrompt={promptOptimizationCandidate}
        model={promptOptimizationModel}
        loading={isOptimizingPrompt}
        error={promptOptimizationError}
        onOpenChange={setIsPromptOptimizationOpen}
        onRetry={() => void requestPromptOptimization()}
        onConfirm={confirmPromptOptimization}
      />
      <PromptOptimizationDialog
        open={descriptionOptimization.open}
        originalPrompt={descriptionOptimization.original}
        optimizedPrompt={descriptionOptimization.candidate}
        model={descriptionOptimization.model}
        loading={descriptionOptimization.loading}
        error={descriptionOptimization.error}
        onOpenChange={(open) =>
          setDescriptionOptimization((current) =>
            open ? { ...current, open: true } : emptyDescriptionOptimization,
          )
        }
        onRetry={() => void requestDescriptionOptimization()}
        onConfirm={confirmDescriptionOptimization}
        title="AI 优化片段描述"
        description="DeepSeek 只生成候选描述。确认前不会覆盖表单，也不会创建片段。"
        loadingText="DeepSeek 正在按自然剧情节奏整理镜号描述..."
        reviewText="请核对人物、动作、剧情顺序和台词含义后再替换。"
        originalLabel="原片段描述"
        optimizedLabel="AI 候选描述"
        confirmLabel="确认使用"
      />
      <ManageReferencesDialog
        open={isManageCharactersOpen}
        title="管理片段角色"
        description="管理当前片段 Prompt 使用的角色参考。"
        currentDescription={
          selectedShot
            ? `${selectedScene?.title ?? "未命名片段"} · ${selectedShot.content ?? "未填写 Prompt"}`
            : "未选择片段"
        }
        emptyAssignedLabel="当前片段未关联角色"
        libraryTitle="项目角色库"
        loadingLabel="正在加载项目角色"
        emptyLibraryLabel="当前项目还没有可选角色。"
        refreshLabel="刷新角色库"
        assignedItems={(selectedShot?.characters ?? []).map((character) => ({
          id: character.id,
          name: character.name,
          description: character.description ?? "暂无角色描述",
          assigned: true,
        }))}
        items={projectCharacters.map((character) => ({
          id: character.id,
          name: character.name,
          description: character.description ?? "暂无角色描述",
          assigned: !!selectedShot?.characters?.some((item) => item.id === character.id),
        }))}
        loading={isLoadingProjectCharacters}
        canRefresh={!!selectedProject}
        activeActionKey={activeCharacterActionKey}
        actionPrefix="add-character"
        removePrefix="remove-character"
        itemAriaLabel="角色"
        onOpenChange={setIsManageCharactersOpen}
        onRefresh={() => selectedProject && void loadProjectCharacters(selectedProject.id)}
        onAdd={(id) => void handleAddStoryboardCharacter(id)}
        onRemove={(id) => void handleRemoveStoryboardCharacter(id)}
      />
      <ManageReferencesDialog
        open={isManageAssetsOpen}
        title="管理参考资产"
        description="给当前片段添加或移除场景、图片、道具和音频资产。生成时会按媒体类型分别作为参考图或参考音频传入。"
        currentDescription={
          selectedShot
            ? `${formatShotNumber(selectedShot.shot_number)} · ${selectedShot.content ?? "未填写画面描述"}`
            : "未选择片段"
        }
        emptyAssignedLabel="当前片段未关联参考资产"
        libraryTitle="项目参考资产库"
        loadingLabel="正在加载项目参考资产"
        emptyLibraryLabel="当前项目还没有可用的参考资产。"
        refreshLabel="刷新资产库"
        assignedItems={(selectedShot?.assets ?? []).map((asset) => ({
          id: asset.id,
          name: asset.name,
          description: asset.meta ?? asset.type ?? "项目资产",
          assigned: true,
        }))}
        items={projectAssets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          description: asset.meta ?? asset.type ?? "项目资产",
          assigned: !!selectedShot?.assets?.some((item) => item.id === asset.id),
        }))}
        loading={isLoadingProjectAssets}
        canRefresh={!!selectedProject}
        activeActionKey={activeAssetActionKey}
        actionPrefix="add-asset"
        removePrefix="remove-asset"
        itemAriaLabel="参考资产"
        onOpenChange={setIsManageAssetsOpen}
        onRefresh={() => selectedProject && void loadProjectAssets(selectedProject.id)}
        onAdd={(id) => void handleAddStoryboardAsset(id)}
        onRemove={(id) => void handleRemoveStoryboardAsset(id)}
      />
      <CreateSceneDialog
        open={isCreateSceneOpen}
        insertSortOrder={sceneInsertSortOrder}
        sceneCount={scenes.length}
        draft={newSceneForm}
        creating={isCreatingScene}
        optimizingDescription={descriptionOptimization.loading}
        onOpenChange={(open) => {
          setIsCreateSceneOpen(open);
          if (!open) {
            setSceneInsertSortOrder(null);
            resetNewSceneForm();
          }
        }}
        onDraftChange={setNewSceneForm}
        onOptimizeDescription={() => void requestDescriptionOptimization()}
        onCreate={() => void handleCreateScene()}
      />
      <CoverGenerationDialog
        open={isCoverConfirmOpen}
        sceneTitle={selectedScene?.title ?? "-"}
        preview={coverGenerationPreview}
        formattedPrompt={formatPromptForDisplay(coverGenerationPreview?.final_prompt)}
        onOpenChange={setIsCoverConfirmOpen}
        onPreviewReference={openGenerationReferencePreview}
        onManageCharacters={handleManageCharactersForCover}
        onManageAssets={handleManageAssetsForCover}
        onConfirm={(textOnly) => void confirmGenerateCover(textOnly)}
      />

      <SceneCoverGenerationDialog
        open={isSceneCoverConfirmOpen}
        preview={sceneCoverGenerationPreview}
        formattedPrompt={formatPromptForDisplay(sceneCoverGenerationPreview?.final_prompt)}
        onOpenChange={setIsSceneCoverConfirmOpen}
        onConfirm={() => void confirmGenerateSceneCover()}
      />

      <ConfirmationDialog
        open={isBatchSceneCoverConfirmOpen}
        title="确认批量生成首帧"
        description="会为当前片段下的全部镜头串行生成新首帧，并消耗图像模型额度。新结果会保留到各自镜头的首帧历史中。"
        items={[
          { label: "片段标题", value: selectedScene?.title ?? "-" },
          { label: "镜头数量", value: filteredShots.length },
          { label: "当前模型", value: "Seedream 4.5" },
        ]}
        confirmLabel="确认生成"
        onOpenChange={setIsBatchSceneCoverConfirmOpen}
        onConfirm={() => void confirmBatchGenerateSceneCovers()}
      />

      <ConfirmationDialog
        open={isSceneVideoConfirmOpen}
        title={selectedScene?.video_url ? "确认重新生成片段视频" : "确认生成片段视频"}
        description={
          selectedScene?.video_url
            ? "当前片段已经有一个已生成的视频。继续后会重新合成并覆盖当前片段视频结果。"
            : "会将当前片段下已有视频镜头按顺序合成为一个片段视频，并保留每个镜头原始音轨。"
        }
        items={[
          { label: "片段标题", value: selectedScene?.title ?? "-" },
          { label: "可合成镜头数", value: composableShots.length },
          { label: "输出规格", value: "720P / 保留原音轨" },
        ]}
        confirmLabel={selectedScene?.video_url ? "确认重新生成" : "确认合成"}
        onOpenChange={setIsSceneVideoConfirmOpen}
        onConfirm={() => void confirmComposeSceneVideo()}
      />

      <ConfirmationDialog
        open={isProjectVideoConfirmOpen}
        title="确认生成项目总片"
        description="会自动收集当前项目内已生成成功的片段视频，按章节和片段顺序合成为一个项目级粗剪视频。"
        items={[
          { label: "项目名称", value: selectedProject?.name ?? "-" },
          { label: "输出规格", value: "720P / 保留各片段原音轨" },
        ]}
        confirmLabel="确认合成"
        onOpenChange={setIsProjectVideoConfirmOpen}
        onConfirm={() => void confirmComposeProjectVideo()}
      />

      <VideoGenerationDialog
        open={isVideoConfirmOpen}
        preview={videoGenerationPreview}
        previewSpecLabel={previewVideoSpecLabel}
        sceneTitle={selectedScene?.title ?? "-"}
        selectedModel={selectedVideoModel}
        activeDuration={activeVideoDuration}
        useFirstFrame={useFirstFrameForVideo}
        shotNumberLabel={selectedShot ? formatShotNumber(selectedShot.shot_number) : ""}
        formattedPrompt={formatPromptForDisplay(videoGenerationPreview?.final_prompt)}
        onOpenChange={handleVideoConfirmOpenChange}
        onUseFirstFrameChange={setUseFirstFrameForVideo}
        onConfirm={() => void confirmGenerateVideo()}
      />

      <ConfirmationDialog
        open={!!deleteTargetGeneration}
        title="确认删除历史版本"
        description="该操作会从历史列表中移除当前版本记录，但不会删除服务器上的资源文件。"
        items={[
          {
            label: "类型",
            value: deleteTargetGeneration?.media_type === MEDIA_TYPE.VIDEO ? "视频" : "首帧",
          },
          { label: "模型", value: deleteTargetGeneration?.model ?? "-" },
          {
            label: "生成时间",
            value: formatShanghaiDateTime(deleteTargetGeneration?.created_at),
          },
        ]}
        confirmLabel="确认删除"
        tone="danger"
        onOpenChange={(open) => !open && setDeleteTargetGeneration(null)}
        onConfirm={() => void confirmDeleteGeneration()}
      />

      <ConfirmationDialog
        open={!!deleteTargetScene}
        title="确认删除片段"
        description="该操作会删除当前片段及其 Prompt、引用和媒体历史，需要二次确认。"
        items={[
          { label: "片段标题", value: deleteTargetScene?.title ?? "-" },
          { label: "地点", value: deleteTargetScene?.location ?? "-" },
          { label: "时间", value: deleteTargetScene?.time_of_day ?? "-" },
        ]}
        confirmLabel="确认删除"
        tone="danger"
        onOpenChange={(open) => !open && setDeleteTargetScene(null)}
        onConfirm={() => void confirmDeleteScene()}
      />

      <ImagePreviewDialog
        open={!!previewImage}
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null);
        }}
        src={previewImage?.src ?? ""}
        alt={previewImage?.alt ?? "片段预览图"}
        items={previewImage?.items}
        currentIndex={previewImage?.currentIndex}
        onNavigate={(nextIndex) => {
          if (!previewImage?.items?.length) return;
          const nextItem = previewImage.items[nextIndex];
          if (!nextItem) return;
          setPreviewImage({
            ...previewImage,
            src: nextItem.src,
            alt: nextItem.alt,
            currentIndex: nextIndex,
          });
        }}
      />

      {frameExtractionGeneration && selectedScene ? (
        <VideoFrameExtractionDialog
          open
          sourceScene={selectedScene}
          nextScene={nextSceneInChapter}
          generation={frameExtractionGeneration}
          onOpenChange={(open) => {
            if (!open) setFrameExtractionGeneration(null);
          }}
          onInsert={handleInsertVideoFrame}
          onClip={handleCreateVideoClip}
        />
      ) : null}

      <VideoPreviewDialog
        preview={previewSceneVideo}
        fallbackTitle="片段视频预览"
        description="默认播放预览版视频。需要查看原始输出时，可在下方打开原视频。"
        onClose={() => setPreviewSceneVideo(null)}
      />

      <VideoPreviewDialog
        preview={previewProjectVideo}
        fallbackTitle="项目总片预览"
        description="默认播放预览版项目总片。需要查看原始输出时，可在下方打开原视频。"
        onClose={() => setPreviewProjectVideo(null)}
      />
    </div>
  );
}
