import { Loader2, MapPin, Package } from "lucide-react";
import type { Asset } from "../../api";
import {
  ASSET_KIND,
  ASSET_LIBRARY_TAB,
  type AssetKind,
  type AssetLibraryTab,
  type AssetViewMode,
} from "../../constants/domain";
import { Badge } from "../ui/badge";
import styles from "../../pages/AssetLibrary.module.scss";

export const getAssetPreviewSrc = (asset: Asset | null | undefined) =>
  asset?.thumbnail_url || asset?.cover_url || asset?.file_url || "";

export function ContainedAssetImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`${styles.containedImage} ${className}`}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className={styles.containedImageBackdrop}
      />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={styles.containedImageSource}
      />
    </div>
  );
}

export function isPropAsset(asset: Asset) {
  const type = String(asset.type || "").toLowerCase();
  return type.includes("prop") || type.includes("道具");
}

export const getAssetKind = (asset: Asset): Exclude<AssetKind, "character" | "voice"> =>
  isPropAsset(asset) ? ASSET_KIND.PROP : ASSET_KIND.SCENE;
export const getAssetTab = (
  asset: Asset,
): Exclude<AssetLibraryTab, "characters"> =>
  isPropAsset(asset) ? ASSET_LIBRARY_TAB.PROPS : ASSET_LIBRARY_TAB.SCENES;
export const getAssetKindLabel = (asset: Asset) => (isPropAsset(asset) ? "道具" : "场景");

function deriveAssetDescription(asset: Asset) {
  return asset.meta?.trim() || `${asset.name} 资源文件`;
}

type AssetCollectionProps = {
  assets: Asset[];
  emptyLabel: string;
  loading: boolean;
  viewMode: AssetViewMode;
  selectedAssetId: number | null;
  onSelect: (asset: Asset) => void;
};

export function AssetCollection({
  assets,
  emptyLabel,
  loading,
  viewMode,
  selectedAssetId,
  onSelect,
}: AssetCollectionProps) {
  if (loading) {
    return (
      <div className={styles.collectionLoading}>
        <Loader2 className={styles.collectionLoadingIcon} />
      </div>
    );
  }
  if (!assets.length) {
    return <div className={styles.collectionEmpty}>{emptyLabel}</div>;
  }

  if (viewMode === "grid") {
    return (
      <div className={styles.assetGrid}>
        {assets.map((asset) => {
          const AssetIcon = isPropAsset(asset) ? Package : MapPin;
          return (
            <button
              key={asset.id}
              onClick={() => onSelect(asset)}
              className={
                selectedAssetId === asset.id ? styles.assetGridCardSelected : styles.assetGridCard
              }
            >
              <div className={styles.assetGridPreview}>
                {getAssetPreviewSrc(asset) ? (
                  <ContainedAssetImage
                    src={getAssetPreviewSrc(asset)}
                    alt={asset.name}
                    className={styles.fullSize}
                  />
                ) : (
                  <AssetIcon className={styles.assetGridPlaceholderIcon} />
                )}
                <div className={styles.primaryBadgePosition}>
                  <Badge className={styles.primaryBadge}>{getAssetKindLabel(asset)}</Badge>
                </div>
                <div className={styles.secondaryBadgePosition}>
                  <Badge className={styles.secondaryBadge}>{asset.type?.trim() || "资源"}</Badge>
                </div>
              </div>
              <div className={styles.assetGridContent}>
                <h4 className={styles.assetName}>{asset.name}</h4>
                <p className={styles.assetGridDescription}>{deriveAssetDescription(asset)}</p>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.assetList}>
      {assets.map((asset) => {
        const AssetIcon = isPropAsset(asset) ? Package : MapPin;
        return (
          <button
            key={asset.id}
            onClick={() => onSelect(asset)}
            className={
              selectedAssetId === asset.id ? styles.assetListCardSelected : styles.assetListCard
            }
          >
            <div className={styles.assetListPreview}>
              {getAssetPreviewSrc(asset) ? (
                <ContainedAssetImage
                  src={getAssetPreviewSrc(asset)}
                  alt={asset.name}
                  className={styles.assetListImage}
                />
              ) : (
                <AssetIcon className={styles.assetListPlaceholderIcon} />
              )}
            </div>
            <div className={styles.assetListContent}>
              <div className={styles.assetListHeader}>
                <h4 className={styles.assetName}>{asset.name}</h4>
                <Badge className={styles.primaryBadge}>{getAssetKindLabel(asset)}</Badge>
              </div>
              <p className={styles.assetListDescription}>{deriveAssetDescription(asset)}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
