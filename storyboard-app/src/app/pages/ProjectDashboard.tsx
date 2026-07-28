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
import styles from "./ProjectDashboard.module.scss";

const gradients = [
  styles.gradientPurple,
  styles.gradientBlue,
  styles.gradientRed,
  styles.gradientGreen,
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
  const [posterFailed, setPosterFailed] = useState(false);
  const metrics = [
    { label: "章节", value: stats.chapters, icon: Layers },
    { label: "片段", value: stats.scenes, icon: Video },
  ];

  useEffect(() => {
    setPosterFailed(false);
  }, [project.video_poster_url]);

  const showPoster = Boolean(project.video_poster_url) && !posterFailed;

  return (
    <article className={styles.projectCard}>
      <button
        type="button"
        className={`${styles.projectCover} ${gradients[index % gradients.length]}`}
        onClick={() => onOpen(project)}
      >
        {showPoster ? (
          <img
            className={styles.coverImage}
            src={project.video_poster_url}
            alt=""
            loading="lazy"
            onError={() => setPosterFailed(true)}
          />
        ) : null}
        <div className={styles.coverOverlay} />
        {!showPoster ? <Film className={styles.coverIcon} /> : null}
        <span className={styles.updatedAt}>{formatDate(project.updated_at)} 更新</span>
      </button>

      <div className={styles.cardContent}>
        <div className={styles.cardHeader}>
          <button type="button" className={styles.projectSummary} onClick={() => onOpen(project)}>
            <div className={styles.projectTitleRow}>
              <h2 className={styles.projectTitle}>{project.name}</h2>
              {isPinned(project) ? <Badge className={styles.pinnedBadge}>置顶</Badge> : null}
            </div>
            <p className={styles.projectDescription}>
              {project.description || "继续完善这个故事的章节与片段"}
            </p>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className={styles.menuTrigger}>
              <MoreHorizontal className={styles.icon} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.menuContent}>
              <DropdownMenuItem
                disabled={pinningProjectId === project.id}
                onClick={() => onTogglePin(project)}
              >
                {isPinned(project) ? (
                  <PinOff className={styles.icon} />
                ) : (
                  <Pin className={styles.icon} />
                )}
                {isPinned(project) ? "取消置顶" : "置顶项目"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRename(project)}>
                <FolderOpen className={styles.icon} />
                重命名
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(project)}>
                <Trash2 className={styles.icon} />
                删除项目
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className={styles.metrics}>
          {metrics.map(({ label, value, icon: Icon }) => (
            <div key={label} className={styles.metric}>
              <div className={styles.metricValue}>
                <Icon className={styles.metricIcon} />
                {value}
              </div>
              <div className={styles.metricLabel}>{label}</div>
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
    <div className={`dark ${styles.page}`}>
      <aside className={styles.sidebar}>
        <button
          type="button"
          className={styles.logoButton}
          onClick={() => navigate("/projects")}
          aria-label="返回项目列表"
        >
          <Film className={styles.logoIcon} />
        </button>

        <nav className={styles.navigation}>
          <button className={styles.navigationActive}>
            <span className={styles.navigationMarker} />
            <Film className={styles.icon} />
            AI 制剧
          </button>
          <button className={styles.navigationButton} onClick={() => navigate("/personal-assets")}>
            <Package className={styles.icon} />
            个人空间
          </button>
        </nav>

        <div className={styles.sidebarFooter}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className={styles.infoButton}>
                <Info className={styles.icon} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className={styles.tooltip}>
              当前使用真实后端支持的 Wan、Seedream 与 Seedance 生成能力。
            </TooltipContent>
          </Tooltip>
          <UserMenu placement="sidebar" />
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <h1 className={styles.title}>AI 制剧</h1>
            <span className={styles.projectCount}>{filteredProjects.length}</span>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.search}>
              <Search className={styles.searchIcon} />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索项目"
                className={styles.searchInput}
              />
            </div>
          </div>
        </header>

        <section className={styles.content}>
          {loading ? (
            <div className={styles.loading}>正在加载项目...</div>
          ) : (
            <div className={styles.projectGrid}>
              <button
                type="button"
                className={styles.createProject}
                onClick={() => navigate("/import")}
              >
                <span className={styles.createIconWrap}>
                  <Plus className={styles.logoIcon} />
                </span>
                <span className={styles.createText}>
                  <strong className={styles.createTitle}>新建项目</strong>
                  <span className={styles.createDescription}>上传剧本开始创作</span>
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
            <div className={styles.noResults}>
              <div>
                <Search className={styles.noResultsIcon} />
                <p className={styles.noResultsText}>没有匹配的项目</p>
              </div>
            </div>
          ) : null}
        </section>
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className={styles.alertDialog}>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除项目</AlertDialogTitle>
            <AlertDialogDescription className={styles.dialogDescription}>
              该操作会从项目列表中移除《{deleteTarget?.name ?? ""}
              》，但不会删除服务器上的原始媒体文件。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={styles.cancelButton}>取消</AlertDialogCancel>
            <AlertDialogAction
              className={styles.deleteButton}
              disabled={deletingProjectId === deleteTarget?.id}
              onClick={() => void confirmDeleteProject()}
            >
              {deletingProjectId === deleteTarget?.id ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && closeRenameDialog()}>
        <DialogContent className={styles.renameDialog}>
          <DialogHeader>
            <DialogTitle>重命名项目</DialogTitle>
            <DialogDescription className={styles.dialogDescription}>
              更新项目名称和描述。
            </DialogDescription>
          </DialogHeader>
          <div className={styles.renameFields}>
            <Input
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              placeholder="项目名称"
              className={styles.renameInput}
            />
            <textarea
              value={renameDescription}
              onChange={(event) => setRenameDescription(event.target.value)}
              placeholder="项目描述"
              className={styles.renameTextarea}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRenameDialog} className={styles.renameInput}>
              取消
            </Button>
            <Button
              onClick={() => void confirmRenameProject()}
              disabled={renamingProjectId === renameTarget?.id}
              className={styles.saveButton}
            >
              {renamingProjectId === renameTarget?.id ? "保存中..." : "保存修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
