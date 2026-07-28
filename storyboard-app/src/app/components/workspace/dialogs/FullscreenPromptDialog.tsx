import { Minimize2 } from "lucide-react";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { PromptOptimizeButton } from "../PromptOptimizationDialog";
import { RichPromptEditor, type PromptMentionOption } from "../RichPromptEditor";
import styles from "../../../pages/Workspace.module.scss";

type FullscreenPromptDialogProps = {
  open: boolean;
  sceneTitle: string;
  editorKey: string;
  value: string;
  options: PromptMentionOption[];
  optimizing: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  onSelectMention: (option: PromptMentionOption) => void;
  onRemoveMentions: (options: PromptMentionOption[]) => void;
  onOptimize: () => void;
};

export function FullscreenPromptDialog({
  open,
  sceneTitle,
  editorKey,
  value,
  options,
  optimizing,
  onOpenChange,
  onChange,
  onSelectMention,
  onRemoveMentions,
  onOptimize,
}: FullscreenPromptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/55 backdrop-blur-lg"
        className={styles.fullscreenDialog}
      >
        <DialogHeader className={styles.fullscreenHeader}>
          <div className={styles.dialogHeaderRow}>
            <div>
              <DialogTitle className={styles.fullscreenTitle}>提示词</DialogTitle>
              <DialogDescription className={styles.fullscreenDescription}>
                当前片段 · {sceneTitle}
              </DialogDescription>
            </div>
            <div className={styles.dialogActions}>
              <PromptOptimizeButton
                loading={optimizing}
                disabled={!value.trim()}
                onClick={onOptimize}
              />
              <Button
                size="sm"
                variant="ghost"
                className={styles.minimizeButton}
                onClick={() => onOpenChange(false)}
                aria-label="退出全屏编辑"
              >
                <Minimize2 className={styles.actionIcon} />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className={styles.fullscreenBody}>
          <RichPromptEditor
            key={editorKey}
            value={value}
            options={options}
            onChange={onChange}
            onSelectMention={onSelectMention}
            onRemoveMentions={onRemoveMentions}
            autoFocus={open}
          />
        </div>
        <DialogFooter className={styles.fullscreenFooter}>
          <Button onClick={() => onOpenChange(false)} className={styles.primaryButton}>
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
