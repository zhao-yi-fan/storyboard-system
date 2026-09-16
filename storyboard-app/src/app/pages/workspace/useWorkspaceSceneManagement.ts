import { toast } from "sonner";

import {
  chapterApi,
  type Project,
  projectApi,
  type Scene,
  sceneApi,
  type StoryboardMediaGeneration,
} from "../../api";
import { GENERATION_STATUS } from "../../constants/domain";
import { type WorkspaceState } from "./useWorkspaceState";
import { emptyDescriptionOptimization,emptySceneForm } from "./utils";

type SceneManagementDeps = Pick<
  WorkspaceState,
  | "selectedProject"
  | "selectedChapter"
  | "selectedScene"
  | "selectedShot"
  | "scenes"
  | "filteredShots"
  | "newSceneForm"
  | "setNewSceneForm"
  | "descriptionOptimization"
  | "setDescriptionOptimization"
  | "sceneInsertSortOrder"
  | "setSceneInsertSortOrder"
  | "isCreatingScene"
  | "setIsCreatingScene"
  | "isComposingProjectVideo"
  | "setIsComposingProjectVideo"
  | "isProjectVideoConfirmOpen"
  | "setIsProjectVideoConfirmOpen"
  | "isSceneVideoConfirmOpen"
  | "setIsSceneVideoConfirmOpen"
  | "isSceneCoverConfirmOpen"
  | "setIsSceneCoverConfirmOpen"
  | "isBatchSceneCoverConfirmOpen"
  | "setIsBatchSceneCoverConfirmOpen"
  | "deleteTargetScene"
  | "setDeleteTargetScene"
  | "activeChapterForSceneCreation"
  | "activeMediaActionKey"
  | "setActiveMediaActionKey"
  | "deleteTargetGeneration"
  | "setDeleteTargetGeneration"
  | "composableShots"
  | "expandedChapters"
  | "setExpandedChapters"
  | "applySceneUpdate"
  | "applyStoryboardsRefresh"
  | "applyMediaMutation"
  | "loadScenes"
  | "loadStoryboards"
  | "loadMediaGenerations"
  | "loadGenerationReferences"
  | "setSelectedChapter"
  | "setIsCreateSceneOpen"
  | "setPreviewProjectVideo"
  | "frameExtractionGeneration"
> & {
  applyClipSceneUpdate: (scene: Scene) => void;
};

