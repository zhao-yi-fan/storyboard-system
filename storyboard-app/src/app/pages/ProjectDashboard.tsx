import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Film,
  Plus,
  Search,
  Clock,
  Layers,
  Video,
  Camera,
  MoreHorizontal,
  FolderOpen,
  Filter,
  Grid3x3,
  List,
  Trash2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { projectApi, type Project } from "../api";

type ViewMode = "grid" | "list";
type StatusFilter = "all" | "草稿" | "进行中" | "已完成";

const gradients = [
  "from-purple-500 to-pink-600",
  "from-blue-500 to-cyan-500",
  "from-red-500 to-orange-500",
  "from-green-500 to-emerald-500",
];

function deriveStats(project: Project) {
  const chapters = project.chapter_count ?? 0;
  const scenes = project.scene_count ?? 0;
  const shots = project.storyboard_count ?? 0;
  const targetShots = Math.max(scenes * 3, 1);
  const progress = scenes === 0 && shots === 0 ? 0 : Math.min(100, Math.round((shots / targetShots) * 100));
  const status: Exclude<StatusFilter, "all"> = progress >= 100 ? "已完成" : shots > 0 || scenes > 0 ? "进行中" : "草稿";
  const statusColor =
    status === "已完成" ? "bg-purple-600" : status === "进行中" ? "bg-green-600" : "bg-gray-600";

  return { chapters, scenes, shots, progress, status, statusColor };
}

