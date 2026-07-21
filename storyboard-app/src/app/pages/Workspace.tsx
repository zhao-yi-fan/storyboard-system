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
  Image as ImageIcon,
  X,
  Loader2,
  ArrowLeft,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { ImagePreviewDialog } from "../components/ui/image-preview-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
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
  type VideoResolution,
} from "../api";
import { COMPOSITE_PROMPT_MAX_LENGTH, buildLegacyCompositePrompt } from "../lib/compositePrompt";

const VIDEO_MODEL_OPTIONS = [
  { value: "seedance-2.0", label: "Seedance 2.0" },
  { value: "wan2.7-i2v", label: "Wan 2.7 I2V" },
] as const;

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
    return { category: "audio" as const, media: ["audio" as const] };
  }
  const isScene = SCENE_ASSET_PATTERN.test(type);
  const isImage =
    isScene ||
    IMAGE_ASSET_PATTERN.test(type) ||
    ["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp"].includes(extension) ||
    !!asset.cover_url;
  if (isScene) {
    return { category: "scene" as const, media: ["image" as const] };
  }
  if (isImage) {
    return { category: "image" as const, media: ["image" as const] };
  }
  return { category: "other" as const, media: [] };
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

const getSceneCoverPreviewSrc = (scene: Scene | null | undefined) =>
  scene?.cover_preview_url || scene?.cover_url || "";

const getProjectVideoPreviewSrc = (project: Project | null | undefined) =>
  project?.video_preview_url || project?.video_url || "";

const getGenerationPreviewSrc = (generation: StoryboardMediaGeneration | null | undefined) =>
  generation?.preview_url || generation?.result_url || "";

const isSeedanceVideoModel = (model: string) => model === "seedance-2.0";

