import { Loader2 } from "lucide-react";

import type { AssetVersion } from "../../api";
import styles from "../../pages/asset-library/AssetLibrary.module.scss";
import { Button } from "../ui/button";

export type VersionImageCardProps = {
  version: AssetVersion;
  src: string;
  alt: string;
  label: string;
  aspectClassName: string;
  switching: boolean;
  onPreview: () => void;
  onSetCurrent: () => void;
};

export function VersionImageCard({
  version,
  src,
  alt,
  label,
  aspectClassName,
  switching,
  onPreview,
  onSetCurrent,
}: VersionImageCardProps) {
  return (
    <div className={version.is_current ? styles.versionCardCurrent : styles.versionCard}>
      <button
        type="button"
        className={styles.versionPreviewButton}
        onClick={onPreview}
        aria-label={`预览${label}`}
      >
        <div className={`${styles.containedImage} ${aspectClassName} ${styles.fullWidth}`}>
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
      </button>
      <div className={styles.versionLabel}>{version.is_current ? "当前版本" : label}</div>
      {!version.is_current ? (
        <Button
          type="button"
          size="sm"
          disabled={switching}
          aria-label="设为当前版本"
          title="设为当前版本"
          className={styles.setCurrentButton}
          onClick={onSetCurrent}
        >
          {switching ? (
            <>
              <Loader2 className={styles.switchingIcon} />
              切换中
            </>
          ) : (
            "设为当前"
          )}
        </Button>
      ) : null}
    </div>
  );
}
