import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Film,
  FolderOpen,
  Info,
  Layers,
  MoreHorizontal,
  Package,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  Video,
} from "lucide-react";
import { projectApi, type Project } from "../api";
import { UserMenu } from "../components/UserMenu";
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
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
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
import { Input } from "../components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";

const gradients = [
  "from-fuchsia-600 via-purple-600 to-indigo-700",
  "from-blue-600 via-sky-600 to-cyan-700",
  "from-orange-600 via-red-600 to-rose-800",
  "from-emerald-600 via-teal-600 to-cyan-800",
];

function deriveStats(project: Project) {
  const chapters = project.chapter_count ?? 0;
  const scenes = project.scene_count ?? 0;
  return { chapters, scenes };
}

function isPinned(project: Project) {
  return Boolean(project.is_pinned || project.pinned_at);
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(dateStr));
}

type ProjectCardProps = {
  project: Project;
  index: number;
  pinningProjectId: number | null;
  onOpen: (project: Project) => void;
  onTogglePin: (project: Project) => void;
  onRename: (project: Project) => void;
  onDelete: (project: Project) => void;
};

function ProjectCard({
  project,
  index,
  pinningProjectId,
  onOpen,
  onTogglePin,
  onRename,
  onDelete,
}: ProjectCardProps) {
  const stats = deriveStats(project);
  const metrics = [
    { label: "章节", value: stats.chapters, icon: Layers },
    { label: "片段", value: stats.scenes, icon: Video },
  ];

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#151515] transition duration-300 hover:-translate-y-0.5 hover:border-teal-400/30 hover:shadow-2xl hover:shadow-black/40">
      <button
        type="button"
        className={`relative block h-36 w-full overflow-hidden bg-gradient-to-br ${gradients[index % gradients.length]}`}
        onClick={() => onOpen(project)}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.26),transparent_36%),linear-gradient(to_top,rgba(0,0,0,0.5),transparent)]" />
        <Film className="absolute bottom-4 left-4 h-10 w-10 text-white/25" />
        <span className="absolute right-3 top-3 rounded-md bg-black/45 px-2 py-1 text-[10px] text-white/75 backdrop-blur">
          {formatDate(project.updated_at)} 更新
        </span>
      </button>

      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <button type="button" className="min-w-0 text-left" onClick={() => onOpen(project)}>
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-base font-semibold text-white">{project.name}</h2>
              {isPinned(project) ? (
                <Badge className="border border-amber-400/20 bg-amber-400/10 text-[10px] text-amber-200">
                  置顶
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-gray-500">
              {project.description || "继续完善这个故事的章节与片段"}
            </p>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-gray-500 transition hover:bg-white/5 hover:text-white">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-white/10 bg-[#181818] text-gray-100">
              <DropdownMenuItem
                disabled={pinningProjectId === project.id}
                onClick={() => onTogglePin(project)}
              >
                {isPinned(project) ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {isPinned(project) ? "取消置顶" : "置顶项目"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRename(project)}>
                <FolderOpen className="h-4 w-4" />
                重命名
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(project)}>
                <Trash2 className="h-4 w-4" />
                删除项目
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {metrics.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-lg bg-white/[0.035] px-2 py-2">
              <div className="flex items-center gap-1 text-xs text-gray-300">
                <Icon className="h-3 w-3 text-teal-400/80" />
                {value}
              </div>
              <div className="mt-0.5 text-[10px] text-gray-600">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function ProjectDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);
  const [pinningProjectId, setPinningProjectId] = useState<number | null>(null);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameDescription, setRenameDescription] = useState("");
  const [renamingProjectId, setRenamingProjectId] = useState<number | null>(null);

  const loadProjects = async () => {
    setLoading(true);
    try {
      setProjects(await projectApi.getProjects());
    } catch (error) {
      console.error("Failed to load projects:", error);
      toast.error("项目列表加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const text = `${project.name} ${project.description ?? ""}`.toLowerCase();
        return text.includes(searchQuery.toLowerCase());
      }),
    [projects, searchQuery],
  );

  const confirmDeleteProject = async () => {
    if (!deleteTarget) return;
    setDeletingProjectId(deleteTarget.id);
    try {
      await projectApi.deleteProject(deleteTarget.id);
      setProjects((current) => current.filter((project) => project.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("项目已删除");
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast.error("项目删除失败");
    } finally {
      setDeletingProjectId(null);
    }
  };

  const togglePinProject = async (project: Project) => {
    setPinningProjectId(project.id);
    try {
      if (isPinned(project)) await projectApi.unpinProject(project.id);
      else await projectApi.pinProject(project.id);
      await loadProjects();
      toast.success(isPinned(project) ? "已取消置顶" : "已置顶项目");
    } catch (error) {
      console.error("Failed to toggle project pin:", error);
      toast.error("置顶状态更新失败");
    } finally {
      setPinningProjectId(null);
    }
  };

  const openRenameDialog = (project: Project) => {
    setRenameTarget(project);
    setRenameName(project.name);
    setRenameDescription(project.description ?? "");
  };

  const closeRenameDialog = () => {
    if (renamingProjectId) return;
    setRenameTarget(null);
    setRenameName("");
    setRenameDescription("");
  };

  const confirmRenameProject = async () => {
    if (!renameTarget) return;
    const name = renameName.trim();
    if (!name) {
      toast.error("项目名称不能为空");
      return;
    }
    setRenamingProjectId(renameTarget.id);
    try {
      await projectApi.updateProject(renameTarget.id, {
        name,
        description: renameDescription.trim(),
      });
      await loadProjects();
      setRenameTarget(null);
      toast.success("项目已重命名");
    } catch (error) {
      console.error("Failed to rename project:", error);
      toast.error("项目重命名失败");
    } finally {
      setRenamingProjectId(null);
    }
  };

  return (
    <div className="dark flex h-screen overflow-hidden bg-[#0b0b0b] text-gray-100">
      <aside className="flex w-[92px] flex-none flex-col items-center border-r border-white/[0.06] bg-[#101010] py-4">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-700 shadow-lg shadow-fuchsia-950/30"
          onClick={() => navigate("/projects")}
          aria-label="返回项目列表"
        >
          <Film className="h-5 w-5 text-white" />
        </button>

        <nav className="mt-7 flex w-full flex-col items-center gap-2">
          <button className="relative flex w-[72px] flex-col items-center gap-1 rounded-xl bg-teal-400/10 py-3 text-[11px] text-teal-300">
            <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-teal-400" />
            <Film className="h-4 w-4" />
            AI 制剧
          </button>
          <button
            className="flex w-[72px] flex-col items-center gap-1 rounded-xl py-3 text-[11px] text-gray-600 transition hover:bg-white/[0.03] hover:text-gray-300"
            onClick={() => navigate("/personal-assets")}
          >
            <Package className="h-4 w-4" />
            个人空间
          </button>
        </nav>

        <div className="mt-auto flex flex-col items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-600 hover:text-gray-300">
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="max-w-72 border-white/10 bg-[#181818] text-gray-300"
            >
              当前使用真实后端支持的 Wan、Seedream 与 Seedance 生成能力。
            </TooltipContent>
          </Tooltip>
          <UserMenu placement="sidebar" />
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[88px] flex-none items-center justify-between border-b border-white/[0.06] px-7">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">AI 制剧</h1>
            <span className="rounded-md border border-teal-400/20 bg-teal-400/10 px-2 py-0.5 text-xs text-teal-300">
              {filteredProjects.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索项目"
                className="h-9 rounded-xl border-white/10 bg-[#141414] pl-9 text-sm"
              />
            </div>
          </div>
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto p-7">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-600">
              正在加载项目...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 pb-8 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <button
                type="button"
                className="group flex min-h-[302px] flex-col items-center justify-center rounded-2xl border border-dashed border-teal-400/20 bg-teal-400/[0.025] transition hover:border-teal-400/50 hover:bg-teal-400/[0.05]"
                onClick={() => navigate("/import")}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-teal-400/25 bg-teal-400/10 text-teal-300 transition group-hover:scale-105">
                  <Plus className="h-5 w-5" />
                </span>
                <span className="mt-4">
                  <strong className="block text-sm font-medium text-teal-300">新建项目</strong>
                  <span className="mt-1 block text-xs text-gray-600">上传剧本开始创作</span>
                </span>
              </button>

              {filteredProjects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={index}
                  pinningProjectId={pinningProjectId}
                  onOpen={(item) => navigate(`/asset-confirmation?project=${item.id}`)}
                  onTogglePin={(item) => void togglePinProject(item)}
                  onRename={openRenameDialog}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}

          {!loading && filteredProjects.length === 0 && projects.length > 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
              <div>
                <Search className="mx-auto h-8 w-8 text-gray-700" />
                <p className="mt-3 text-sm text-gray-500">没有匹配的项目</p>
              </div>
            </div>
          ) : null}
        </section>
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-white/10 bg-[#151515] text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除项目</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              该操作会从项目列表中移除《{deleteTarget?.name ?? ""}
              》，但不会删除服务器上的原始媒体文件。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-[#202020] text-gray-100">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deletingProjectId === deleteTarget?.id}
              onClick={() => void confirmDeleteProject()}
            >
              {deletingProjectId === deleteTarget?.id ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && closeRenameDialog()}>
        <DialogContent className="border-white/10 bg-[#151515] text-gray-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重命名项目</DialogTitle>
            <DialogDescription className="text-gray-400">更新项目名称和描述。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              placeholder="项目名称"
              className="border-white/10 bg-[#202020]"
            />
            <textarea
              value={renameDescription}
              onChange={(event) => setRenameDescription(event.target.value)}
              placeholder="项目描述"
              className="min-h-24 w-full rounded-xl border border-white/10 bg-[#202020] px-3 py-2 text-sm outline-none focus:border-teal-500/50"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeRenameDialog}
              className="border-white/10 bg-[#202020]"
            >
              取消
            </Button>
            <Button
              onClick={() => void confirmRenameProject()}
              disabled={renamingProjectId === renameTarget?.id}
              className="bg-teal-500 text-[#06251f] hover:bg-teal-400"
            >
              {renamingProjectId === renameTarget?.id ? "保存中..." : "保存修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
