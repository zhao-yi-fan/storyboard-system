import { useMemo } from "react";

import type { Asset, Character } from "../../api";
import { isPropAsset } from "../../components/assets/AssetCollection";

export function useAssetLibraryFilters(
  characters: Character[],
  assets: Asset[],
  searchQuery: string,
) {
  const filteredCharacters = useMemo(() => {
    return characters.filter(
      (char) =>
        char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        char.description?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [characters, searchQuery]);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return assets.filter(
      (asset) =>
        asset.name.toLowerCase().includes(normalizedQuery) ||
        asset.meta?.toLowerCase().includes(normalizedQuery),
    );
  }, [assets, searchQuery]);
  const filteredSceneAssets = useMemo(
    () => filteredAssets.filter((asset) => !isPropAsset(asset)),
    [filteredAssets],
  );
  const filteredPropAssets = useMemo(
    () => filteredAssets.filter((asset) => isPropAsset(asset)),
    [filteredAssets],
  );
  const sceneAssetCount = useMemo(
    () => assets.filter((asset) => !isPropAsset(asset)).length,
    [assets],
  );
  const propAssetCount = assets.length - sceneAssetCount;

  return {
    filteredCharacters,
    filteredAssets,
    filteredSceneAssets,
    filteredPropAssets,
    sceneAssetCount,
    propAssetCount,
  };
}
