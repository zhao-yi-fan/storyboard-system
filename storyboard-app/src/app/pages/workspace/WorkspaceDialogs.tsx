import type { Dispatch, SetStateAction } from "react";

import type {
  AIGenerationPreview,
  Asset,
  Character,
  Project,
  Scene,
  SceneVideoFrame,
  Storyboard,
  StoryboardCoverGenerationPreview,
  StoryboardMediaGeneration,
  StoryboardVideoGenerationPreview,
} from "../../api";
import { ImagePreviewDialog } from "../../components/shared/ImagePreviewDialog";
import { ConfirmationDialog } from "../../components/workspace/dialogs/ConfirmationDialog";
import { CoverGenerationDialog } from "../../components/workspace/dialogs/CoverGenerationDialog";
import type { NewSceneDraft } from "../../components/workspace/dialogs/CreateSceneDialog";
import { CreateSceneDialog } from "../../components/workspace/dialogs/CreateSceneDialog";
import { FullscreenPromptDialog } from "../../components/workspace/dialogs/FullscreenPromptDialog";
import { ManageReferencesDialog } from "../../components/workspace/dialogs/ManageReferencesDialog";
import { SceneCoverGenerationDialog } from "../../components/workspace/dialogs/SceneCoverGenerationDialog";
import { VideoGenerationDialog } from "../../components/workspace/dialogs/VideoGenerationDialog";
import {
  type VideoPreview,
  VideoPreviewDialog,
} from "../../components/workspace/dialogs/VideoPreviewDialog";
import { PromptOptimizationDialog } from "../../components/workspace/PromptOptimizationDialog";
import type { PromptMentionOption } from "../../components/workspace/RichPromptEditor";
import { VideoFrameExtractionDialog } from "../../components/workspace/VideoFrameExtractionDialog";
import { MEDIA_TYPE } from "../../constants/domain";
import type { ShotFormState } from "./Workspace.helpers";
import {
  emptyDescriptionOptimization,
  formatPromptForDisplay,
  formatShanghaiDateTime,
  formatShotNumber,
} from "./Workspace.helpers";

type DescriptionOptimization = {
  open: boolean;
  loading: boolean;
  original: string;
  candidate: string;
  model: string;
  error: string;
};

// ── Prompt dialogs: fullscreen editor + 2 optimization flows ────────────────

type PromptDialogsProps = {
  isPromptFullscreenOpen: boolean;
  setIsPromptFullscreenOpen: (open: boolean) => void;
  selectedScene: Scene | null;
  selectedShot: Storyboard | null;
  shotContent: string;
  promptMentionOptions: PromptMentionOption[];
  isOptimizingPrompt: boolean;
  updateShotForm: <K extends keyof ShotFormState>(key: K, value: ShotFormState[K]) => void;
  handleSelectPromptMention: (option: PromptMentionOption) => void | Promise<void>;
  handleRemovePromptMentions: (options: PromptMentionOption[]) => void | Promise<void>;
  requestPromptOptimization: () => void | Promise<void>;
  isPromptOptimizationOpen: boolean;
  promptOptimizationOriginal: string;
  promptOptimizationCandidate: string;
  promptOptimizationModel: string;
  promptOptimizationError: string;
  setIsPromptOptimizationOpen: (open: boolean) => void;
  confirmPromptOptimization: () => void;
  descriptionOptimization: DescriptionOptimization;
  setDescriptionOptimization: (
    value:
      DescriptionOptimization | ((current: DescriptionOptimization) => DescriptionOptimization),
  ) => void;
  requestDescriptionOptimization: () => void | Promise<void>;
  confirmDescriptionOptimization: () => void;
};

export function PromptDialogs({
  isPromptFullscreenOpen,
  setIsPromptFullscreenOpen,
  selectedScene,
  selectedShot,
  shotContent,
  promptMentionOptions,
  isOptimizingPrompt,
  updateShotForm,
  handleSelectPromptMention,
  handleRemovePromptMentions,
  requestPromptOptimization,
  isPromptOptimizationOpen,
  promptOptimizationOriginal,
  promptOptimizationCandidate,
  promptOptimizationModel,
  promptOptimizationError,
  setIsPromptOptimizationOpen,
  confirmPromptOptimization,
  descriptionOptimization,
  setDescriptionOptimization,
  requestDescriptionOptimization,
  confirmDescriptionOptimization,
}: PromptDialogsProps) {
  return (
    <>
      <FullscreenPromptDialog
        open={isPromptFullscreenOpen}
        sceneTitle={selectedScene?.title ?? "未命名片段"}
        editorKey={`fullscreen-prompt-${selectedShot?.id ?? 0}`}
        value={shotContent}
        options={promptMentionOptions}
        optimizing={isOptimizingPrompt}
        onOpenChange={setIsPromptFullscreenOpen}
        onChange={(value) => updateShotForm("content", value)}
        onSelectMention={(option) => void handleSelectPromptMention(option)}
        onRemoveMentions={(options) => void handleRemovePromptMentions(options)}
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
    </>
  );
}

