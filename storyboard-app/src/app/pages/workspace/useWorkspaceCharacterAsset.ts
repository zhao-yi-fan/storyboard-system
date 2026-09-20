import { useState } from "react";
import { toast } from "sonner";

import type { Project, Scene, Storyboard } from "../../api";
import { sceneApi } from "../../api";
import type { PromptMentionOption } from "../../components/workspace/RichPromptEditor";
import { ENTITY_TYPE } from "../../constants/domain";

type UseWorkspaceCharacterAssetDeps = {
  selectedProject: Project | null;
  selectedShot: Storyboard | null;
  applyClipSceneUpdate: (scene: Scene) => void;
  loadGenerationReferences: (sceneId: number) => Promise<void>;
  loadProjectCharacters: (projectId: number) => Promise<void>;
  loadProjectAssets: (projectId: number) => Promise<void>;
};

export function useWorkspaceCharacterAsset({
  selectedProject,
  selectedShot,
  applyClipSceneUpdate,
  loadGenerationReferences,
  loadProjectCharacters,
  loadProjectAssets,
}: UseWorkspaceCharacterAssetDeps) {
  const [isManageCharactersOpen, setIsManageCharactersOpen] = useState(false);
  const [isManageAssetsOpen, setIsManageAssetsOpen] = useState(false);
  const [activeCharacterActionKey, setActiveCharacterActionKey] = useState<string | null>(null);
  const [activeAssetActionKey, setActiveAssetActionKey] = useState<string | null>(null);

  const handleOpenManageCharacters = async () => {
    if (!selectedProject) {
      return;
    }
    setIsManageCharactersOpen(true);
    await loadProjectCharacters(selectedProject.id);
  };

  const handleAddStoryboardCharacter = async (characterId: number) => {
    if (!selectedShot) {
      return;
    }
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
    if (!selectedShot) {
      return;
    }
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

  const handleOpenManageAssets = async () => {
    if (!selectedProject || !selectedShot) {
      return;
    }
    setIsManageAssetsOpen(true);
    await loadProjectAssets(selectedProject.id);
  };

  const handleAddStoryboardAsset = async (assetId: number) => {
    if (!selectedShot) {
      return;
    }
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
    if (!selectedShot) {
      return;
    }
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

  const handleSelectPromptMention = async (option: PromptMentionOption) => {
    if (!selectedShot || option.isBound) {
      return;
    }
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

  return {
    isManageCharactersOpen,
    setIsManageCharactersOpen,
    isManageAssetsOpen,
    setIsManageAssetsOpen,
    activeCharacterActionKey,
    activeAssetActionKey,
    handleOpenManageCharacters,
    handleAddStoryboardCharacter,
    handleRemoveStoryboardCharacter,
    handleOpenManageAssets,
    handleAddStoryboardAsset,
    handleRemoveStoryboardAsset,
    handleSelectPromptMention,
    handleRemovePromptMentions,
  };
}
