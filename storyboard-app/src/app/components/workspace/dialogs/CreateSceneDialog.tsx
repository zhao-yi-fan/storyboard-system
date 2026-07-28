import { Loader2 } from "lucide-react";
import { PromptOptimizeButton } from "../PromptOptimizationDialog";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import styles from "../../../pages/Workspace.module.scss";

export type NewSceneDraft = {
  title: string;
  description: string;
};

type CreateSceneDialogProps = {
  open: boolean;
  insertSortOrder: number | null;
  sceneCount: number;
  draft: NewSceneDraft;
  creating: boolean;
  optimizingDescription: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (draft: NewSceneDraft) => void;
  onOptimizeDescription: () => void;
  onCreate: () => void;
};

export function CreateSceneDialog({
  open,
  insertSortOrder,
  sceneCount,
  draft,
  creating,
  optimizingDescription,
  onOpenChange,
  onDraftChange,
  onOptimizeDescription,
  onCreate,
}: CreateSceneDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.formDialog}>
        <DialogHeader>
          <DialogTitle>{insertSortOrder ? "插入片段" : "新建片段"}</DialogTitle>
          <DialogDescription className={styles.mutedText}>
            {insertSortOrder
              ? `新片段将插入为当前章节的片段-${insertSortOrder}，后续片段会自动顺延。`
              : "在当前章节末尾创建新片段。若项目还没有章节，系统会先自动创建第1章。"}
          </DialogDescription>
        </DialogHeader>
        <div className={styles.dialogForm}>
          <div>
            <Label className={styles.formLabel}>片段号</Label>
            <Input
              value={draft.title}
              onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
              placeholder={`片段${insertSortOrder || sceneCount + 1}`}
              className={styles.dialogInput}
            />
          </div>
          <div>
            <div className={styles.formLabelRow}>
              <Label className={styles.formLabel}>片段描述</Label>
              <PromptOptimizeButton
                compact
                loading={optimizingDescription}
                disabled={!draft.description.trim() || creating}
                onClick={onOptimizeDescription}
              />
            </div>
            <Textarea
              value={draft.description}
              onChange={(event) => onDraftChange({ ...draft, description: event.target.value })}
              placeholder="请输入，可选"
              className={styles.dialogTextarea}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            className={styles.primaryButton}
            onClick={onCreate}
            disabled={creating || !draft.title.trim()}
          >
            {creating ? (
              <>
                <Loader2 className={styles.buttonSpinner} />
                创建中
              </>
            ) : (
              "确认创建"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
