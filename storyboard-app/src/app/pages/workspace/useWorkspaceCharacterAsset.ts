import { toast } from "sonner";

import {
  sceneApi,
} from "../../api";
import { PROMPT_MENTION_CATEGORY } from "../../components/workspace/RichPromptEditor";
import { ENTITY_TYPE } from "../../constants/domain";
import { COMPOSITE_PROMPT_SPEC } from "../../lib/compositePrompt";
import { type WorkspaceState } from "./useWorkspaceState";
import { getAssetMentionPresentation, type ShotFormState } from "./utils";

type CharacterAssetDeps = Pick<
  WorkspaceState,
  | "selectedProject"
  | "selectedShot"
  | "selectedScene"
  | "projectCharacters"
  | "projectAssets"
  | "shotForm"
  | "isManageCharactersOpen"
  | "setIsManageCharactersOpen"
  | "isManageAssetsOpen"
  | "setIsManageAssetsOpen"
  | "isLoadingProjectCharacters"
  | "isLoadingProjectAssets"
  | "activeCharacterActionKey"
  | "setActiveCharacterActionKey"
  | "activeAssetActionKey"
  | "setActiveAssetActionKey"
  | "isOptimizingPrompt"
  | "setIsOptimizingPrompt"
  | "isPromptOptimizationOpen"
  | "setIsPromptOptimizationOpen"
  | "promptOptimizationOriginal"
  | "setPromptOptimizationOriginal"
  | "promptOptimizationCandidate"
  | "setPromptOptimizationCandidate"
  | "promptOptimizationModel"
  | "setPromptOptimizationModel"
  | "promptOptimizationError"
  | "setPromptOptimizationError"
  | "applyClipSceneUpdate"
  | "loadGenerationReferences"
  | "loadProjectCharacters"
  | "loadProjectAssets"
> & {
  updateShotForm: <K extends keyof ShotFormState>(
    key: K,
    value: ShotFormState[K],
  ) => void;
};

export type PromptMentionOption = {
  id: number;
  kind: (typeof ENTITY_TYPE)[keyof typeof ENTITY_TYPE];
  name: string;
  imageUrl?: string | null;
  isBound: boolean;
  category: string;
  description: string;
  media: readonly ("image" | "audio")[];
  searchText: string;
};

