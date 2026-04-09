import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Film,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Play,
  Save,
  Download,
  Users,
  Package,
  Clock,
  Camera,
  MessageSquare,
  Image as ImageIcon,
  X,
  Sparkles,
  Loader2,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
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
  projectApi,
  chapterApi,
  sceneApi,
  storyboardApi,
  type Project,
  type Chapter,
  type Scene,
  type Storyboard,
  type StoryboardCoverGenerationPreview,
  type StoryboardMediaGeneration,
} from "../api";

const COVER_MODEL_OPTIONS = [
  { value: "qwen-image-2.0", label: "Qwen Image 2.0" },
] as const;

const VIDEO_MODEL_OPTIONS = [
  { value: "wan2.6-i2v-flash", label: "Wan 2.6 I2V Flash" },
  { value: "wan2.7-i2v", label: "Wan 2.7 I2V" },
] as const;

const SHOT_TYPE_OPTIONS = ["远景", "全景", "中景", "近景", "特写", "大特写"] as const;
const CAMERA_DIRECTION_OPTIONS = ["平视", "俯视", "仰视", "侧面"] as const;
const CAMERA_MOTION_OPTIONS = ["静止", "推镜", "拉镜", "横移", "跟拍", "手持轻晃"] as const;
const MOOD_OPTIONS = ["压抑", "神秘", "温暖", "孤独", "紧张", "惊悚", "冷峻"] as const;

type ShotFormState = {
  content: string;
  dialogue: string;
  shot_type: string;
  camera_direction: string;
  camera_motion: string;
  mood: string;
  notes: string;
};

const emptyShotForm: ShotFormState = {
  content: "",
  dialogue: "",
  shot_type: "",
  camera_direction: "",
  camera_motion: "",
  mood: "",
  notes: "",
};

const emptySceneForm = {
  title: "",
  description: "",
  location: "",
  time_of_day: "",
};

const buildShotFormState = (shot: Storyboard | null): ShotFormState => ({
  content: shot?.content || "",
  dialogue: shot?.dialogue || "",
  shot_type: shot?.shot_type || "",
  camera_direction: shot?.camera_direction || "",
  camera_motion: shot?.camera_motion || "",
  mood: shot?.mood || "",
  notes: shot?.notes || "",
});

function getStoryboardVideoPreviewSrc(storyboard?: Storyboard | null) {
  if (!storyboard) return "";
  return storyboard.video_preview_url || storyboard.video_url || "";
}

const getStoryboardPreviewSrc = (shot: Storyboard | null | undefined) =>
  shot?.thumbnail_preview_url || shot?.thumbnail_url || "";

const getScenePreviewSrc = (scene: Scene | null | undefined) =>
  scene?.cover_preview_url || scene?.cover_url || "";

const getSceneVideoPreviewSrc = (scene: Scene | null | undefined) =>
  scene?.video_preview_url || scene?.video_url || "";

const getProjectVideoPreviewSrc = (project: Project | null | undefined) =>
  project?.video_preview_url || project?.video_url || "";

const getGenerationPreviewSrc = (generation: StoryboardMediaGeneration | null | undefined) =>
  generation?.preview_url || generation?.result_url || "";

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

