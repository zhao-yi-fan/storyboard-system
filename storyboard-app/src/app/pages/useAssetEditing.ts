import type { Dispatch, RefObject, SetStateAction } from "react";
import { useState } from "react";
import { toast } from "sonner";

import type { Asset, AssetVersion, Character } from "../api";
import { assetApi, assetWorkspaceApi, characterApi, ossApi } from "../api";
import { getAssetKindLabel, getAssetTab } from "../components/assets/AssetCollection";
import {
  AI_PREVIEW_ACTION,
  type AIPreviewDialogState,
} from "../components/assets/dialogs/AIGenerationPreviewDialog";
import type { ASSET_LIBRARY_TAB} from "../constants/domain";
import { ENTITY_TYPE } from "../constants/domain";
import type { AIPreviewDialogInput, SelectedAsset } from "./AssetLibrary.helpers";
import { CHARACTER_GENERATION_COPY } from "./AssetLibrary.helpers";

type UseAssetEditingDeps = {
  selectedAsset: SelectedAsset;
  setSelectedAsset: (asset: SelectedAsset) => void;
  setCharacters: Dispatch<SetStateAction<Character[]>>;
  setAssets: Dispatch<SetStateAction<Asset[]>>;
  setActiveTab: (tab: (typeof ASSET_LIBRARY_TAB)[keyof typeof ASSET_LIBRARY_TAB]) => void;
  setVersions: Dispatch<SetStateAction<AssetVersion[]>>;
  selectedCharacterReferenceInputRef: RefObject<HTMLInputElement | null>;
  selectedCharacterVoiceReferenceInputRef: RefObject<HTMLInputElement | null>;
  selectedAssetFileInputRef: RefObject<HTMLInputElement | null>;
};

