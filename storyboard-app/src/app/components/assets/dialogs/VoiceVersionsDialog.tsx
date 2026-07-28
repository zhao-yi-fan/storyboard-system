import type { CharacterVoiceVersion } from "../../../api";
import { ASSET_SOURCE_TYPE } from "../../../constants/domain";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import styles from "../../../pages/AssetLibrary.module.scss";

type VoiceVersionsDialogProps = {
  open: boolean;
  versions: CharacterVoiceVersion[];
  onOpenChange: (open: boolean) => void;
  onSetCurrent: (version: CharacterVoiceVersion) => void;
};

export function VoiceVersionsDialog({
  open,
  versions,
  onOpenChange,
  onSetCurrent,
}: VoiceVersionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.voiceVersionsDialog}>
        <DialogHeader>
          <DialogTitle>主语音版本</DialogTitle>
          <DialogDescription>试听并恢复以前生成或上传的角色主语音。</DialogDescription>
        </DialogHeader>
        {versions.length ? (
          <div className={styles.voiceVersionsList}>
            {versions.map((version) => (
              <div
                key={version.id}
                className={version.is_current ? styles.voiceVersionCurrent : styles.voiceVersion}
              >
                <audio controls className={styles.fullWidth}>
                  <source src={version.file_url} />
                </audio>
                <div className={styles.voiceVersionFooter}>
                  <span>
                    {version.source_type === ASSET_SOURCE_TYPE.MANUAL_UPLOAD
                      ? "手动上传"
                      : "AI 生成"}{" "}
                    ·{" "}
                    {version.duration.toFixed(1)}s
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={version.is_current}
                    onClick={() => onSetCurrent(version)}
                  >
                    {version.is_current ? "当前版本" : "设为当前"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.dialogEmpty}>尚无语音版本</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