// ── Manage dialogs: characters + assets ─────────────────────────────────────

type ManageDialogsProps = {
  isManageCharactersOpen: boolean;
  setIsManageCharactersOpen: (open: boolean) => void;
  isManageAssetsOpen: boolean;
  setIsManageAssetsOpen: (open: boolean) => void;
  selectedShot: Storyboard | null;
  selectedScene: Scene | null;
  selectedProject: Project | null;
  projectCharacters: Character[];
  projectAssets: Asset[];
  isLoadingProjectCharacters: boolean;
  isLoadingProjectAssets: boolean;
  activeCharacterActionKey: string | null;
  activeAssetActionKey: string | null;
  loadProjectCharacters: (projectId: number) => Promise<void>;
  loadProjectAssets: (projectId: number) => Promise<void>;
  handleAddStoryboardCharacter: (id: number) => void | Promise<void>;
  handleRemoveStoryboardCharacter: (id: number) => void | Promise<void>;
  handleAddStoryboardAsset: (id: number) => void | Promise<void>;
  handleRemoveStoryboardAsset: (id: number) => void | Promise<void>;
};

export function ManageDialogs({
  isManageCharactersOpen,
  setIsManageCharactersOpen,
  isManageAssetsOpen,
  setIsManageAssetsOpen,
  selectedShot,
  selectedScene,
  selectedProject,
  projectCharacters,
  projectAssets,
  isLoadingProjectCharacters,
  isLoadingProjectAssets,
  activeCharacterActionKey,
  activeAssetActionKey,
  loadProjectCharacters,
  loadProjectAssets,
  handleAddStoryboardCharacter,
  handleRemoveStoryboardCharacter,
  handleAddStoryboardAsset,
  handleRemoveStoryboardAsset,
}: ManageDialogsProps) {
  return (
    <>
      <ManageReferencesDialog
        open={isManageCharactersOpen}
        title="管理片段角色"
        description="管理当前片段 Prompt 使用的角色参考。"
        currentDescription={
          selectedShot
            ? `${selectedScene?.title ?? "未命名片段"} · ${selectedShot.content ?? "未填写 Prompt"}`
            : "未选择片段"
        }
        emptyAssignedLabel="当前片段未关联角色"
        libraryTitle="项目角色库"
        loadingLabel="正在加载项目角色"
        emptyLibraryLabel="当前项目还没有可选角色。"
        refreshLabel="刷新角色库"
        assignedItems={(selectedShot?.characters ?? []).map((character) => ({
          id: character.id,
          name: character.name,
          description: character.description ?? "暂无角色描述",
          assigned: true,
        }))}
        items={projectCharacters.map((character) => ({
          id: character.id,
          name: character.name,
          description: character.description ?? "暂无角色描述",
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
            ? `${formatShotNumber(selectedShot.shot_number)} · ${selectedShot.content ?? "未填写画面描述"}`
            : "未选择片段"
        }
        emptyAssignedLabel="当前片段未关联参考资产"
        libraryTitle="项目参考资产库"
        loadingLabel="正在加载项目参考资产"
        emptyLibraryLabel="当前项目还没有可用的参考资产。"
        refreshLabel="刷新资产库"
        assignedItems={(selectedShot?.assets ?? []).map((asset) => ({
          id: asset.id,
          name: asset.name,
          description: asset.meta ?? asset.type ?? "项目资产",
          assigned: true,
        }))}
        items={projectAssets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          description: asset.meta ?? asset.type ?? "项目资产",
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
    </>
  );
}

// ── Generation dialogs: scene create, covers, videos, deletions ─────────────

type GenerationDialogsProps = {
  isCreateSceneOpen: boolean;
  sceneInsertSortOrder: number | null;
  sceneCount: number;
  newSceneForm: { title: string; description: string };
  isCreatingScene: boolean;
  optimizingDescription: boolean;
  setIsCreateSceneOpen: (open: boolean) => void;
  setSceneInsertSortOrder: (order: number | null) => void;
  resetNewSceneForm: () => void;
  setNewSceneForm: Dispatch<SetStateAction<NewSceneDraft>>;
  requestDescriptionOptimization: () => void | Promise<void>;
  handleCreateScene: () => void | Promise<void>;
  isCoverConfirmOpen: boolean;
  setIsCoverConfirmOpen: (open: boolean) => void;
  selectedScene: Scene | null;
  coverGenerationPreview: StoryboardCoverGenerationPreview | null;
  openGenerationReferencePreview: (index: number) => void;
  handleManageCharactersForCover: () => void;
  handleManageAssetsForCover: () => void;
  confirmGenerateCover: (textOnly: boolean) => void | Promise<void>;
  isSceneCoverConfirmOpen: boolean;
  setIsSceneCoverConfirmOpen: (open: boolean) => void;
  sceneCoverGenerationPreview: AIGenerationPreview | null;
  confirmGenerateSceneCover: () => void | Promise<void>;
  isBatchSceneCoverConfirmOpen: boolean;
  setIsBatchSceneCoverConfirmOpen: (open: boolean) => void;
  filteredShotCount: number;
  confirmBatchGenerateSceneCovers: () => void | Promise<void>;
  isSceneVideoConfirmOpen: boolean;
  setIsSceneVideoConfirmOpen: (open: boolean) => void;
  composableShotCount: number;
  confirmComposeSceneVideo: () => void | Promise<void>;
  isProjectVideoConfirmOpen: boolean;
  setIsProjectVideoConfirmOpen: (open: boolean) => void;
  selectedProject: Project | null;
  confirmComposeProjectVideo: () => void | Promise<void>;
  isVideoConfirmOpen: boolean;
  videoGenerationPreview: StoryboardVideoGenerationPreview | null;
  previewVideoSpecLabel: string;
  selectedVideoModel: string;
  activeVideoDuration: number;
  useFirstFrameForVideo: boolean;
  selectedShot: Storyboard | null;
  handleVideoConfirmOpenChange: (open: boolean) => void;
  setUseFirstFrameForVideo: (checked: boolean) => void;
  confirmGenerateVideo: () => void | Promise<void>;
  deleteTargetGeneration: StoryboardMediaGeneration | null;
  setDeleteTargetGeneration: (generation: StoryboardMediaGeneration | null) => void;
  confirmDeleteGeneration: () => void | Promise<void>;
  deleteTargetScene: Scene | null;
  setDeleteTargetScene: (scene: Scene | null) => void;
  confirmDeleteScene: () => void | Promise<void>;
};

export function GenerationDialogs({
  isCreateSceneOpen,
  sceneInsertSortOrder,
  sceneCount,
  newSceneForm,
  isCreatingScene,
  optimizingDescription,
  setIsCreateSceneOpen,
  setSceneInsertSortOrder,
  resetNewSceneForm,
  setNewSceneForm,
  requestDescriptionOptimization,
  handleCreateScene,
  isCoverConfirmOpen,
  setIsCoverConfirmOpen,
  selectedScene,
  coverGenerationPreview,
  openGenerationReferencePreview,
  handleManageCharactersForCover,
  handleManageAssetsForCover,
  confirmGenerateCover,
  isSceneCoverConfirmOpen,
  setIsSceneCoverConfirmOpen,
  sceneCoverGenerationPreview,
  confirmGenerateSceneCover,
  isBatchSceneCoverConfirmOpen,
  setIsBatchSceneCoverConfirmOpen,
  filteredShotCount,
  confirmBatchGenerateSceneCovers,
  isSceneVideoConfirmOpen,
  setIsSceneVideoConfirmOpen,
  composableShotCount,
  confirmComposeSceneVideo,
  isProjectVideoConfirmOpen,
  setIsProjectVideoConfirmOpen,
  selectedProject,
  confirmComposeProjectVideo,
  isVideoConfirmOpen,
  videoGenerationPreview,
  previewVideoSpecLabel,
  selectedVideoModel,
  activeVideoDuration,
  useFirstFrameForVideo,
  selectedShot,
  handleVideoConfirmOpenChange,
  setUseFirstFrameForVideo,
  confirmGenerateVideo,
  deleteTargetGeneration,
  setDeleteTargetGeneration,
  confirmDeleteGeneration,
  deleteTargetScene,
  setDeleteTargetScene,
  confirmDeleteScene,
}: GenerationDialogsProps) {
  return (
    <>
      <CreateSceneDialog
        open={isCreateSceneOpen}
        insertSortOrder={sceneInsertSortOrder}
        sceneCount={sceneCount}
        draft={newSceneForm}
        creating={isCreatingScene}
        optimizingDescription={optimizingDescription}
        onOpenChange={(open) => {
          setIsCreateSceneOpen(open);
          if (!open) {
            setSceneInsertSortOrder(null);
            resetNewSceneForm();
          }
        }}
        onDraftChange={setNewSceneForm}
        onOptimizeDescription={() => void requestDescriptionOptimization()}
        onCreate={() => void handleCreateScene()}
      />
      <CoverGenerationDialog
        open={isCoverConfirmOpen}
        sceneTitle={selectedScene?.title ?? "-"}
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
          { label: "片段标题", value: selectedScene?.title ?? "-" },
          { label: "镜头数量", value: filteredShotCount },
          { label: "当前模型", value: "Seedream 4.5" },
        ]}
        confirmLabel="确认生成"
        onOpenChange={setIsBatchSceneCoverConfirmOpen}
        onConfirm={() => void confirmBatchGenerateSceneCovers()}
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
          { label: "片段标题", value: selectedScene?.title ?? "-" },
          { label: "可合成镜头数", value: composableShotCount },
          { label: "输出规格", value: "720P / 保留原音轨" },
        ]}
        confirmLabel={selectedScene?.video_url ? "确认重新生成" : "确认合成"}
        onOpenChange={setIsSceneVideoConfirmOpen}
        onConfirm={() => void confirmComposeSceneVideo()}
      />

      <ConfirmationDialog
        open={isProjectVideoConfirmOpen}
        title="确认生成项目总片"
        description="会自动收集当前项目内已生成成功的片段视频，按章节和片段顺序合成为一个项目级粗剪视频。"
        items={[
          { label: "项目名称", value: selectedProject?.name ?? "-" },
          { label: "输出规格", value: "720P / 保留各片段原音轨" },
        ]}
        confirmLabel="确认合成"
        onOpenChange={setIsProjectVideoConfirmOpen}
        onConfirm={() => void confirmComposeProjectVideo()}
      />

      <VideoGenerationDialog
        open={isVideoConfirmOpen}
        preview={videoGenerationPreview}
        previewSpecLabel={previewVideoSpecLabel}
        sceneTitle={selectedScene?.title ?? "-"}
        selectedModel={selectedVideoModel}
        activeDuration={activeVideoDuration}
        useFirstFrame={useFirstFrameForVideo}
        shotNumberLabel={selectedShot ? formatShotNumber(selectedShot.shot_number) : ""}
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
            value: deleteTargetGeneration?.media_type === MEDIA_TYPE.VIDEO ? "视频" : "首帧",
          },
          { label: "模型", value: deleteTargetGeneration?.model ?? "-" },
          {
            label: "生成时间",
            value: formatShanghaiDateTime(deleteTargetGeneration?.created_at),
          },
        ]}
        confirmLabel="确认删除"
        tone="danger"
        onOpenChange={(open) => !open && setDeleteTargetGeneration(null)}
        onConfirm={() => void confirmDeleteGeneration()}
      />

      <ConfirmationDialog
        open={!!deleteTargetScene}
        title="确认删除片段"
        description="该操作会删除当前片段及其 Prompt、引用和媒体历史，需要二次确认。"
        items={[
          { label: "片段标题", value: deleteTargetScene?.title ?? "-" },
          { label: "地点", value: deleteTargetScene?.location ?? "-" },
          { label: "时间", value: deleteTargetScene?.time_of_day ?? "-" },
        ]}
        confirmLabel="确认删除"
        tone="danger"
        onOpenChange={(open) => !open && setDeleteTargetScene(null)}
        onConfirm={() => void confirmDeleteScene()}
      />
    </>
  );
}

