import type { Dispatch, SetStateAction } from "react";

import type { AssetVersion, CharacterVoiceVersion } from "../../api";
import type { AIPreviewDialogState } from "../../components/assets/dialogs/AIGenerationPreviewDialog";
import { AIGenerationPreviewDialog } from "../../components/assets/dialogs/AIGenerationPreviewDialog";
import { AssetVersionsDialog } from "../../components/assets/dialogs/AssetVersionsDialog";
import type { NewAssetDraft } from "../../components/assets/dialogs/CreateAssetDialog";
import { CreateAssetDialog } from "../../components/assets/dialogs/CreateAssetDialog";
import { DeleteAssetDialog } from "../../components/assets/dialogs/DeleteAssetDialog";
import { VoiceVersionsDialog } from "../../components/assets/dialogs/VoiceVersionsDialog";
import { ImagePreviewDialog } from "../../components/shared/ImagePreviewDialog";
import { ENTITY_TYPE } from "../../constants/domain";
import type { CreateMode, DeleteTarget, SelectedAsset } from "./AssetLibrary.helpers";

type AssetLibraryDialogsProps = {
  aiPreviewDialog: AIPreviewDialogState | null;
  setAiPreviewDialog: Dispatch<SetStateAction<AIPreviewDialogState | null>>;
  isLoadingAIPreview: boolean;
  setPreviewImage: (preview: { src: string; alt: string } | null) => void;
  confirmAIPreviewGeneration: () => void | Promise<void>;
  showVersions: boolean;
  setShowVersions: (open: boolean) => void;
  versions: AssetVersion[];
  selectedAsset: SelectedAsset;
  switchingVersionId: number | null;
  chooseSelectedVersion: (version: AssetVersion) => void | Promise<void>;
  showVoiceVersions: boolean;
  setShowVoiceVersions: (open: boolean) => void;
  voiceVersions: CharacterVoiceVersion[];
  chooseVoiceVersion: (version: CharacterVoiceVersion) => void | Promise<void>;
  showCreateDialog: boolean;
  setShowCreateDialog: (open: boolean) => void;
  createMode: CreateMode;
  newCharacter: { name: string; description: string; avatar_url: string };
  setNewCharacter: (character: { name: string; description: string; avatar_url: string }) => void;
  newAsset: NewAssetDraft;
  setNewAsset: (asset: NewAssetDraft) => void;
  createCharacterFile: File | null;
  setCreateCharacterFile: (file: File | null) => void;
  createAssetFile: File | null;
  setCreateAssetFile: (file: File | null) => void;
  isCreating: boolean;
  resetCreateState: () => void;
  selectCreateMode: (mode: CreateMode) => void;
  handleCreate: () => void | Promise<void>;
  deleteTarget: DeleteTarget;
  setDeleteTarget: (target: DeleteTarget) => void;
  deleteActionKey: string | null;
  confirmDelete: () => void | Promise<void>;
  previewImage: { src: string; alt: string } | null;
};

export function AssetLibraryDialogs({
  aiPreviewDialog,
  setAiPreviewDialog,
  isLoadingAIPreview,
  setPreviewImage,
  confirmAIPreviewGeneration,
  showVersions,
  setShowVersions,
  versions,
  selectedAsset,
  switchingVersionId,
  chooseSelectedVersion,
  showVoiceVersions,
  setShowVoiceVersions,
  voiceVersions,
  chooseVoiceVersion,
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
  selectCreateMode,
  handleCreate,
  deleteTarget,
  setDeleteTarget,
  deleteActionKey,
  confirmDelete,
  previewImage,
}: AssetLibraryDialogsProps) {
  return (
    <>
      <AIGenerationPreviewDialog
        state={aiPreviewDialog}
        loading={isLoadingAIPreview}
        onClose={() => setAiPreviewDialog(null)}
        onPromptChange={(promptDraft) =>
          setAiPreviewDialog((current) => (current ? { ...current, promptDraft } : current))
        }
        onPreviewReference={(src, alt) => setPreviewImage({ src, alt })}
        onConfirm={() => void confirmAIPreviewGeneration()}
      />

      <AssetVersionsDialog
        open={showVersions}
        versions={versions}
        isCharacter={selectedAsset?.type === ENTITY_TYPE.CHARACTER}
        switchingVersionId={switchingVersionId}
        onOpenChange={setShowVersions}
        onPreview={(src, alt) => setPreviewImage({ src, alt })}
        onSetCurrent={(version) => void chooseSelectedVersion(version)}
      />

      <VoiceVersionsDialog
        open={showVoiceVersions}
        versions={voiceVersions}
        onOpenChange={setShowVoiceVersions}
        onSetCurrent={(version) => void chooseVoiceVersion(version)}
      />

      <CreateAssetDialog
        open={showCreateDialog}
        mode={createMode}
        character={newCharacter}
        asset={newAsset}
        hasCharacterFile={Boolean(createCharacterFile)}
        hasAssetFile={Boolean(createAssetFile)}
        creating={isCreating}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) resetCreateState();
        }}
        onModeChange={selectCreateMode}
        onCharacterChange={setNewCharacter}
        onAssetChange={setNewAsset}
        onCharacterFileChange={setCreateCharacterFile}
        onAssetFileChange={setCreateAssetFile}
        onCreate={() => void handleCreate()}
      />

      <DeleteAssetDialog
        target={deleteTarget}
        deleting={deleteActionKey === `${deleteTarget?.type}:${deleteTarget?.id}`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <ImagePreviewDialog
        open={!!previewImage}
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null);
        }}
        src={previewImage?.src ?? ""}
        alt={previewImage?.alt ?? "资产预览图"}
      />
    </>
  );
}
