import { ArrowLeft, Film, Image as ImageIcon, MoreHorizontal, Play } from "lucide-react";
import type { Project } from "../../api";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import styles from "../../pages/Workspace.module.scss";

type WorkspaceHeaderProps = {
  project: Project | null;
  sceneCount: number;
  totalDuration: number;
  composingProjectVideo: boolean;
  projectVideoPreviewSrc: string;
  onBack: () => void;
  onOpenAssetConfirmation: () => void;
  onComposeProjectVideo: () => void;
  onPreviewProjectVideo: () => void;
};

export function WorkspaceHeader({
  project,
  sceneCount,
  totalDuration,
  composingProjectVideo,
  projectVideoPreviewSrc,
  onBack,
  onOpenAssetConfirmation,
  onComposeProjectVideo,
  onPreviewProjectVideo,
}: WorkspaceHeaderProps) {
  return (
    <header className={`storyboard-topbar ${styles.topbar}`}>
      <div className={styles.topbarStart}>
        <Button
          size="sm"
          variant="ghost"
          onClick={onBack}
          className={styles.backButton}
          aria-label="返回项目列表"
        >
          <ArrowLeft className={styles.icon} />
        </Button>
        <div className={styles.brandIcon}>
          <Film className={styles.brandFilmIcon} />
        </div>
        <span className={styles.projectTitle}>
          {project ? `《${project.name}》` : "片段工作台"}
        </span>
        <div className={styles.topbarDivider} />
        <DropdownMenu>
          <DropdownMenuTrigger className={styles.projectMenuTrigger}>
            <MoreHorizontal className={styles.smallIcon} />
            项目操作
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={styles.dropdownContent}>
            <DropdownMenuItem onClick={onOpenAssetConfirmation} disabled={!project}>
              <ImageIcon className={styles.icon} />
              资产确认
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onComposeProjectVideo}
              disabled={!project || composingProjectVideo}
            >
              <Film className={styles.icon} />
              {composingProjectVideo ? "总片合成中..." : "生成项目总片"}
            </DropdownMenuItem>
            {project && projectVideoPreviewSrc ? (
              <DropdownMenuItem onClick={onPreviewProjectVideo}>
                <Play className={styles.icon} />
                播放项目总片
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <span className={styles.topbarSummary}>
        {sceneCount} 个片段 · 当前片段 {totalDuration.toFixed(1)}s
      </span>
    </header>
  );
}
