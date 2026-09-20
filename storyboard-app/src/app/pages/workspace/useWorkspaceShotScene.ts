import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { toast } from "sonner";

import type { Chapter, Project, Scene, Storyboard } from "../../api";
import { chapterApi, sceneApi } from "../../api";
import { COMPOSITE_PROMPT_SPEC } from "../../lib/compositePrompt";
import type { ShotFormState } from "./Workspace.helpers";
import { emptyDescriptionOptimization, emptySceneForm } from "./Workspace.helpers";

type UseWorkspaceShotSceneDeps = {
  selectedProject: Project | null;
  selectedChapter: Chapter | null;
  selectedScene: Scene | null;
  selectedShot: Storyboard | null;
  activeChapterForSceneCreation: Chapter | null;
  shotForm: ShotFormState;
  setShotForm: Dispatch<SetStateAction<ShotFormState>>;
  setSelectedScene: (scene: Scene | null) => void;
  setSelectedShot: (shot: Storyboard | null) => void;
  setStoryboards: (storyboards: Storyboard[]) => void;
  setChapters: (chapters: Chapter[]) => void;
  setSelectedChapter: (chapter: Chapter | null) => void;
  setExpandedChapters: (ids: number[]) => void;
  loadScenes: (chapterId: number, autoSelect?: boolean) => Promise<void>;
  loadStoryboards: (sceneId: number) => Promise<void>;
};

export function useWorkspaceShotScene({
  selectedProject,
  selectedChapter,
  selectedScene,
  selectedShot,
  activeChapterForSceneCreation,
  shotForm,
  setShotForm,
  setSelectedScene,
  setSelectedShot,
  setStoryboards,
  setChapters,
  setSelectedChapter,
  setExpandedChapters,
  loadScenes,
  loadStoryboards,
}: UseWorkspaceShotSceneDeps) {
  const [deleteTargetScene, setDeleteTargetScene] = useState<Scene | null>(null);
  const [isPromptFullscreenOpen, setIsPromptFullscreenOpen] = useState(false);
  const [isPromptOptimizationOpen, setIsPromptOptimizationOpen] = useState(false);
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
  const [promptOptimizationOriginal, setPromptOptimizationOriginal] = useState("");
  const [promptOptimizationCandidate, setPromptOptimizationCandidate] = useState("");
  const [promptOptimizationModel, setPromptOptimizationModel] = useState("");
  const [promptOptimizationError, setPromptOptimizationError] = useState("");
  const [newSceneForm, setNewSceneForm] = useState(emptySceneForm);
  const [descriptionOptimization, setDescriptionOptimization] = useState(
    emptyDescriptionOptimization,
  );
  const [isCreateSceneOpen, setIsCreateSceneOpen] = useState(false);
  const [sceneInsertSortOrder, setSceneInsertSortOrder] = useState<number | null>(null);
  const [isCreatingScene, setIsCreatingScene] = useState(false);

  const handleRequestDeleteScene = (scene: Scene) => {
    setDeleteTargetScene(scene);
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

  const updateShotForm = <K extends keyof ShotFormState>(key: K, value: ShotFormState[K]) => {
    setShotForm((prev) => ({ ...prev, [key]: value }));
  };

  const requestPromptOptimization = async () => {
    if (!selectedShot || isOptimizingPrompt) return;
    if (!shotForm.content.trim()) {
      toast.error("请先输入需要优化的提示词");
      return;
    }
    if (shotForm.content.length > COMPOSITE_PROMPT_SPEC.MAX_LENGTH) {
      toast.error(`提示词最多支持 ${COMPOSITE_PROMPT_SPEC.MAX_LENGTH} 个字符`);
      return;
    }

    const originalPrompt = shotForm.content;
    setPromptOptimizationOriginal(originalPrompt);
    setPromptOptimizationCandidate("");
    setPromptOptimizationModel("");
    setPromptOptimizationError("");
    setIsPromptOptimizationOpen(true);
    setIsOptimizingPrompt(true);
    try {
      const result = await sceneApi.optimizeScenePrompt(selectedShot.id, originalPrompt);
      setPromptOptimizationOriginal(result.original_prompt);
      setPromptOptimizationCandidate(result.optimized_prompt);
      setPromptOptimizationModel(result.model);
    } catch (error) {
      console.error("Failed to optimize prompt:", error);
      setPromptOptimizationError(
        error instanceof Error ? error.message : "提示词优化失败，请稍后重试",
      );
    } finally {
      setIsOptimizingPrompt(false);
    }
  };

  const confirmPromptOptimization = () => {
    if (!promptOptimizationCandidate) return;
    updateShotForm("content", promptOptimizationCandidate);
    setIsPromptOptimizationOpen(false);
    toast.success("已替换为 AI 候选稿，保存或生成时将写入片段");
  };

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

  const handleCreateScene = async () => {
    if (!selectedProject || !newSceneForm.title.trim()) {
      return;
    }

    setIsCreatingScene(true);
    try {
      let targetChapter = activeChapterForSceneCreation;

      if (!targetChapter) {
        targetChapter = await chapterApi.createChapter(selectedProject.id, {
          title: "第1章",
          summary: "",
        });
        setChapters([targetChapter]);
      }

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

  return {
    deleteTargetScene,
    setDeleteTargetScene,
    isPromptFullscreenOpen,
    setIsPromptFullscreenOpen,
    isPromptOptimizationOpen,
    setIsPromptOptimizationOpen,
    isOptimizingPrompt,
    promptOptimizationOriginal,
    promptOptimizationCandidate,
    promptOptimizationModel,
    promptOptimizationError,
    newSceneForm,
    setNewSceneForm,
    descriptionOptimization,
    setDescriptionOptimization,
    isCreateSceneOpen,
    setIsCreateSceneOpen,
    sceneInsertSortOrder,
    setSceneInsertSortOrder,
    isCreatingScene,
    handleRequestDeleteScene,
    confirmDeleteScene,
    updateShotForm,
    requestPromptOptimization,
    confirmPromptOptimization,
    updateNewSceneForm,
    resetNewSceneForm,
    openCreateSceneDialog,
    requestDescriptionOptimization,
    confirmDescriptionOptimization,
    handleCreateScene,
  };
}
