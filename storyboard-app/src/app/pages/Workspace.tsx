import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Film,
  Plus,
  MoreHorizontal,
  Trash2,
  Play,
  Save,
  Camera,
  X,
  Loader2,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Scissors,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { ImagePreviewDialog } from "../components/shared/ImagePreviewDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  PROMPT_MENTION_CATEGORY,
  RichPromptEditor,
  type PromptMentionOption,
} from "../components/workspace/RichPromptEditor";
import {
  PromptOptimizationDialog,
  PromptOptimizeButton,
} from "../components/workspace/PromptOptimizationDialog";
import {
  CoverReferencePanel,
  PromptReferenceStatus,
} from "../components/workspace/CoverReferencePanel";
import {
  VideoGenerationSettings,
  getVideoGenerationSpecLabel,
} from "../components/workspace/VideoGenerationSettings";
import { VideoFrameExtractionDialog } from "../components/workspace/VideoFrameExtractionDialog";
import { ConfirmationDialog } from "../components/workspace/dialogs/ConfirmationDialog";
import {
  VideoPreviewDialog,
  type VideoPreview,
} from "../components/workspace/dialogs/VideoPreviewDialog";
import { CreateSceneDialog } from "../components/workspace/dialogs/CreateSceneDialog";
import { ManageReferencesDialog } from "../components/workspace/dialogs/ManageReferencesDialog";
import { FullscreenPromptDialog } from "../components/workspace/dialogs/FullscreenPromptDialog";
import { useSceneVideoPolling } from "../components/workspace/hooks/useSceneVideoPolling";
import { CoverGenerationDialog } from "../components/workspace/dialogs/CoverGenerationDialog";
import { SceneCoverGenerationDialog } from "../components/workspace/dialogs/SceneCoverGenerationDialog";
import { VideoGenerationDialog } from "../components/workspace/dialogs/VideoGenerationDialog";
import { WorkspaceHeader } from "../components/workspace/WorkspaceHeader";
import {
  projectApi,
  chapterApi,
  sceneApi,
  characterApi,
  assetApi,
  ossApi,
  type Project,
  type Chapter,
  type Scene,
  type Storyboard,
  type StoryboardCoverGenerationPreview,
  type SceneGenerationReferences,
  type StoryboardVideoGenerationPreview,
  type StoryboardMediaGeneration,
  type SceneMediaGeneration,
  type AIGenerationPreview,
  type Character,
  type Asset,
  type StoryboardVideoGenerationOptions,
  type VideoAspectRatio,
  type VideoResolution,
} from "../api";
import styles from "./Workspace.module.scss";
import { COMPOSITE_PROMPT_SPEC, buildLegacyCompositePrompt } from "../lib/compositePrompt";
import {
  ENTITY_TYPE,
  GENERATION_STATUS,
  MEDIA_TYPE,
  VIDEO_ASPECT_RATIO,
  VIDEO_MODEL,
  VIDEO_RESOLUTION,
} from "../constants/domain";

const VIDEO_MODEL_OPTIONS = [
  { value: VIDEO_MODEL.SEEDANCE_2, label: "Seedance 2.0" },
  { value: VIDEO_MODEL.WAN_2_7_I2V, label: "Wan 2.7 I2V" },
] as const;
const FIXED_VIDEO_ASPECT_RATIO: VideoAspectRatio = VIDEO_ASPECT_RATIO.PORTRAIT;

const AUDIO_ASSET_PATTERN = /(audio|voice|sound|music|sfx|配音|语音|音频|音乐|音效)/i;
const SCENE_ASSET_PATTERN = /(scene|background|location|场景|背景|地点)/i;
const IMAGE_ASSET_PATTERN =
  /(image|photo|picture|reference|prop|costume|图片|图像|照片|参考|道具|服装)/i;

