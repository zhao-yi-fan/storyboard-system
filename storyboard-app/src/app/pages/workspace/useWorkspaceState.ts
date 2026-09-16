import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type AIGenerationPreview,
  type Asset,
  assetApi,
  type Chapter,
  chapterApi,
  type Character,
  characterApi,
  ossApi,
  type Project,
  projectApi,
  type Scene,
  sceneApi,
  type SceneGenerationReferences,
  type SceneMediaGeneration,
  type Storyboard,
  type StoryboardCoverGenerationPreview,
  type StoryboardMediaGeneration,
  type StoryboardVideoGenerationOptions,
  type StoryboardVideoGenerationPreview,
  type VideoResolution,
} from "../../api";
import { GENERATION_STATUS, MEDIA_TYPE, VIDEO_RESOLUTION } from "../../constants/domain";
import { COMPOSITE_PROMPT_SPEC } from "../../lib/compositePrompt";
import {
  buildShotFormState,
  emptyDescriptionOptimization,
  emptySceneForm,
  emptyShotForm,
  isSeedanceVideoModel,
  sceneMediaToWorkspaceMedia,
  sceneToWorkspaceClip,
  type ShotFormState,
  VIDEO_MODEL_OPTIONS,
} from "./utils";

export type WorkspaceState = {
  loading: boolean;
  chapters: Chapter[];
  scenes: Scene[];
  storyboards: Storyboard[];
  mediaGenerations: StoryboardMediaGeneration[];
  frameExtractionGeneration: StoryboardMediaGeneration | null;
  selectedProject: Project | null;
  selectedChapter: Chapter | null;
  selectedScene: Scene | null;
  selectedShot: Storyboard | null;
  hoveredSceneIndex: number | null;
  expandedChapters: number[];
  isEpisodeRailCollapsed: boolean;
  isSavingShot: boolean;
  generatingCoverId: number | null;
  generatingVideoId: number | null;
  previewImage: {
    src: string;
    alt: string;
    items?: { src: string; alt: string }[];
    currentIndex?: number;
  } | null;
  selectedVideoModel: (typeof VIDEO_MODEL_OPTIONS)[number]["value"];
  selectedVideoResolution: VideoResolution;
  selectedVideoDuration: number;
  generateVideoAudio: boolean;
  useFirstFrameForVideo: boolean;
  isLoadingCoverPreview: boolean;
  isLoadingVideoPreview: boolean;
  coverGenerationPreview: StoryboardCoverGenerationPreview | null;
  generationReferences: SceneGenerationReferences | null;
  isLoadingGenerationReferences: boolean;
  generationReferenceError: string;
  coverGenerationError: string;
  videoGenerationPreview: StoryboardVideoGenerationPreview | null;
  videoGenerationRequest: StoryboardVideoGenerationOptions | null;
  isCoverConfirmOpen: boolean;
  isVideoConfirmOpen: boolean;
  isSceneCoverConfirmOpen: boolean;
  sceneCoverGenerationPreview: AIGenerationPreview | null;
  isBatchSceneCoverConfirmOpen: boolean;
  isSceneVideoConfirmOpen: boolean;
  isProjectVideoConfirmOpen: boolean;
  isCreateSceneOpen: boolean;
  sceneInsertSortOrder: number | null;
  isCreatingScene: boolean;
  isComposingProjectVideo: boolean;
  deleteTargetGeneration: StoryboardMediaGeneration | null;
  deleteTargetScene: Scene | null;
  activeMediaActionKey: string | null;
  previewSceneVideo: { src: string; originalSrc?: string; title: string } | null;
  previewProjectVideo: { src: string; originalSrc?: string; title: string } | null;
  shotForm: ShotFormState;
  isPromptFullscreenOpen: boolean;
  isPromptOptimizationOpen: boolean;
  isOptimizingPrompt: boolean;
  promptOptimizationOriginal: string;
  promptOptimizationCandidate: string;
  promptOptimizationModel: string;
  promptOptimizationError: string;
  newSceneForm: typeof emptySceneForm;
  descriptionOptimization: typeof emptyDescriptionOptimization;
  projectCharacters: Character[];
  projectAssets: Asset[];
  isManageCharactersOpen: boolean;
  isManageAssetsOpen: boolean;
  isLoadingProjectCharacters: boolean;
  isLoadingProjectAssets: boolean;
  activeCharacterActionKey: string | null;
  activeAssetActionKey: string | null;
};