// ── Preview dialogs: image, frame extraction, video previews ────────────────

type PreviewImageState = {
  src: string;
  alt: string;
  items?: { src: string; alt: string }[];
  currentIndex?: number;
} | null;

type PreviewDialogsProps = {
  previewImage: PreviewImageState;
  setPreviewImage: (preview: PreviewImageState) => void;
  frameExtractionGeneration: StoryboardMediaGeneration | null;
  setFrameExtractionGeneration: (generation: StoryboardMediaGeneration | null) => void;
  selectedScene: Scene | null;
  nextSceneInChapter: Scene | null;
  handleInsertVideoFrame: (
    file: File,
    timestampMs: number,
    targetScene: Scene,
  ) => Promise<SceneVideoFrame>;
  handleCreateVideoClip: (startMs: number, endMs: number) => Promise<void>;
  previewSceneVideo: VideoPreview | null;
  setPreviewSceneVideo: (preview: VideoPreview | null) => void;
  previewProjectVideo: VideoPreview | null;
  setPreviewProjectVideo: (preview: VideoPreview | null) => void;
};

export function PreviewDialogs({
  previewImage,
  setPreviewImage,
  frameExtractionGeneration,
  setFrameExtractionGeneration,
  selectedScene,
  nextSceneInChapter,
  handleInsertVideoFrame,
  handleCreateVideoClip,
  previewSceneVideo,
  setPreviewSceneVideo,
  previewProjectVideo,
  setPreviewProjectVideo,
}: PreviewDialogsProps) {
  return (
    <>
      <ImagePreviewDialog
        open={!!previewImage}
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null);
        }}
        src={previewImage?.src ?? ""}
        alt={previewImage?.alt ?? "片段预览图"}
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
    </>
  );
}
