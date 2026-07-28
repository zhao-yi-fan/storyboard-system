import { Loader2 } from "lucide-react";
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
import styles from "../../../pages/AssetLibrary.module.scss";

export type CreateAssetMode = "character" | "scene" | "prop";

export type NewCharacterDraft = {
  name: string;
  description: string;
  avatar_url: string;
};

export type NewAssetDraft = {
  name: string;
  type: string;
  meta: string;
  file_url: string;
};

type CreateAssetDialogProps = {
  open: boolean;
  mode: CreateAssetMode;
  character: NewCharacterDraft;
  asset: NewAssetDraft;
  hasCharacterFile: boolean;
  hasAssetFile: boolean;
  creating: boolean;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: CreateAssetMode) => void;
  onCharacterChange: (draft: NewCharacterDraft) => void;
  onAssetChange: (draft: NewAssetDraft) => void;
  onCharacterFileChange: (file: File | null) => void;
  onAssetFileChange: (file: File | null) => void;
  onCreate: () => void;
};

const CREATE_TYPE_OPTIONS: Array<{ value: CreateAssetMode; label: string }> = [
  { value: "character", label: "角色资产" },
  { value: "scene", label: "场景资产" },
  { value: "prop", label: "道具资产" },
];

export function CreateAssetDialog({
  open,
  mode,
  character,
  asset,
  hasCharacterFile,
  hasAssetFile,
  creating,
  onOpenChange,
  onModeChange,
  onCharacterChange,
  onAssetChange,
  onCharacterFileChange,
  onAssetFileChange,
  onCreate,
}: CreateAssetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={styles.createDialog}
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>新建资产</DialogTitle>
          <DialogDescription className={styles.dialogDescription}>
            选择角色、场景或道具资产，创建后会进入对应分类。
          </DialogDescription>
        </DialogHeader>
        <div className={styles.createFields}>
          <div>
            <Label className={styles.detailLabel}>资产类型</Label>
            <div className={styles.createTypeGrid}>
              {CREATE_TYPE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={mode === option.value ? "default" : "outline"}
                  className={
                    mode === option.value ? styles.createTypeActive : styles.createTypeButton
                  }
                  onClick={() => onModeChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          {mode === "character" ? (
            <>
              <div>
                <Label className={styles.detailLabel}>名称</Label>
                <Input
                  value={character.name}
                  onChange={(event) =>
                    onCharacterChange({ ...character, name: event.target.value })
                  }
                  className={styles.detailInput}
                />
              </div>
              <div>
                <Label className={styles.detailLabel}>描述</Label>
                <Textarea
                  value={character.description}
                  onChange={(event) =>
                    onCharacterChange({ ...character, description: event.target.value })
                  }
                  className={styles.detailTextarea}
                />
              </div>
              <div>
                <Label className={styles.detailLabel}>角色参考图地址（可选）</Label>
                <Input
                  value={character.avatar_url}
                  onChange={(event) =>
                    onCharacterChange({ ...character, avatar_url: event.target.value })
                  }
                  placeholder="https://..."
                  disabled={hasCharacterFile}
                  className={styles.detailInput}
                />
              </div>
              <div>
                <Label className={styles.detailLabel}>上传角色参考图（可选）</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => onCharacterFileChange(event.target.files?.[0] || null)}
                  className={styles.detailInput}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label className={styles.detailLabel}>名称</Label>
                <Input
                  value={asset.name}
                  onChange={(event) => onAssetChange({ ...asset, name: event.target.value })}
                  className={styles.detailInput}
                />
              </div>
              <div>
                <Label className={styles.detailLabel}>
                  {mode === "prop" ? "道具说明" : "场景说明"}
                </Label>
                <Textarea
                  value={asset.meta}
                  onChange={(event) => onAssetChange({ ...asset, meta: event.target.value })}
                  className={styles.detailTextarea}
                />
              </div>
              <div>
                <Label className={styles.detailLabel}>资源地址（可选）</Label>
                <Input
                  value={asset.file_url}
                  onChange={(event) => onAssetChange({ ...asset, file_url: event.target.value })}
                  placeholder="https://..."
                  disabled={hasAssetFile}
                  className={styles.detailInput}
                />
              </div>
              <div>
                <Label className={styles.detailLabel}>上传图片（可选）</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => onAssetFileChange(event.target.files?.[0] || null)}
                  className={styles.detailInput}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className={styles.cancelButton}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            className={styles.createConfirmButton}
            disabled={creating}
            onClick={onCreate}
          >
            {creating ? (
              <>
                <Loader2 className={styles.buttonLoadingIcon} />
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
