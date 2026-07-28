import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import styles from "../../../pages/Workspace.module.scss";

export type ConfirmationSummaryItem = {
  label: string;
  value: string | number;
};

type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: string;
  items: ConfirmationSummaryItem[];
  confirmLabel: string;
  tone?: "primary" | "danger";
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ConfirmationDialog({
  open,
  title,
  description,
  items,
  confirmLabel,
  tone = "primary",
  onOpenChange,
  onConfirm,
}: ConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={styles.alertDialog}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className={styles.dialogDescriptionLeading}>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className={styles.confirmationSummary}>
          {items.map((item) => (
            <div className={styles.detailRow} key={item.label}>
              <span className={styles.labelText}>{item.label}</span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            className={tone === "danger" ? styles.dangerButton : styles.primaryButton}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
