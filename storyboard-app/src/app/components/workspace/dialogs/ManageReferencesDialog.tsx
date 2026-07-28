import { Loader2, X } from "lucide-react";
import { Badge } from "../../ui/badge";
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

export type ManageReferenceItem = {
  id: number;
  name: string;
  description: string;
  assigned: boolean;
};

type ManageReferencesDialogProps = {
  open: boolean;
  title: string;
  description: string;
  currentDescription: string;
  emptyAssignedLabel: string;
  libraryTitle: string;
  loadingLabel: string;
  emptyLibraryLabel: string;
  refreshLabel: string;
  items: ManageReferenceItem[];
  assignedItems: ManageReferenceItem[];
  loading: boolean;
  canRefresh: boolean;
  activeActionKey: string | null;
  actionPrefix: string;
  removePrefix: string;
  itemAriaLabel: string;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
  onAdd: (id: number) => void;
  onRemove: (id: number) => void;
};

export function ManageReferencesDialog({
  open,
  title,
  description,
  currentDescription,
  emptyAssignedLabel,
  libraryTitle,
  loadingLabel,
  emptyLibraryLabel,
  refreshLabel,
  items,
  assignedItems,
  loading,
  canRefresh,
  activeActionKey,
  actionPrefix,
  removePrefix,
  itemAriaLabel,
  onOpenChange,
  onRefresh,
  onAdd,
  onRemove,
}: ManageReferencesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.manageDialog}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={styles.dialogDescription}>
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className={styles.manageSections}>
          <div className={styles.manageSection}>
            <div className={styles.manageSectionTitle}>当前片段</div>
            <div className={styles.currentSceneDescription}>{currentDescription}</div>
            <div className={styles.assignedItems}>
              {assignedItems.length ? (
                assignedItems.map((item) => (
                  <Badge key={item.id} variant="outline" className={styles.assignedBadge}>
                    <span>{item.name}</span>
                    <button
                      type="button"
                      className={styles.removeAssignedButton}
                      onClick={() => onRemove(item.id)}
                      disabled={activeActionKey === `${removePrefix}:${item.id}`}
                      aria-label={`移除${itemAriaLabel} ${item.name}`}
                    >
                      <X className={styles.smallIcon} />
                    </button>
                  </Badge>
                ))
              ) : (
                <Badge variant="outline" className={styles.emptyBadge}>
                  {emptyAssignedLabel}
                </Badge>
              )}
            </div>
          </div>

          <div className={styles.manageSection}>
            <div className={styles.manageSectionHeader}>
              <div className={styles.manageSectionTitle}>{libraryTitle}</div>
              {canRefresh ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={styles.refreshButton}
                  onClick={onRefresh}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className={styles.inlineButtonSpinner} />
                      刷新中
                    </>
                  ) : (
                    refreshLabel
                  )}
                </Button>
              ) : null}
            </div>
            <div className={styles.libraryList}>
              {loading ? (
                <div className={styles.inlineLoading}>
                  <Loader2 className={styles.inlineLoadingIcon} />
                  {loadingLabel}
                </div>
              ) : items.length ? (
                items.map((item) => (
                  <div key={item.id} className={styles.libraryItem}>
                    <div className={styles.libraryItemText}>
                      <div className={styles.libraryItemName}>{item.name}</div>
                      <div className={styles.libraryItemDescription}>{item.description}</div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={item.assigned ? "outline" : "default"}
                      className={
                        item.assigned
                          ? "h-7 border-gray-700 text-xs text-gray-400"
                          : "h-7 bg-teal-400 px-3 text-xs text-[#071514] hover:bg-teal-300"
                      }
                      onClick={() => onAdd(item.id)}
                      disabled={item.assigned || activeActionKey === `${actionPrefix}:${item.id}`}
                    >
                      {activeActionKey === `${actionPrefix}:${item.id}` ? (
                        <>
                          <Loader2 className={styles.inlineButtonSpinner} />
                          添加中
                        </>
                      ) : item.assigned ? (
                        "已关联"
                      ) : (
                        "加入片段"
                      )}
                    </Button>
                  </div>
                ))
              ) : (
                <div className={styles.libraryEmpty}>{emptyLibraryLabel}</div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