export function useWorkspaceState() {
  const [loading, setLoading] = useState(true);
  const [, setProjects] = useState<Project[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [mediaGenerations, setMediaGenerations] = useState<StoryboardMediaGeneration[]>([]);
  const [frameExtractionGeneration, setFrameExtractionGeneration] =
    useState<StoryboardMediaGeneration | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [selectedShot, setSelectedShot] = useState<Storyboard | null>(null);
  const [hoveredSceneIndex, setHoveredSceneIndex] = useState<number | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<number[]>([]);
  const [isEpisodeRailCollapsed, setIsEpisodeRailCollapsed] = useState(false);
  const [isSavingShot, setIsSavingShot] = useState(false);
  const [generatingCoverId, setGeneratingCoverId] = useState<number | null>(null);
  const [, setUploadingCoverId] = useState<number | null>(null);
  const [generatingVideoId, setGeneratingVideoId] = useState<number | null>(null);
  const [, setPendingGeneratedShotId] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
    items?: { src: string; alt: string }[];
    currentIndex?: number;
  } | null>(null);
  const [selectedVideoModel, setSelectedVideoModel] = useState<
    (typeof VIDEO_MODEL_OPTIONS)[number]["value"]
  >(VIDEO_MODEL_OPTIONS[0].value);
  const [selectedVideoResolution, setSelectedVideoResolution] =
    useState<VideoResolution>(VIDEO_RESOLUTION.HD);
  const [selectedVideoDuration, setSelectedVideoDuration] = useState(5);
  const [generateVideoAudio, setGenerateVideoAudio] = useState(true);
  const [useFirstFrameForVideo, setUseFirstFrameForVideo] = useState(false);
  const [isLoadingCoverPreview, setIsLoadingCoverPreview] = useState(false);
  const [isLoadingVideoPreview, setIsLoadingVideoPreview] = useState(false);
  const [coverGenerationPreview, setCoverGenerationPreview] =
    useState<StoryboardCoverGenerationPreview | null>(null);
  const [generationReferences, setGenerationReferences] =
    useState<SceneGenerationReferences | null>(null);
  const [isLoadingGenerationReferences, setIsLoadingGenerationReferences] = useState(false);
  const [generationReferenceError, setGenerationReferenceError] = useState("");
  const [coverGenerationError, setCoverGenerationError] = useState("");
  const [videoGenerationPreview, setVideoGenerationPreview] =
    useState<StoryboardVideoGenerationPreview | null>(null);
  const [videoGenerationRequest, setVideoGenerationRequest] =
    useState<StoryboardVideoGenerationOptions | null>(null);
  const [isCoverConfirmOpen, setIsCoverConfirmOpen] = useState(false);
  const [isVideoConfirmOpen, setIsVideoConfirmOpen] = useState(false);
  const [isSceneCoverConfirmOpen, setIsSceneCoverConfirmOpen] = useState(false);
  const [sceneCoverGenerationPreview, _setSceneCoverGenerationPreview] =
    useState<AIGenerationPreview | null>(null);
  const [isBatchSceneCoverConfirmOpen, setIsBatchSceneCoverConfirmOpen] = useState(false);
  const [isSceneVideoConfirmOpen, setIsSceneVideoConfirmOpen] = useState(false);
  const [isProjectVideoConfirmOpen, setIsProjectVideoConfirmOpen] = useState(false);
  const [isCreateSceneOpen, setIsCreateSceneOpen] = useState(false);
  const [sceneInsertSortOrder, setSceneInsertSortOrder] = useState<number | null>(null);
  const [isCreatingScene, setIsCreatingScene] = useState(false);
  const [isComposingProjectVideo, setIsComposingProjectVideo] = useState(false);
  const [deleteTargetGeneration, setDeleteTargetGeneration] =
    useState<StoryboardMediaGeneration | null>(null);
  const [deleteTargetScene, setDeleteTargetScene] = useState<Scene | null>(null);
  const [activeMediaActionKey, setActiveMediaActionKey] = useState<string | null>(null);
  const [previewSceneVideo, setPreviewSceneVideo] = useState<{
    src: string;
    originalSrc?: string;
    title: string;
  } | null>(null);
  const [previewProjectVideo, setPreviewProjectVideo] = useState<{
    src: string;
    originalSrc?: string;
    title: string;
  } | null>(null);
  const [shotForm, setShotForm] = useState<ShotFormState>(emptyShotForm);
  const [isPromptFullscreenOpen, setIsPromptFullscreenOpen] = useState(false);
  const [isPromptOptimizationOpen, setIsPromptOptimizationOpen] = useState(false);
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
  const [promptOptimizationOriginal, setPromptOptimizationOriginal] = useState("");
  const [promptOptimizationCandidate, setPromptOptimizationCandidate] = useState("");
  const [promptOptimizationModel, setPromptOptimizationModel] = useState("");
  const [promptOptimizationError, setPromptOptimizationError] = useState("");
  const [newSceneForm, setNewSceneForm] = useState(emptySceneForm);
  const [descriptionOptimization, setDescriptionOptimization] = useState(
    emptyDescriptionOptimization,
  );
  const [projectCharacters, setProjectCharacters] = useState<Character[]>([]);
  const [projectAssets, setProjectAssets] = useState<Asset[]>([]);
  const [isManageCharactersOpen, setIsManageCharactersOpen] = useState(false);
  const [isManageAssetsOpen, setIsManageAssetsOpen] = useState(false);
  const [isLoadingProjectCharacters, setIsLoadingProjectCharacters] = useState(false);
  const [isLoadingProjectAssets, setIsLoadingProjectAssets] = useState(false);
  const [activeCharacterActionKey, setActiveCharacterActionKey] = useState<string | null>(null);
  const [activeAssetActionKey, setActiveAssetActionKey] = useState<string | null>(null);
  const shotCoverInputRef = useRef<HTMLInputElement>(null);
  const initializedShotFormKeyRef = useRef("");

  // ── Derived values ──────────────────────────────────────────────────

  const activeVideoResolution: VideoResolution = isSeedanceVideoModel(selectedVideoModel)
    ? selectedVideoResolution
    : VIDEO_RESOLUTION.HD;
  const activeVideoDuration = isSeedanceVideoModel(selectedVideoModel) ? selectedVideoDuration : 5;
  const activeVideoAudio = isSeedanceVideoModel(selectedVideoModel) ? generateVideoAudio : true;

  const filteredShots = selectedScene
    ? storyboards.filter((shot) => shot.scene_id === selectedScene.id)
    : [];
  const composableShots = filteredShots.filter(
    (shot) => shot.video_status === GENERATION_STATUS.SUCCEEDED && !!shot.video_url,
  );

  const coverGenerations = mediaGenerations.filter(
    (item) => item.media_type === MEDIA_TYPE.COVER,
  );
  const videoGenerations = mediaGenerations.filter(
    (item) => item.media_type === MEDIA_TYPE.VIDEO,
  );
  const currentVideoGeneration =
    videoGenerations.find(
      (item) =>
        item.is_current && item.status === GENERATION_STATUS.SUCCEEDED && item.result_url,
    ) ?? null;

  const selectedSceneIndex = selectedScene
    ? scenes.findIndex((scene) => scene.id === selectedScene.id)
    : -1;
  const nextSceneInChapter =
    selectedSceneIndex >= 0 && selectedSceneIndex < scenes.length - 1
      ? scenes[selectedSceneIndex + 1]
      : null;

  const activeChapterForSceneCreation = selectedChapter ?? chapters[0] ?? null;

  // ── Core apply helpers ───────────────────────────────────────────────

  const applySceneUpdate = (nextScene: Scene) => {
    setScenes((prev) => prev.map((scene) => (scene.id === nextScene.id ? nextScene : scene)));
    setSelectedScene((prev) => (prev?.id === nextScene.id ? nextScene : prev));
  };

  const applyClipSceneUpdate = (nextScene: Scene) => {
    const clip = sceneToWorkspaceClip(nextScene);
    applySceneUpdate(nextScene);
    setStoryboards([clip]);
    setSelectedShot(clip);
  };

  const applyProjectUpdate = (nextProject: Project) => {
    setProjects((prev) =>
      prev.map((project) => (project.id === nextProject.id ? nextProject : project)),
    );
    setSelectedProject((prev) => (prev?.id === nextProject.id ? nextProject : prev));
  };

  const applyStoryboardsRefresh = (nextStoryboards: Storyboard[]) => {
    setStoryboards(nextStoryboards);
    setSelectedShot((prev) => {
      if (!nextStoryboards.length) return null;
      if (!prev) return nextStoryboards[0] ?? null;
      return nextStoryboards.find((shot) => shot.id === prev.id) ?? nextStoryboards[0] ?? null;
    });
  };

  const applyMediaMutation = (payload: {
    scene: Scene;
    media_generations: SceneMediaGeneration[];
  }) => {
    applyClipSceneUpdate(payload.scene);
    setMediaGenerations(payload.media_generations.map(sceneMediaToWorkspaceMedia));
  };

  // ── Data loading functions ───────────────────────────────────────────

  const loadMediaGenerations = async (sceneId: number) => {
    try {
      const data = await sceneApi.getSceneMediaGenerations(sceneId);
      setMediaGenerations(data.map(sceneMediaToWorkspaceMedia));
    } catch (error) {
      console.error("Failed to load media generations:", error);
      setMediaGenerations([]);
    }
  };

  const loadStoryboards = async (sceneId: number) => {
    try {
      const scene = await sceneApi.getScene(sceneId);
      const clip = sceneToWorkspaceClip(scene);
      applySceneUpdate(scene);
      setStoryboards([clip]);
      setSelectedShot(clip);
    } catch (error) {
      console.error("Failed to load storyboards:", error);
      setStoryboards([]);
      setSelectedShot(null);
    }
  };

  const loadGenerationReferences = async (sceneId: number) => {
    setIsLoadingGenerationReferences(true);
    setGenerationReferenceError("");
    try {
      const data = await sceneApi.getSceneGenerationReferences(sceneId);
      setGenerationReferences(data);
    } catch (error) {
      console.error("Failed to load generation references:", error);
      setGenerationReferences(null);
      setGenerationReferenceError(
        error instanceof Error ? error.message : "真实生成参考读取失败，请重试",
      );
    } finally {
      setIsLoadingGenerationReferences(false);
    }
  };

  const loadProjectCharacters = async (projectId: number) => {
    setIsLoadingProjectCharacters(true);
    try {
      const data = await characterApi.getCharactersByProject(projectId);
      setProjectCharacters(data);
    } catch (error) {
      console.error("Failed to load project characters:", error);
      toast.error(error instanceof Error ? error.message : "加载项目角色失败");
      setProjectCharacters([]);
    } finally {
      setIsLoadingProjectCharacters(false);
    }
  };

  const loadProjectAssets = async (projectId: number) => {
    setIsLoadingProjectAssets(true);
    try {
      const data = await assetApi.getAssetsByProject(projectId);
      setProjectAssets(data || []);
    } catch (error) {
      console.error("Failed to load project assets:", error);
      toast.error(error instanceof Error ? error.message : "加载项目资产失败");
      setProjectAssets([]);
    } finally {
      setIsLoadingProjectAssets(false);
    }
  };

  const loadScenes = async (chapterId: number, autoSelect = false) => {
    try {
      const data = await sceneApi.getScenesByChapter(chapterId);
      setScenes(data);
      if (autoSelect) {
        const firstScene = data[0] ?? null;
        setSelectedScene(firstScene);
        if (firstScene) {
          await loadStoryboards(firstScene.id);
        } else {
          setStoryboards([]);
          setSelectedShot(null);
        }
      } else {
        setSelectedScene((prev) => {
          if (!prev) return prev;
          return data.find((scene) => scene.id === prev.id) ?? prev;
        });
      }
    } catch (error) {
      console.error("Failed to load scenes:", error);
      setScenes([]);
      if (autoSelect) {
        setSelectedScene(null);
        setStoryboards([]);
        setSelectedShot(null);
      }
    }
  };

  const loadChapters = async (projectId: number, autoSelect = false) => {
    try {
      const data = await chapterApi.getChaptersByProject(projectId);
      setChapters(data);
      if (autoSelect) {
        const firstChapter = data[0] ?? null;
        setSelectedChapter(firstChapter);
        setExpandedChapters(firstChapter ? [firstChapter.id] : []);
        if (firstChapter) {
          await loadScenes(firstChapter.id, true);
        } else {
          setScenes([]);
          setSelectedScene(null);
          setStoryboards([]);
          setSelectedShot(null);
        }
      }
    } catch (error) {
      console.error("Failed to load chapters:", error);
      setChapters([]);
      if (autoSelect) {
        setSelectedChapter(null);
        setScenes([]);
        setSelectedScene(null);
        setStoryboards([]);
        setSelectedShot(null);
      }
    }
  };

  const resolveProjectId = () => {
    const url = new URL(window.location.href);
    const fromQuery = Number(url.searchParams.get("project") ?? "0");
    const fromStorage = Number(window.localStorage.getItem("currentProjectId") ?? "0");
    return fromQuery || fromStorage || 0;
  };

  const applyProjectSelection = async (projectId: number, projectList: Project[]) => {
    const project = projectList.find((p) => p.id === projectId);
    if (!project) return;
    window.localStorage.setItem("currentProjectId", String(projectId));
    setSelectedProject(project);
    await Promise.all([
      loadChapters(projectId, true),
      loadProjectCharacters(projectId),
      loadProjectAssets(projectId),
    ]);
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await projectApi.getProjects();
      setProjects(data);
      const projectId = resolveProjectId();
      if (projectId) {
        await applyProjectSelection(projectId, data);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  // ── Navigation & selection ───────────────────────────────────────────

  const toggleChapter = async (chapterId: number) => {
    const isExpanded = expandedChapters.includes(chapterId);
    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter) return;

    if (isExpanded) {
      setExpandedChapters((prev) => prev.filter((id) => id !== chapterId));
      setSelectedChapter(null);
      setScenes([]);
      setSelectedScene(null);
      setStoryboards([]);
      setSelectedShot(null);
      return;
    }

    setExpandedChapters([chapterId]);
    setSelectedChapter(chapter);
    await loadScenes(chapter.id, true);
  };

  const selectScene = async (scene: Scene) => {
    setSelectedScene(scene);
    await loadStoryboards(scene.id);
  };

  // ── Shot form & saving ──────────────────────────────────────────────

  const updateShotForm = <K extends keyof ShotFormState>(key: K, value: ShotFormState[K]) => {
    setShotForm((prev) => ({ ...prev, [key]: value }));
  };

  const buildShotUpdatePayload = () => ({
    content: shotForm.content,
  });

  const isShotDraftDirty = () => {
    if (!selectedShot) return false;
    const persisted = buildShotFormState(selectedShot, selectedScene);
    return (Object.keys(shotForm) as Array<keyof ShotFormState>).some(
      (key) => shotForm[key] !== persisted[key],
    );
  };

  const saveShotDraft = async (onlyWhenDirty = false) => {
    if (!selectedShot) return false;
    if (onlyWhenDirty && !isShotDraftDirty()) return true;
    if (shotForm.content.length > COMPOSITE_PROMPT_SPEC.MAX_LENGTH) {
      toast.error(`提示词最多支持 ${COMPOSITE_PROMPT_SPEC.MAX_LENGTH} 个字符`);
      return false;
    }

    setIsSavingShot(true);
    try {
      const nextScene = await sceneApi.updateScene(selectedShot.id, {
        prompt: buildShotUpdatePayload().content,
        generation_duration: activeVideoDuration,
      });
      applyClipSceneUpdate(nextScene);
      return true;
    } catch (error) {
      console.error("Failed to save storyboard:", error);
      toast.error(error instanceof Error ? error.message : "片段保存失败，已停止生成");
      return false;
    } finally {
      setIsSavingShot(false);
    }
  };

  const saveShotDraftBeforeGeneration = () => saveShotDraft(true);

  // ── Video model settings ─────────────────────────────────────────────

  const handleVideoModelChange = (value: string) => {
    const model = value as (typeof VIDEO_MODEL_OPTIONS)[number]["value"];
    setSelectedVideoModel(model);
    if (!isSeedanceVideoModel(model)) {
      setSelectedVideoResolution(VIDEO_RESOLUTION.HD);
      setSelectedVideoDuration(5);
      setGenerateVideoAudio(true);
    }
  };

  // ── Effects ──────────────────────────────────────────────────────────

  useEffect(() => {
    void loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedShot?.id) {
      void loadMediaGenerations(selectedShot.id);
    } else {
      setMediaGenerations([]);
    }
  }, [selectedShot?.id]);

  useEffect(() => {
    const formKey = selectedShot ? `${selectedScene?.id ?? 0}:${selectedShot.id}` : "";
    if (formKey === initializedShotFormKeyRef.current) return;
    initializedShotFormKeyRef.current = formKey;
    setShotForm(buildShotFormState(selectedShot, selectedScene));
  }, [selectedScene, selectedShot]);

  useEffect(() => {
    if (selectedShot?.id) {
      void loadGenerationReferences(selectedShot.id);
    } else {
      setGenerationReferences(null);
      setGenerationReferenceError("");
    }
  }, [selectedShot?.id]);

  // ── Video polling wiring ─────────────────────────────────────────────
  // The polling hook is initialized in useWorkspaceVideoGeneration via its own import.

  // ── Upload ───────────────────────────────────────────────────────────

  const handleUploadShotCover = async (file: File) => {
    if (!selectedShot) return;
    setUploadingCoverId(selectedShot.id);
    try {
      const uploadedUrl = await ossApi.uploadFileToOss(file);
      const result = await sceneApi.uploadSceneCover(selectedShot.id, uploadedUrl);
      applyMediaMutation(result);
      toast.success("首帧上传成功");
    } catch (error) {
      console.error("Failed to upload storyboard cover:", error);
      toast.error(error instanceof Error ? error.message : "首帧上传失败");
    } finally {
      setUploadingCoverId(null);
      if (shotCoverInputRef.current) {
        shotCoverInputRef.current.value = "";
      }
    }
  };

  return {
    // state
    loading,
    chapters,
    scenes,
    storyboards,
    mediaGenerations,
    frameExtractionGeneration,
    setFrameExtractionGeneration,
    selectedProject,
    selectedChapter,
    selectedScene,
    selectedShot,
    hoveredSceneIndex,
    setHoveredSceneIndex,
    expandedChapters,
    isEpisodeRailCollapsed,
    setIsEpisodeRailCollapsed,
    isSavingShot,
    generatingCoverId,
    setGeneratingCoverId,
    generatingVideoId,
    setGeneratingVideoId,
    previewImage,
    setPreviewImage,
    selectedVideoModel,
    setSelectedVideoModel,
    selectedVideoResolution,
    selectedVideoDuration,
    generateVideoAudio,
    useFirstFrameForVideo,
    setUseFirstFrameForVideo,
    isLoadingCoverPreview,
    setIsLoadingCoverPreview,
    isLoadingVideoPreview,
    setIsLoadingVideoPreview,
    coverGenerationPreview,
    setCoverGenerationPreview,
    generationReferences,
    isLoadingGenerationReferences,
    generationReferenceError,
    coverGenerationError,
    setCoverGenerationError,
    videoGenerationPreview,
    setVideoGenerationPreview,
    videoGenerationRequest,
    setVideoGenerationRequest,
    isCoverConfirmOpen,
    setIsCoverConfirmOpen,
    isVideoConfirmOpen,
    setIsVideoConfirmOpen,
    isSceneCoverConfirmOpen,
    setIsSceneCoverConfirmOpen,
    sceneCoverGenerationPreview,
    isBatchSceneCoverConfirmOpen,
    setIsBatchSceneCoverConfirmOpen,
    isSceneVideoConfirmOpen,
    setIsSceneVideoConfirmOpen,
    isProjectVideoConfirmOpen,
    setIsProjectVideoConfirmOpen,
    isCreateSceneOpen,
    setIsCreateSceneOpen,
    sceneInsertSortOrder,
    setSceneInsertSortOrder,
    isCreatingScene,
    setIsCreatingScene,
    isComposingProjectVideo,
    setIsComposingProjectVideo,
    deleteTargetGeneration,
    setDeleteTargetGeneration,
    deleteTargetScene,
    setDeleteTargetScene,
    activeMediaActionKey,
    setActiveMediaActionKey,
    previewSceneVideo,
    setPreviewSceneVideo,
    previewProjectVideo,
    setPreviewProjectVideo,
    shotForm,
    isPromptFullscreenOpen,
    setIsPromptFullscreenOpen,
    isPromptOptimizationOpen,
    setIsPromptOptimizationOpen,
    isOptimizingPrompt,
    setIsOptimizingPrompt,
    promptOptimizationOriginal,
    setPromptOptimizationOriginal,
    promptOptimizationCandidate,
    setPromptOptimizationCandidate,
    promptOptimizationModel,
    setPromptOptimizationModel,
    promptOptimizationError,
    setPromptOptimizationError,
    newSceneForm,
    setNewSceneForm,
    descriptionOptimization,
    setDescriptionOptimization,
    projectCharacters,
    projectAssets,
    isManageCharactersOpen,
    setIsManageCharactersOpen,
    isManageAssetsOpen,
    setIsManageAssetsOpen,
    isLoadingProjectCharacters,
    isLoadingProjectAssets,
    activeCharacterActionKey,
    setActiveCharacterActionKey,
    activeAssetActionKey,
    setActiveAssetActionKey,
    shotCoverInputRef,

    // derived
    activeVideoResolution,
    activeVideoDuration,
    activeVideoAudio,
    filteredShots,
    composableShots,
    coverGenerations,
    videoGenerations,
    currentVideoGeneration,
    selectedSceneIndex,
    nextSceneInChapter,
    activeChapterForSceneCreation,

    // apply helpers
    applySceneUpdate,
    applyClipSceneUpdate,
    applyProjectUpdate,
    applyStoryboardsRefresh,
    applyMediaMutation,

    // data loading
    loadStoryboards,
    loadMediaGenerations,
    loadGenerationReferences,
    loadProjectCharacters,
    loadProjectAssets,
    loadScenes,
    loadChapters,
    applyProjectSelection,
    loadProjects,

    // navigation
    toggleChapter,
    selectScene,

    // shot form
    updateShotForm,
    isShotDraftDirty,
    saveShotDraft,
    saveShotDraftBeforeGeneration,

    // video model
    handleVideoModelChange,

    // upload
    handleUploadShotCover,
  };
}