export function useWorkspaceSceneManagement(deps: SceneManagementDeps) {
  const {
    selectedProject,
    selectedChapter,
    selectedScene,
    selectedShot,
    filteredShots,
    newSceneForm,
    setNewSceneForm,
    descriptionOptimization,
    setDescriptionOptimization,
    sceneInsertSortOrder,
    setSceneInsertSortOrder,
    isCreatingScene,
    setIsCreatingScene,
    isComposingProjectVideo,
    setIsComposingProjectVideo,
    isProjectVideoConfirmOpen,
    setIsProjectVideoConfirmOpen,
    isSceneVideoConfirmOpen,
    setIsSceneVideoConfirmOpen,
    isSceneCoverConfirmOpen,
    setIsSceneCoverConfirmOpen,
    isBatchSceneCoverConfirmOpen,
    setIsBatchSceneCoverConfirmOpen,
    deleteTargetScene,
    setDeleteTargetScene,
    activeChapterForSceneCreation,
    activeMediaActionKey,
    setActiveMediaActionKey,
    deleteTargetGeneration,
    setDeleteTargetGeneration,
    expandedChapters,
    setExpandedChapters,
    applySceneUpdate,
    applyStoryboardsRefresh,
    applyMediaMutation,
    loadScenes,
    loadStoryboards,
    loadMediaGenerations,
    loadGenerationReferences,
    setSelectedChapter,
    setIsCreateSceneOpen,
    frameExtractionGeneration,
    applyClipSceneUpdate,
  } = deps;

  // ── Scene form helpers ─────────────────────────────────────────────

  const updateNewSceneForm = <K extends keyof typeof emptySceneForm>(
    key: K,
    value: (typeof emptySceneForm)[K],
  ) => {
    setNewSceneForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetNewSceneForm = () => {
    setNewSceneForm(emptySceneForm);
    setDescriptionOptimization(emptyDescriptionOptimization);
  };

  const openCreateSceneDialog = (sortOrder: number | null = null) => {
    setSceneInsertSortOrder(sortOrder);
    setIsCreateSceneOpen(true);
  };

  // ── Description optimization ───────────────────────────────────────

  const requestDescriptionOptimization = async () => {
    const originalDescription = newSceneForm.description.trim();
    if (!originalDescription || descriptionOptimization.loading || isCreatingScene) return;

    setDescriptionOptimization({
      open: true,
      loading: true,
      original: originalDescription,
      candidate: "",
      model: "",
      error: "",
    });
    try {
      const result = await sceneApi.optimizeSceneDescription(
        newSceneForm.title.trim(),
        originalDescription,
      );
      setDescriptionOptimization({
        open: true,
        loading: false,
        original: result.original_description,
        candidate: result.optimized_description,
        model: result.model,
        error: "",
      });
    } catch (error) {
      console.error("Failed to optimize scene description:", error);
      setDescriptionOptimization((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "片段描述优化失败，请稍后重试",
      }));
    }
  };

  const confirmDescriptionOptimization = () => {
    if (!descriptionOptimization.candidate) return;
    updateNewSceneForm("description", descriptionOptimization.candidate);
    setDescriptionOptimization(emptyDescriptionOptimization);
    toast.success("已替换为 AI 候选描述，确认创建后才会保存");
  };

  // ── Create scene ───────────────────────────────────────────────────

  const handleCreateScene = async () => {
    if (!selectedProject || !newSceneForm.title.trim()) return;

    setIsCreatingScene(true);
    try {
      const targetChapter = activeChapterForSceneCreation ?? await chapterApi.createChapter(selectedProject.id, {
          title: "第1章",
          summary: "",
        });

      const scene = await sceneApi.createScene(targetChapter.id, {
        title: newSceneForm.title.trim(),
        description: newSceneForm.description.trim(),
        sort_order: sceneInsertSortOrder ?? undefined,
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

  // ── Delete scene ───────────────────────────────────────────────────

  const handleRequestDeleteScene = (scene: Scene) => {
    setDeleteTargetScene(scene);
  };

  const confirmDeleteScene = async () => {
    if (!deleteTargetScene) return;
    try {
      await sceneApi.deleteScene(deleteTargetScene.id);
      const deletingSelected = selectedScene?.id === deleteTargetScene.id;
      setDeleteTargetScene(null);
      if (selectedChapter) {
        await loadScenes(selectedChapter.id, false);
      }
      if (deletingSelected) {
        setSelectedScene(null);
      }
    } catch (error) {
      console.error("Failed to delete scene:", error);
    }
  };

  // ── Scene cover generation ─────────────────────────────────────────

  const confirmGenerateSceneCover = async () => {
    setIsSceneCoverConfirmOpen(false);
    if (!selectedScene) return;
    try {
      const result = await sceneApi.generateSceneCover(selectedScene.id);
      applySceneUpdate(result.scene);
      toast.success("片段封面生成完成");
    } catch (error) {
      console.error("Failed to generate scene cover:", error);
    }
  };

  // ── Batch scene cover generation ───────────────────────────────────

  const confirmBatchGenerateSceneCovers = async () => {
    setIsBatchSceneCoverConfirmOpen(false);
    if (!selectedScene) return;
    const currentShotId = selectedShot?.id ?? null;
    try {
      const result = await sceneApi.generateSceneStoryboardCovers(selectedScene.id);
      applySceneUpdate(result.scene);
      applyStoryboardsRefresh(result.storyboards);
      if (currentShotId) {
        const refreshedSelected = result.storyboards.find((shot) => shot.id === currentShotId);
        if (refreshedSelected) {
          await loadMediaGenerations(refreshedSelected.id);
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
    }
  };

  // ── Scene video compose ────────────────────────────────────────────

  const confirmComposeSceneVideo = async () => {
    setIsSceneVideoConfirmOpen(false);
    if (!selectedScene) return;
    try {
      const result = await sceneApi.composeSceneVideo(selectedScene.id);
      applySceneUpdate(result.scene);
      toast.success("片段视频合成完成");
    } catch (error) {
      console.error("Failed to compose scene video:", error);
    }
  };

  // ── Project video compose ──────────────────────────────────────────

  const handleComposeProjectVideo = () => {
    if (!selectedProject || isComposingProjectVideo) return;
    setIsProjectVideoConfirmOpen(true);
  };

  const confirmComposeProjectVideo = async () => {
    setIsProjectVideoConfirmOpen(false);
    if (!selectedProject) return;
    setIsComposingProjectVideo(true);
    try {
      const result = await projectApi.composeProjectVideo(selectedProject.id);
      // Apply project update via the workspace-level setter
      // This is passed through deps since project update affects project state
      const applyProjectUpdate = (deps as unknown as {
        applyProjectUpdate: (p: Project) => void;
      }).applyProjectUpdate;
      if (applyProjectUpdate) {
        applyProjectUpdate(result.project);
      }
      toast.success("项目总片合成完成");
    } catch (error) {
      console.error("Failed to compose project video:", error);
    } finally {
      setIsComposingProjectVideo(false);
    }
  };

  // ── Media generation management ────────────────────────────────────

  const handleSetCurrentGeneration = async (generation: StoryboardMediaGeneration) => {
    if (!selectedShot) return;
    if (generation.status !== GENERATION_STATUS.SUCCEEDED || !generation.result_url) {
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

  const confirmDeleteGeneration = async () => {
    if (!selectedShot || !deleteTargetGeneration) return;
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

  // ── Video frame extraction ─────────────────────────────────────────

  const handleInsertVideoFrame = async (file: File, timestampMs: number, targetScene: Scene) => {
    if (!selectedScene || !frameExtractionGeneration) {
      throw new Error("抽帧来源不可用");
    }
    const frame = await sceneApi.createSceneVideoFrame(
      selectedScene.id,
      frameExtractionGeneration.id,
      { file, timestampMs, targetSceneId: targetScene.id },
    );
    await loadMediaGenerations(selectedScene.id);
    if (targetScene.id === selectedScene.id) {
      const refreshed = await sceneApi.getScene(selectedScene.id);
      applyClipSceneUpdate(refreshed);
      await loadGenerationReferences(selectedScene.id);
    }
    toast.success(`已将抽帧作为「${targetScene.title}」的参考图`);
    return frame;
  };

  const handleCreateVideoClip = async (startMs: number, endMs: number) => {
    if (!selectedScene || !frameExtractionGeneration) {
      throw new Error("视频来源不可用");
    }
    const result = await sceneApi.createSceneVideoClip(
      selectedScene.id,
      frameExtractionGeneration.id,
      { startMs, endMs },
    );
    applyMediaMutation(result);
    toast.success("截取视频已保存到视频版本");
  };

  return {
    updateNewSceneForm,
    resetNewSceneForm,
    openCreateSceneDialog,
    requestDescriptionOptimization,
    confirmDescriptionOptimization,
    handleCreateScene,
    handleRequestDeleteScene,
    confirmDeleteScene,
    confirmGenerateSceneCover,
    confirmBatchGenerateSceneCovers,
    confirmComposeSceneVideo,
    handleComposeProjectVideo,
    confirmComposeProjectVideo,
    handleSetCurrentGeneration,
    handleRequestDeleteGeneration,
    confirmDeleteGeneration,
    handleInsertVideoFrame,
    handleCreateVideoClip,
  };
}