export default function Workspace() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [mediaGenerations, setMediaGenerations] = useState<StoryboardMediaGeneration[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [selectedShot, setSelectedShot] = useState<Storyboard | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<number[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingShot, setIsSavingShot] = useState(false);
  const [generatingCoverId, setGeneratingCoverId] = useState<number | null>(null);
  const [generatingVideoId, setGeneratingVideoId] = useState<number | null>(null);
  const [pendingGeneratedShotId, setPendingGeneratedShotId] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [selectedCoverModel, setSelectedCoverModel] = useState<(typeof COVER_MODEL_OPTIONS)[number]["value"]>(COVER_MODEL_OPTIONS[0].value);
  const [selectedVideoModel, setSelectedVideoModel] = useState<(typeof VIDEO_MODEL_OPTIONS)[number]["value"]>(VIDEO_MODEL_OPTIONS[0].value);
  const [isLoadingCoverPreview, setIsLoadingCoverPreview] = useState(false);
  const [coverGenerationPreview, setCoverGenerationPreview] = useState<StoryboardCoverGenerationPreview | null>(null);
  const [isCoverConfirmOpen, setIsCoverConfirmOpen] = useState(false);
  const [isVideoConfirmOpen, setIsVideoConfirmOpen] = useState(false);
  const [isSceneCoverConfirmOpen, setIsSceneCoverConfirmOpen] = useState(false);
  const [isBatchSceneCoverConfirmOpen, setIsBatchSceneCoverConfirmOpen] = useState(false);
  const [isSceneVideoConfirmOpen, setIsSceneVideoConfirmOpen] = useState(false);
  const [isProjectVideoConfirmOpen, setIsProjectVideoConfirmOpen] = useState(false);
  const [isCreateSceneOpen, setIsCreateSceneOpen] = useState(false);
  const [isCreatingScene, setIsCreatingScene] = useState(false);
  const [isCreatingShot, setIsCreatingShot] = useState(false);
  const [isGeneratingSceneCover, setIsGeneratingSceneCover] = useState(false);
  const [isBatchGeneratingSceneCover, setIsBatchGeneratingSceneCover] = useState(false);
  const [isComposingSceneVideo, setIsComposingSceneVideo] = useState(false);
  const [isComposingProjectVideo, setIsComposingProjectVideo] = useState(false);
  const [deleteTargetGeneration, setDeleteTargetGeneration] = useState<StoryboardMediaGeneration | null>(null);
  const [deleteTargetScene, setDeleteTargetScene] = useState<Scene | null>(null);
  const [deleteTargetShot, setDeleteTargetShot] = useState<Storyboard | null>(null);
  const [activeMediaActionKey, setActiveMediaActionKey] = useState<string | null>(null);
  const [previewSceneVideo, setPreviewSceneVideo] = useState<{ src: string; originalSrc?: string; title: string } | null>(null);
  const [previewProjectVideo, setPreviewProjectVideo] = useState<{ src: string; originalSrc?: string; title: string } | null>(null);
  const [shotForm, setShotForm] = useState<ShotFormState>(emptyShotForm);
  const [newSceneForm, setNewSceneForm] = useState(emptySceneForm);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(256);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(350);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const leftSidebarRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLDivElement>(null);
  const videoPollingTimerRef = useRef<number | null>(null);

  const MIN_SIDEBAR_WIDTH = 220;
  const MAX_SIDEBAR_WIDTH = 500;

  // Load projects on mount
  useEffect(() => {
    loadProjects();
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
    setShotForm(buildShotFormState(selectedShot));
  }, [selectedShot]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = e.clientX;
        if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
          setLeftSidebarWidth(newWidth);
        }
      }

      if (isResizingRight) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
          setRightSidebarWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingLeft, isResizingRight]);

  const resolveProjectId = () => {
    const url = new URL(window.location.href);
    const fromQuery = Number(url.searchParams.get("project") || "0");
    const fromStorage = Number(window.localStorage.getItem("currentProjectId") || "0");
    return fromQuery || fromStorage || 0;
  };

  const loadStoryboards = async (sceneId: number) => {
    try {
      const data = await storyboardApi.getStoryboardsByScene(sceneId);
      setStoryboards(data);
      setSelectedShot(data[0] ?? null);
    } catch (error) {
      console.error("Failed to load storyboards:", error);
      setStoryboards([]);
      setSelectedShot(null);
    }
  };

  const loadMediaGenerations = async (storyboardId: number) => {
    try {
      const data = await storyboardApi.getStoryboardMediaGenerations(storyboardId);
      setMediaGenerations(data);
    } catch (error) {
      console.error("Failed to load media generations:", error);
      setMediaGenerations([]);
    }
  };

  const applyStoryboardUpdate = (nextShot: Storyboard) => {
    setStoryboards((prev) => prev.map((shot) => (shot.id === nextShot.id ? nextShot : shot)));
    setSelectedShot((prev) => (prev?.id === nextShot.id ? nextShot : prev));
  };

  const applySceneUpdate = (nextScene: Scene) => {
    setScenes((prev) => prev.map((scene) => (scene.id === nextScene.id ? nextScene : scene)));
    setSelectedScene((prev) => (prev?.id === nextScene.id ? nextScene : prev));
  };

  const applyProjectUpdate = (nextProject: Project) => {
    setProjects((prev) => prev.map((project) => (project.id === nextProject.id ? nextProject : project)));
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

  const applyMediaMutation = (payload: { storyboard: Storyboard; media_generations: StoryboardMediaGeneration[] }) => {
    applyStoryboardUpdate(payload.storyboard);
    setMediaGenerations(payload.media_generations);
  };

  const stopVideoPolling = () => {
    if (videoPollingTimerRef.current !== null) {
      window.clearInterval(videoPollingTimerRef.current);
      videoPollingTimerRef.current = null;
    }
  };

  const pollStoryboardVideo = (storyboardId: number) => {
    stopVideoPolling();
    videoPollingTimerRef.current = window.setInterval(async () => {
      try {
        const latest = await storyboardApi.getStoryboard(storyboardId);
        applyStoryboardUpdate(latest);
        const generations = await storyboardApi.getStoryboardMediaGenerations(storyboardId);
        setMediaGenerations(generations);
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
    await loadChapters(projectId, true);
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

  const handleLeftMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
  };

  const handleRightMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
  };

  const filteredShots = selectedScene
    ? storyboards.filter((shot) => shot.scene_id === selectedScene.id)
    : [];
  const composableShots = filteredShots.filter((shot) => shot.video_status === "succeeded" && !!shot.video_url);

  const calculateTotalDuration = () => {
    return filteredShots.reduce((sum, shot) => sum + (shot.duration || 0), 0);
  };

  const formatShotNumber = (num?: number) => String(num ?? 0).padStart(3, "0");

  const deriveShotType = (shot: Storyboard) => {
    if (shot.shot_type) return shot.shot_type;
    const text = `${shot.content || ""} ${shot.notes || ""}`;
    if (text.includes("特写")) return "特写";
    if (text.includes("中景")) return "中景";
    if (text.includes("近景")) return "近景";
    if (text.includes("远景")) return "远景";
    if (text.includes("全景")) return "全景";
    return "镜头";
  };

  const deriveEmotion = (shot: Storyboard) => {
    if (shot.mood) return shot.mood;
    const text = `${shot.content || ""} ${shot.notes || ""}`;
    if (text.includes("孤独")) return "孤独";
    if (text.includes("沉思")) return "沉思";
    if (text.includes("紧张")) return "紧张";
    if (text.includes("悔恨")) return "悔恨";
    if (text.includes("温暖")) return "温暖";
    if (text.includes("渺小")) return "渺小";
    return "";
  };

  const deriveCharacterNames = (shot: Storyboard) => {
    if (shot.character_names && shot.character_names.length > 0) {
      return shot.character_names;
    }
    if (shot.characters && shot.characters.length > 0) {
      return shot.characters.map((character) => character.name);
    }
    return [];
  };

  const runGenerateCover = async (useTextOnly = false) => {
    if (!selectedShot) {
      return;
    }

    setGeneratingCoverId(selectedShot.id);
    setPendingGeneratedShotId(selectedShot.id);
    try {
      const result = await storyboardApi.generateStoryboardCover(selectedShot.id, useTextOnly ? { use_text_only: true } : undefined);
      const nextShot = result.storyboard;
      setStoryboards((prev) =>
        prev.map((shot) => (shot.id === nextShot.id ? nextShot : shot)),
      );
      setSelectedShot(nextShot);
      await loadMediaGenerations(nextShot.id);
    } catch (error) {
      console.error("Failed to generate storyboard cover:", error);
    } finally {
      setGeneratingCoverId(null);
      setPendingGeneratedShotId(null);
      setCoverGenerationPreview(null);
    }
  };

  const runGenerateVideo = async () => {
    if (!selectedShot) {
      return;
    }

    setGeneratingVideoId(selectedShot.id);
    try {
      const result = await storyboardApi.generateStoryboardVideo(selectedShot.id, {
        model: selectedVideoModel,
      });
      const nextShot = result.storyboard;
      applyStoryboardUpdate(nextShot);
      await loadMediaGenerations(nextShot.id);
      if (nextShot.video_status === "generating") {
        pollStoryboardVideo(nextShot.id);
      } else {
        setGeneratingVideoId(null);
      }
    } catch (error) {
      console.error("Failed to generate storyboard video:", error);
      setGeneratingVideoId(null);
    }
  };

  const handleGenerateCover = async () => {
    if (!selectedShot || generatingCoverId === selectedShot.id || isLoadingCoverPreview) {
      return;
    }

    setIsLoadingCoverPreview(true);
    try {
      const preview = await storyboardApi.getStoryboardCoverGenerationPreview(selectedShot.id);
      setCoverGenerationPreview(preview);
      setIsCoverConfirmOpen(true);
    } catch (error) {
      console.error("Failed to preview storyboard cover generation:", error);
    } finally {
      setIsLoadingCoverPreview(false);
    }
  };

  const confirmGenerateCover = async (useTextOnly = false) => {
    setIsCoverConfirmOpen(false);
    await runGenerateCover(useTextOnly);
  };

  const handleGoToAssetsForReferences = () => {
    setIsCoverConfirmOpen(false);
    if (!selectedProject) {
      return;
    }
    navigate(`/assets?project=${selectedProject.id}`);
  };

  const handleGenerateVideo = () => {
    if (!selectedShot || generatingVideoId === selectedShot.id) {
      return;
    }
    setIsVideoConfirmOpen(true);
  };

  const confirmGenerateVideo = async () => {
    setIsVideoConfirmOpen(false);
    await runGenerateVideo();
  };
  const handleGenerateSceneCover = () => {
    if (!selectedScene || isGeneratingSceneCover) {
      return;
    }
    setIsSceneCoverConfirmOpen(true);
  };

  const runGenerateSceneCover = async () => {
    if (!selectedScene) {
      return;
    }

    setIsGeneratingSceneCover(true);
    try {
      const result = await sceneApi.generateSceneCover(selectedScene.id);
      applySceneUpdate(result.scene);
      toast.success("场景封面生成完成");
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

  const handleBatchGenerateSceneCovers = () => {
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
        toast.success(`已为 ${result.generated_count} 个镜头生成封面`);
      }
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} 个镜头封面生成失败`);
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

  const handleComposeSceneVideo = () => {
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
      toast.success("场景视频合成完成");
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
    const actionKey = `set-current:${generation.id}`;
    setActiveMediaActionKey(actionKey);
    try {
      const result = await storyboardApi.setStoryboardMediaGenerationCurrent(selectedShot.id, generation.id);
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

  const handleRequestDeleteScene = (scene: Scene) => {
    setDeleteTargetScene(scene);
  };

  const handleRequestDeleteShot = (shot: Storyboard) => {
    setDeleteTargetShot(shot);
  };

  const confirmDeleteShot = async () => {
    if (!deleteTargetShot || !selectedScene) {
      return;
    }

    const sceneShots = storyboards.filter((shot) => shot.scene_id === selectedScene.id);
    const deleteIndex = sceneShots.findIndex((shot) => shot.id === deleteTargetShot.id);
    const fallbackShot = deleteIndex >= 0
      ? sceneShots[deleteIndex + 1] || sceneShots[deleteIndex - 1] || null
      : null;

    try {
      await storyboardApi.deleteStoryboard(deleteTargetShot.id);
      setDeleteTargetShot(null);
      setStoryboards((prev) => prev.filter((shot) => shot.id !== deleteTargetShot.id));

      if (selectedShot?.id === deleteTargetShot.id) {
        setSelectedShot(fallbackShot);
        if (fallbackShot) {
          await loadMediaGenerations(fallbackShot.id);
        } else {
          setMediaGenerations([]);
        }
      }
    } catch (error) {
      console.error("Failed to delete storyboard:", error);
    }
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
      const result = await storyboardApi.deleteStoryboardMediaGeneration(selectedShot.id, deleteTargetGeneration.id);
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

  const updateNewSceneForm = <K extends keyof typeof emptySceneForm>(key: K, value: (typeof emptySceneForm)[K]) => {
    setNewSceneForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetNewSceneForm = () => {
    setNewSceneForm(emptySceneForm);
  };

  const handleCreateScene = async () => {
    if (!selectedChapter || !newSceneForm.title.trim()) {
      return;
    }

    setIsCreatingScene(true);
    try {
      const scene = await sceneApi.createScene(selectedChapter.id, {
        title: newSceneForm.title.trim(),
        description: newSceneForm.description.trim(),
        location: newSceneForm.location.trim(),
        time_of_day: newSceneForm.time_of_day.trim(),
      });

      await loadScenes(selectedChapter.id);
      setSelectedScene(scene);
      await loadStoryboards(scene.id);
      setIsCreateSceneOpen(false);
      resetNewSceneForm();
    } catch (error) {
      console.error("Failed to create scene:", error);
    } finally {
      setIsCreatingScene(false);
    }
  };

  const handleInsertShot = async () => {
    if (!selectedScene) {
      return;
    }

    setIsCreatingShot(true);
    try {
      const storyboard = await storyboardApi.createStoryboard(selectedScene.id, {
        content: "新镜头",
        duration: 5,
        camera_direction: "平视",
        background: selectedScene.title || "",
      });

      await loadStoryboards(selectedScene.id);
      setSelectedShot(storyboard);
    } catch (error) {
      console.error("Failed to create storyboard:", error);
    } finally {
      setIsCreatingShot(false);
    }
  };

  const handleSaveShot = async () => {
    if (!selectedShot) {
      return;
    }

    setIsSavingShot(true);
    try {
      const nextShot = await storyboardApi.updateStoryboard(selectedShot.id, {
        content: shotForm.content,
        dialogue: shotForm.dialogue,
        shot_type: shotForm.shot_type,
        mood: shotForm.mood,
        camera_direction: shotForm.camera_direction,
        camera_motion: shotForm.camera_motion,
        notes: shotForm.notes,
      });
      applyStoryboardUpdate(nextShot);
    } catch (error) {
      console.error("Failed to save storyboard:", error);
    } finally {
      setIsSavingShot(false);
    }
  };

  const coverGenerations = mediaGenerations.filter((item) => item.media_type === "cover");
  const videoGenerations = mediaGenerations.filter((item) => item.media_type === "video");

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
  }, [selectedShot?.id, selectedShot?.video_status]);

  return (
    <div className="dark h-screen flex flex-col bg-[#0a0a0a] text-gray-100">
      <header className="border-b border-gray-800 bg-[#111111] flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate("/")}
              className="h-8 text-gray-400 hover:text-gray-200"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              项目列表
            </Button>

            <div className="h-6 w-px bg-gray-700"></div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-600 rounded flex items-center justify-center">
                <Film className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm">
                {selectedProject
                  ? `《${selectedProject.name}》分镜工作台`
                  : "漫剧分镜工作台"}
              </span>
            </div>

            <div className="h-6 w-px bg-gray-700"></div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-gray-400 hover:text-gray-200"
                onClick={handleComposeProjectVideo}
                disabled={!selectedProject || isComposingProjectVideo}
              >
                {isComposingProjectVideo ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    合成中...
                  </>
                ) : (
                  <>
                    <Film className="w-4 h-4 mr-1.5" />
                    生成总片
                  </>
                )}
              </Button>
              {selectedProject && getProjectVideoPreviewSrc(selectedProject) ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-gray-400 hover:text-gray-200"
                  onClick={() =>
                    setPreviewProjectVideo({
                      src: getProjectVideoPreviewSrc(selectedProject),
                      originalSrc: selectedProject.video_url || undefined,
                      title: `《${selectedProject.name}》项目总片`,
                    })
                  }
                >
                  <Play className="w-4 h-4 mr-1.5" />
                  播放总片
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-gray-400 hover:text-gray-200"
              >
                <Save className="w-4 h-4 mr-1.5" />
                保存
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-gray-400 hover:text-gray-200"
                onClick={() =>
                  navigate(
                    selectedProject
                      ? `/assets?project=${selectedProject.id}`
                      : "/assets",
                  )
                }
              >
                <Package className="w-4 h-4 mr-1.5" />
                资产库
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-gray-400 hover:text-gray-200"
              >
                <Download className="w-4 h-4 mr-1.5" />
                导出
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500">
              共 {filteredShots.length} 个镜头 · 预计时长 {calculateTotalDuration().toFixed(1)}s
            </div>
            <Button
              size="sm"
              className="h-8 bg-purple-600 hover:bg-purple-700"
              onClick={() => {
                setIsGenerating(true);
                setTimeout(() => setIsGenerating(false), 2000);
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  AI 优化
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {isLeftSidebarOpen && (
          <aside
            ref={leftSidebarRef}
            style={{ width: leftSidebarWidth }}
            className="border-r border-gray-800 bg-[#0f0f0f] flex flex-col flex-shrink-0 relative"
          >
          <div className="p-3 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400">章节场景</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsLeftSidebarOpen(false)}
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-200"
              >
                <PanelLeftClose className="w-4 h-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="搜索场景..."
                className="pl-9 h-8 bg-[#1a1a1a] border-gray-700 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin opacity-30" />
                <p className="text-sm">加载中...</p>
              </div>
            ) : !selectedProject ? (
              <div className="p-8 text-center text-gray-500">
                <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">请选择一个项目</p>
                <p className="text-xs mt-1">回到项目列表进入工作台</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {chapters.map((chapter) => (
                  <div key={chapter.id}>
                    <button
                      onClick={() => toggleChapter(chapter.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-[#1a1a1a] rounded"
                    >
                      {expandedChapters.includes(chapter.id) ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <Film className="w-4 h-4 text-purple-400" />
                      <span className="flex-1 text-left truncate">{chapter.title}</span>
                    </button>

                    {expandedChapters.includes(chapter.id) && (
                      <div className="ml-6 mt-1 space-y-0.5">
                        {scenes
                          .filter((s) => s.chapter_id === chapter.id)
                          .map((scene) => (
                            <div
                              key={scene.id}
                              className={`w-full flex items-center gap-1 px-1 py-0.5 text-sm rounded ${
                                selectedScene?.id === scene.id
                                  ? "bg-purple-600/20 text-purple-300"
                                  : "text-gray-300 hover:bg-[#1a1a1a]"
                              }`}
                            >
                              <button
                                onClick={() => selectScene(scene)}
                                className="flex-1 flex items-center gap-2 px-1 py-1 text-sm rounded text-left min-w-0"
                              >
                                {getScenePreviewSrc(scene) ? (
                                  <img
                                    src={getScenePreviewSrc(scene)}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    className="h-8 w-10 rounded border border-gray-700 object-cover bg-[#171717]"
                                  />
                                ) : (
                                  <div className="flex h-8 w-10 items-center justify-center rounded border border-gray-800 bg-[#171717]">
                                    <Camera className="w-3.5 h-3.5 text-gray-500" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="truncate">{scene.title}</div>
                                  {(scene.location || scene.time_of_day) ? (
                                    <div className="truncate text-[11px] text-gray-500">
                                      {[scene.location, scene.time_of_day].filter(Boolean).join(" · ")}
                                    </div>
                                  ) : null}
                                </div>
                              </button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleRequestDeleteScene(scene);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-800 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 border-gray-700 text-gray-400"
              onClick={() => setIsCreateSceneOpen(true)}
              disabled={!selectedChapter}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              新建场景
            </Button>
          </div>

          </aside>
        )}

        {isLeftSidebarOpen && (
          <div
            className={`resize-handle resize-handle-right relative flex-shrink-0 w-3 z-20 ${isResizingLeft ? "dragging" : ""}`}
            onMouseDown={handleLeftMouseDown}
          />
        )}

        {!isLeftSidebarOpen && (
          <div className="flex-shrink-0 w-12 border-r border-gray-800 bg-[#0f0f0f] flex flex-col items-center py-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsLeftSidebarOpen(true)}
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-200 mb-2"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </Button>
            <div className="flex-1" />
          </div>
        )}

        {/* Center: Shot Cards */}
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="p-4 border-b border-gray-800 bg-[#0f0f0f] flex-shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {selectedScene ? (
                  <button
                    type="button"
                    className="h-12 w-20 overflow-hidden rounded border border-gray-800 bg-[#171717]"
                    onClick={() => selectedScene.cover_url && setPreviewImage({ src: selectedScene.cover_url, alt: `${selectedScene.title} 场景封面` })}
                    disabled={!selectedScene.cover_url}
                  >
                    {getScenePreviewSrc(selectedScene) ? (
                      <img
                        src={getScenePreviewSrc(selectedScene)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-gray-600" />
                      </div>
                    )}
                  </button>
                ) : null}
                <div className="min-w-0">
                  <h3 className="text-sm">
                    {selectedScene
                      ? `${selectedChapter?.title} · ${selectedScene.title}`
                      : "请选择一个场景"}
                  </h3>
                  {selectedScene ? (
                    <p className="mt-1 truncate text-xs text-gray-500">
                      {[selectedScene.location, selectedScene.time_of_day].filter(Boolean).join(" · ") || selectedScene.description || "当前场景还没有补充描述"}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-gray-700 text-gray-300"
                  onClick={handleGenerateSceneCover}
                  disabled={!selectedScene || isGeneratingSceneCover}
                >
                  {isGeneratingSceneCover ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      正在生成
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      生成场景封面
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-gray-700 text-gray-300"
                  onClick={handleBatchGenerateSceneCovers}
                  disabled={!selectedScene || filteredShots.length === 0 || isBatchGeneratingSceneCover}
                >
                  {isBatchGeneratingSceneCover ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      正在生成
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      批量生成封面
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-gray-700 text-gray-300"
                  onClick={handleComposeSceneVideo}
                  disabled={!selectedScene || composableShots.length === 0 || isComposingSceneVideo}
                >
                  {isComposingSceneVideo ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      正在合成
                    </>
                  ) : (
                    <>
                      <Film className="w-3.5 h-3.5 mr-1.5" />
                      生成场景视频
                    </>
                  )}
                </Button>
                {selectedScene && getSceneVideoPreviewSrc(selectedScene) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-purple-300 hover:text-purple-200"
                    onClick={() =>
                      setPreviewSceneVideo({
                        src: getSceneVideoPreviewSrc(selectedScene),
                        originalSrc: selectedScene.video_url || undefined,
                        title: `${selectedScene.title} 场景视频`,
                      })
                    }
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5" />
                    播放场景视频
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-gray-400"
                  onClick={handleInsertShot}
                  disabled={!selectedScene || isCreatingShot}
                >
                  {isCreatingShot ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 mr-1" />
                  )}
                  插入镜头
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="grid grid-cols-2 gap-4 pb-4">
              {filteredShots.map((shot) => (
                <button
                  key={shot.id}
                  onClick={() => setSelectedShot(shot)}
                  className={`text-left bg-[#141414] border rounded-lg overflow-hidden transition-all ${
                    selectedShot?.id === shot.id
                      ? "border-purple-500 shadow-lg shadow-purple-500/20"
                      : "border-gray-800 hover:border-gray-700"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      {shot.thumbnail_url ? (
                        <img
                          src={getStoryboardPreviewSrc(shot)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className={`w-full h-full object-cover transition-opacity ${pendingGeneratedShotId === shot.id ? "opacity-40" : "opacity-100"}`}
                        />
                      ) : (
                        <ImageIcon className="w-12 h-12 text-gray-700" />
                      )}
                      {pendingGeneratedShotId === shot.id ? (
                        <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                          <span className="text-xs text-white/90">正在生成新封面...</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded text-xs font-mono tracking-[0.2em]">
                      {formatShotNumber(shot.shot_number)}
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Badge className="bg-purple-600/90 text-white text-xs px-1.5 py-0">
                        {deriveShotType(shot)}
                      </Badge>
                    </div>
                    {shot.duration > 0 && (
                      <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {shot.duration}s
                      </div>
                    )}
                    {shot.video_url ? (
                      <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 rounded text-xs flex items-center gap-1 text-purple-200">
                        <Play className="w-3 h-3 fill-current" />
                        视频
                      </div>
                    ) : null}
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                        {selectedScene?.title}
                      </Badge>
                      {shot.background ? (
                        <Badge variant="outline" className="text-xs border-blue-800 text-blue-300">
                          {shot.background}
                        </Badge>
                      ) : null}
                    </div>

                    <p className="text-xs text-gray-400 line-clamp-2">
                      {shot.content}
                    </p>

                    {shot.notes && (
                      <div className="flex items-start gap-1.5 text-xs text-gray-500">
                        <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <p className="line-clamp-1">{shot.notes}</p>
                      </div>
                    )}

                    {deriveEmotion(shot) ? (
                      <div className="flex items-center gap-1">
                        <Badge className="text-xs bg-pink-600/20 text-pink-300 border-0">
                          {deriveEmotion(shot)}
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>

            {filteredShots.length === 0 && selectedScene && (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">暂无镜头</p>
                  <p className="text-xs mt-1">点击上方按钮添加新镜头</p>
                </div>
              </div>
            )}
          </div>
        </main>

        {isRightSidebarOpen && (
          <div
            className={`resize-handle resize-handle-left relative flex-shrink-0 w-3 z-20 ${isResizingRight ? "dragging" : ""}`}
            onMouseDown={handleRightMouseDown}
          />
        )}

        {isRightSidebarOpen && (
          <aside
            ref={rightSidebarRef}
            style={{ width: rightSidebarWidth }}
            className="border-l border-gray-800 bg-[#0f0f0f] flex flex-col flex-shrink-0 relative"
          >
          {selectedShot ? (
            <>
              <div className="p-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
                <h3 className="text-sm">镜头详情</h3>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-[#1f1f1f] hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40">
                      <MoreHorizontal className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#111111] border-gray-800 text-gray-100">
                      <DropdownMenuItem
                        variant="destructive"
                        className="cursor-pointer focus:bg-red-500/10 focus:text-red-300"
                        onClick={() => handleRequestDeleteShot(selectedShot)}
                      >
                        <Trash2 className="w-4 h-4" />
                        删除镜头
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsRightSidebarOpen(false)}
                    className="h-7 w-7 p-0 text-gray-400 hover:text-gray-200"
                  >
                    <PanelRightClose className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                <div className="space-y-4">
                  {/* Shot Number */}
                  <div>
                    <Label className="text-xs text-gray-400">镜头编号</Label>
                    <Input
                      value={selectedShot.shot_number}
                      className="mt-1.5 bg-[#1a1a1a] border-gray-700 font-mono"
                      readOnly
                    />
                  </div>

                  {/* Preview */}
                  <div>
                    <Label className="text-xs text-gray-400">预览图</Label>
                    <div className="mt-1.5 aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded border border-gray-700 flex items-center justify-center overflow-hidden">
                      {selectedShot.thumbnail_url && generatingCoverId !== selectedShot.id ? (
                        <button
                          type="button"
                          className="w-full h-full"
                          onClick={() =>
                            setPreviewImage({
                              src: selectedShot.thumbnail_url!,
                              alt: `镜头 ${selectedShot.shot_number} 预览图`,
                            })
                          }
                        >
                          <img
                            src={getStoryboardPreviewSrc(selectedShot)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover rounded"
                          />
                        </button>
                      ) : generatingCoverId === selectedShot.id ? (
                        <div className="w-full h-full rounded flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-gray-900 to-gray-800">
                          <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
                          <span className="text-xs text-gray-300">正在生成新封面...</span>
                        </div>
                      ) : (
                        <ImageIcon className="w-16 h-16 text-gray-700" />
                      )}
                    </div>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-10 rounded-md border border-gray-700 bg-[#1a1a1a] px-3 text-sm text-gray-300 flex items-center">
                          自动选择模型（参考图优先）
                        </div>
                        <Button
                          type="button"
                          onClick={handleGenerateCover}
                          disabled={generatingCoverId === selectedShot.id || isLoadingCoverPreview}
                          className="bg-[#1a1a1a] hover:bg-[#202020] border border-gray-700 text-gray-100 shrink-0"
                        >
                          {generatingCoverId === selectedShot.id || isLoadingCoverPreview ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {isLoadingCoverPreview ? "分析中" : "正在生成"}
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              生成封面
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={selectedVideoModel} onValueChange={(value) => setSelectedVideoModel(value as typeof selectedVideoModel)}>
                          <SelectTrigger className="flex-1 bg-[#1a1a1a] border-gray-700 h-10 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1a1a] border-gray-700">
                            {VIDEO_MODEL_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          onClick={handleGenerateVideo}
                          disabled={generatingVideoId === selectedShot.id}
                          className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                        >
                          {generatingVideoId === selectedShot.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              正在生成
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              生成视频
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    {selectedShot.video_status === "failed" && selectedShot.video_error ? (
                      <p className="mt-2 text-xs text-red-400 leading-5">{selectedShot.video_error}</p>
                    ) : null}
                    {selectedShot.video_status === "generating" ? (
                      <div className="mt-3 rounded border border-gray-700 bg-[#121212] p-4">
                        <div className="flex flex-col items-center justify-center gap-3 text-center">
                          <Loader2 className="w-6 h-6 text-purple-300 animate-spin" />
                          <div>
                            <p className="text-sm text-gray-200">正在生成新视频...</p>
                            <p className="text-xs text-gray-500 mt-1">生成完成后会自动刷新预览</p>
                          </div>
                        </div>
                      </div>
                    ) : selectedShot.video_url ? (
                      <div className="mt-3 rounded border border-gray-700 bg-[#121212] p-2">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs text-gray-400">视频预览</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">{(selectedShot.video_duration || selectedShot.duration) ? `${selectedShot.video_duration || selectedShot.duration}s` : "-"}</span>
                            <button
                              type="button"
                              className="text-xs text-purple-300 hover:text-purple-200"
                              onClick={() => window.open(selectedShot.video_url, "_blank", "noopener,noreferrer")}
                            >
                              打开原视频
                            </button>
                          </div>
                        </div>
                        <video
                          key={getStoryboardVideoPreviewSrc(selectedShot)}
                          src={getStoryboardVideoPreviewSrc(selectedShot)}
                          controls
                          preload="metadata"
                          poster={selectedShot.thumbnail_preview_url || selectedShot.thumbnail_url || undefined}
                          className="w-full rounded bg-black"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-gray-800 bg-[#121212] p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-300">封面历史</p>
                        <p className="text-[11px] text-gray-500">新生成的封面会自动成为当前版本</p>
                      </div>
                      <Badge variant="outline" className="border-gray-700 text-gray-400">{coverGenerations.length}</Badge>
                    </div>
                    {coverGenerations.length > 0 ? (
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {coverGenerations.map((generation) => (
                          <div key={generation.id} className="rounded-md border border-gray-800 bg-[#161616] p-2">
                            <div className="flex gap-3">
                              <button
                                type="button"
                                className="w-20 h-12 shrink-0 overflow-hidden rounded border border-gray-800 bg-[#0f0f0f]"
                                onClick={() => generation.result_url && setPreviewImage({ src: generation.result_url, alt: `封面历史 ${generation.id}` })}
                                disabled={!generation.result_url}
                              >
                                {getGenerationPreviewSrc(generation) ? (
                                  <img
                                    src={getGenerationPreviewSrc(generation)}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <ImageIcon className="w-4 h-4 text-gray-600" />
                                  </div>
                                )}
                              </button>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-gray-200">{generation.model}</span>
                                  {generation.is_current ? (
                                    <Badge className="bg-purple-600 text-white text-[10px]">当前</Badge>
                                  ) : null}
                                  <Badge variant="outline" className="border-gray-700 text-gray-400 text-[10px]">{generation.status}</Badge>
                                </div>
                                <p className="text-[11px] text-gray-500">{formatShanghaiDateTime(generation.created_at)}</p>
                                {generation.error_message ? (
                                  <p className="text-[11px] leading-5 text-red-400 line-clamp-2">{generation.error_message}</p>
                                ) : null}
                                <div className="flex items-center gap-2 pt-1">
                                  {!generation.is_current && generation.status === "succeeded" ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-6 border-gray-700 px-2 text-[11px] text-gray-300"
                                      disabled={activeMediaActionKey === `set-current:${generation.id}`}
                                      onClick={() => handleSetCurrentGeneration(generation)}
                                    >
                                      {activeMediaActionKey === `set-current:${generation.id}` ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        "设为当前"
                                      )}
                                    </Button>
                                  ) : null}
                                  {generation.status !== "generating" ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-[11px] text-red-300 hover:bg-red-500/10 hover:text-red-200"
                                      disabled={activeMediaActionKey === `delete:${generation.id}`}
                                      onClick={() => handleRequestDeleteGeneration(generation)}
                                    >
                                      删除
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">当前镜头还没有封面历史记录</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-800 bg-[#121212] p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-300">视频历史</p>
                        <p className="text-[11px] text-gray-500">多次生成会保留全部历史，不覆盖旧结果</p>
                      </div>
                      <Badge variant="outline" className="border-gray-700 text-gray-400">{videoGenerations.length}</Badge>
                    </div>
                    {videoGenerations.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {videoGenerations.map((generation) => (
                          <div key={generation.id} className="rounded-md border border-gray-800 bg-[#161616] p-2 space-y-2">
                            <div className="flex gap-3">
                              <div className="w-20 h-12 shrink-0 overflow-hidden rounded border border-gray-800 bg-[#0f0f0f]">
                                {generation.preview_url || generation.result_url ? (
                                  <video
                                    src={generation.preview_url || generation.result_url}
                                    muted
                                    playsInline
                                    preload="metadata"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Play className="w-4 h-4 text-gray-600" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-gray-200">{generation.model}</span>
                                  {generation.is_current ? (
                                    <Badge className="bg-purple-600 text-white text-[10px]">当前</Badge>
                                  ) : null}
                                  <Badge variant="outline" className="border-gray-700 text-gray-400 text-[10px]">{generation.status}</Badge>
                                </div>
                                <p className="text-[11px] text-gray-500">{formatShanghaiDateTime(generation.created_at)}</p>
                                {generation.error_message ? (
                                  <p className="text-[11px] leading-5 text-red-400 line-clamp-2">{generation.error_message}</p>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              {!generation.is_current && generation.status === "succeeded" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 border-gray-700 text-xs text-gray-300"
                                  disabled={activeMediaActionKey === `set-current:${generation.id}`}
                                  onClick={() => handleSetCurrentGeneration(generation)}
                                >
                                  {activeMediaActionKey === `set-current:${generation.id}` ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    "设为当前"
                                  )}
                                </Button>
                              ) : null}
                              {generation.status !== "generating" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-red-300 hover:bg-red-500/10 hover:text-red-200"
                                  disabled={activeMediaActionKey === `delete:${generation.id}`}
                                  onClick={() => handleRequestDeleteGeneration(generation)}
                                >
                                  删除
                                </Button>
                              ) : null}
                              {generation.status === "succeeded" && generation.result_url ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 border-gray-700 text-xs text-gray-300"
                                  onClick={() => window.open(generation.result_url, "_blank", "noopener,noreferrer")}
                                >
                                  打开视频
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">当前镜头还没有视频历史记录</p>
                    )}
                  </div>

                  {/* Scene */}
                  <div>
                    <Label className="text-xs text-gray-400">所属场景</Label>
                    <Input
                      value={selectedScene?.title || ""}
                      className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                      readOnly
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-gray-400">角色</Label>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {deriveCharacterNames(selectedShot).length > 0 ? (
                        deriveCharacterNames(selectedShot).map((name) => (
                          <Badge key={name} variant="outline" className="border-purple-700 text-purple-300">
                            {name}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="border-gray-700 text-gray-500">
                          待关联
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs border-gray-700 text-gray-400"
                        onClick={() =>
                          navigate(
                            selectedProject
                              ? `/assets?project=${selectedProject.id}`
                              : "/assets",
                          )
                        }
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        管理角色
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-400">背景场景</Label>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {selectedShot.background ? (
                        <Badge variant="outline" className="border-blue-700 text-blue-300">
                          {selectedShot.background}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-gray-700 text-gray-500">
                          未生成
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <Label className="text-xs text-gray-400">画面描述</Label>
                    <Textarea
                      value={shotForm.content}
                      className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[100px]"
                      onChange={(e) => updateShotForm("content", e.target.value)}
                    />
                  </div>

                  {/* Dialogue */}
                  <div>
                    <Label className="text-xs text-gray-400">台词</Label>
                    <Textarea
                      value={shotForm.dialogue}
                      placeholder="无台词"
                      className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[60px]"
                      onChange={(e) => updateShotForm("dialogue", e.target.value)}
                    />
                  </div>

                  {/* Shot Type & Camera Angle */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-400">景别</Label>
                      <Select value={shotForm.shot_type} onValueChange={(value) => updateShotForm("shot_type", value)}>
                        <SelectTrigger className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9 text-sm">
                          <SelectValue placeholder="选择景别" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-gray-700">
                          {SHOT_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs text-gray-400">机位</Label>
                      <Select value={shotForm.camera_direction} onValueChange={(value) => updateShotForm("camera_direction", value)}>
                        <SelectTrigger className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9 text-sm">
                          <SelectValue placeholder="选择机位" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-gray-700">
                          {CAMERA_DIRECTION_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-400">镜头运动</Label>
                      <Select value={shotForm.camera_motion} onValueChange={(value) => updateShotForm("camera_motion", value)}>
                        <SelectTrigger className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9 text-sm">
                          <SelectValue placeholder="选择镜头运动" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-gray-700">
                          {CAMERA_MOTION_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs text-gray-400">情绪</Label>
                      <Select value={shotForm.mood} onValueChange={(value) => updateShotForm("mood", value)}>
                        <SelectTrigger className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9 text-sm">
                          <SelectValue placeholder="选择情绪" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-gray-700">
                          {MOOD_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-400">时长（秒）</Label>
                      <Input
                        value={selectedShot.video_duration || selectedShot.duration || ""}
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9"
                        readOnly
                      />
                    </div>

                    <div></div>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label className="text-xs text-gray-400">备注（补充细节）</Label>
                    <Textarea
                      value={shotForm.notes}
                      placeholder="添加备注..."
                      className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[60px]"
                      onChange={(e) => updateShotForm("notes", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-800 flex gap-2">
                <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={handleSaveShot} disabled={isSavingShot}>
                  {isSavingShot ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "保存修改"
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex h-9 items-center justify-center rounded-md border border-gray-700 bg-[#1a1a1a] px-3 text-gray-100 transition-colors hover:bg-[#262626] hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40">
                    <MoreHorizontal className="w-4 h-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#111111] border-gray-800 text-gray-100">
                    <DropdownMenuItem
                      variant="destructive"
                      className="cursor-pointer focus:bg-red-500/10 focus:text-red-300"
                      onClick={() => handleRequestDeleteShot(selectedShot)}
                    >
                      <Trash2 className="w-4 h-4" />
                      删除镜头
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">请选择一个镜头</p>
              </div>
            </div>
          )}
          </aside>
        )}

        {!isRightSidebarOpen && (
          <div className="flex-shrink-0 w-12 border-l border-gray-800 bg-[#0f0f0f] flex flex-col items-center py-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsRightSidebarOpen(true)}
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-200 mb-2"
            >
              <PanelRightOpen className="w-4 h-4" />
            </Button>
            <div className="flex-1" />
          </div>
        )}
      </div>
      <Dialog
        open={isCreateSceneOpen}
        onOpenChange={(open) => {
          setIsCreateSceneOpen(open);
          if (!open) {
            resetNewSceneForm();
          }
        }}
      >
        <DialogContent className="bg-[#111111] border-gray-800 text-gray-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建场景</DialogTitle>
            <DialogDescription className="text-gray-400">
              在当前章节下创建一个新场景，创建后会自动切换到该场景。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-400">场景标题</Label>
              <Input
                value={newSceneForm.title}
                onChange={(e) => updateNewSceneForm("title", e.target.value)}
                className="mt-1.5 bg-[#1a1a1a] border-gray-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-400">地点</Label>
                <Input
                  value={newSceneForm.location}
                  onChange={(e) => updateNewSceneForm("location", e.target.value)}
                  className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-400">时间</Label>
                <Input
                  value={newSceneForm.time_of_day}
                  onChange={(e) => updateNewSceneForm("time_of_day", e.target.value)}
                  className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-400">描述</Label>
              <Textarea
                value={newSceneForm.description}
                onChange={(e) => updateNewSceneForm("description", e.target.value)}
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
                resetNewSceneForm();
              }}
            >
              取消
            </Button>
            <Button
              type="button"
              className="bg-purple-600 hover:bg-purple-700 text-white"
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
            <DialogTitle>确认生成封面</DialogTitle>
            <DialogDescription className="text-gray-400 leading-6">
              会为当前镜头调用图像模型生成 1 张新封面，并消耗模型额度。弹窗展示的是本次将实际传给大模型的参数。
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="grid gap-3 rounded-md border border-gray-800 bg-[#161616] p-3 text-sm md:grid-cols-2">
              <div className="flex justify-between gap-4"><span className="text-gray-500">镜头编号</span><span>{selectedShot ? formatShotNumber(selectedShot.shot_number) : "-"}</span></div>
              <div className="flex justify-between gap-4"><span className="text-gray-500">生成模式</span><span>{coverGenerationPreview?.mode === "reference" ? "参考图生成" : "纯文本生成"}</span></div>
              <div className="flex justify-between gap-4 md:col-span-2"><span className="text-gray-500">实际模型</span><span>{coverGenerationPreview?.model || "-"}</span></div>
            </div>

            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-2">
              <div className="text-gray-300 font-medium">参考图</div>
              {coverGenerationPreview?.reference_images?.length ? (
                <div className="space-y-2">
                  {coverGenerationPreview.reference_images.map((reference, index) => (
                    <div key={`${reference.type}-${reference.name}-${index}`} className="rounded border border-gray-800 bg-[#111111] p-2 text-xs space-y-1 break-all">
                      <div className="flex justify-between gap-4"><span className="text-gray-500">类型</span><span>{reference.type}</span></div>
                      <div className="flex justify-between gap-4"><span className="text-gray-500">名称</span><span>{reference.name || "-"}</span></div>
                      <div className="flex justify-between gap-4"><span className="text-gray-500">来源字段</span><span>{reference.source}</span></div>
                      <div>
                        <div className="text-gray-500 mb-1">URL</div>
                        <div className="text-gray-300 break-all">{reference.url}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-amber-300">当前镜头没有任何可用参考图。</div>
              )}
              {!!coverGenerationPreview?.missing_references?.length && (
                <div>
                  <div className="text-gray-500 mb-1">缺失参考图</div>
                  <div className="text-gray-300 text-xs break-words">{coverGenerationPreview.missing_references.join("、")}</div>
                </div>
              )}
            </div>

            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-2">
              <div className="text-gray-300 font-medium">结构化字段</div>
              <div className="grid gap-2 md:grid-cols-2 text-xs">
                <div><span className="text-gray-500">场景标题：</span><span>{coverGenerationPreview?.fields.scene_title || "-"}</span></div>
                <div><span className="text-gray-500">地点：</span><span>{coverGenerationPreview?.fields.location || "-"}</span></div>
                <div><span className="text-gray-500">时间：</span><span>{coverGenerationPreview?.fields.time_of_day || "-"}</span></div>
                <div><span className="text-gray-500">背景场景：</span><span>{coverGenerationPreview?.fields.background || "-"}</span></div>
                <div className="md:col-span-2"><span className="text-gray-500">角色：</span><span>{coverGenerationPreview?.fields.characters?.join("、") || "-"}</span></div>
                <div><span className="text-gray-500">景别：</span><span>{coverGenerationPreview?.fields.shot_type || "-"}</span></div>
                <div><span className="text-gray-500">机位：</span><span>{coverGenerationPreview?.fields.camera_direction || "-"}</span></div>
                <div className="md:col-span-2"><span className="text-gray-500">画面描述：</span><span>{coverGenerationPreview?.fields.content || "-"}</span></div>
                <div><span className="text-gray-500">情绪：</span><span>{coverGenerationPreview?.fields.mood || "-"}</span></div>
                <div><span className="text-gray-500">台词：</span><span>{coverGenerationPreview?.fields.dialogue || "-"}</span></div>
                <div className="md:col-span-2"><span className="text-gray-500">备注：</span><span>{coverGenerationPreview?.fields.notes || "-"}</span></div>
              </div>
            </div>

            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-2">
              <div className="text-gray-300 font-medium">最终 Prompt</div>
              <pre className="whitespace-pre-wrap break-words rounded border border-gray-800 bg-[#111111] p-3 text-xs text-gray-300 leading-6">{coverGenerationPreview?.final_prompt || "-"}</pre>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setIsCoverConfirmOpen(false)}>取消</Button>
            {coverGenerationPreview?.reference_images?.length ? (
              <Button type="button" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => void confirmGenerateCover(false)}>确认生成</Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={handleGoToAssetsForReferences}>去资产库补参考图</Button>
                <Button type="button" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => void confirmGenerateCover(true)}>继续用纯文本生成</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isSceneCoverConfirmOpen} onOpenChange={setIsSceneCoverConfirmOpen}>
        <AlertDialogContent className="bg-[#111111] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>确认生成场景封面</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 leading-6">
              会为当前场景生成 1 张场景级代表封面，并消耗图像模型额度。该封面用于场景树和当前场景头部预览。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
            <div className="flex justify-between gap-4"><span className="text-gray-500">场景标题</span><span>{selectedScene?.title || "-"}</span></div>
            <div className="flex justify-between gap-4"><span className="text-gray-500">当前模型</span><span>{selectedCoverModel}</span></div>
            <div className="flex justify-between gap-4"><span className="text-gray-500">输出</span><span>1 张场景封面</span></div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-purple-600 hover:bg-purple-700 text-white" onClick={confirmGenerateSceneCover}>确认生成</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBatchSceneCoverConfirmOpen} onOpenChange={setIsBatchSceneCoverConfirmOpen}>
        <AlertDialogContent className="bg-[#111111] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量生成封面</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 leading-6">
              会为当前场景下的全部镜头串行生成新封面，并消耗图像模型额度。新结果会保留到各自镜头的封面历史中。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
            <div className="flex justify-between gap-4"><span className="text-gray-500">场景标题</span><span>{selectedScene?.title || "-"}</span></div>
            <div className="flex justify-between gap-4"><span className="text-gray-500">镜头数量</span><span>{filteredShots.length}</span></div>
            <div className="flex justify-between gap-4"><span className="text-gray-500">当前模型</span><span>{selectedCoverModel}</span></div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-purple-600 hover:bg-purple-700 text-white" onClick={confirmBatchGenerateSceneCovers}>确认生成</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isSceneVideoConfirmOpen} onOpenChange={setIsSceneVideoConfirmOpen}>
        <AlertDialogContent className="bg-[#111111] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>确认生成场景视频</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 leading-6">
              会将当前场景下已有视频镜头按顺序合成为一个场景视频，并保留每个镜头原始音轨。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
            <div className="flex justify-between gap-4"><span className="text-gray-500">场景标题</span><span>{selectedScene?.title || "-"}</span></div>
            <div className="flex justify-between gap-4"><span className="text-gray-500">可合成镜头数</span><span>{composableShots.length}</span></div>
            <div className="flex justify-between gap-4"><span className="text-gray-500">输出规格</span><span>720P / 保留原音轨</span></div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-purple-600 hover:bg-purple-700 text-white" onClick={confirmComposeSceneVideo}>
              确认合成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isProjectVideoConfirmOpen} onOpenChange={setIsProjectVideoConfirmOpen}>
        <AlertDialogContent className="bg-[#111111] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>确认生成项目总片</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 leading-6">
              会自动收集当前项目内已生成成功的场景视频，按章节和场景顺序合成为一个项目级粗剪视频。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
            <div className="flex justify-between gap-4"><span className="text-gray-500">项目名称</span><span>{selectedProject?.name || "-"}</span></div>
            <div className="flex justify-between gap-4"><span className="text-gray-500">输出规格</span><span>720P / 保留各场景原音轨</span></div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-purple-600 hover:bg-purple-700 text-white" onClick={confirmComposeProjectVideo}>
              确认合成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isVideoConfirmOpen} onOpenChange={setIsVideoConfirmOpen}>
        <AlertDialogContent className="bg-[#111111] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>确认生成视频</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 leading-6">
              会为当前镜头生成 720P、5 秒、有声视频，并消耗较高额度。新结果会保留到历史记录中，不会覆盖旧版本。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
            <div className="flex justify-between gap-4"><span className="text-gray-500">镜头编号</span><span>{selectedShot ? formatShotNumber(selectedShot.shot_number) : "-"}</span></div>
            <div className="flex justify-between gap-4"><span className="text-gray-500">当前模型</span><span>{selectedVideoModel}</span></div>
            <div className="flex justify-between gap-4"><span className="text-gray-500">时长</span><span>5 秒</span></div>
            <div className="flex justify-between gap-4"><span className="text-gray-500">输出规格</span><span>720P / 5秒 / 有声</span></div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-purple-600 hover:bg-purple-700 text-white" onClick={confirmGenerateVideo}>确认生成</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTargetShot}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTargetShot(null);
          }
        }}
      >
        <AlertDialogContent className="bg-[#111111] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除镜头</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 leading-6">
              该操作会删除当前镜头记录，并刷新当前场景的镜头列表。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">镜头编号</span>
              <span>{deleteTargetShot ? formatShotNumber(deleteTargetShot.shot_number) : '-'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">景别</span>
              <span>{deleteTargetShot ? deriveShotType(deleteTargetShot) : '-'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">描述</span>
              <span className="max-w-[240px] truncate text-right">{deleteTargetShot?.content || '-'}</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDeleteShot}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <span>{deleteTargetGeneration?.media_type === "video" ? "视频" : "封面"}</span>
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
            <AlertDialogCancel>
              取消
            </AlertDialogCancel>
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
            <AlertDialogTitle>确认删除场景</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 leading-6">
              该操作会删除当前场景及其镜头数据，需要二次确认。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-md border border-gray-800 bg-[#161616] p-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">场景标题</span>
              <span>{deleteTargetScene?.title || '-'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">地点</span>
              <span>{deleteTargetScene?.location || '-'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">时间</span>
              <span>{deleteTargetScene?.time_of_day || '-'}</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDeleteScene}>
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
        alt={previewImage?.alt || "镜头预览图"}
      />

      <Dialog
        open={!!previewSceneVideo}
        onOpenChange={(open) => {
          if (!open) setPreviewSceneVideo(null);
        }}
      >
        <DialogContent className="max-w-5xl border-gray-800 bg-[#111111] text-gray-100">
          <DialogHeader>
            <DialogTitle>{previewSceneVideo?.title || "场景视频预览"}</DialogTitle>
            <DialogDescription className="text-gray-400">
              默认播放预览版视频。需要查看原始输出时，可在下方打开原视频。
            </DialogDescription>
          </DialogHeader>
          {previewSceneVideo ? (
            <div className="space-y-4">
              <video
                key={previewSceneVideo.src}
                src={previewSceneVideo.src}
                controls
                preload="metadata"
                className="w-full rounded-lg bg-black"
              />
              <div className="flex justify-end">
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
        <DialogContent className="max-w-5xl border-gray-800 bg-[#111111] text-gray-100">
          <DialogHeader>
            <DialogTitle>{previewProjectVideo?.title || "项目总片预览"}</DialogTitle>
            <DialogDescription className="text-gray-400">
              默认播放预览版项目总片。需要查看原始输出时，可在下方打开原视频。
            </DialogDescription>
          </DialogHeader>
          {previewProjectVideo ? (
            <div className="space-y-4">
              <video
                key={previewProjectVideo.src}
                src={previewProjectVideo.src}
                controls
                preload="metadata"
                className="w-full rounded-lg bg-black"
              />
              <div className="flex justify-end">
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