export default function ProjectDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);

  useEffect(() => {
    void loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await projectApi.getProjects();
      setProjects(data);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const text = `${project.name} ${project.description ?? ""}`.toLowerCase();
      const matchesSearch = text.includes(searchQuery.toLowerCase());
      const { status } = deriveStats(project);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "全部状态" },
    { value: "草稿", label: "草稿" },
    { value: "进行中", label: "进行中" },
    { value: "已完成", label: "已完成" },
  ];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "刚刚更新";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Shanghai",
      hour12: false,
    }).format(new Date(dateStr));
  };

  const confirmDeleteProject = async () => {
    if (!deleteTarget) return;

    setDeletingProjectId(deleteTarget.id);
    try {
      await projectApi.deleteProject(deleteTarget.id);
      setProjects((prev) => prev.filter((project) => project.id !== deleteTarget.id));
      toast.success("项目已删除");
      setDeleteTarget(null);
    } catch (error) {
      console.error("Failed to delete project:", error);
    } finally {
      setDeletingProjectId(null);
    }
  };

  return (
    <div className="dark h-screen flex flex-col bg-[#0a0a0a] text-gray-100">
      <header className="border-b border-gray-800 bg-[#111111] flex-shrink-0">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-[0_8px_24px_rgba(168,85,247,0.35)]">
                <Film className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-medium">漫剧分镜系统</h1>
                <p className="text-xs text-gray-500">专业分镜创作工具</p>
              </div>
            </div>

            <Button size="sm" className="h-9 bg-purple-600 hover:bg-purple-700" onClick={() => navigate("/import")}>
              <Plus className="w-4 h-4 mr-2" />
              新建项目
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-6 py-4 border-b border-gray-800 bg-[#0f0f0f] flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium">我的项目</h2>
              <Badge className="bg-gray-800 text-gray-400 text-xs">{filteredProjects.length}</Badge>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="搜索项目..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-[#1a1a1a] border-gray-700 text-sm text-gray-100"
                />
              </div>

              <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-md border border-gray-700 px-2 py-1">
                <Filter className="w-4 h-4 text-gray-500" />
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setStatusFilter(option.value)}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      statusFilter === option.value ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="flex bg-[#1a1a1a] rounded border border-gray-700">
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-9 w-9 p-0 rounded-none ${viewMode === "grid" ? "bg-gray-800" : ""}`}
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3x3 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-9 w-9 p-0 rounded-none ${viewMode === "list" ? "bg-gray-800" : ""}`}
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Film className="w-12 h-12 mx-auto mb-3 opacity-30 animate-pulse" />
                <p className="text-sm">加载项目中...</p>
              </div>
            </div>
          ) : filteredProjects.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-6">
                {filteredProjects.map((project, index) => {
                  const stats = deriveStats(project);
                  const gradient = gradients[index % gradients.length];
                  return (
                    <div
                      key={project.id}
                      className="bg-[#141414] border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition-all group cursor-pointer"
                      onClick={() => navigate(`/workspace?project=${project.id}`)}
                    >
                      <div className={`h-40 bg-gradient-to-br ${gradient} relative flex items-center justify-center`}>
                        <Film className="w-16 h-16 text-white/30" />
                        <div className="absolute top-3 right-3">
                          <Badge className={`${stats.statusColor} text-white text-xs`}>{stats.status}</Badge>
                        </div>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Button size="sm" className="bg-white/90 text-gray-900 hover:bg-white" onClick={(e) => { e.stopPropagation(); navigate(`/workspace?project=${project.id}`); }}>
                            <FolderOpen className="w-4 h-4 mr-2" />
                            打开项目
                          </Button>
                        </div>
                      </div>

                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium text-base">{project.name}</h3>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="inline-flex h-7 w-7 -mt-1 -mr-1 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-[#262626] hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                                <MoreHorizontal className="w-4 h-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-[#111111] border-gray-800 text-gray-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenuItem
                                variant="destructive"
                                className="focus:bg-red-950/40 focus:text-red-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget(project);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                                删除项目
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <p className="text-xs text-gray-400 line-clamp-2 mb-3">{project.description || "暂无描述"}</p>

                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-[#1a1a1a] rounded px-2 py-1.5">
                            <div className="flex items-center gap-1 text-purple-400 mb-0.5">
                              <Layers className="w-3 h-3" />
                              <span className="text-xs">{stats.chapters}</span>
                            </div>
                            <div className="text-[10px] text-gray-500">章节</div>
                          </div>
                          <div className="bg-[#1a1a1a] rounded px-2 py-1.5">
                            <div className="flex items-center gap-1 text-blue-400 mb-0.5">
                              <Video className="w-3 h-3" />
                              <span className="text-xs">{stats.scenes}</span>
                            </div>
                            <div className="text-[10px] text-gray-500">场景</div>
                          </div>
                          <div className="bg-[#1a1a1a] rounded px-2 py-1.5">
                            <div className="flex items-center gap-1 text-green-400 mb-0.5">
                              <Camera className="w-3 h-3" />
                              <span className="text-xs">{stats.shots}</span>
                            </div>
                            <div className="text-[10px] text-gray-500">镜头</div>
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">完成度</span>
                            <span className="text-xs text-gray-400">{stats.progress}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all" style={{ width: `${stats.progress}%` }} />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(project.updated_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3 pb-6">
                {filteredProjects.map((project, index) => {
                  const stats = deriveStats(project);
                  const gradient = gradients[index % gradients.length];
                  return (
                    <div key={project.id} className="bg-[#141414] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className={`w-24 h-16 bg-gradient-to-br ${gradient} rounded flex items-center justify-center flex-shrink-0 relative`}>
                          <Film className="w-8 h-8 text-white/30" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{project.name}</h3>
                            <Badge className={`${stats.statusColor} text-white text-xs`}>{stats.status}</Badge>
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-1 mb-2">{project.description || "暂无描述"}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Layers className="w-3 h-3 text-purple-400" />{stats.chapters} 章节</span>
                            <span className="flex items-center gap-1"><Video className="w-3 h-3 text-blue-400" />{stats.scenes} 场景</span>
                            <span className="flex items-center gap-1"><Camera className="w-3 h-3 text-green-400" />{stats.shots} 镜头</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(project.updated_at)}</span>
                          </div>
                        </div>
                        <div className="w-32 flex-shrink-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">完成度</span>
                            <span className="text-xs text-gray-400">{stats.progress}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${stats.progress}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button size="sm" className="h-8 bg-purple-600 hover:bg-purple-700" onClick={() => navigate(`/workspace?project=${project.id}`)}>
                            <FolderOpen className="w-4 h-4 mr-1.5" />
                            打开
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-[#262626] hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                                <MoreHorizontal className="w-4 h-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-[#111111] border-gray-800 text-gray-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenuItem
                                variant="destructive"
                                className="focus:bg-red-950/40 focus:text-red-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget(project);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                                删除项目
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
                  <FolderOpen className="w-10 h-10 text-gray-600" />
                </div>
                <h3 className="text-base mb-2 text-gray-400">暂无项目</h3>
                <p className="text-sm text-gray-600 mb-4">{searchQuery || statusFilter !== "all" ? "没有找到匹配的项目" : "开始创建你的第一个分镜项目"}</p>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => navigate("/import")}>
                  <Plus className="w-4 h-4 mr-2" />
                  新建项目
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-[#121212] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除项目</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              该操作会从项目列表中移除项目《{deleteTarget?.name ?? ""}》，但不会删除服务器上的原始媒体文件。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-600 bg-[#1a1a1a] text-gray-100 hover:bg-[#262626] hover:text-white">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deletingProjectId === deleteTarget?.id}
              onClick={confirmDeleteProject}
            >
              {deletingProjectId === deleteTarget?.id ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
