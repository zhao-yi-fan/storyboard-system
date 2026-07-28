import type { AIGenerationPreview } from "../../../api";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import styles from "../../../pages/Workspace.module.scss";

type SceneCoverGenerationDialogProps = {
  open: boolean;
  preview: AIGenerationPreview | null;
  formattedPrompt: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function SceneCoverGenerationDialog({
  open,
  preview,
  formattedPrompt,
  onOpenChange,
  onConfirm,
}: SceneCoverGenerationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.detailDialog}>
        <DialogHeader>
          <DialogTitle>确认生成片段封面</DialogTitle>
          <DialogDescription className={styles.dialogDescriptionLeading}>
            会为当前片段生成 1 张片段级代表封面。弹窗展示的是本次将实际传给大模型的详细参数和最终
            prompt。
          </DialogDescription>
        </DialogHeader>
        <div className={styles.detailScroll}>
          <div className={styles.detailSection}>
            <div className={styles.detailRow}>
              <span className={styles.labelText}>实际模型</span>
              <span>{preview?.model || "-"}</span>
            </div>
            {preview?.notes?.length ? (
              <div>
                <div className={styles.fieldLabelLegacy}>说明</div>
                <ul className={styles.noteList}>
                  {preview.notes.map((note, index) => (
                    <li key={`${note}-${index}`}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className={styles.detailSection}>
            <div className={styles.sectionTitle}>详细参数</div>
            <div className={styles.detailFieldGrid}>
              {Object.entries(preview?.fields || {}).map(([key, value]) => (
                <div key={key}>
                  <span className={styles.labelText}>{key}：</span>
                  <span>{value || "-"}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.detailSection}>
            <div className={styles.sectionTitle}>最终 Prompt</div>
            <pre className={styles.promptPreview}>{formattedPrompt}</pre>
          </div>
        </div>
        <DialogFooter className={styles.dialogFooter}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" className={styles.primaryButton} onClick={onConfirm}>
            确认生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
