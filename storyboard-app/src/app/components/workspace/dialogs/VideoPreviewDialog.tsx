import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import styles from "../../../pages/Workspace.module.scss";

export type VideoPreview = {
  src: string;
  originalSrc?: string;
  title: string;
};

type VideoPreviewDialogProps = {
  preview: VideoPreview | null;
  fallbackTitle: string;
  description: string;
  onClose: () => void;
};

export function VideoPreviewDialog({
  preview,
  fallbackTitle,
  description,
  onClose,
}: VideoPreviewDialogProps) {
  return (
    <Dialog open={!!preview} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={styles.mediaPreviewDialog}>
        <DialogHeader className={styles.dialogHeader}>
          <DialogTitle>{preview?.title || fallbackTitle}</DialogTitle>
          <DialogDescription className={styles.mutedText}>{description}</DialogDescription>
        </DialogHeader>
        {preview ? (
          <div className={styles.mediaPreviewBody}>
            <div className={styles.mediaPreviewStage}>
              <video
                key={preview.src}
                src={preview.src}
                controls
                autoPlay
                preload="metadata"
                className={styles.mediaPreviewContent}
              />
            </div>
            <div className={styles.previewActions}>
              <Button
                type="button"
                variant="outline"
                className={styles.secondaryButton}
                onClick={() =>
                  preview.originalSrc &&
                  window.open(preview.originalSrc, "_blank", "noopener,noreferrer")
                }
                disabled={!preview.originalSrc}
              >
                打开原视频
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
