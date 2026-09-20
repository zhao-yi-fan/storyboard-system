import { useState } from "react";

import { assetApi, characterApi } from "../../api";
import { ENTITY_TYPE } from "../../constants/domain";
import type { DeleteTarget, SelectedAsset } from "./AssetLibrary.helpers";

type UseAssetDeletionDeps = {
  selectedAsset: SelectedAsset;
  setSelectedAsset: (asset: SelectedAsset) => void;
  loadCharacters: () => Promise<void>;
  loadAssets: () => Promise<void>;
};

export function useAssetDeletion({
  selectedAsset,
  setSelectedAsset,
  loadCharacters,
  loadAssets,
}: UseAssetDeletionDeps) {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleteActionKey, setDeleteActionKey] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const actionKey = `${deleteTarget.type}:${deleteTarget.id}`;
    setDeleteActionKey(actionKey);
    try {
      if (deleteTarget.type === ENTITY_TYPE.CHARACTER) {
        await characterApi.deleteCharacter(deleteTarget.id);
        await loadCharacters();
      } else {
        await assetApi.deleteAsset(deleteTarget.id);
        await loadAssets();
      }
      if (selectedAsset?.data.id === deleteTarget.id && selectedAsset?.type === deleteTarget.type) {
        setSelectedAsset(null);
      }
      setDeleteTarget(null);
    } catch (error) {
      console.error("Failed to delete item:", error);
    } finally {
      setDeleteActionKey(null);
    }
  };

  return { deleteTarget, setDeleteTarget, deleteActionKey, confirmDelete };
}
