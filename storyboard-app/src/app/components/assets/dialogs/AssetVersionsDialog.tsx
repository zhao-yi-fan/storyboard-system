import { Loader2 } from "lucide-react";
import type { AssetVersion } from "../../../api";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import styles from "../../../pages/AssetLibrary.module.scss";

type AssetVersionsDialogProps = {
  open: boolean;
  versions: AssetVersion[];
  isCharacter: boolean;
  switchingVersionId: number | null;
  onOpenChange: (open: boolean) => void;
  onPreview: (src: string, alt: string) => void;
  onSetCurrent: (version: AssetVersion) => void;
};

export function AssetVersionsDialog({
  open,
  versions,
  isCharacter,
  switchingVersionId,
  onOpenChange,
  onPreview,
  onSetCurrent,
}: AssetVersionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.versionsDialog}>
        <DialogHeader>
          <DialogTitle>生成版本</DialogTitle>
          <DialogDescription>
            点击图片仅预览；移入非当前版本后，点击右上角按钮才会切换。
          </DialogDescription>
        </DialogHeader>
        {versions.length ? (
          <div className={styles.versionsGrid}>
            {versions.map((version, index) => {
              const src = isCharacter
                ? version.file_url
                : version.preview_url || version.file_url;
              const alt = `资产生成版本 ${versions.length - index}`;
              const label = `v${versions.length - index}`;
              return (
                <div
                  className={version.is_current ? styles.versionCardCurrent : styles.versionCard}
                  key={version.id}
                >
                  <button
                    type="button"
                    className={styles.versionPreviewButton}
                    onClick={() => onPreview(src, alt)}
                    aria-label={`预览${label}`}
                  >
                    <div
                      className={`${styles.containedImage} ${styles.aspectVideo} ${styles.fullWidth}`}
                    >
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
                  <div className={styles.versionLabel}>
                    {version.is_current ? "当前版本" : label}
                  </div>
                  {!version.is_current ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={switchingVersionId === version.id}
                      aria-label="设为当前版本"
                      title="设为当前版本"
                      className={styles.setCurrentButton}
                      onClick={() => onSetCurrent(version)}
                    >
                      {switchingVersionId === version.id ? (
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
            })}
          </div>
        ) : (
          <div className={styles.dialogEmpty}>尚无生成版本</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