export function useWorkspaceCharacterAsset(deps: CharacterAssetDeps) {
  const {
    selectedProject,
    selectedShot,
    selectedScene,
    projectCharacters,
    projectAssets,
    shotForm,
    isManageCharactersOpen,
    setIsManageCharactersOpen,
    isManageAssetsOpen,
    setIsManageAssetsOpen,
    isLoadingProjectCharacters,
    isLoadingProjectAssets,
    activeCharacterActionKey,
    setActiveCharacterActionKey,
    activeAssetActionKey,
    setActiveAssetActionKey,
    isOptimizingPrompt,
    setIsOptimizingPrompt,
    isPromptOptimizationOpen,
    setIsPromptOptimizationOpen,
    promptOptimizationOriginal,
    setPromptOptimizationOriginal,
    promptOptimizationCandidate,
    setPromptOptimizationCandidate,
    promptOptimizationModel,
    setPromptOptimizationModel,
    promptOptimizationError,
    setPromptOptimizationError,
    applyClipSceneUpdate,
    loadGenerationReferences,
    loadProjectCharacters,
    loadProjectAssets,
    updateShotForm,
  } = deps;

  // ── Character operations ───────────────────────────────────────────

  const handleOpenManageCharacters = async () => {
    if (!selectedProject) return;
    setIsManageCharactersOpen(true);
    await loadProjectCharacters(selectedProject.id);
  };

  const handleAddStoryboardCharacter = async (characterId: number) => {
    if (!selectedShot) return;
    const actionKey = `add-character:${characterId}`;
    setActiveCharacterActionKey(actionKey);
    try {
      const nextScene = await sceneApi.addSceneCharacter(selectedShot.id, characterId);
      applyClipSceneUpdate(nextScene);
      await loadGenerationReferences(nextScene.id);
      toast.success("已添加片段角色");
    } catch (error) {
      console.error("Failed to add storyboard character:", error);
      toast.error(error instanceof Error ? error.message : "添加片段角色失败");
    } finally {
      setActiveCharacterActionKey(null);
    }
  };

  const handleRemoveStoryboardCharacter = async (characterId: number) => {
    if (!selectedShot) return;
    const actionKey = `remove-character:${characterId}`;
    setActiveCharacterActionKey(actionKey);
    try {
      const nextScene = await sceneApi.removeSceneCharacter(selectedShot.id, characterId);
      applyClipSceneUpdate(nextScene);
      await loadGenerationReferences(nextScene.id);
      toast.success("已移除片段角色");
    } catch (error) {
      console.error("Failed to remove storyboard character:", error);
      toast.error(error instanceof Error ? error.message : "移除片段角色失败");
    } finally {
      setActiveCharacterActionKey(null);
    }
  };

  // ── Asset operations ───────────────────────────────────────────────

  const handleOpenManageAssets = async () => {
    if (!selectedProject || !selectedShot) return;
    setIsManageAssetsOpen(true);
    await loadProjectAssets(selectedProject.id);
  };

  const handleAddStoryboardAsset = async (assetId: number) => {
    if (!selectedShot) return;
    const actionKey = `add-asset:${assetId}`;
    setActiveAssetActionKey(actionKey);
    try {
      const updated = await sceneApi.addSceneAsset(selectedShot.id, assetId);
      applyClipSceneUpdate(updated);
      await loadGenerationReferences(updated.id);
    } catch (error) {
      console.error("Failed to add storyboard asset:", error);
      toast.error(error instanceof Error ? error.message : "添加参考资产失败");
    } finally {
      setActiveAssetActionKey(null);
    }
  };

  const handleRemoveStoryboardAsset = async (assetId: number) => {
    if (!selectedShot) return;
    const actionKey = `remove-asset:${assetId}`;
    setActiveAssetActionKey(actionKey);
    try {
      const updated = await sceneApi.removeSceneAsset(selectedShot.id, assetId);
      applyClipSceneUpdate(updated);
      await loadGenerationReferences(updated.id);
    } catch (error) {
      console.error("Failed to remove storyboard asset:", error);
      toast.error(error instanceof Error ? error.message : "移除参考资产失败");
    } finally {
      setActiveAssetActionKey(null);
    }
  };

  // ── Prompt mention operations ──────────────────────────────────────

  const handleSelectPromptMention = async (option: PromptMentionOption) => {
    if (!selectedShot || option.isBound) return;
    if (option.kind === ENTITY_TYPE.CHARACTER) {
      await handleAddStoryboardCharacter(option.id);
      return;
    }
    await handleAddStoryboardAsset(option.id);
  };

  const handleRemovePromptMentions = async (removedOptions: PromptMentionOption[]) => {
    if (!selectedShot || !removedOptions.length) return;
    const sceneId = selectedShot.id;
    const failedNames: string[] = [];
    for (const option of removedOptions) {
      try {
        const nextScene =
          option.kind === ENTITY_TYPE.CHARACTER
            ? await sceneApi.removeSceneCharacter(sceneId, option.id)
            : await sceneApi.removeSceneAsset(sceneId, option.id);
        applyClipSceneUpdate(nextScene);
      } catch (error) {
        console.error("Failed to remove prompt mention reference:", error);
        failedNames.push(option.name);
      }
    }
    if (failedNames.length) {
      toast.error(`提示词已删除，但以下参考移除失败：${failedNames.join("、")}`);
      return;
    }
    await loadGenerationReferences(sceneId);
    toast.success("已同步移除对应参考");
  };

  // ── Prompt mention options builder ─────────────────────────────────

  const promptMentionOptions: PromptMentionOption[] = [
    ...projectCharacters.map((character) => ({
      id: character.id,
      kind: ENTITY_TYPE.CHARACTER,
      name: character.name,
      imageUrl: character.design_sheet_url ?? character.avatar_url,
      isBound: !!selectedShot?.characters?.some((item) => item.id === character.id),
      category: PROMPT_MENTION_CATEGORY.CHARACTER,
      description: character.description ?? "人物资产",
      media: [
        ...(character.design_sheet_url ? (["image"] as const) : []),
        ...(character.voice_reference_url ? (["audio"] as const) : []),
      ],
      searchText: `${character.voice_name ?? ""} 人物 角色`,
    })),
    ...projectAssets.map((asset) => {
      const presentation = getAssetMentionPresentation(asset);
      return {
        id: asset.id,
        kind: ENTITY_TYPE.ASSET,
        name: asset.name,
        imageUrl:
          presentation.category === PROMPT_MENTION_CATEGORY.AUDIO
            ? asset.thumbnail_url ?? asset.cover_url
            : asset.cover_url ?? asset.file_url ?? asset.thumbnail_url,
        isBound: !!selectedShot?.assets?.some((item) => item.id === asset.id),
        category: presentation.category,
        description: asset.meta ?? asset.type ?? "项目资产",
        media: presentation.media,
        searchText: `${asset.type ?? ""} ${asset.meta ?? ""}`,
      };
    }),
  ];

  // ── Prompt optimization ────────────────────────────────────────────

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

  return {
    handleOpenManageCharacters,
    handleAddStoryboardCharacter,
    handleRemoveStoryboardCharacter,
    handleOpenManageAssets,
    handleAddStoryboardAsset,
    handleRemoveStoryboardAsset,
    handleSelectPromptMention,
    handleRemovePromptMentions,
    promptMentionOptions,
    requestPromptOptimization,
    confirmPromptOptimization,
  };
}
