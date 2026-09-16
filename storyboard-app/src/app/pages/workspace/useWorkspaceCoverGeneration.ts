import { toast } from "sonner";

import {
  sceneApi,
  type SceneGenerationReferences,
  type StoryboardMediaGeneration,
} from "../../api";
import { type WorkspaceState } from "./useWorkspaceState";
import {
  buildCoverPreviewItems,
} from "./utils";

type CoverGenerationDeps = Pick<
  WorkspaceState,
  | "selectedShot"
  | "selectedScene"
  | "coverGenerations"
  | "coverGenerationPreview"
  | "setCoverGenerationPreview"
  | "setGenerationReferences"
  | "coverGenerationError"
  | "setCoverGenerationError"
  | "isSavingShot"
  | "isLoadingCoverPreview"
  | "setIsLoadingCoverPreview"
  | "generatingCoverId"
  | "setGeneratingCoverId"
  | "setPendingGeneratedShotId"
  | "applyClipSceneUpdate"
  | "loadMediaGenerations"
  | "setPreviewImage"
  | "setIsCoverConfirmOpen"
  | "setIsManageCharactersOpen"
  | "setIsManageAssetsOpen"
> & {
  saveShotDraftBeforeGeneration: () => Promise<boolean>;
};

export function useWorkspaceCoverGeneration(deps: CoverGenerationDeps) {
  const {
    selectedShot,
    selectedScene,
    coverGenerations,
    coverGenerationPreview,
    setCoverGenerationPreview,
    setGenerationReferences,
    setCoverGenerationError,
    isSavingShot,
    isLoadingCoverPreview,
    setIsLoadingCoverPreview,
    generatingCoverId,
    setGeneratingCoverId,
    applyClipSceneUpdate,
    loadMediaGenerations,
    setPreviewImage,
    setIsCoverConfirmOpen,
    setIsManageCharactersOpen,
    setIsManageAssetsOpen,
    saveShotDraftBeforeGeneration,
  } = deps;

  const runGenerateCover = async (useTextOnly = false) => {
    if (!selectedShot) return;

    setGeneratingCoverId(selectedShot.id);
    setCoverGenerationError("");
    try {
      const result = await sceneApi.generateSceneClipCover(selectedShot.id, {
        ...(coverGenerationPreview?.model
          ? { model: coverGenerationPreview.model }
          : { model: "seedream-4.5" }),
        ...(useTextOnly ? { use_text_only: true } : {}),
      });
      applyClipSceneUpdate(result.scene);
      await loadMediaGenerations(result.scene.id);
    } catch (error) {
      console.error("Failed to generate storyboard cover:", error);
      const message = error instanceof Error ? error.message : "首帧生成失败，请重试";
      setCoverGenerationError(message);
      toast.error(message);
    } finally {
      setGeneratingCoverId(null);
      setCoverGenerationPreview(null);
    }
  };

  const openCoverHistoryPreview = (generation: StoryboardMediaGeneration) => {
    const items = buildCoverPreviewItems(coverGenerations);
    const currentIndex = items.findIndex((item) => item.src === generation.result_url);
    setPreviewImage({
      src: generation.result_url ?? "",
      alt: `首帧历史 ${generation.id}`,
      items,
      currentIndex: currentIndex >= 0 ? currentIndex : 0,
    });
  };

  const openGenerationReferencePreview = (referenceIndex: number) => {
    const references =
      (deps as unknown as { generationReferences: SceneGenerationReferences | null })
        .generationReferences?.reference_images ?? [];
    const reference = references[referenceIndex];
    if (!reference) return;
    const items = references.map((item) => ({
      src: item.url,
      alt: `${item.name || item.type} · ${item.source}`,
    }));
    setPreviewImage({
      src: reference.url,
      alt: `${reference.name || reference.type} · ${reference.source}`,
      items,
      currentIndex: referenceIndex,
    });
  };

  const handleGenerateCover = async () => {
    if (
      !selectedShot ||
      generatingCoverId === selectedShot.id ||
      isLoadingCoverPreview ||
      isSavingShot
    ) {
      return;
    }

    setCoverGenerationError("");
    if (!(await saveShotDraftBeforeGeneration())) return;

    setIsLoadingCoverPreview(true);
    try {
      const preview = await sceneApi.getSceneClipCoverGenerationPreview(
        selectedShot.id,
        "seedream-4.5",
      );
      setCoverGenerationPreview(preview);
      setGenerationReferences({
        reference_images: preview.reference_images,
        missing_references: preview.missing_references,
        mappings: preview.mappings ?? [],
        bound_without_mentions: preview.bound_without_mentions ?? [],
        unbound_mentions: preview.unbound_mentions ?? [],
        recognized_bound_mentions: (preview.mappings ?? [])
          .filter((mapping) => mapping.is_mentioned)
          .map((mapping) => mapping.name),
      });
      setIsCoverConfirmOpen(true);
    } catch (error) {
      console.error("Failed to preview storyboard cover generation:", error);
      const message = error instanceof Error ? error.message : "首帧生成预览失败，请重试";
      setCoverGenerationError(message);
      toast.error(message);
    } finally {
      setIsLoadingCoverPreview(false);
    }
  };

  const confirmGenerateCover = async (useTextOnly = false) => {
    setIsCoverConfirmOpen(false);
    await runGenerateCover(useTextOnly);
  };

  const handleManageCharactersForCover = () => {
    setIsCoverConfirmOpen(false);
    window.setTimeout(() => setIsManageCharactersOpen(true), 0);
  };

  const handleManageAssetsForCover = () => {
    setIsCoverConfirmOpen(false);
    window.setTimeout(() => setIsManageAssetsOpen(true), 0);
  };

  return {
    runGenerateCover,
    openCoverHistoryPreview,
    openGenerationReferencePreview,
    handleGenerateCover,
    confirmGenerateCover,
    handleManageCharactersForCover,
    handleManageAssetsForCover,
  };
}