const buildCoverPreviewItems = (generations: StoryboardMediaGeneration[]) =>
  generations
    .filter((generation) => generation.status === "succeeded" && !!generation.result_url)
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
    <div
      className="group flex h-7 items-center gap-2 px-3"
      aria-label={`在第 ${position} 个位置插入片段`}
    >
      <button
        type="button"
        disabled={disabled}
        className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border border-teal-300/35 bg-[#12201f]/90 text-teal-200 shadow-sm backdrop-blur-md transition group-hover:opacity-100 focus-visible:opacity-100 hover:border-teal-200/70 hover:bg-teal-300/15 disabled:cursor-not-allowed disabled:opacity-0 ${revealed ? "opacity-100" : "opacity-0"}`}
        onClick={() => onInsert(position)}
        title={`在片段 ${position} 插入新片段`}
      >
        <Plus className="h-3 w-3" />
      </button>
      <span
        className={`h-px flex-1 bg-teal-200/30 transition group-hover:opacity-100 group-focus-within:opacity-100 ${revealed ? "opacity-100" : "opacity-0"}`}
      />
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
  const [selectedVideoResolution, setSelectedVideoResolution] = useState<VideoResolution>("720p");
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
  const [projectCharacters, setProjectCharacters] = useState<Character[]>([]);
  const [projectAssets, setProjectAssets] = useState<Asset[]>([]);
  const [isManageCharactersOpen, setIsManageCharactersOpen] = useState(false);
  const [isManageAssetsOpen, setIsManageAssetsOpen] = useState(false);
  const [isLoadingProjectCharacters, setIsLoadingProjectCharacters] = useState(false);
  const [isLoadingProjectAssets, setIsLoadingProjectAssets] = useState(false);
  const [activeCharacterActionKey, setActiveCharacterActionKey] = useState<string | null>(null);
  const [activeAssetActionKey, setActiveAssetActionKey] = useState<string | null>(null);
  const videoPollingTimerRef = useRef<number | null>(null);
  const shotCoverInputRef = useRef<HTMLInputElement>(null);
  const initializedShotFormKeyRef = useRef("");

  // Load projects on mount
  useEffect(() => {
    void loadProjects();
    // Project selection is initialized once from the URL or persisted project id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (videoPollingTimerRef.current !== null) {
        window.clearInterval(videoPollingTimerRef.current);
      }
    };
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

  const stopVideoPolling = () => {
    if (videoPollingTimerRef.current !== null) {
      window.clearInterval(videoPollingTimerRef.current);
      videoPollingTimerRef.current = null;
    }
  };

  const pollStoryboardVideo = (sceneId: number) => {
    stopVideoPolling();
    videoPollingTimerRef.current = window.setInterval(async () => {
      try {
        const latest = await sceneApi.getScene(sceneId);
        applyClipSceneUpdate(latest);
        const generations = await sceneApi.getSceneMediaGenerations(sceneId);
        setMediaGenerations(generations.map(sceneMediaToWorkspaceMedia));
        if (latest.video_status !== "generating") {
          stopVideoPolling();
          setGeneratingVideoId(null);
        }
      } catch (error) {
        console.error("Failed to poll storyboard video status:", error);
        stopVideoPolling();
        setGeneratingVideoId(null);
      }
    }, 5000);
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
    (shot) => shot.video_status === "succeeded" && !!shot.video_url,
  );
  const promptMentionOptions: PromptMentionOption[] = [
    ...projectCharacters.map((character) => ({
      id: character.id,
      kind: "character" as const,
      name: character.name,
      imageUrl: character.design_sheet_url || character.avatar_url,
      isBound: !!selectedShot?.characters?.some((item) => item.id === character.id),
      category: "character" as const,
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
        kind: "asset" as const,
        name: asset.name,
        imageUrl:
          presentation.category === "audio"
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
    : "720p";
  const activeVideoDuration = isSeedanceVideoModel(selectedVideoModel) ? selectedVideoDuration : 5;
  const activeVideoAudio = isSeedanceVideoModel(selectedVideoModel) ? generateVideoAudio : true;
  const activeVideoSpecLabel = getVideoGenerationSpecLabel(
    activeVideoResolution,
    activeVideoDuration,
    activeVideoAudio,
  );
  const previewVideoSpecLabel = videoGenerationPreview
    ? getVideoGenerationSpecLabel(
        videoGenerationPreview.resolution as VideoResolution,
        videoGenerationPreview.duration,
        videoGenerationPreview.audio,
      )
    : activeVideoSpecLabel;

  const buildVideoGenerationRequest = (): StoryboardVideoGenerationOptions => ({
    model: selectedVideoModel,
    resolution: activeVideoResolution,
    duration: activeVideoDuration,
    generate_audio: activeVideoAudio,
    use_first_frame: useFirstFrameForVideo,
  });

  const handleVideoModelChange = (value: string) => {
    const model = value as (typeof VIDEO_MODEL_OPTIONS)[number]["value"];
    setSelectedVideoModel(model);
    if (!isSeedanceVideoModel(model)) {
      setSelectedVideoResolution("720p");
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
    if (shotForm.content.length > COMPOSITE_PROMPT_MAX_LENGTH) {
      toast.error(`提示词最多支持 ${COMPOSITE_PROMPT_MAX_LENGTH} 个字符`);
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
      if (nextScene.video_status === "generating") {
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
    if (generation.status !== "succeeded" || !generation.result_url) {
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
    if (option.kind === "character") {
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
          option.kind === "character"
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
    if (shotForm.content.length > COMPOSITE_PROMPT_MAX_LENGTH) {
      toast.error(`提示词最多支持 ${COMPOSITE_PROMPT_MAX_LENGTH} 个字符`);
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
  };

  const openCreateSceneDialog = (sortOrder: number | null = null) => {
    setSceneInsertSortOrder(sortOrder);
    setIsCreateSceneOpen(true);
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

  const coverGenerations = mediaGenerations.filter((item) => item.media_type === "cover");
  const videoGenerations = mediaGenerations.filter((item) => item.media_type === "video");
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
    if (selectedShot?.video_status === "generating") {
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
    <div className="storyboard-product-shell storyboard-workspace dark flex h-screen flex-col overflow-hidden text-gray-100">
      <header className="storyboard-topbar relative z-30 flex h-12 flex-none items-center justify-between border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate("/projects")}
            className="h-8 w-8 p-0 text-gray-500 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="返回项目列表"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-teal-300 to-cyan-700 shadow-sm shadow-teal-950/35">
            <Film className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="truncate text-sm font-semibold tracking-tight text-gray-100">
            {selectedProject ? "《" + selectedProject.name + "》" : "片段工作台"}
          </span>
          <div className="mx-2 h-4 w-px bg-white/10" />
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-gray-500 transition hover:bg-white/[0.06] hover:text-white">
              <MoreHorizontal className="h-3.5 w-3.5" />
              项目操作
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="border-white/10 bg-[#1b2525]/95 text-gray-100 backdrop-blur-xl"
            >
              <DropdownMenuItem
                onClick={() =>
                  selectedProject && navigate(`/asset-confirmation?project=${selectedProject.id}`)
                }
                disabled={!selectedProject}
              >
                <ImageIcon className="h-4 w-4" />
                资产确认
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleComposeProjectVideo}
                disabled={!selectedProject || isComposingProjectVideo}
              >
                <Film className="h-4 w-4" />
                {isComposingProjectVideo ? "总片合成中..." : "生成项目总片"}
              </DropdownMenuItem>
              {selectedProject && getProjectVideoPreviewSrc(selectedProject) ? (
                <DropdownMenuItem
                  onClick={() =>
                    setPreviewProjectVideo({
                      src: getProjectVideoPreviewSrc(selectedProject),
                      originalSrc: selectedProject.video_url || undefined,
                      title: "《" + selectedProject.name + "》项目总片",
                    })
                  }
                >
                  <Play className="h-4 w-4" />
                  播放项目总片
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <span className="hidden text-[11px] font-medium text-gray-500 lg:block">
          {scenes.length} 个片段 · 当前片段 {calculateTotalDuration().toFixed(1)}s
        </span>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden p-4">
        <div
          className={
            isEpisodeRailCollapsed
              ? "storyboard-glass-panel absolute bottom-4 left-4 top-4 z-20 flex w-[330px] overflow-hidden rounded-[22px] text-gray-100 max-xl:w-[300px] [&_.text-gray-500]:text-gray-300 [&_.text-gray-600]:text-gray-400 [&_.text-gray-700]:text-gray-400"
              : "storyboard-glass-panel absolute bottom-4 left-4 top-4 z-20 flex w-[390px] overflow-hidden rounded-[22px] text-gray-100 max-xl:w-[340px] [&_.text-gray-500]:text-gray-300 [&_.text-gray-600]:text-gray-400 [&_.text-gray-700]:text-gray-400"
          }
        >
          {!isEpisodeRailCollapsed ? (
            <aside className="flex w-[64px] flex-none flex-col overflow-hidden border-r border-white/[0.055] bg-black/[0.08] py-3">
              <div className="px-1 pb-2 pt-1 text-center text-[10px] text-gray-500">选集</div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {chapters.map((chapter, index) => {
                  const active = selectedChapter?.id === chapter.id;
                  return (
                    <button
                      key={chapter.id}
                      type="button"
                      title={chapter.title}
                      aria-label={`第 ${index + 1} 集：${chapter.title}`}
                      className={
                        active
                          ? "flex h-10 w-10 items-center justify-center rounded-xl border border-teal-200/55 bg-teal-300/10 text-base font-semibold text-teal-50 shadow-lg shadow-teal-950/25"
                          : "flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.055] text-base font-semibold text-gray-500 transition hover:bg-white/[0.09] hover:text-gray-200"
                      }
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

          <aside className="flex min-w-0 flex-1 flex-col overflow-hidden px-3">
            <div className="flex h-[68px] flex-none items-center justify-between border-b border-white/[0.055] pb-1">
              <div className="flex min-w-0 items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 flex-none text-gray-600 hover:bg-white/5 hover:text-gray-200"
                  onClick={() => setIsEpisodeRailCollapsed((collapsed) => !collapsed)}
                  aria-label={isEpisodeRailCollapsed ? "展开选集" : "收起选集"}
                  title={isEpisodeRailCollapsed ? "展开选集" : "收起选集"}
                >
                  {isEpisodeRailCollapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold tracking-tight text-white">
                    {selectedChapter?.title || "请选择章节"}
                  </div>
                  <div className="mt-1 text-[10px] tracking-wide text-gray-600">
                    {scenes.length} 个片段
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-white/5 hover:text-white">
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="border-white/10 bg-[#1b2525]/95 text-gray-100 backdrop-blur-xl"
                  >
                    <DropdownMenuItem
                      onClick={() => openCreateSceneDialog(scenes.length + 1)}
                      disabled={!activeChapterForSceneCreation}
                    >
                      <Plus className="h-4 w-4" />
                      新建片段
                    </DropdownMenuItem>
                    {selectedScene ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => handleRequestDeleteScene(selectedScene)}
                      >
                        <Trash2 className="h-4 w-4" />
                        删除当前片段
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex h-full items-center justify-center text-xs text-gray-600">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在加载
                </div>
              ) : !selectedProject ? (
                <div className="p-6 text-center text-xs text-gray-600">请从项目列表进入工作台</div>
              ) : (
                <div className="pr-2 pt-1">
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
                          className="overflow-hidden"
                          onMouseEnter={() => setHoveredSceneIndex(sceneIndex)}
                          onMouseLeave={() => setHoveredSceneIndex(null)}
                        >
                          <button
                            type="button"
                            className={
                              activeScene
                                ? "flex w-full items-center gap-2 rounded-xl bg-white/[0.055] px-2 py-3 text-left shadow-sm shadow-black/10"
                                : "flex w-full items-center gap-2 rounded-xl px-2 py-3 text-left text-gray-500 transition hover:bg-white/[0.035]"
                            }
                            onClick={() => void selectScene(scene)}
                          >
                            <span
                              className={
                                activeScene
                                  ? "h-8 w-1 flex-none rounded-full bg-gradient-to-b from-teal-300 to-cyan-700"
                                  : "h-8 w-1 flex-none rounded-full bg-white/5"
                              }
                            />
                            {getSceneCoverPreviewSrc(scene) ? (
                              <span className="h-11 w-11 flex-none overflow-hidden rounded-lg bg-black/20">
                                <img
                                  src={getSceneCoverPreviewSrc(scene)}
                                  alt={`${scene.title}片段封面`}
                                  loading="lazy"
                                  decoding="async"
                                  className="h-full w-full object-cover"
                                />
                              </span>
                            ) : null}
                            <span className="min-w-0 flex-1">
                              <span
                                className={
                                  activeScene
                                    ? "block text-[10px] font-medium tracking-wide text-teal-300"
                                    : "block text-[10px] tracking-wide text-gray-700"
                                }
                              >
                                片段-{sceneIndex + 1}
                              </span>
                              <span
                                className={
                                  activeScene
                                    ? "mt-0.5 block truncate text-[13px] font-medium text-white"
                                    : "mt-0.5 block truncate text-xs text-gray-300"
                                }
                              >
                                {scene.title}
                              </span>
                            </span>
                            <Badge className="border border-white/10 bg-transparent text-[9px] text-gray-600 shadow-none">
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
              ? "storyboard-center-stage absolute bottom-4 left-0 right-0 top-4 flex min-w-[360px] flex-col rounded-[26px] pl-[354px] pr-[374px] max-2xl:pr-[344px] max-xl:pl-[324px] max-xl:pr-[318px]"
              : "storyboard-center-stage absolute bottom-4 left-0 right-0 top-4 flex min-w-[360px] flex-col rounded-[26px] pl-[414px] pr-[374px] max-2xl:pr-[344px] max-xl:pl-[364px] max-xl:pr-[318px]"
          }
        >
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-6 pt-5">
            {selectedShot ? (
              <div className="relative flex h-full max-h-[680px] w-full max-w-[760px] items-center justify-center">
                {selectedShot.video_status === "generating" ? (
                  <div className="storyboard-media-frame flex aspect-[9/16] h-full max-h-[620px] flex-col items-center justify-center rounded-2xl text-gray-500">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-300" />
                    <span className="mt-3 text-xs">视频生成中，状态会自动刷新</span>
                  </div>
                ) : getStoryboardVideoPreviewSrc(selectedShot) ? (
                  <video
                    key={getStoryboardVideoPreviewSrc(selectedShot)}
                    src={getStoryboardVideoPreviewSrc(selectedShot)}
                    controls
                    playsInline
                    className="storyboard-media-frame h-full max-h-[620px] max-w-full rounded-2xl object-contain"
                  />
                ) : (
                  <div className="storyboard-media-frame relative flex aspect-[9/16] h-full max-h-[620px] flex-col items-center justify-center overflow-hidden rounded-2xl">
                    {getStoryboardPreviewSrc(selectedShot) ? (
                      <img
                        src={getStoryboardPreviewSrc(selectedShot)}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-35"
                      />
                    ) : null}
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-black/60">
                      <Play className="ml-1 h-5 w-5 text-white/65" />
                    </div>
                    <span className="relative mt-3 text-xs text-gray-600">
                      点击右侧“生视频”开始生成
                    </span>
                  </div>
                )}

                {selectedShot.video_status === "failed" && selectedShot.video_error ? (
                  <div className="absolute inset-x-4 bottom-4 rounded-xl border border-red-500/20 bg-red-950/80 px-4 py-3 text-xs text-red-200 backdrop-blur">
                    <div className="font-medium">视频生成失败</div>
                    <div className="mt-1 break-words text-red-300/70">
                      {selectedShot.video_error}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-center text-gray-700">
                <Camera className="mx-auto h-10 w-10" />
                <p className="mt-3 text-xs">从左侧选择一个片段</p>
              </div>
            )}
          </div>

          <div className="mx-auto h-[112px] w-full max-w-[430px] flex-none px-4 py-2">
            <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-gray-700">
              History
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {videoGenerations.map((generation, index) => (
                <div
                  key={generation.id}
                  className={
                    generation.is_current
                      ? "group relative h-[72px] w-[62px] flex-none overflow-hidden rounded-lg border border-teal-300/45 bg-[var(--storyboard-surface)]"
                      : "group relative h-[72px] w-[62px] flex-none overflow-hidden rounded-lg border border-white/[0.07] bg-[var(--storyboard-surface)]"
                  }
                >
                  {getGenerationPreviewSrc(generation) ? (
                    <video
                      src={getGenerationPreviewSrc(generation)}
                      muted
                      className="h-full w-full object-cover opacity-60"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-gray-700">
                      {generation.status}
                    </div>
                  )}
                  <button
                    type="button"
                    className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/90 via-transparent to-transparent pb-1 text-[9px] text-gray-400"
                    onClick={() => void handleSetCurrentGeneration(generation)}
                    disabled={
                      generation.is_current ||
                      generation.status !== "succeeded" ||
                      !generation.result_url ||
                      activeMediaActionKey === "set-current:" + generation.id
                    }
                    title={
                      generation.status !== "succeeded" || !generation.result_url
                        ? "该版本未生成成功，不能切换"
                        : generation.is_current
                          ? "当前版本"
                          : "设为当前版本"
                    }
                  >
                    {generation.status === "succeeded"
                      ? `v${videoGenerations.length - index}`
                      : generation.status === "failed"
                        ? "失败"
                        : "生成中"}
                  </button>
                  <button
                    type="button"
                    className="absolute right-1 top-1 hidden rounded bg-black/70 p-1 text-gray-400 group-hover:block"
                    onClick={() => handleRequestDeleteGeneration(generation)}
                    aria-label="删除历史版本"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {!videoGenerations.length ? (
                <div className="flex h-[72px] items-center text-[11px] text-gray-700">
                  还没有视频历史版本
                </div>
              ) : null}
            </div>
          </div>
        </main>

        <aside className="storyboard-glass-panel absolute bottom-4 right-4 top-4 z-20 flex w-[356px] flex-col overflow-hidden rounded-[22px] text-gray-100 max-2xl:w-[328px] max-xl:w-[300px] [&_.text-gray-500]:text-gray-300 [&_.text-gray-600]:text-gray-400 [&_.text-gray-700]:text-gray-400">
          {selectedShot ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
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

                <section className="flex min-h-[420px] flex-1 flex-col border-b border-white/[0.06] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-gray-500">提示词</span>
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-gray-700">
                        #{formatShotNumber(selectedShot.shot_number)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <PromptOptimizeButton
                        compact
                        loading={isOptimizingPrompt}
                        disabled={!shotForm.content.trim()}
                        onClick={() => void requestPromptOptimization()}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-gray-600 hover:text-white"
                        onClick={() => setIsPromptFullscreenOpen(true)}
                        aria-label="全屏编辑提示词"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
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
                  <div className="mt-2 text-right text-[9px] text-gray-700">输入 @ 引用资产</div>
                </section>

                <section className="p-3">
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.055] bg-[var(--storyboard-surface)] px-3 py-2.5">
                    <div>
                      <div className="text-[10px] text-gray-400">指定首帧控制开场</div>
                      <div className="mt-0.5 text-[9px] text-gray-700">
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

              <div className="flex-none border-t border-white/[0.06] p-3">
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <Select value={selectedVideoModel} onValueChange={handleVideoModelChange}>
                    <SelectTrigger className="h-9 border-white/10 bg-[var(--storyboard-surface)] text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#1b2525]/95 backdrop-blur-xl">
                      {VIDEO_MODEL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <VideoGenerationSettings
                    model={selectedVideoModel}
                    resolution={activeVideoResolution}
                    duration={activeVideoDuration}
                    generateAudio={activeVideoAudio}
                    onResolutionChange={setSelectedVideoResolution}
                    onDurationChange={setSelectedVideoDuration}
                    onGenerateAudioChange={setGenerateVideoAudio}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-600 font-semibold text-[#071312] shadow-lg shadow-teal-950/30 hover:from-teal-400 hover:to-cyan-500"
                    onClick={handleGenerateVideo}
                    disabled={
                      generatingVideoId === selectedShot.id || isLoadingVideoPreview || isSavingShot
                    }
                  >
                    {generatingVideoId === selectedShot.id || isLoadingVideoPreview ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    生视频
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[var(--storyboard-surface)] text-gray-500 hover:bg-white/[0.07] hover:text-white">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="border-white/10 bg-[#1b2525]/95 text-gray-100 backdrop-blur-xl"
                    >
                      <DropdownMenuItem onClick={handleSaveShot} disabled={isSavingShot}>
                        <Save className="h-4 w-4" />
                        保存片段 Prompt
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => selectedScene && handleRequestDeleteScene(selectedScene)}
                      >
                        <Trash2 className="h-4 w-4" />
                        删除片段
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center text-gray-700">
              <div>
                <Camera className="mx-auto h-9 w-9" />
                <p className="mt-3 text-xs">选择片段后编辑生成参数</p>
              </div>
            </div>
          )}
        </aside>
      </div>

      <input
        ref={shotCoverInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleUploadShotCover(file);
        }}
      />

      <Dialog open={isPromptFullscreenOpen} onOpenChange={setIsPromptFullscreenOpen}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-black/55 backdrop-blur-lg"
          className="flex h-[96vh] max-h-[96vh] !w-[98vw] !max-w-[1800px] flex-col overflow-hidden border-white/10 bg-[#131515]/95 p-0 text-gray-100 shadow-2xl shadow-black/70"
        >
          <DialogHeader className="flex-none border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-sm">提示词</DialogTitle>
                <DialogDescription className="mt-1 text-xs text-gray-600">
                  当前片段 · {selectedScene?.title || "未命名片段"}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <PromptOptimizeButton
                  loading={isOptimizingPrompt}
                  disabled={!shotForm.content.trim()}
                  onClick={() => void requestPromptOptimization()}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-gray-600 hover:text-white"
                  onClick={() => setIsPromptFullscreenOpen(false)}
                  aria-label="退出全屏编辑"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col p-5">
            <RichPromptEditor
              key={"fullscreen-prompt-" + (selectedShot?.id || 0)}
              value={shotForm.content}
              options={promptMentionOptions}
              onChange={(value) => updateShotForm("content", value)}
              onSelectMention={handleSelectPromptMention}
              onRemoveMentions={handleRemovePromptMentions}
              autoFocus={isPromptFullscreenOpen}
            />
          </div>
          <DialogFooter className="flex-none border-t border-white/[0.06] px-5 py-4">
            <Button
              onClick={() => setIsPromptFullscreenOpen(false)}
              className="bg-teal-400 text-[#071514] hover:bg-teal-300"
            >
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <Dialog open={isManageCharactersOpen} onOpenChange={setIsManageCharactersOpen}>
        <DialogContent className="bg-[#111111] border-gray-800 text-gray-100 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>管理片段角色</DialogTitle>
            <DialogDescription className="text-gray-400">
              管理当前片段 Prompt 使用的角色参考。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
              <div className="text-gray-300 font-medium">当前片段</div>
              <div className="mt-2 text-xs text-gray-400">
                {selectedShot
                  ? `${selectedScene?.title || "未命名片段"} · ${selectedShot.content || "未填写 Prompt"}`
                  : "未选择片段"}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedShot?.characters?.length ? (
                  selectedShot.characters.map((character) => (
                    <Badge
                      key={character.id}
                      variant="outline"
                      className="flex h-7 items-center gap-1 border-teal-700 pr-1 text-teal-200"
                    >
                      <span>{character.name}</span>
                      <button
                        type="button"
                        className="rounded-sm p-0.5 text-teal-200 transition hover:bg-teal-900/40 disabled:opacity-50"
                        onClick={() => void handleRemoveStoryboardCharacter(character.id)}
                        disabled={activeCharacterActionKey === `remove-character:${character.id}`}
                        aria-label={`移除角色 ${character.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="border-gray-700 text-gray-500">
                    当前片段未关联角色
                  </Badge>
                )}
              </div>
            </div>

            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-gray-300 font-medium">项目角色库</div>
                {selectedProject ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-gray-700 text-xs text-gray-300"
                    onClick={() => void loadProjectCharacters(selectedProject.id)}
                    disabled={isLoadingProjectCharacters}
                  >
                    {isLoadingProjectCharacters ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        刷新中
                      </>
                    ) : (
                      "刷新角色库"
                    )}
                  </Button>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                {isLoadingProjectCharacters ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    正在加载项目角色
                  </div>
                ) : projectCharacters.length > 0 ? (
                  projectCharacters.map((character) => {
                    const alreadyAssigned = !!selectedShot?.characters?.some(
                      (item) => item.id === character.id,
                    );
                    return (
                      <div
                        key={character.id}
                        className="flex items-start justify-between gap-3 rounded-md border border-gray-800 bg-[#111111] p-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm text-gray-200">{character.name}</div>
                          <div className="mt-1 line-clamp-3 text-xs leading-5 text-gray-400">
                            {character.description || "暂无角色描述"}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={alreadyAssigned ? "outline" : "default"}
                          className={
                            alreadyAssigned
                              ? "h-7 border-gray-700 text-xs text-gray-400"
                              : "h-7 bg-teal-400 px-3 text-xs text-[#071514] hover:bg-teal-300"
                          }
                          onClick={() => void handleAddStoryboardCharacter(character.id)}
                          disabled={
                            alreadyAssigned ||
                            activeCharacterActionKey === `add-character:${character.id}`
                          }
                        >
                          {activeCharacterActionKey === `add-character:${character.id}` ? (
                            <>
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              添加中
                            </>
                          ) : alreadyAssigned ? (
                            "已关联"
                          ) : (
                            "加入片段"
                          )}
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-gray-500">当前项目还没有可选角色。</div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsManageCharactersOpen(false)}
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isManageAssetsOpen} onOpenChange={setIsManageAssetsOpen}>
        <DialogContent className="bg-[#111111] border-gray-800 text-gray-100 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>管理参考资产</DialogTitle>
            <DialogDescription className="text-gray-400">
              给当前片段添加或移除场景、图片、道具和音频资产。生成时会按媒体类型分别作为参考图或参考音频传入。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
              <div className="text-gray-300 font-medium">当前片段</div>
              <div className="mt-2 text-xs text-gray-400">
                {selectedShot
                  ? `${formatShotNumber(selectedShot.shot_number)} · ${selectedShot.content || "未填写画面描述"}`
                  : "未选择片段"}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedShot?.assets?.length ? (
                  selectedShot.assets.map((asset) => (
                    <Badge
                      key={asset.id}
                      variant="outline"
                      className="flex h-7 items-center gap-1 border-teal-700 pr-1 text-teal-200"
                    >
                      <span>{asset.name}</span>
                      <button
                        type="button"
                        className="rounded-sm p-0.5 text-teal-200 transition hover:bg-teal-900/40 disabled:opacity-50"
                        onClick={() => void handleRemoveStoryboardAsset(asset.id)}
                        disabled={activeAssetActionKey === `remove-asset:${asset.id}`}
                        aria-label={`移除参考资产 ${asset.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="border-gray-700 text-gray-500">
                    当前片段未关联参考资产
                  </Badge>
                )}
              </div>
            </div>

            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-gray-300 font-medium">项目参考资产库</div>
                {selectedProject ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-gray-700 text-xs text-gray-300"
                    onClick={() => void loadProjectAssets(selectedProject.id)}
                    disabled={isLoadingProjectAssets}
                  >
                    {isLoadingProjectAssets ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        刷新中
                      </>
                    ) : (
                      "刷新资产库"
                    )}
                  </Button>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                {isLoadingProjectAssets ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    正在加载项目参考资产
                  </div>
                ) : projectAssets.length > 0 ? (
                  projectAssets.map((asset) => {
                    const alreadyAssigned = !!selectedShot?.assets?.some(
                      (item) => item.id === asset.id,
                    );
                    return (
                      <div
                        key={asset.id}
                        className="flex items-start justify-between gap-3 rounded-md border border-gray-800 bg-[#111111] p-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm text-gray-200">{asset.name}</div>
                          <div className="mt-1 line-clamp-3 text-xs leading-5 text-gray-400">
                            {asset.meta || asset.type || "项目资产"}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={alreadyAssigned ? "outline" : "default"}
                          className={
                            alreadyAssigned
                              ? "h-7 border-gray-700 text-xs text-gray-400"
                              : "h-7 bg-teal-400 px-3 text-xs text-[#071514] hover:bg-teal-300"
                          }
                          onClick={() => void handleAddStoryboardAsset(asset.id)}
                          disabled={
                            alreadyAssigned || activeAssetActionKey === `add-asset:${asset.id}`
                          }
                        >
                          {activeAssetActionKey === `add-asset:${asset.id}` ? (
                            <>
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              添加中
                            </>
                          ) : alreadyAssigned ? (
                            "已关联"
                          ) : (
                            "加入片段"
                          )}
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-gray-500">当前项目还没有可用的参考资产。</div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsManageAssetsOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isCreateSceneOpen}
        onOpenChange={(open) => {
          setIsCreateSceneOpen(open);
          if (!open) {
            setSceneInsertSortOrder(null);
            resetNewSceneForm();
          }
        }}
      >
        <DialogContent className="bg-[#111111] border-gray-800 text-gray-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{sceneInsertSortOrder ? "插入片段" : "新建片段"}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {sceneInsertSortOrder
                ? `新片段将插入为当前章节的片段-${sceneInsertSortOrder}，后续片段会自动顺延。`
                : "在当前章节末尾创建新片段。若项目还没有章节，系统会先自动创建第1章。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-400">片段号</Label>
              <Input
                value={newSceneForm.title}
                onChange={(e) => updateNewSceneForm("title", e.target.value)}
                placeholder={`片段${sceneInsertSortOrder || scenes.length + 1}`}
                className="mt-1.5 bg-[#1a1a1a] border-gray-700"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400">片段描述</Label>
              <Textarea
                value={newSceneForm.description}
                onChange={(e) => updateNewSceneForm("description", e.target.value)}
                placeholder="请输入，可选"
                className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateSceneOpen(false);
                setSceneInsertSortOrder(null);
                resetNewSceneForm();
              }}
            >
              取消
            </Button>
            <Button
              type="button"
              className="bg-teal-400 text-[#071514] hover:bg-teal-300"
              onClick={handleCreateScene}
              disabled={isCreatingScene || !newSceneForm.title.trim()}
            >
              {isCreatingScene ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  创建中
                </>
              ) : (
                "确认创建"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isCoverConfirmOpen} onOpenChange={setIsCoverConfirmOpen}>
        <DialogContent className="bg-[#111111] border-gray-800 text-gray-100 max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>确认生成首帧</DialogTitle>
            <DialogDescription className="text-gray-400 leading-6">
              会为当前片段调用图像模型生成 1
              张新首帧，并消耗模型额度。弹窗展示的是本次将实际传给大模型的参数。
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="grid gap-3 rounded-md border border-gray-800 bg-[#161616] p-3 text-sm md:grid-cols-2">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">片段</span>
                <span>{selectedScene?.title || "-"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">生成模式</span>
                <span>
                  {coverGenerationPreview?.mode === "reference" ? "参考图生成" : "纯文本生成"}
                </span>
              </div>
              <div className="flex justify-between gap-4 md:col-span-2">
                <span className="text-gray-500">实际模型</span>
                <span>{coverGenerationPreview?.model || "-"}</span>
              </div>
            </div>

            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-2">
              <div className="text-gray-300 font-medium">参考图</div>
              {coverGenerationPreview?.reference_images?.length ? (
                <div className="space-y-3">
                  {coverGenerationPreview.reference_images.map((reference, index) => (
                    <div
                      key={`${reference.type}-${reference.name}-${index}`}
                      className="rounded border border-gray-800 bg-[#111111] p-2 text-xs space-y-2"
                    >
                      <div className="grid gap-2 md:grid-cols-[96px_minmax(0,1fr)]">
                        <button
                          type="button"
                          className="h-24 w-24 overflow-hidden rounded bg-black"
                          onClick={() => openGenerationReferencePreview(index)}
                          aria-label={`预览参考图 ${reference.name || index + 1}`}
                        >
                          <img
                            src={reference.url}
                            alt={reference.name || `${reference.type} 参考图`}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        </button>
                        <div className="space-y-1 break-all">
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">类型</span>
                            <span>{reference.type}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">名称</span>
                            <span>{reference.name || "-"}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">来源字段</span>
                            <span>{reference.source}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Prompt 映射</span>
                            <span>
                              {coverGenerationPreview?.mappings?.[index]?.is_mentioned
                                ? `已对应 ${coverGenerationPreview.mappings[index].mention}`
                                : "已绑定但正文未引用"}
                            </span>
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">URL</div>
                            <div className="text-gray-300 break-all">{reference.url}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-amber-300">当前片段没有任何可用参考图。</div>
              )}
              {!!coverGenerationPreview?.missing_references?.length && (
                <div>
                  <div className="text-gray-500 mb-1">缺失参考图</div>
                  <div className="text-gray-300 text-xs break-words">
                    {coverGenerationPreview.missing_references.join("、")}
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-2">
              <div className="text-gray-300 font-medium">结构化字段</div>
              <div className="grid gap-2 md:grid-cols-2 text-xs">
                <div>
                  <span className="text-gray-500">片段标题：</span>
                  <span>{coverGenerationPreview?.fields.scene_title || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500">地点：</span>
                  <span>{coverGenerationPreview?.fields.location || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500">时间：</span>
                  <span>{coverGenerationPreview?.fields.time_of_day || "-"}</span>
                </div>
                <div className="md:col-span-2">
                  <span className="text-gray-500">角色：</span>
                  <span>{coverGenerationPreview?.fields.characters?.join("、") || "-"}</span>
                </div>
                <div className="md:col-span-2">
                  <span className="text-gray-500">画面描述：</span>
                  <span>{coverGenerationPreview?.fields.content || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500">情绪：</span>
                  <span>{coverGenerationPreview?.fields.mood || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500">台词：</span>
                  <span>{coverGenerationPreview?.fields.dialogue || "-"}</span>
                </div>
                <div className="md:col-span-2">
                  <span className="text-gray-500">备注：</span>
                  <span>{coverGenerationPreview?.fields.notes || "-"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-2">
              <div className="text-gray-300 font-medium">最终 Prompt</div>
              <pre className="whitespace-pre-wrap break-words rounded border border-gray-800 bg-[#111111] p-3 text-xs text-gray-300 leading-6">
                {formatPromptForDisplay(coverGenerationPreview?.final_prompt)}
              </pre>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setIsCoverConfirmOpen(false)}>
              取消
            </Button>
            {coverGenerationPreview?.reference_images?.length ? (
              <Button
                type="button"
                className="bg-teal-400 text-[#071514] hover:bg-teal-300"
                onClick={() => void confirmGenerateCover(false)}
              >
                确认生成
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={handleManageCharactersForCover}>
                  管理角色参考
                </Button>
                <Button type="button" variant="outline" onClick={handleManageAssetsForCover}>
                  管理场景参考
                </Button>
                <Button
                  type="button"
                  className="bg-teal-400 text-[#071514] hover:bg-teal-300"
                  onClick={() => void confirmGenerateCover(true)}
                >
                  继续用纯文本生成
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSceneCoverConfirmOpen} onOpenChange={setIsSceneCoverConfirmOpen}>
        <DialogContent className="bg-[#111111] border-gray-800 text-gray-100 max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>确认生成片段封面</DialogTitle>
            <DialogDescription className="text-gray-400 leading-6">
              会为当前片段生成 1 张片段级代表封面。弹窗展示的是本次将实际传给大模型的详细参数和最终
              prompt。
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">实际模型</span>
                <span>{sceneCoverGenerationPreview?.model || "-"}</span>
              </div>
              {sceneCoverGenerationPreview?.notes?.length ? (
                <div>
                  <div className="text-gray-500 mb-1">说明</div>
                  <ul className="space-y-1 text-xs text-gray-300 list-disc pl-5">
                    {sceneCoverGenerationPreview.notes.map((note, index) => (
                      <li key={`${note}-${index}`}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-2">
              <div className="text-gray-300 font-medium">详细参数</div>
              <div className="grid gap-2 md:grid-cols-2 text-xs">
                {Object.entries(sceneCoverGenerationPreview?.fields || {}).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-gray-500">{key}：</span>
                    <span>{value || "-"}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-2">
              <div className="text-gray-300 font-medium">最终 Prompt</div>
              <pre className="whitespace-pre-wrap break-words rounded border border-gray-800 bg-[#111111] p-3 text-xs text-gray-300 leading-6">
                {formatPromptForDisplay(sceneCoverGenerationPreview?.final_prompt)}
              </pre>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSceneCoverConfirmOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="bg-teal-400 text-[#071514] hover:bg-teal-300"
              onClick={() => void confirmGenerateSceneCover()}
            >
              确认生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isBatchSceneCoverConfirmOpen}
        onOpenChange={setIsBatchSceneCoverConfirmOpen}
      >
        <AlertDialogContent className="bg-[#111111] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量生成首帧</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 leading-6">
              会为当前片段下的全部镜头串行生成新首帧，并消耗图像模型额度。新结果会保留到各自镜头的首帧历史中。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">片段标题</span>
              <span>{selectedScene?.title || "-"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">镜头数量</span>
              <span>{filteredShots.length}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">当前模型</span>
              <span>Seedream 4.5</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-teal-400 text-[#071514] hover:bg-teal-300"
              onClick={confirmBatchGenerateSceneCovers}
            >
              确认生成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isSceneVideoConfirmOpen} onOpenChange={setIsSceneVideoConfirmOpen}>
        <AlertDialogContent className="bg-[#111111] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedScene?.video_url ? "确认重新生成片段视频" : "确认生成片段视频"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 leading-6">
              {selectedScene?.video_url
                ? "当前片段已经有一个已生成的视频。继续后会重新合成并覆盖当前片段视频结果。"
                : "会将当前片段下已有视频镜头按顺序合成为一个片段视频，并保留每个镜头原始音轨。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">片段标题</span>
              <span>{selectedScene?.title || "-"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">可合成镜头数</span>
              <span>{composableShots.length}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">输出规格</span>
              <span>720P / 保留原音轨</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-teal-400 text-[#071514] hover:bg-teal-300"
              onClick={confirmComposeSceneVideo}
            >
              {selectedScene?.video_url ? "确认重新生成" : "确认合成"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isProjectVideoConfirmOpen} onOpenChange={setIsProjectVideoConfirmOpen}>
        <AlertDialogContent className="bg-[#111111] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>确认生成项目总片</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 leading-6">
              会自动收集当前项目内已生成成功的片段视频，按章节和片段顺序合成为一个项目级粗剪视频。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">项目名称</span>
              <span>{selectedProject?.name || "-"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">输出规格</span>
              <span>720P / 保留各片段原音轨</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-teal-400 text-[#071514] hover:bg-teal-300"
              onClick={confirmComposeProjectVideo}
            >
              确认合成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isVideoConfirmOpen} onOpenChange={handleVideoConfirmOpenChange}>
        <DialogContent className="bg-[#111111] border-gray-800 text-gray-100 max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>确认生成视频</DialogTitle>
            <DialogDescription className="text-gray-400 leading-6">
              会为当前片段生成 {previewVideoSpecLabel}{" "}
              视频。弹窗展示的是本次将实际传给大模型的详细参数和最终 prompt。
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="grid gap-3 rounded-md border border-gray-800 bg-[#161616] p-3 text-sm md:grid-cols-2">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">片段</span>
                <span>{selectedScene?.title || "-"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">实际模型</span>
                <span>{videoGenerationPreview?.model || selectedVideoModel}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">时长</span>
                <span>{videoGenerationPreview?.duration || activeVideoDuration} 秒</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">输出规格</span>
                <span>
                  {videoGenerationPreview
                    ? `${videoGenerationPreview.resolution} / ${videoGenerationPreview.duration}秒 / ${videoGenerationPreview.audio ? "有声" : "无声"}`
                    : previewVideoSpecLabel}
                </span>
              </div>
              <div className="flex justify-between gap-4 md:col-span-2">
                <span className="text-gray-500">首帧来源</span>
                <span>
                  {videoGenerationPreview?.use_first_frame
                    ? videoGenerationPreview?.will_generate_cover
                      ? "当前无首帧，后端会先自动生成首帧"
                      : "使用当前片段首帧作为首帧输入"
                    : "不使用首帧，直接文生视频"}
                </span>
              </div>
            </div>

            <div className="rounded-md border border-gray-800 bg-[#161616] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-200">指定首帧控制开场</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Seedance 的首帧模式与参考素材模式互斥。开启后只发送首帧，关闭后发送角色、场景和语音参考素材。
                  </p>
                </div>
                <Switch
                  checked={useFirstFrameForVideo}
                  onCheckedChange={setUseFirstFrameForVideo}
                />
              </div>
            </div>

            {videoGenerationPreview?.use_first_frame ? (
              <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-2">
                <div className="text-gray-300 font-medium">首帧图</div>
                {videoGenerationPreview?.source_image_url ? (
                  <div className="grid gap-2 md:grid-cols-[112px_minmax(0,1fr)]">
                    <div className="h-28 w-28 overflow-hidden rounded border border-gray-800 bg-black">
                      <img
                        src={videoGenerationPreview.source_image_url}
                        alt={
                          selectedShot
                            ? `${formatShotNumber(selectedShot.shot_number)} 首帧图`
                            : "首帧图"
                        }
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="space-y-2 break-all text-xs">
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-500">状态</span>
                        <span>
                          {videoGenerationPreview.source_image_status === "existing-cover"
                            ? "已有首帧"
                            : "将自动补首帧"}
                        </span>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-1">URL</div>
                        <div className="text-gray-300 break-all">
                          {videoGenerationPreview.source_image_url}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-amber-300 text-sm">
                    当前片段还没有首帧。开始生成后，后端会先自动补一张首帧，再继续生成视频。
                  </div>
                )}
              </div>
            ) : null}

            {!!videoGenerationPreview?.omitted_reference_images?.length && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm leading-6 text-amber-200">
                当前为首帧模式，已绑定的 {videoGenerationPreview.omitted_reference_images.length} 张角色或场景参考图不会发送给 Seedance。关闭“指定首帧控制开场”即可改用参考素材模式。
              </div>
            )}

            {!!videoGenerationPreview?.reference_images?.length && (
              <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-gray-300 font-medium">参考图输入</div>
                  <div className="text-[11px] text-gray-500">
                    用于生成前确认；Seedance 2.0 会额外传入角色主语音参考
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {videoGenerationPreview.reference_images.map((reference, index) => (
                    <div
                      key={`${reference.name}-${index}`}
                      className="grid gap-2 rounded border border-gray-800 bg-[#111111] p-3 md:grid-cols-[96px_minmax(0,1fr)]"
                    >
                      <div className="h-24 w-24 overflow-hidden rounded border border-gray-800 bg-black">
                        <img
                          src={reference.url}
                          alt={reference.name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-[#1b2336] text-[#9ec5ff] hover:bg-[#1b2336]">
                            {reference.type === "character"
                              ? "角色"
                              : reference.type === "scene"
                                ? "背景"
                                : reference.type}
                          </Badge>
                          <span className="truncate text-gray-200">{reference.name}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">来源：</span>
                          <span className="text-gray-300">{reference.source}</span>
                        </div>
                        <div>
                          <div className="mb-1 text-gray-500">URL</div>
                          <div className="break-all text-gray-300">{reference.url}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {!!videoGenerationPreview?.missing_references?.length && (
                  <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                    <div className="mb-1 text-amber-300">以下参考项缺少可用图片：</div>
                    <div className="break-words">
                      {videoGenerationPreview.missing_references.join("、")}
                    </div>
                  </div>
                )}
              </div>
            )}

            {videoGenerationPreview?.audio_reference_limits ? (
              <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-gray-300 font-medium">角色主语音参考</div>
                  <div className="text-[11px] text-gray-500">
                    最多 {videoGenerationPreview.audio_reference_limits.max_count} 段 / 总时长不超过{" "}
                    {videoGenerationPreview.audio_reference_limits.max_total_duration} 秒
                  </div>
                </div>
                {videoGenerationPreview.audio_reference_assets?.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {videoGenerationPreview.audio_reference_assets.map((reference) => (
                      <div
                        key={reference.reference_id || reference.url}
                        className="rounded border border-gray-800 bg-[#111111] p-3 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-gray-200">{reference.name}</div>
                            <div className="mt-1 text-gray-500">
                              {reference.voice_name || "角色主语音"} ·{" "}
                              {reference.duration
                                ? `${reference.duration.toFixed(1)}s`
                                : "未知时长"}
                            </div>
                          </div>
                          <Badge className="bg-teal-400 text-[#071514]">reference_audio</Badge>
                        </div>
                        <audio controls className="w-full" src={reference.url} />
                        <div className="break-all text-gray-500">{reference.url}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded border border-dashed border-gray-700 px-3 py-4 text-xs text-gray-500">
                    当前片段没有可传入的角色主语音参考。
                  </div>
                )}
                {!!videoGenerationPreview.missing_audio_references?.length && (
                  <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                    <div className="mb-1 text-amber-300">以下角色缺少主语音参考：</div>
                    <div className="break-words">
                      {videoGenerationPreview.missing_audio_references.join("、")}
                    </div>
                  </div>
                )}
                {!!videoGenerationPreview.blocking_reasons?.length && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                    <div className="mb-1 text-red-300">当前不能生成 Seedance 2.0 视频：</div>
                    <ul className="space-y-1 list-disc pl-5">
                      {videoGenerationPreview.blocking_reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="bg-teal-400/15 text-teal-100 hover:bg-teal-400/15">
                  {videoGenerationPreview?.prompt_mode === "composite" ? "完整原文" : "兼容模式"}
                </Badge>
                <span className="text-xs text-gray-500">
                  生成时长 {videoGenerationPreview?.duration || activeVideoDuration} 秒
                </span>
                <span className="text-xs text-gray-500">
                  首帧 {videoGenerationPreview?.use_first_frame ? "开启" : "关闭"}
                </span>
              </div>
              <div className="mb-2 text-sm font-medium text-gray-300">最终提交 Prompt</div>
              <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded border border-gray-800 bg-[#111111] p-3 text-xs leading-6 text-gray-300">
                {formatPromptForDisplay(videoGenerationPreview?.final_prompt)}
              </pre>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setIsVideoConfirmOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              className="bg-teal-400 text-[#071514] hover:bg-teal-300"
              onClick={() => void confirmGenerateVideo()}
              disabled={!!videoGenerationPreview?.blocking_reasons?.length}
            >
              确认生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTargetGeneration}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTargetGeneration(null);
          }
        }}
      >
        <AlertDialogContent className="bg-[#111111] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除历史版本</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 leading-6">
              该操作会从历史列表中移除当前版本记录，但不会删除服务器上的资源文件。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">类型</span>
              <span>{deleteTargetGeneration?.media_type === "video" ? "视频" : "首帧"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">模型</span>
              <span>{deleteTargetGeneration?.model || "-"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">生成时间</span>
              <span>{formatShanghaiDateTime(deleteTargetGeneration?.created_at)}</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDeleteGeneration}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTargetScene}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTargetScene(null);
          }
        }}
      >
        <AlertDialogContent className="bg-[#111111] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除片段</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 leading-6">
              该操作会删除当前片段及其 Prompt、引用和媒体历史，需要二次确认。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">片段标题</span>
              <span>{deleteTargetScene?.title || "-"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">地点</span>
              <span>{deleteTargetScene?.location || "-"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">时间</span>
              <span>{deleteTargetScene?.time_of_day || "-"}</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDeleteScene}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <Dialog
        open={!!previewSceneVideo}
        onOpenChange={(open) => {
          if (!open) setPreviewSceneVideo(null);
        }}
      >
        <DialogContent className="!max-w-[98vw] h-[96vh] max-h-[96vh] w-[98vw] overflow-hidden border-gray-800 bg-[#111111] text-gray-100 flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{previewSceneVideo?.title || "片段视频预览"}</DialogTitle>
            <DialogDescription className="text-gray-400">
              默认播放预览版视频。需要查看原始输出时，可在下方打开原视频。
            </DialogDescription>
          </DialogHeader>
          {previewSceneVideo ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-black">
                <video
                  key={previewSceneVideo.src}
                  src={previewSceneVideo.src}
                  controls
                  autoPlay
                  preload="metadata"
                  className="max-h-full w-full rounded-lg bg-black object-contain"
                />
              </div>
              <div className="flex flex-shrink-0 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-700 text-gray-300"
                  onClick={() => {
                    if (previewSceneVideo.originalSrc) {
                      window.open(previewSceneVideo.originalSrc, "_blank", "noopener,noreferrer");
                    }
                  }}
                  disabled={!previewSceneVideo.originalSrc}
                >
                  打开原视频
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewProjectVideo}
        onOpenChange={(open) => {
          if (!open) setPreviewProjectVideo(null);
        }}
      >
        <DialogContent className="!max-w-[98vw] h-[96vh] max-h-[96vh] w-[98vw] overflow-hidden border-gray-800 bg-[#111111] text-gray-100 flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{previewProjectVideo?.title || "项目总片预览"}</DialogTitle>
            <DialogDescription className="text-gray-400">
              默认播放预览版项目总片。需要查看原始输出时，可在下方打开原视频。
            </DialogDescription>
          </DialogHeader>
          {previewProjectVideo ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-black">
                <video
                  key={previewProjectVideo.src}
                  src={previewProjectVideo.src}
                  controls
                  autoPlay
                  preload="metadata"
                  className="max-h-full w-full rounded-lg bg-black object-contain"
                />
              </div>
              <div className="flex flex-shrink-0 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-700 text-gray-300"
                  onClick={() => {
                    if (previewProjectVideo.originalSrc) {
                      window.open(previewProjectVideo.originalSrc, "_blank", "noopener,noreferrer");
                    }
                  }}
                  disabled={!previewProjectVideo.originalSrc}
                >
                  打开原视频
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
