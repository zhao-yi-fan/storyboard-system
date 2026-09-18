import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { toast } from "sonner";

import type { AssetVersion, Character, CharacterVoiceVersion } from "../api";
import { assetApi, assetWorkspaceApi, characterApi } from "../api";
import { ENTITY_TYPE } from "../constants/domain";
import type { SelectedAsset } from "./AssetLibrary.helpers";

type UseAssetVersionsDeps = {
  selectedAsset: SelectedAsset;
  setSelectedAsset: (asset: SelectedAsset) => void;
  setCharacters: Dispatch<SetStateAction<Character[]>>;
  loadCharacters: () => Promise<void>;
  loadAssets: () => Promise<void>;
  setLoadError: (message: string) => void;
};

export function useAssetVersions({
  selectedAsset,
  setSelectedAsset,
  setCharacters,
  loadCharacters,
  loadAssets,
  setLoadError,
}: UseAssetVersionsDeps) {
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [switchingVersionId, setSwitchingVersionId] = useState<number | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [voiceVersions, setVoiceVersions] = useState<CharacterVoiceVersion[]>([]);
  const [showVoiceVersions, setShowVoiceVersions] = useState(false);
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);

  const openSelectedVersions = async () => {
    if (!selectedAsset) return;
    setShowVersions(true);
    setVersions([]);
    try {
      setVersions(await assetWorkspaceApi.getVersions(selectedAsset.type, selectedAsset.data.id));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "版本加载失败");
    }
  };

  const chooseSelectedVersion = async (version: AssetVersion) => {
    if (!selectedAsset) return;
    const type = selectedAsset.type;
    const id = selectedAsset.data.id;
    setSwitchingVersionId(version.id);
    try {
      setVersions(await assetWorkspaceApi.setCurrentVersion(type, id, version.id));
      if (type === ENTITY_TYPE.CHARACTER) await loadCharacters();
      else await loadAssets();
      const refreshed =
        type === ENTITY_TYPE.CHARACTER ? await characterApi.getCharacter(id) : await assetApi.getAsset(id);
      if (refreshed) setSelectedAsset({ type, data: refreshed } as SelectedAsset);
      toast.success(type === ENTITY_TYPE.CHARACTER ? "已切换主设定图版本" : "已切换资产版本");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "切换版本失败");
    } finally {
      setSwitchingVersionId(null);
    }
  };

  const saveSelectedToPersonal = async () => {
    if (!selectedAsset) return;
    setIsSavingPersonal(true);
    try {
      if (selectedAsset.type === ENTITY_TYPE.CHARACTER) {
        await assetWorkspaceApi.saveCharacterToPersonal(selectedAsset.data.id);
      } else {
        await assetWorkspaceApi.saveAssetToPersonal(selectedAsset.data.id);
      }
      toast.success("已同步到个人空间");
    } finally {
      setIsSavingPersonal(false);
    }
  };

  const openVoiceVersions = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setShowVoiceVersions(true);
    setVoiceVersions([]);
    try {
      setVoiceVersions(await assetWorkspaceApi.getCharacterVoiceVersions(selectedAsset.data.id));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "语音版本加载失败");
    }
  };

  const chooseVoiceVersion = async (version: CharacterVoiceVersion) => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    const id = selectedAsset.data.id;
    setVoiceVersions(await assetWorkspaceApi.setCurrentCharacterVoiceVersion(id, version.id));
    const refreshed = await characterApi.getCharacter(id);
    setCharacters((prev) => prev.map((item) => (item.id === id ? refreshed : item)));
    setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: refreshed });
  };

  return {
    versions,
    setVersions,
    isLoadingVersions,
    setIsLoadingVersions,
    switchingVersionId,
    showVersions,
    setShowVersions,
    voiceVersions,
    showVoiceVersions,
    setShowVoiceVersions,
    isSavingPersonal,
    openSelectedVersions,
    chooseSelectedVersion,
    saveSelectedToPersonal,
    openVoiceVersions,
    chooseVoiceVersion,
  };
}