export function useAssetEditing({
  selectedAsset,
  setSelectedAsset,
  setCharacters,
  setAssets,
  setActiveTab,
  setVersions,
  selectedCharacterReferenceInputRef,
  selectedCharacterVoiceReferenceInputRef,
  selectedAssetFileInputRef,
}: UseAssetEditingDeps) {
  const [isSavingCharacter, setIsSavingCharacter] = useState(false);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [uploadingCharacterReferenceId, setUploadingCharacterReferenceId] = useState<number | null>(
    null,
  );
  const [uploadingCharacterVoiceReferenceId, setUploadingCharacterVoiceReferenceId] = useState<
    number | null
  >(null);
  const [generatingCharacterDesignSheetId, setGeneratingCharacterDesignSheetId] = useState<
    number | null
  >(null);
  const [generatingCharacterVoiceReferenceId, setGeneratingCharacterVoiceReferenceId] = useState<
    number | null
  >(null);
  const [characterVoiceReferenceError, setCharacterVoiceReferenceError] = useState<{
    id: number;
    message: string;
  } | null>(null);
  const [generatingAssetCoverId, setGeneratingAssetCoverId] = useState<number | null>(null);
  const [aiPreviewDialog, setAiPreviewDialog] = useState<AIPreviewDialogState | null>(null);
  const [isLoadingAIPreview, setIsLoadingAIPreview] = useState(false);

  const saveSelectedCharacter = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setIsSavingCharacter(true);
    try {
      const updated = await characterApi.updateCharacter(selectedAsset.data.id, {
        name: selectedAsset.data.name,
        description: selectedAsset.data.description ?? "",
        avatar_url: selectedAsset.data.avatar_url ?? "",
        voice_prompt: selectedAsset.data.voice_prompt ?? "",
      });
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: updated });
      toast.success("角色修改已保存");
      return updated;
    } catch (error) {
      console.error("Failed to save character:", error);
      throw error;
    } finally {
      setIsSavingCharacter(false);
    }
  };

  const saveSelectedAsset = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.ASSET) return;
    setIsSavingAsset(true);
    try {
      const updated = await assetApi.updateAsset(selectedAsset.data.id, {
        name: selectedAsset.data.name,
        type: selectedAsset.data.type,
        meta: selectedAsset.data.meta ?? "",
        file_url: selectedAsset.data.file_url ?? "",
      });
      setAssets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.ASSET, data: updated });
      setActiveTab(getAssetTab(updated));
      toast.success("资产修改已保存");
      return updated;
    } catch (error) {
      console.error("Failed to save asset:", error);
      throw error;
    } finally {
      setIsSavingAsset(false);
    }
  };

  const runGenerateSelectedCharacterDesignSheet = async (promptOverride: string) => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setGeneratingCharacterDesignSheetId(selectedAsset.data.id);
    try {
      const updated = await characterApi.generateCharacterDesignSheet(
        selectedAsset.data.id,
        promptOverride,
      );
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: updated });
      setVersions(await assetWorkspaceApi.getVersions(ENTITY_TYPE.CHARACTER, updated.id));
      toast.success("主设定图已生成并保存为新版本");
    } catch (error) {
      console.error("Failed to generate character design sheet:", error);
      toast.error(error instanceof Error ? error.message : "生成主设定图失败");
    } finally {
      setGeneratingCharacterDesignSheetId(null);
    }
  };

  const runGenerateSelectedCharacterVoiceReference = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setGeneratingCharacterVoiceReferenceId(selectedAsset.data.id);
    setCharacterVoiceReferenceError(null);
    try {
      const updated = await characterApi.generateCharacterVoiceReference(selectedAsset.data.id, {
        voice_prompt: selectedAsset.data.voice_prompt ?? "",
      });
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: updated });
      setCharacterVoiceReferenceError(null);
      toast.success("主语音参考已生成");
    } catch (error) {
      console.error("Failed to generate character voice reference:", error);
      const message = error instanceof Error ? error.message : "生成主语音参考失败";
      setCharacterVoiceReferenceError({ id: selectedAsset.data.id, message });
      toast.error(message);
    } finally {
      setGeneratingCharacterVoiceReferenceId(null);
    }
  };

  const runGenerateSelectedAssetCover = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.ASSET) return;
    setGeneratingAssetCoverId(selectedAsset.data.id);
    try {
      const updated = await assetApi.generateAssetCover(selectedAsset.data.id);
      setAssets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.ASSET, data: updated });
    } catch (error) {
      console.error("Failed to generate asset cover:", error);
    } finally {
      setGeneratingAssetCoverId(null);
    }
  };

  const openAIPreviewDialog = (state: AIPreviewDialogInput) => {
    setAiPreviewDialog({
      ...state,
      promptDraft: state.preview.final_prompt || "",
    });
  };

  const handleGenerateCharacterDesignSheet = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setIsLoadingAIPreview(true);
    try {
      const saved = await saveSelectedCharacter();
      const preview = await characterApi.getCharacterDesignSheetGenerationPreview(saved!.id);
      openAIPreviewDialog({
        action: AI_PREVIEW_ACTION.CHARACTER_DESIGN_SHEET,
        title: "确认生成主设定图",
        description:
          "会用 Seedream 图生图生成当前角色的主设定图。角色参考图只用于这次生成，不参与其他展示链路。",
        confirmLabel: "确认生成",
        preview,
      });
    } catch (error) {
      console.error("Failed to preview character design sheet generation:", error);
      toast.error(error instanceof Error ? error.message : "获取主设定图预览失败");
    } finally {
      setIsLoadingAIPreview(false);
    }
  };

  const handleUploadSelectedCharacterReference = async (file: File | null) => {
    if (!file || !selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setUploadingCharacterReferenceId(selectedAsset.data.id);
    try {
      const avatarURL = await ossApi.uploadFileToOss(file);
      const updated = await characterApi.updateCharacter(selectedAsset.data.id, {
        avatar_url: avatarURL,
      });
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: updated });
      toast.success("角色参考图已更新");
    } catch (error) {
      console.error("Failed to upload character reference image:", error);
      toast.error(error instanceof Error ? error.message : "上传角色参考图失败");
    } finally {
      setUploadingCharacterReferenceId(null);
      if (selectedCharacterReferenceInputRef.current) {
        selectedCharacterReferenceInputRef.current.value = "";
      }
    }
  };

  const handleUploadSelectedCharacterVoiceReference = async (file: File | null) => {
    if (!file || !selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setUploadingCharacterVoiceReferenceId(selectedAsset.data.id);
    try {
      const voiceReferenceURL = await ossApi.uploadFileToOss(file);
      const updated = await characterApi.uploadCharacterVoiceReference(
        selectedAsset.data.id,
        voiceReferenceURL,
      );
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: updated });
      setCharacterVoiceReferenceError(null);
      toast.success("主语音参考已更新");
    } catch (error) {
      console.error("Failed to upload character voice reference:", error);
      toast.error(error instanceof Error ? error.message : "上传主语音参考失败");
    } finally {
      setUploadingCharacterVoiceReferenceId(null);
      if (selectedCharacterVoiceReferenceInputRef.current) {
        selectedCharacterVoiceReferenceInputRef.current.value = "";
      }
    }
  };

  const handleUploadSelectedAssetFile = async (file: File | null) => {
    if (!file || !selectedAsset || selectedAsset.type !== ENTITY_TYPE.ASSET) return;
    setIsSavingAsset(true);
    try {
      const fileURL = await ossApi.uploadFileToOss(file);
      const updated = await assetApi.updateAsset(selectedAsset.data.id, { file_url: fileURL });
      setAssets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.ASSET, data: updated });
      toast.success("原始素材已替换");
    } finally {
      setIsSavingAsset(false);
      if (selectedAssetFileInputRef.current) selectedAssetFileInputRef.current.value = "";
    }
  };

  const handleGenerateCharacterVoiceReference = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setIsLoadingAIPreview(true);
    try {
      const saved = await saveSelectedCharacter();
      const preview = await characterApi.getCharacterVoiceReferenceGenerationPreview(saved!.id, {
        voice_prompt: saved!.voice_prompt ?? "",
      });
      openAIPreviewDialog({
        action: AI_PREVIEW_ACTION.CHARACTER_VOICE_REFERENCE,
        title: "确认生成主语音参考",
        description: `会用大模型生成当前角色的主语音参考，并绑定到角色资产上。${CHARACTER_GENERATION_COPY.VOICE_REFERENCE_DURATION_HINT}`,
        confirmLabel: "确认生成",
        preview,
      });
    } catch (error) {
      console.error("Failed to preview character voice reference generation:", error);
      toast.error(error instanceof Error ? error.message : "获取主语音参考预览失败");
    } finally {
      setIsLoadingAIPreview(false);
    }
  };

  const handleGenerateAssetCover = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.ASSET) return;
    setIsLoadingAIPreview(true);
    try {
      const saved = await saveSelectedAsset();
      const preview = await assetApi.getAssetCoverGenerationPreview(saved!.id);
      openAIPreviewDialog({
        action: AI_PREVIEW_ACTION.ASSET_COVER,
        title: `确认生成${getAssetKindLabel(saved!)}封面`,
        description: `会为当前${getAssetKindLabel(saved!)}资产生成一张封面图，用于资产库预览。`,
        confirmLabel: "确认生成",
        preview,
      });
    } catch (error) {
      console.error("Failed to preview asset cover generation:", error);
      toast.error(error instanceof Error ? error.message : "获取资产封面预览失败");
    } finally {
      setIsLoadingAIPreview(false);
    }
  };

  const confirmAIPreviewGeneration = async () => {
    if (!aiPreviewDialog) return;
    const action = aiPreviewDialog.action;
    const promptOverride = aiPreviewDialog.promptDraft.trim();
    if (action === AI_PREVIEW_ACTION.CHARACTER_DESIGN_SHEET && !promptOverride) {
      toast.error("最终 Prompt 不能为空");
      return;
    }
    setAiPreviewDialog(null);
    switch (action) {
      case AI_PREVIEW_ACTION.CHARACTER_DESIGN_SHEET:
        await runGenerateSelectedCharacterDesignSheet(promptOverride);
        return;
      case AI_PREVIEW_ACTION.CHARACTER_VOICE_REFERENCE:
        await runGenerateSelectedCharacterVoiceReference();
        return;
      case AI_PREVIEW_ACTION.ASSET_COVER:
        await runGenerateSelectedAssetCover();
        return;
      default:
        return;
    }
  };

  return {
    isSavingCharacter,
    isSavingAsset,
    uploadingCharacterReferenceId,
    uploadingCharacterVoiceReferenceId,
    generatingCharacterDesignSheetId,
    generatingCharacterVoiceReferenceId,
    characterVoiceReferenceError,
    generatingAssetCoverId,
    aiPreviewDialog,
    setAiPreviewDialog,
    isLoadingAIPreview,
    saveSelectedCharacter,
    saveSelectedAsset,
    runGenerateSelectedCharacterDesignSheet,
    runGenerateSelectedCharacterVoiceReference,
    runGenerateSelectedAssetCover,
    openAIPreviewDialog,
    handleGenerateCharacterDesignSheet,
    handleUploadSelectedCharacterReference,
    handleUploadSelectedCharacterVoiceReference,
    handleUploadSelectedAssetFile,
    handleGenerateCharacterVoiceReference,
    handleGenerateAssetCover,
    confirmAIPreviewGeneration,
  };
}
