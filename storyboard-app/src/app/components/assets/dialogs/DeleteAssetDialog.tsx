import { Loader2 } from "lucide-react";
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
import styles from "../../../pages/AssetLibrary.module.scss";

export type DeleteAssetTarget =
  | { type: "character"; id: number; name: string }
  | { type: "asset"; id: number; name: string; assetKind: "scene" | "prop" }
  | null;

type DeleteAssetDialogProps = {
  target: DeleteAssetTarget;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteAssetDialog({
  target,
  deleting,
  onClose,
  onConfirm,
}: DeleteAssetDialogProps) {
  const isCharacter = target?.type === "character";

  return (
    <AlertDialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className={styles.deleteDialog}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isCharacter
              ? "确认删除角色"
              : `确认删除${target?.type === "asset" && target.assetKind === "prop" ? "道具" : "场景"}资产`}
          </AlertDialogTitle>
          <AlertDialogDescription className={styles.dialogDescription}>
            {isCharacter
              ? "该操作会从资产库隐藏该角色，不会删除服务器原始文件。"
              : "该操作会从资产库隐藏该资产，不会删除服务器原始文件。"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={styles.cancelButton}>取消</AlertDialogCancel>
          <AlertDialogAction
            className={styles.deleteConfirmButton}
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? <Loader2 className={styles.iconLoading} /> : "确认删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