function getAssetFileExtension(asset: Asset) {
  const source = String(asset.file_url || "").split(/[?#]/)[0];
  return source.includes(".") ? source.slice(source.lastIndexOf(".") + 1).toLowerCase() : "";
}

function getAssetMentionPresentation(asset: Asset) {
  const type = String(asset.type || "").trim();
  const extension = getAssetFileExtension(asset);
  const isAudio =
    AUDIO_ASSET_PATTERN.test(type) ||
    ["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(extension);
  if (isAudio) {
    return { category: PROMPT_MENTION_CATEGORY.AUDIO, media: ["audio" as const] };
  }
  const isScene = SCENE_ASSET_PATTERN.test(type);
  const isImage =
    isScene ||
    IMAGE_ASSET_PATTERN.test(type) ||
    ["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp"].includes(extension) ||
    !!asset.cover_url;
  if (isScene) {
    return { category: PROMPT_MENTION_CATEGORY.SCENE, media: ["image" as const] };
  }
  if (isImage) {
    return { category: PROMPT_MENTION_CATEGORY.IMAGE, media: ["image" as const] };
  }
  return { category: PROMPT_MENTION_CATEGORY.OTHER, media: [] };
}

const PROMPT_SECTION_BREAKS = [
  "主体与画面核心：",
  "动作与叙事重点：",
  "镜头设计：",
  "风格气质：",
  "特效与氛围：",
  "一致性要求：",
  "音频要求：",
  "画质与完成度：",
  "输出要求：",
  "负向约束：",
  "节奏分段：",
  "首段：",
  "中段：",
  "尾段：",
  "开场：",
  "高潮：",
  "收束：",
] as const;

const formatPromptForDisplay = (prompt: string | null | undefined) => {
  const raw = String(prompt || "").trim();
  if (!raw) return "-";
  return PROMPT_SECTION_BREAKS.reduce((formatted, marker) => {
    const next = formatted.replaceAll(marker, `\n${marker}`);
    return next.startsWith("\n") ? next.slice(1) : next;
  }, raw);
};

type ShotFormState = {
  content: string;
};

const emptyShotForm: ShotFormState = {
  content: "",
};

const emptySceneForm = {
  title: "",
  description: "",
};

const emptyDescriptionOptimization = {
  open: false,
  loading: false,
  original: "",
  candidate: "",
  model: "",
  error: "",
};

const buildShotFormState = (shot: Storyboard | null, scene: Scene | null): ShotFormState => ({
  content: scene?.prompt || (shot ? buildLegacyCompositePrompt(shot, scene) : ""),
});

function sceneToWorkspaceClip(scene: Scene): Storyboard {
  return {
    id: scene.id,
    scene_id: scene.id,
    chapter_id: scene.chapter_id,
    project_id: scene.project_id,
    shot_number: 1,
    content: scene.prompt || "",
    camera_direction: "",
    duration: scene.generation_duration || 5,
    background: scene.location || scene.title,
    thumbnail_url: scene.cover_url || "",
    thumbnail_preview_url: scene.cover_preview_url,
    video_url: scene.video_url,
    video_preview_url: scene.video_preview_url,
    video_status: scene.video_status,
    video_error: scene.video_error,
    video_duration: scene.video_duration,
    notes: "",
    sort_order: scene.sort_order,
    characters: scene.characters || [],
    character_names: scene.character_names || [],
    assets: scene.assets || [],
    asset_names: scene.asset_names || [],
    created_at: scene.created_at,
    updated_at: scene.updated_at,
  };
}

function sceneMediaToWorkspaceMedia(item: SceneMediaGeneration): StoryboardMediaGeneration {
  return { ...item, storyboard_id: item.scene_id };
}

function getStoryboardVideoPreviewSrc(storyboard?: Storyboard | null) {
  if (!storyboard) return "";
  return storyboard.video_preview_url || storyboard.video_url || "";
}

const getStoryboardPreviewSrc = (shot: Storyboard | null | undefined) =>
  shot?.thumbnail_preview_url || shot?.thumbnail_url || "";

const getSceneNavigatorThumbnailSrc = (scene: Scene | null | undefined) =>
  scene?.video_poster_url || scene?.cover_preview_url || scene?.cover_url || "";

const getProjectVideoPreviewSrc = (project: Project | null | undefined) =>
  project?.video_preview_url || project?.video_url || "";

const getGenerationPreviewSrc = (generation: StoryboardMediaGeneration | null | undefined) =>
  generation?.preview_url || generation?.result_url || "";

const isSeedanceVideoModel = (model: string) => model === VIDEO_MODEL.SEEDANCE_2;

const buildCoverPreviewItems = (generations: StoryboardMediaGeneration[]) =>
  generations
    .filter(
      (generation) =>
        generation.status === GENERATION_STATUS.SUCCEEDED && !!generation.result_url,
    )
    .map((generation) => ({
      src: generation.result_url as string,
      alt: `首帧历史 ${generation.id}`,
    }));

const formatShanghaiDateTime = (dateStr?: string) => {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(dateStr));
};

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
  const [sceneCoverGenerationPreview, setSceneCoverGenerationPreview] =
    useState<AIGenerationPreview | null>(null);
  const [isLoadingSceneCoverPreview, setIsLoadingSceneCoverPreview] = useState(false);
  const [isBatchSceneCoverConfirmOpen, setIsBatchSceneCoverConfirmOpen] = useState(false);
  const [isSceneVideoConfirmOpen, setIsSceneVideoConfirmOpen] = useState(false);
  const [isProjectVideoConfirmOpen, setIsProjectVideoConfirmOpen] = useState(false);
  const [isCreateSceneOpen, setIsCreateSceneOpen] = useState(false);
  const [sceneInsertSortOrder, setSceneInsertSortOrder] = useState<number | null>(null);
  const [isCreatingScene, setIsCreatingScene] = useState(false);
  const [isGeneratingSceneCover, setIsGeneratingSceneCover] = useState(false);
  const [isBatchGeneratingSceneCover, setIsBatchGeneratingSceneCover] = useState(false);
  const [isComposingSceneVideo, setIsComposingSceneVideo] = useState(false);
  const [isComposingProjectVideo, setIsComposingProjectVideo] = useState(false);
  const [deleteTargetGeneration, setDeleteTargetGeneration] =
    useState<StoryboardMediaGeneration | null>(null);
  const [deleteTargetScene, setDeleteTargetScene] = useState<Scene | null>(null);
  const [activeMediaActionKey, setActiveMediaActionKey] = useState<string | null>(null);
  const [previewSceneVideo, setPreviewSceneVideo] = useState<VideoPreview | null>(null);
  const [previewProjectVideo, setPreviewProjectVideo] = useState<VideoPreview | null>(null);
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

  // Load projects on mount
  useEffect(() => {
    void loadProjects();
    // Project selection is initialized once from the URL or persisted project id.
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
    const formKey = selectedShot ? `${selectedScene?.id || 0}:${selectedShot.id}` : "";
    if (formKey === initializedShotFormKeyRef.current) return;
    initializedShotFormKeyRef.current = formKey;
    setShotForm(buildShotFormState(selectedShot, selectedScene));
  }, [selectedScene, selectedShot]);

  const resolveProjectId = () => {
    const url = new URL(window.location.href);
    const fromQuery = Number(url.searchParams.get("project") || "0");
    const fromStorage = Number(window.localStorage.getItem("currentProjectId") || "0");
    return fromQuery || fromStorage || 0;
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

  const loadMediaGenerations = async (sceneId: number) => {
    try {
      const data = await sceneApi.getSceneMediaGenerations(sceneId);
      setMediaGenerations(data.map(sceneMediaToWorkspaceMedia));
    } catch (error) {
      console.error("Failed to load media generations:", error);
      setMediaGenerations([]);
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

  useEffect(() => {
    if (selectedShot?.id) {
      void loadGenerationReferences(selectedShot.id);
    } else {
      setGenerationReferences(null);
      setGenerationReferenceError("");
    }
  }, [selectedShot?.id]);

  const _applyStoryboardUpdate = (nextShot: Storyboard) => {
    setStoryboards((prev) => prev.map((shot) => (shot.id === nextShot.id ? nextShot : shot)));
    setSelectedShot((prev) => (prev?.id === nextShot.id ? nextShot : prev));
  };

  const applyClipSceneUpdate = (nextScene: Scene) => {
    const clip = sceneToWorkspaceClip(nextScene);
    applySceneUpdate(nextScene);
    setStoryboards([clip]);
    setSelectedShot(clip);
  };

  const applySceneUpdate = (nextScene: Scene) => {
    setScenes((prev) => prev.map((scene) => (scene.id === nextScene.id ? nextScene : scene)));
    setSelectedScene((prev) => (prev?.id === nextScene.id ? nextScene : prev));
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
      if (!nextStoryboards.length) {
        return null;
      }
      if (!prev) {
        return nextStoryboards[0] ?? null;
      }
      return nextStoryboards.find((shot) => shot.id === prev.id) || nextStoryboards[0] || null;
    });
  };

  const applyMediaMutation = (payload: {
    scene: Scene;
    media_generations: SceneMediaGeneration[];
  }) => {
    applyClipSceneUpdate(payload.scene);
    setMediaGenerations(payload.media_generations.map(sceneMediaToWorkspaceMedia));
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

  const { start: pollStoryboardVideo, stop: stopVideoPolling } = useSceneVideoPolling({
    onScene: applyClipSceneUpdate,
    onGenerations: (generations) =>
      setMediaGenerations(generations.map(sceneMediaToWorkspaceMedia)),
    onTerminal: () => setGeneratingVideoId(null),
    onError: (error) => {
      console.error("Failed to poll storyboard video status:", error);
      setGeneratingVideoId(null);
    },
  });

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
          return data.find((scene) => scene.id === prev.id) || prev;
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

  const applyProjectSelection = async (projectId: number, projectList: Project[]) => {
    const project = projectList.find((p) => p.id === projectId);
    if (!project) {
      return;
    }

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

  const toggleChapter = async (chapterId: number) => {
    const isExpanded = expandedChapters.includes(chapterId);
    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter) {
      return;
    }

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
      imageUrl: character.design_sheet_url || character.avatar_url,
      isBound: !!selectedShot?.characters?.some((item) => item.id === character.id),
      category: PROMPT_MENTION_CATEGORY.CHARACTER,
      description: character.description || "人物资产",
      media: [
        ...(character.design_sheet_url ? (["image"] as const) : []),
        ...(character.voice_reference_url ? (["audio"] as const) : []),
      ],
      searchText: `${character.voice_name || ""} 人物 角色`,
    })),
    ...projectAssets.map((asset) => {
      const presentation = getAssetMentionPresentation(asset);
      return {
        id: asset.id,
        kind: ENTITY_TYPE.ASSET,
        name: asset.name,
        imageUrl:
          presentation.category === PROMPT_MENTION_CATEGORY.AUDIO
            ? asset.thumbnail_url || asset.cover_url
            : asset.cover_url || asset.file_url || asset.thumbnail_url,
        isBound: !!selectedShot?.assets?.some((item) => item.id === asset.id),
        category: presentation.category,
        description: asset.meta || asset.type || "项目资产",
        media: presentation.media,
        searchText: `${asset.type || ""} ${asset.meta || ""}`,
      };
    }),
  ];
  const activeChapterForSceneCreation = selectedChapter ?? chapters[0] ?? null;

  const calculateTotalDuration = () => {
    return selectedScene?.generation_duration || activeVideoDuration;
  };

  const countPromptShots = (prompt?: string) =>
    Math.max(1, (String(prompt || "").match(/(?:^|\n)\s*镜号\s*[：:]/g) || []).length);

  const formatShotNumber = (num?: number) => String(num ?? 0).padStart(3, "0");

  const activeVideoResolution: VideoResolution = isSeedanceVideoModel(selectedVideoModel)
    ? selectedVideoResolution
    : VIDEO_RESOLUTION.HD;
  const activeVideoDuration = isSeedanceVideoModel(selectedVideoModel) ? selectedVideoDuration : 5;
  const activeVideoAudio = isSeedanceVideoModel(selectedVideoModel) ? generateVideoAudio : true;
  const activeVideoSpecLabel = getVideoGenerationSpecLabel(
    FIXED_VIDEO_ASPECT_RATIO,
    activeVideoResolution,
    activeVideoDuration,
    activeVideoAudio,
  );
  const previewVideoSpecLabel = videoGenerationPreview
    ? getVideoGenerationSpecLabel(
        videoGenerationPreview.aspect_ratio || FIXED_VIDEO_ASPECT_RATIO,
        videoGenerationPreview.resolution as VideoResolution,
        videoGenerationPreview.duration,
        videoGenerationPreview.audio,
      )
    : activeVideoSpecLabel;

  const buildVideoGenerationRequest = (): StoryboardVideoGenerationOptions => ({
    model: selectedVideoModel,
    aspect_ratio: FIXED_VIDEO_ASPECT_RATIO,
    resolution: activeVideoResolution,
    duration: activeVideoDuration,
    generate_audio: activeVideoAudio,
    use_first_frame: useFirstFrameForVideo,
  });

  const handleVideoModelChange = (value: string) => {
    const model = value as (typeof VIDEO_MODEL_OPTIONS)[number]["value"];
    setSelectedVideoModel(model);
    if (!isSeedanceVideoModel(model)) {
      setSelectedVideoResolution(VIDEO_RESOLUTION.HD);
      setSelectedVideoDuration(5);
      setGenerateVideoAudio(true);
    }
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

  const runGenerateCover = async (useTextOnly = false) => {
    if (!selectedShot) {
      return;
    }

    setGeneratingCoverId(selectedShot.id);
    setPendingGeneratedShotId(selectedShot.id);
    setCoverGenerationError("");
    try {
      const result = await sceneApi.generateSceneClipCover(selectedShot.id, {
        ...(coverGenerationPreview?.model
          ? { model: coverGenerationPreview.model }
          : { model: "seedream-4.5" }),
        ...(useTextOnly ? { use_text_only: true } : {}),
      });
      applyClipSceneUpdate(result.scene);
      await loadMediaGenerations(result.scene.id);
    } catch (error) {
      console.error("Failed to generate storyboard cover:", error);
      const message = error instanceof Error ? error.message : "首帧生成失败，请重试";
      setCoverGenerationError(message);
      toast.error(message);
    } finally {
      setGeneratingCoverId(null);
      setPendingGeneratedShotId(null);
      setCoverGenerationPreview(null);
    }
  };

  const openCoverHistoryPreview = (generation: StoryboardMediaGeneration) => {
    const items = buildCoverPreviewItems(coverGenerations);
    const currentIndex = items.findIndex((item) => item.src === generation.result_url);
    setPreviewImage({
      src: generation.result_url || "",
      alt: `首帧历史 ${generation.id}`,
      items,
      currentIndex: currentIndex >= 0 ? currentIndex : 0,
    });
  };

  const openGenerationReferencePreview = (referenceIndex: number) => {
    const references = generationReferences?.reference_images || [];
    const reference = references[referenceIndex];
    if (!reference) return;
    const items = references.map((item) => ({
      src: item.url,
      alt: `${item.name || item.type} · ${item.source}`,
    }));
    setPreviewImage({
      src: reference.url,
      alt: `${reference.name || reference.type} · ${reference.source}`,
      items,
      currentIndex: referenceIndex,
    });
  };

  const runGenerateVideo = async () => {
    if (!selectedShot) {
      return;
    }

    setGeneratingVideoId(selectedShot.id);
    try {
      const result = await sceneApi.generateSceneVideo(
        selectedShot.id,
        videoGenerationRequest || buildVideoGenerationRequest(),
      );
      const nextScene = result.scene;
      applyClipSceneUpdate(nextScene);
      await loadMediaGenerations(nextScene.id);
      if (nextScene.video_status === GENERATION_STATUS.GENERATING) {
        pollStoryboardVideo(nextScene.id);
      } else {
        setGeneratingVideoId(null);
      }
    } catch (error) {
      console.error("Failed to generate storyboard video:", error);
      setGeneratingVideoId(null);
    } finally {
      setVideoGenerationRequest(null);
    }
  };

  const handleGenerateCover = async () => {
    if (
      !selectedShot ||
      generatingCoverId === selectedShot.id ||
      isLoadingCoverPreview ||
      isSavingShot
    ) {
      return;
    }

    setCoverGenerationError("");
    if (!(await saveShotDraftBeforeGeneration())) {
      return;
    }

    setIsLoadingCoverPreview(true);
    try {
      const preview = await sceneApi.getSceneClipCoverGenerationPreview(
        selectedShot.id,
        "seedream-4.5",
      );
      setCoverGenerationPreview(preview);
      setGenerationReferences({
        reference_images: preview.reference_images,
        missing_references: preview.missing_references,
        mappings: preview.mappings || [],
        bound_without_mentions: preview.bound_without_mentions || [],
        unbound_mentions: preview.unbound_mentions || [],
        recognized_bound_mentions: (preview.mappings || [])
          .filter((mapping) => mapping.is_mentioned)
          .map((mapping) => mapping.name),
      });
      setIsCoverConfirmOpen(true);
    } catch (error) {
      console.error("Failed to preview storyboard cover generation:", error);
      const message = error instanceof Error ? error.message : "首帧生成预览失败，请重试";
      setCoverGenerationError(message);
      toast.error(message);
    } finally {
      setIsLoadingCoverPreview(false);
    }
  };

  const confirmGenerateCover = async (useTextOnly = false) => {
    setIsCoverConfirmOpen(false);
    await runGenerateCover(useTextOnly);
  };

  const handleManageCharactersForCover = () => {
    setIsCoverConfirmOpen(false);
    window.setTimeout(() => void handleOpenManageCharacters(), 0);
  };

  const handleManageAssetsForCover = () => {
    setIsCoverConfirmOpen(false);
    window.setTimeout(() => void handleOpenManageAssets(), 0);
  };

  const handleGenerateVideo = async () => {
    if (
      !selectedShot ||
      generatingVideoId === selectedShot.id ||
      isLoadingVideoPreview ||
      isSavingShot
    ) {
      return;
    }

    if (!(await saveShotDraftBeforeGeneration())) {
      return;
    }

    const request = buildVideoGenerationRequest();
    setIsLoadingVideoPreview(true);
    try {
      const preview = await sceneApi.getSceneVideoGenerationPreview(selectedShot.id, request);
      setVideoGenerationRequest(request);
      setVideoGenerationPreview(preview);
      setIsVideoConfirmOpen(true);
    } catch (error) {
      console.error("Failed to preview storyboard video generation:", error);
    } finally {
      setIsLoadingVideoPreview(false);
    }
  };

  const handleRequestUploadShotCover = () => {
    shotCoverInputRef.current?.click();
  };

  const handleUploadShotCover = async (file: File) => {
    if (!selectedShot) {
      return;
    }
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

  const confirmGenerateVideo = async () => {
    setIsVideoConfirmOpen(false);
    await runGenerateVideo();
  };

  const handleVideoConfirmOpenChange = (open: boolean) => {
    setIsVideoConfirmOpen(open);
    if (!open && !generatingVideoId) {
      setVideoGenerationRequest(null);
      setVideoGenerationPreview(null);
    }
  };

  const handleOpenManageAssets = async () => {
    if (!selectedProject || !selectedShot) {
      return;
    }
    setIsManageAssetsOpen(true);
    await loadProjectAssets(selectedProject.id);
  };

  const handleAddStoryboardAsset = async (assetId: number) => {
    if (!selectedShot) {
      return;
    }
    const actionKey = `add-asset:${assetId}`;
    setActiveAssetActionKey(actionKey);
    try {
      const updated = await sceneApi.addSceneAsset(selectedShot.id, assetId);
      applyClipSceneUpdate(updated);
      await loadGenerationReferences(updated.id);
    } catch (error) {
      console.error("Failed to add storyboard asset:", error);
      toast.error(error instanceof Error ? error.message : "添加参考资产失败");
    } finally {
      setActiveAssetActionKey(null);
    }
  };

  const handleRemoveStoryboardAsset = async (assetId: number) => {
    if (!selectedShot) {
      return;
    }
    const actionKey = `remove-asset:${assetId}`;
    setActiveAssetActionKey(actionKey);
    try {
      const updated = await sceneApi.removeSceneAsset(selectedShot.id, assetId);
      applyClipSceneUpdate(updated);
      await loadGenerationReferences(updated.id);
    } catch (error) {
      console.error("Failed to remove storyboard asset:", error);
      toast.error(error instanceof Error ? error.message : "移除参考资产失败");
    } finally {
      setActiveAssetActionKey(null);
    }
  };
  const _handleGenerateSceneCover = () => {
    if (!selectedScene || isGeneratingSceneCover || isLoadingSceneCoverPreview) {
      return;
    }
    setIsLoadingSceneCoverPreview(true);
    void sceneApi
      .getSceneCoverGenerationPreview(selectedScene.id)
      .then((preview) => {
        setSceneCoverGenerationPreview(preview);
        setIsSceneCoverConfirmOpen(true);
      })
      .catch((error) => {
        console.error("Failed to preview scene cover generation:", error);
        toast.error(error instanceof Error ? error.message : "获取片段封面预览失败");
      })
      .finally(() => {
        setIsLoadingSceneCoverPreview(false);
      });
  };

  const runGenerateSceneCover = async () => {
    if (!selectedScene) {
      return;
    }

    setIsGeneratingSceneCover(true);
    try {
      const result = await sceneApi.generateSceneCover(selectedScene.id);
      applySceneUpdate(result.scene);
      toast.success("片段封面生成完成");
    } catch (error) {
      console.error("Failed to generate scene cover:", error);
    } finally {
      setIsGeneratingSceneCover(false);
    }
  };

  const confirmGenerateSceneCover = async () => {
    setIsSceneCoverConfirmOpen(false);
    await runGenerateSceneCover();
  };

  const _handleBatchGenerateSceneCovers = () => {
    if (!selectedScene || filteredShots.length === 0 || isBatchGeneratingSceneCover) {
      return;
    }
    setIsBatchSceneCoverConfirmOpen(true);
  };

  const runBatchGenerateSceneCovers = async () => {
    if (!selectedScene) {
      return;
    }

    const currentShotId = selectedShot?.id ?? null;
    setIsBatchGeneratingSceneCover(true);
    try {
      const result = await sceneApi.generateSceneStoryboardCovers(selectedScene.id);
      applySceneUpdate(result.scene);
      applyStoryboardsRefresh(result.storyboards);
      if (currentShotId) {
        const refreshedSelected = result.storyboards.find((shot) => shot.id === currentShotId);
        if (refreshedSelected) {
          setSelectedShot(refreshedSelected);
          await loadMediaGenerations(refreshedSelected.id);
        } else {
          setMediaGenerations([]);
        }
      }
      if (result.generated_count > 0) {
        toast.success(`已为 ${result.generated_count} 个镜头生成首帧`);
      }
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} 个镜头首帧生成失败`);
      }
    } catch (error) {
      console.error("Failed to batch generate storyboard covers:", error);
    } finally {
      setIsBatchGeneratingSceneCover(false);
    }
  };

  const confirmBatchGenerateSceneCovers = async () => {
    setIsBatchSceneCoverConfirmOpen(false);
    await runBatchGenerateSceneCovers();
  };

  const _handleComposeSceneVideo = () => {
    if (!selectedScene || isComposingSceneVideo) {
      return;
    }
    setIsSceneVideoConfirmOpen(true);
  };

  const runComposeSceneVideo = async () => {
    if (!selectedScene) {
      return;
    }

    setIsComposingSceneVideo(true);
    try {
      const result = await sceneApi.composeSceneVideo(selectedScene.id);
      applySceneUpdate(result.scene);
      toast.success("片段视频合成完成");
    } catch (error) {
      console.error("Failed to compose scene video:", error);
    } finally {
      setIsComposingSceneVideo(false);
    }
  };

  const confirmComposeSceneVideo = async () => {
    setIsSceneVideoConfirmOpen(false);
    await runComposeSceneVideo();
  };

  const handleComposeProjectVideo = () => {
    if (!selectedProject || isComposingProjectVideo) {
      return;
    }
    setIsProjectVideoConfirmOpen(true);
  };

  const runComposeProjectVideo = async () => {
    if (!selectedProject) {
      return;
    }

    setIsComposingProjectVideo(true);
    try {
      const result = await projectApi.composeProjectVideo(selectedProject.id);
      applyProjectUpdate(result.project);
      toast.success("项目总片合成完成");
    } catch (error) {
      console.error("Failed to compose project video:", error);
    } finally {
      setIsComposingProjectVideo(false);
    }
  };

  const confirmComposeProjectVideo = async () => {
    setIsProjectVideoConfirmOpen(false);
    await runComposeProjectVideo();
  };

  const handleSetCurrentGeneration = async (generation: StoryboardMediaGeneration) => {
    if (!selectedShot) {
      return;
    }
    if (generation.status !== GENERATION_STATUS.SUCCEEDED || !generation.result_url) {
      toast.error("该版本尚未生成成功，不能设为当前版本");
      return;
    }
    const actionKey = `set-current:${generation.id}`;
    setActiveMediaActionKey(actionKey);
    try {
      const result = await sceneApi.setSceneMediaGenerationCurrent(selectedShot.id, generation.id);
      applyMediaMutation(result);
    } catch (error) {
      console.error("Failed to set current media generation:", error);
    } finally {
      setActiveMediaActionKey(null);
    }
  };

  const handleRequestDeleteGeneration = (generation: StoryboardMediaGeneration) => {
    setDeleteTargetGeneration(generation);
  };

  const handleInsertVideoFrame = async (file: File, timestampMs: number, targetScene: Scene) => {
    if (!selectedScene || !frameExtractionGeneration) {
      throw new Error("抽帧来源不可用");
    }
    const frame = await sceneApi.createSceneVideoFrame(
      selectedScene.id,
      frameExtractionGeneration.id,
      { file, timestampMs, targetSceneId: targetScene.id },
    );
    await loadMediaGenerations(selectedScene.id);
    if (targetScene.id === selectedScene.id) {
      const refreshed = await sceneApi.getScene(selectedScene.id);
      applyClipSceneUpdate(refreshed);
      await loadGenerationReferences(selectedScene.id);
    }
    toast.success(`已将抽帧作为「${targetScene.title}」的参考图`);
    return frame;
  };

  const handleCreateVideoClip = async (startMs: number, endMs: number) => {
    if (!selectedScene || !frameExtractionGeneration) {
      throw new Error("视频来源不可用");
    }
    const result = await sceneApi.createSceneVideoClip(
      selectedScene.id,
      frameExtractionGeneration.id,
      { startMs, endMs },
    );
    applyMediaMutation(result);
    toast.success("截取视频已保存到视频版本");
  };

  const handleRemoveStoryboardCharacter = async (characterId: number) => {
    if (!selectedShot) {
      return;
    }
    const actionKey = `remove-character:${characterId}`;
    setActiveCharacterActionKey(actionKey);
    try {
      const nextScene = await sceneApi.removeSceneCharacter(selectedShot.id, characterId);
      applyClipSceneUpdate(nextScene);
      await loadGenerationReferences(nextScene.id);
      toast.success("已移除片段角色");
    } catch (error) {
      console.error("Failed to remove storyboard character:", error);
      toast.error(error instanceof Error ? error.message : "移除片段角色失败");
    } finally {
      setActiveCharacterActionKey(null);
    }
  };

  const handleOpenManageCharacters = async () => {
    if (!selectedProject) {
      return;
    }
    setIsManageCharactersOpen(true);
    await loadProjectCharacters(selectedProject.id);
  };

  const handleAddStoryboardCharacter = async (characterId: number) => {
    if (!selectedShot) {
      return;
    }
    const actionKey = `add-character:${characterId}`;
    setActiveCharacterActionKey(actionKey);
    try {
      const nextScene = await sceneApi.addSceneCharacter(selectedShot.id, characterId);
      applyClipSceneUpdate(nextScene);
      await loadGenerationReferences(nextScene.id);
      toast.success("已添加片段角色");
    } catch (error) {
      console.error("Failed to add storyboard character:", error);
      toast.error(error instanceof Error ? error.message : "添加片段角色失败");
    } finally {
      setActiveCharacterActionKey(null);
    }
  };

  const handleSelectPromptMention = async (option: PromptMentionOption) => {
    if (!selectedShot || option.isBound) {
      return;
    }
    if (option.kind === ENTITY_TYPE.CHARACTER) {
      await handleAddStoryboardCharacter(option.id);
      return;
    }
    await handleAddStoryboardAsset(option.id);
  };

  const handleRemovePromptMentions = async (removedOptions: PromptMentionOption[]) => {
    if (!selectedShot || !removedOptions.length) return;

    const sceneId = selectedShot.id;
    const failedNames: string[] = [];
    for (const option of removedOptions) {
      try {
        const nextScene =
          option.kind === ENTITY_TYPE.CHARACTER
            ? await sceneApi.removeSceneCharacter(sceneId, option.id)
            : await sceneApi.removeSceneAsset(sceneId, option.id);
        applyClipSceneUpdate(nextScene);
      } catch (error) {
        console.error("Failed to remove prompt mention reference:", error);
        failedNames.push(option.name);
      }
    }

    if (failedNames.length) {
      toast.error(`提示词已删除，但以下参考移除失败：${failedNames.join("、")}`);
      return;
    }
    await loadGenerationReferences(sceneId);
    toast.success("已同步移除对应参考");
  };

  const handleRequestDeleteScene = (scene: Scene) => {
    setDeleteTargetScene(scene);
  };

  const confirmDeleteScene = async () => {
    if (!deleteTargetScene) {
      return;
    }

    try {
      await sceneApi.deleteScene(deleteTargetScene.id);
      const deletingSelected = selectedScene?.id === deleteTargetScene.id;
      setDeleteTargetScene(null);
      if (selectedChapter) {
        await loadScenes(selectedChapter.id, false);
      }
      if (deletingSelected) {
        setSelectedScene(null);
        setStoryboards([]);
        setSelectedShot(null);
      }
    } catch (error) {
      console.error("Failed to delete scene:", error);
    }
  };

  const confirmDeleteGeneration = async () => {
    if (!selectedShot || !deleteTargetGeneration) {
      return;
    }

    const actionKey = `delete:${deleteTargetGeneration.id}`;
    setActiveMediaActionKey(actionKey);
    try {
      const result = await sceneApi.deleteSceneMediaGeneration(
        selectedShot.id,
        deleteTargetGeneration.id,
      );
      applyMediaMutation(result);
    } catch (error) {
      console.error("Failed to delete media generation:", error);
    } finally {
      setActiveMediaActionKey(null);
      setDeleteTargetGeneration(null);
    }
  };

  const updateShotForm = <K extends keyof ShotFormState>(key: K, value: ShotFormState[K]) => {
    setShotForm((prev) => ({ ...prev, [key]: value }));
  };

  const requestPromptOptimization = async () => {
    if (!selectedShot || isOptimizingPrompt) return;
    if (!shotForm.content.trim()) {
      toast.error("请先输入需要优化的提示词");
      return;
    }
    if (shotForm.content.length > COMPOSITE_PROMPT_SPEC.MAX_LENGTH) {
      toast.error(`提示词最多支持 ${COMPOSITE_PROMPT_SPEC.MAX_LENGTH} 个字符`);
      return;
    }

    const originalPrompt = shotForm.content;
    setPromptOptimizationOriginal(originalPrompt);
    setPromptOptimizationCandidate("");
    setPromptOptimizationModel("");
    setPromptOptimizationError("");
    setIsPromptOptimizationOpen(true);
    setIsOptimizingPrompt(true);
    try {
      const result = await sceneApi.optimizeScenePrompt(selectedShot.id, originalPrompt);
      setPromptOptimizationOriginal(result.original_prompt);
      setPromptOptimizationCandidate(result.optimized_prompt);
      setPromptOptimizationModel(result.model);
    } catch (error) {
      console.error("Failed to optimize prompt:", error);
      setPromptOptimizationError(
        error instanceof Error ? error.message : "提示词优化失败，请稍后重试",
      );
    } finally {
      setIsOptimizingPrompt(false);
    }
  };

  const confirmPromptOptimization = () => {
    if (!promptOptimizationCandidate) return;
    updateShotForm("content", promptOptimizationCandidate);
    setIsPromptOptimizationOpen(false);
    toast.success("已替换为 AI 候选稿，保存或生成时将写入片段");
  };

  const updateNewSceneForm = <K extends keyof typeof emptySceneForm>(
    key: K,
    value: (typeof emptySceneForm)[K],
  ) => {
    setNewSceneForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetNewSceneForm = () => {
    setNewSceneForm(emptySceneForm);
    setDescriptionOptimization(emptyDescriptionOptimization);
  };

  const openCreateSceneDialog = (sortOrder: number | null = null) => {
    setSceneInsertSortOrder(sortOrder);
    setIsCreateSceneOpen(true);
  };

  const requestDescriptionOptimization = async () => {
    const originalDescription = newSceneForm.description.trim();
    if (!originalDescription || descriptionOptimization.loading || isCreatingScene) return;

    setDescriptionOptimization({
      open: true,
      loading: true,
      original: originalDescription,
      candidate: "",
      model: "",
      error: "",
    });
    try {
      const result = await sceneApi.optimizeSceneDescription(
        newSceneForm.title.trim(),
        originalDescription,
      );
      setDescriptionOptimization({
        open: true,
        loading: false,
        original: result.original_description,
        candidate: result.optimized_description,
        model: result.model,
        error: "",
      });
    } catch (error) {
      console.error("Failed to optimize scene description:", error);
      setDescriptionOptimization((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "片段描述优化失败，请稍后重试",
      }));
    }
  };

  const confirmDescriptionOptimization = () => {
    if (!descriptionOptimization.candidate) return;
    updateNewSceneForm("description", descriptionOptimization.candidate);
    setDescriptionOptimization(emptyDescriptionOptimization);
    toast.success("已替换为 AI 候选描述，确认创建后才会保存");
  };

  const handleCreateScene = async () => {
    if (!selectedProject || !newSceneForm.title.trim()) {
      return;
    }

    setIsCreatingScene(true);
    try {
      let targetChapter = activeChapterForSceneCreation;

      if (!targetChapter) {
        targetChapter = await chapterApi.createChapter(selectedProject.id, {
          title: "第1章",
          summary: "",
        });
        setChapters([targetChapter]);
      }

      const scene = await sceneApi.createScene(targetChapter.id, {
        title: newSceneForm.title.trim(),
        description: newSceneForm.description.trim(),
        sort_order: sceneInsertSortOrder || undefined,
      });

      setSelectedChapter(targetChapter);
      setExpandedChapters([targetChapter.id]);
      await loadScenes(targetChapter.id);
      setSelectedScene(scene);
      await loadStoryboards(scene.id);
      setIsCreateSceneOpen(false);
      setSceneInsertSortOrder(null);
      resetNewSceneForm();
    } catch (error) {
      console.error("Failed to create scene:", error);
    } finally {
      setIsCreatingScene(false);
    }
  };

  const handleSaveShot = async () => {
    await saveShotDraft();
  };

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
    ) || null;
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
        onBack={() => navigate("/projects")}
        onOpenAssetConfirmation={() =>
          selectedProject && navigate(`/asset-confirmation?project=${selectedProject.id}`)
        }
        onComposeProjectVideo={handleComposeProjectVideo}
        onPreviewProjectVideo={() =>
          selectedProject &&
          setPreviewProjectVideo({
            src: getProjectVideoPreviewSrc(selectedProject),
            originalSrc: selectedProject.video_url || undefined,
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
                    {selectedChapter?.title || "请选择章节"}
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
                      generation.status !== GENERATION_STATUS.SUCCEEDED ||
                      !generation.result_url
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
                  {generation.status === GENERATION_STATUS.SUCCEEDED &&
                  generation.result_url ? (
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
                    onClick={handleGenerateVideo}
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
                      <DropdownMenuItem onClick={handleSaveShot} disabled={isSavingShot}>
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
        sceneTitle={selectedScene?.title || "未命名片段"}
        editorKey={`fullscreen-prompt-${selectedShot?.id || 0}`}
        value={shotForm.content}
        options={promptMentionOptions}
        optimizing={isOptimizingPrompt}
        onOpenChange={setIsPromptFullscreenOpen}
        onChange={(value) => updateShotForm("content", value)}
        onSelectMention={handleSelectPromptMention}
        onRemoveMentions={handleRemovePromptMentions}
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
            ? `${selectedScene?.title || "未命名片段"} · ${selectedShot.content || "未填写 Prompt"}`
            : "未选择片段"
        }
        emptyAssignedLabel="当前片段未关联角色"
        libraryTitle="项目角色库"
        loadingLabel="正在加载项目角色"
        emptyLibraryLabel="当前项目还没有可选角色。"
        refreshLabel="刷新角色库"
        assignedItems={(selectedShot?.characters || []).map((character) => ({
          id: character.id,
          name: character.name,
          description: character.description || "暂无角色描述",
          assigned: true,
        }))}
        items={projectCharacters.map((character) => ({
          id: character.id,
          name: character.name,
          description: character.description || "暂无角色描述",
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
            ? `${formatShotNumber(selectedShot.shot_number)} · ${selectedShot.content || "未填写画面描述"}`
            : "未选择片段"
        }
        emptyAssignedLabel="当前片段未关联参考资产"
        libraryTitle="项目参考资产库"
        loadingLabel="正在加载项目参考资产"
        emptyLibraryLabel="当前项目还没有可用的参考资产。"
        refreshLabel="刷新资产库"
        assignedItems={(selectedShot?.assets || []).map((asset) => ({
          id: asset.id,
          name: asset.name,
          description: asset.meta || asset.type || "项目资产",
          assigned: true,
        }))}
        items={projectAssets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          description: asset.meta || asset.type || "项目资产",
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
        onCreate={handleCreateScene}
      />
      <CoverGenerationDialog
        open={isCoverConfirmOpen}
        sceneTitle={selectedScene?.title || "-"}
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
          { label: "片段标题", value: selectedScene?.title || "-" },
          { label: "镜头数量", value: filteredShots.length },
          { label: "当前模型", value: "Seedream 4.5" },
        ]}
        confirmLabel="确认生成"
        onOpenChange={setIsBatchSceneCoverConfirmOpen}
        onConfirm={confirmBatchGenerateSceneCovers}
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
          { label: "片段标题", value: selectedScene?.title || "-" },
          { label: "可合成镜头数", value: composableShots.length },
          { label: "输出规格", value: "720P / 保留原音轨" },
        ]}
        confirmLabel={selectedScene?.video_url ? "确认重新生成" : "确认合成"}
        onOpenChange={setIsSceneVideoConfirmOpen}
        onConfirm={confirmComposeSceneVideo}
      />

      <ConfirmationDialog
        open={isProjectVideoConfirmOpen}
        title="确认生成项目总片"
        description="会自动收集当前项目内已生成成功的片段视频，按章节和片段顺序合成为一个项目级粗剪视频。"
        items={[
          { label: "项目名称", value: selectedProject?.name || "-" },
          { label: "输出规格", value: "720P / 保留各片段原音轨" },
        ]}
        confirmLabel="确认合成"
        onOpenChange={setIsProjectVideoConfirmOpen}
        onConfirm={confirmComposeProjectVideo}
      />

      <VideoGenerationDialog
        open={isVideoConfirmOpen}
        preview={videoGenerationPreview}
        previewSpecLabel={previewVideoSpecLabel}
        sceneTitle={selectedScene?.title || "-"}
        selectedModel={selectedVideoModel}
        activeDuration={activeVideoDuration}
        useFirstFrame={useFirstFrameForVideo}
        shotNumberLabel={
          selectedShot ? formatShotNumber(selectedShot.shot_number) : ""
        }
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
            value:
              deleteTargetGeneration?.media_type === MEDIA_TYPE.VIDEO ? "视频" : "首帧",
          },
          { label: "模型", value: deleteTargetGeneration?.model || "-" },
          {
            label: "生成时间",
            value: formatShanghaiDateTime(deleteTargetGeneration?.created_at),
          },
        ]}
        confirmLabel="确认删除"
        tone="danger"
        onOpenChange={(open) => !open && setDeleteTargetGeneration(null)}
        onConfirm={confirmDeleteGeneration}
      />

      <ConfirmationDialog
        open={!!deleteTargetScene}
        title="确认删除片段"
        description="该操作会删除当前片段及其 Prompt、引用和媒体历史，需要二次确认。"
        items={[
          { label: "片段标题", value: deleteTargetScene?.title || "-" },
          { label: "地点", value: deleteTargetScene?.location || "-" },
          { label: "时间", value: deleteTargetScene?.time_of_day || "-" },
        ]}
        confirmLabel="确认删除"
        tone="danger"
        onOpenChange={(open) => !open && setDeleteTargetScene(null)}
        onConfirm={confirmDeleteScene}
      />

      <ImagePreviewDialog
        open={!!previewImage}
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null);
        }}
        src={previewImage?.src || ""}
        alt={previewImage?.alt || "片段预览图"}
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
