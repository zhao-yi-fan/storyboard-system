import {
  Film,
  Loader2,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
} from "lucide-react";

import type { Chapter, Scene } from "../../api";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { countPromptShots, getSceneNavigatorThumbnailSrc } from "./Workspace.helpers";
import styles from "./Workspace.module.scss";

export function SceneInsertDivider({
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

type WorkspaceSceneRailProps = {
  loading: boolean;
  chapters: Chapter[];
  scenes: Scene[];
  selectedChapter: Chapter | null;
  selectedScene: Scene | null;
  selectedProject: { id: number } | null;
  isEpisodeRailCollapsed: boolean;
  setIsEpisodeRailCollapsed: (collapsed: boolean) => void;
  hoveredSceneIndex: number | null;
  setHoveredSceneIndex: (index: number | null) => void;
  activeChapterForSceneCreation: Chapter | null;
  toggleChapter: (chapterId: number) => void | Promise<void>;
  selectScene: (scene: Scene) => void | Promise<void>;
  openCreateSceneDialog: (sortOrder?: number | null) => void;
  handleRequestDeleteScene: (scene: Scene) => void;
};

export function WorkspaceSceneRail({
  loading,
  chapters,
  scenes,
  selectedChapter,
  selectedScene,
  selectedProject,
  isEpisodeRailCollapsed,
  setIsEpisodeRailCollapsed,
  hoveredSceneIndex,
  setHoveredSceneIndex,
  activeChapterForSceneCreation,
  toggleChapter,
  selectScene,
  openCreateSceneDialog,
  handleRequestDeleteScene,
}: WorkspaceSceneRailProps) {
  return (
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
              onClick={() => setIsEpisodeRailCollapsed(!isEpisodeRailCollapsed)}
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
                          className={activeScene ? styles.sceneMarkerActive : styles.sceneMarker}
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
                            className={activeScene ? styles.sceneIndexActive : styles.sceneIndex}
                          >
                            片段-{sceneIndex + 1}
                          </span>
                          <span
                            className={activeScene ? styles.sceneTitleActive : styles.sceneTitle}
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
  );
}
