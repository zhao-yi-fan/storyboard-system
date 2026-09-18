import { Camera, Loader2, Maximize2, MoreHorizontal, Play, Save, Trash2 } from "lucide-react";

import type {
  Scene,
  SceneGenerationReferences,
  Storyboard,
  StoryboardMediaGeneration,
  VideoResolution,
} from "../api";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { CoverReferencePanel, PromptReferenceStatus } from "../components/workspace/CoverReferencePanel";
import {
  PromptOptimizeButton,
} from "../components/workspace/PromptOptimizationDialog";
import type { PromptMentionOption } from "../components/workspace/RichPromptEditor";
import { RichPromptEditor } from "../components/workspace/RichPromptEditor";
import { VideoGenerationSettings } from "../components/workspace/VideoGenerationSettings";
import type { ShotFormState } from "./Workspace.helpers";
import {
  FIXED_VIDEO_ASPECT_RATIO,
  formatShotNumber,
  getGenerationPreviewSrc,
  getStoryboardPreviewSrc,
  VIDEO_MODEL_OPTIONS,
} from "./Workspace.helpers";
import styles from "./Workspace.module.scss";

type WorkspaceSettingsPanelProps = {
  selectedShot: Storyboard | null;
  selectedScene: Scene | null;
  shotForm: ShotFormState;
  updateShotForm: <K extends keyof ShotFormState>(key: K, value: ShotFormState[K]) => void;
  promptMentionOptions: PromptMentionOption[];
  handleSelectPromptMention: (option: PromptMentionOption) => void | Promise<void>;
  handleRemovePromptMentions: (options: PromptMentionOption[]) => void | Promise<void>;
  isOptimizingPrompt: boolean;
  requestPromptOptimization: () => void | Promise<void>;
  setIsPromptFullscreenOpen: (open: boolean) => void;
  useFirstFrameForVideo: boolean;
  setUseFirstFrameForVideo: (checked: boolean) => void;
  selectedVideoModel: string;
  handleVideoModelChange: (value: string) => void;
  activeVideoResolution: VideoResolution;
  activeVideoDuration: number;
  activeVideoAudio: boolean;
  setSelectedVideoResolution: (resolution: VideoResolution) => void;
  setSelectedVideoDuration: (duration: number) => void;
  setGenerateVideoAudio: (audio: boolean) => void;
  generatingVideoId: number | null;
  isLoadingVideoPreview: boolean;
  isSavingShot: boolean;
  handleGenerateVideo: () => void | Promise<void>;
  handleSaveShot: () => void | Promise<void>;
  handleRequestDeleteScene: (scene: Scene) => void;
  coverGenerations: StoryboardMediaGeneration[];
  liveGenerationReferences: SceneGenerationReferences | null;
  isLoadingGenerationReferences: boolean;
  generationReferenceError: string;
  coverGenerationError: string;
  generatingCoverId: number | null;
  isLoadingCoverPreview: boolean;
  handleGenerateCover: () => void | Promise<void>;
  handleRequestUploadShotCover: () => void;
  handleOpenManageCharacters: () => void | Promise<void>;
  handleOpenManageAssets: () => void | Promise<void>;
  openGenerationReferencePreview: (index: number) => void;
  openCoverHistoryPreview: (generation: StoryboardMediaGeneration) => void;
  setPreviewImage: (
    preview: { src: string; alt: string } | null,
  ) => void;
  setCoverGenerationError: (message: string) => void;
  setGenerationReferenceError: (message: string) => void;
};

export function WorkspaceSettingsPanel({
  selectedShot,
  selectedScene,
  shotForm,
  updateShotForm,
  promptMentionOptions,
  handleSelectPromptMention,
  handleRemovePromptMentions,
  isOptimizingPrompt,
  requestPromptOptimization,
  setIsPromptFullscreenOpen,
  useFirstFrameForVideo,
  setUseFirstFrameForVideo,
  selectedVideoModel,
  handleVideoModelChange,
  activeVideoResolution,
  activeVideoDuration,
  activeVideoAudio,
  setSelectedVideoResolution,
  setSelectedVideoDuration,
  setGenerateVideoAudio,
  generatingVideoId,
  isLoadingVideoPreview,
  isSavingShot,
  handleGenerateVideo,
  handleSaveShot,
  handleRequestDeleteScene,
  coverGenerations,
  liveGenerationReferences,
  isLoadingGenerationReferences,
  generationReferenceError,
  coverGenerationError,
  generatingCoverId,
  isLoadingCoverPreview,
  handleGenerateCover,
  handleRequestUploadShotCover,
  handleOpenManageCharacters,
  handleOpenManageAssets,
  openGenerationReferencePreview,
  openCoverHistoryPreview,
  setPreviewImage,
  setCoverGenerationError,
  setGenerationReferenceError,
}: WorkspaceSettingsPanelProps) {
  return (
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
                onClick={() => void handleGenerateVideo()}
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
                  <DropdownMenuItem
                    onClick={() => void handleSaveShot()}
                    disabled={isSavingShot}
                  >
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
  );
}
