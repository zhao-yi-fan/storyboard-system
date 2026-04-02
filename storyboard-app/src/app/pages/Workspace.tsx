import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Film,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  MoreHorizontal,
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
  projectApi,
  chapterApi,
  sceneApi,
  storyboardApi,
  type Project,
  type Chapter,
  type Scene,
  type Storyboard,
} from "../api";

export default function Workspace() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [selectedShot, setSelectedShot] = useState<Storyboard | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<number[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingCoverId, setGeneratingCoverId] = useState<number | null>(null);
  const [pendingGeneratedShotId, setPendingGeneratedShotId] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(256);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(350);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const leftSidebarRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLDivElement>(null);

  const MIN_SIDEBAR_WIDTH = 220;
  const MAX_SIDEBAR_WIDTH = 500;

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

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

  const calculateTotalDuration = () => {
    return filteredShots.reduce((sum, shot) => sum + (shot.duration || 0), 0);
  };

  const formatShotNumber = (num?: number) => String(num ?? 0).padStart(3, "0");

  const deriveShotType = (shot: Storyboard) => {
    const text = `${shot.content || ""} ${shot.notes || ""}`;
    if (text.includes("特写")) return "特写";
    if (text.includes("中景")) return "中景";
    if (text.includes("近景")) return "近景";
    if (text.includes("远景")) return "远景";
    if (text.includes("全景")) return "全景";
    return "镜头";
  };

  const deriveEmotion = (shot: Storyboard) => {
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

  const handleGenerateCover = async () => {
    if (!selectedShot) {
      return;
    }

    setGeneratingCoverId(selectedShot.id);
    setPendingGeneratedShotId(selectedShot.id);
    try {
      const result = await storyboardApi.generateStoryboardCover(selectedShot.id);
      const nextShot = result.storyboard;
      setStoryboards((prev) =>
        prev.map((shot) => (shot.id === nextShot.id ? nextShot : shot)),
      );
      setSelectedShot(nextShot);
    } catch (error) {
      console.error("Failed to generate storyboard cover:", error);
    } finally {
      setGeneratingCoverId(null);
      setPendingGeneratedShotId(null);
    }
  };

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
                            <button
                              key={scene.id}
                              onClick={() => selectScene(scene)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded ${
                                selectedScene?.id === scene.id
                                  ? "bg-purple-600/20 text-purple-300"
                                  : "hover:bg-[#1a1a1a] text-gray-300"
                              }`}
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span className="flex-1 text-left truncate">{scene.title}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-800 flex-shrink-0">
            <Button size="sm" variant="outline" className="w-full h-8 border-gray-700 text-gray-400">
              <Plus className="w-4 h-4 mr-1.5" />
              新建场景
            </Button>
          </div>

            <div
              className={`resize-handle resize-handle-right absolute top-0 bottom-0 right-0 w-1 ${isResizingLeft ? "dragging" : ""}`}
              onMouseDown={handleLeftMouseDown}
            />
          </aside>
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
            <div className="flex items-center justify-between">
              <h3 className="text-sm">
                {selectedScene
                  ? `${selectedChapter?.title} · ${selectedScene.title}`
                  : "请选择一个场景"}
              </h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400">
                  <Plus className="w-3.5 h-3.5 mr-1" />
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
                          src={shot.thumbnail_url}
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
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
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
                            src={selectedShot.thumbnail_url}
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
                    <Button
                      type="button"
                      onClick={handleGenerateCover}
                      disabled={generatingCoverId === selectedShot.id}
                      className="mt-2 w-full bg-[#1a1a1a] hover:bg-[#202020] border border-gray-700 text-gray-100"
                    >
                      {generatingCoverId === selectedShot.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          正在生成封面...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          生成封面
                        </>
                      )}
                    </Button>
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
                      value={selectedShot.content}
                      className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[100px]"
                      readOnly
                    />
                  </div>

                  {/* Dialogue */}
                  <div>
                    <Label className="text-xs text-gray-400">台词</Label>
                    <Textarea
                      // TODO: store dialogue separately
                      placeholder="无台词"
                      className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[60px]"
                      readOnly
                    />
                  </div>

                  {/* Shot Type & Camera Angle */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-400">景别</Label>
                      <Select value={""}>
                        <SelectTrigger className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-gray-700">
                          <SelectItem value="远景">远景</SelectItem>
                          <SelectItem value="全景">全景</SelectItem>
                          <SelectItem value="中景">中景</SelectItem>
                          <SelectItem value="近景">近景</SelectItem>
                          <SelectItem value="特写">特写</SelectItem>
                          <SelectItem value="大特写">大特写</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs text-gray-400">机位</Label>
                      <Select value={selectedShot.camera_direction}>
                        <SelectTrigger className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-gray-700">
                          <SelectItem value="平视">平视</SelectItem>
                          <SelectItem value="俯视">俯视</SelectItem>
                          <SelectItem value="仰视">仰视</SelectItem>
                          <SelectItem value="侧面">侧面</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Duration & Emotion */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-400">时长（秒）</Label>
                      <Input
                        value={selectedShot.duration || ""}
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9"
                        readOnly
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-gray-400">情绪</Label>
                      <Input
                        value={""}
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9"
                        readOnly
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label className="text-xs text-gray-400">备注</Label>
                    <Textarea
                      value={selectedShot.notes || ""}
                      placeholder="添加备注..."
                      className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[60px]"
                      readOnly
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-800 flex gap-2">
                <Button className="flex-1 bg-purple-600 hover:bg-purple-700">
                  保存修改
                </Button>
                <Button variant="outline" className="border-gray-700">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
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

            <div
              className={`resize-handle resize-handle-left absolute top-0 bottom-0 left-0 w-1 ${isResizingRight ? "dragging" : ""}`}
              onMouseDown={handleRightMouseDown}
            />
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
      <ImagePreviewDialog
        open={!!previewImage}
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null);
        }}
        src={previewImage?.src || ""}
        alt={previewImage?.alt || "镜头预览图"}
      />
    </div>
  );
}
