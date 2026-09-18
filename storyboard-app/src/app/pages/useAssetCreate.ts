import { useState } from "react";
import { toast } from "sonner";

import { assetApi, characterApi, ossApi } from "../api";
import { getAssetTab } from "../components/assets/AssetCollection";
import type { NewAssetDraft } from "../components/assets/dialogs/CreateAssetDialog";
import {
  ASSET_KIND,
  ASSET_LIBRARY_TAB,
  ENTITY_TYPE,
} from "../constants/domain";
import type { CreateMode, SelectedAsset } from "./AssetLibrary.helpers";

type UseAssetCreateDeps = {
  currentProjectId: number;
  activeTab: (typeof ASSET_LIBRARY_TAB)[keyof typeof ASSET_LIBRARY_TAB];
  loadCharacters: () => Promise<void>;
  loadAssets: () => Promise<void>;
  setActiveTab: (tab: (typeof ASSET_LIBRARY_TAB)[keyof typeof ASSET_LIBRARY_TAB]) => void;
  setSelectedAsset: (asset: SelectedAsset) => void;
};

export function useAssetCreate({
  currentProjectId,
  activeTab,
  loadCharacters,
  loadAssets,
  setActiveTab,
  setSelectedAsset,
}: UseAssetCreateDeps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>(ASSET_KIND.CHARACTER);
  const [newCharacter, setNewCharacter] = useState({ name: "", description: "", avatar_url: "" });
  const [newAsset, setNewAsset] = useState<NewAssetDraft>({
    name: "",
    type: ASSET_KIND.SCENE,
    meta: "",
    file_url: "",
  });
  const [createCharacterFile, setCreateCharacterFile] = useState<File | null>(null);
  const [createAssetFile, setCreateAssetFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const resetCreateState = () => {
    setNewCharacter({ name: "", description: "", avatar_url: "" });
    setNewAsset({ name: "", type: ASSET_KIND.SCENE, meta: "", file_url: "" });
    setCreateCharacterFile(null);
    setCreateAssetFile(null);
  };

  const handleCreate = async () => {
    if (!currentProjectId) return;
    setIsCreating(true);
    try {
      if (createMode === ASSET_KIND.CHARACTER) {
        if (!newCharacter.name.trim()) {
          toast.error("请输入角色名称");
          return;
        }
        let avatarURL = newCharacter.avatar_url.trim();
        if (createCharacterFile) {
          avatarURL = await ossApi.uploadFileToOss(createCharacterFile);
        }
        const created = await characterApi.createCharacter(currentProjectId, {
          name: newCharacter.name.trim(),
          description: newCharacter.description.trim(),
          avatar_url: avatarURL || undefined,
        });
        await loadCharacters();
        setActiveTab(ASSET_LIBRARY_TAB.CHARACTERS);
        setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: created });
      } else {
        if (!newAsset.name.trim() || !newAsset.type.trim()) {
          toast.error(
            `请填写完整的${createMode === ASSET_KIND.PROP ? "道具" : "场景"}资产信息`,
          );
          return;
        }
        let fileURL = newAsset.file_url.trim();
        if (createAssetFile) {
          fileURL = await ossApi.uploadFileToOss(createAssetFile);
        }
        const created = await assetApi.createAsset(currentProjectId, {
          name: newAsset.name.trim(),
          type: newAsset.type.trim(),
          meta: newAsset.meta.trim(),
          file_url: fileURL,
        });
        await loadAssets();
        setActiveTab(getAssetTab(created));
        setSelectedAsset({ type: ENTITY_TYPE.ASSET, data: created });
      }
      resetCreateState();
      setShowCreateDialog(false);
    } catch (error) {
      console.error("Failed to create asset:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const openCreateDialog = () => {
    const nextMode: CreateMode =
      activeTab === ASSET_LIBRARY_TAB.PROPS
        ? ASSET_KIND.PROP
        : activeTab === ASSET_LIBRARY_TAB.SCENES
          ? ASSET_KIND.SCENE
          : ASSET_KIND.CHARACTER;
    setCreateMode(nextMode);
    if (nextMode !== ASSET_KIND.CHARACTER) {
      setNewAsset((prev) => ({ ...prev, type: nextMode }));
    }
    setShowCreateDialog(true);
  };

  const selectCreateMode = (mode: CreateMode) => {
    setCreateMode(mode);
    if (mode !== ASSET_KIND.CHARACTER) {
      setNewAsset((prev) => ({ ...prev, type: mode }));
    }
  };

  return {
    showCreateDialog,
    setShowCreateDialog,
    createMode,
    newCharacter,
    setNewCharacter,
    newAsset,
    setNewAsset,
    createCharacterFile,
    setCreateCharacterFile,
    createAssetFile,
    setCreateAssetFile,
    isCreating,
    resetCreateState,
    handleCreate,
    openCreateDialog,
    selectCreateMode,
  };
}
