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
import { Textarea } from "../../ui/textarea";
import styles from "../../../pages/AssetLibrary.module.scss";

export const AI_PREVIEW_ACTION = {
  CHARACTER_DESIGN_SHEET: "character-design-sheet",
  CHARACTER_VOICE_REFERENCE: "character-voice-reference",
  ASSET_COVER: "asset-cover",
} as const;

export type AIPreviewAction =
  (typeof AI_PREVIEW_ACTION)[keyof typeof AI_PREVIEW_ACTION];

export type AIPreviewDialogState = {
  action: AIPreviewAction;
  title: string;
  description: string;
  confirmLabel: string;
  preview: AIGenerationPreview;
  promptDraft: string;
};

type AIGenerationPreviewDialogProps = {
  state: AIPreviewDialogState | null;
  loading: boolean;
  onClose: () => void;
  onPromptChange: (prompt: string) => void;
  onPreviewReference: (src: string, alt: string) => void;
  onConfirm: () => void;
};

const PROMPT_SECTION_BREAKS = [
  "主体与画面核心：",
  "动作与叙事重点：",
  "镜头设计：",
  "风格气质：",
  "特效与氛围：",
  "一致性要求：",
  "音频要求：",
  "画质与完成度：",
  "输出要求：",
  "负向约束：",
  "节奏分段：",
  "首段：",
  "中段：",
  "尾段：",
  "开场：",
  "中段：",
  "高潮：",
  "收束：",
] as const;

function formatPromptForDisplay(prompt: string | null | undefined) {
  const raw = String(prompt || "").trim();
  if (!raw) return "-";
  return PROMPT_SECTION_BREAKS.reduce((formatted, marker) => {
    const next = formatted.replaceAll(marker, `\n${marker}`);
    return next.startsWith("\n") ? next.slice(1) : next;
  }, raw);
}

export function AIGenerationPreviewDialog({
  state,
  loading,
  onClose,
  onPromptChange,
  onPreviewReference,
  onConfirm,
}: AIGenerationPreviewDialogProps) {
  const promptIsEditable =
    state?.action === AI_PREVIEW_ACTION.CHARACTER_DESIGN_SHEET;

  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={styles.aiPreviewDialog}>
        <DialogHeader>
          <DialogTitle>{state?.title || "确认 AI 生成"}</DialogTitle>
          <DialogDescription className={styles.aiPreviewDescription}>
            {state?.description || ""}
          </DialogDescription>
        </DialogHeader>
        <div className={styles.aiPreviewBody}>
          <div className={styles.previewSection}>
            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>实际模型</span>
              <span>{state?.preview.model || "-"}</span>
            </div>
            {state?.preview.notes?.length ? (
              <div>
                <div className={styles.previewNotesTitle}>说明</div>
                <ul className={styles.previewNotes}>
                  {state.preview.notes.map((note, index) => (
                    <li key={`${note}-${index}`}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className={styles.previewSection}>
            <div className={styles.previewSectionTitle}>详细参数</div>
            <div className={styles.previewFields}>
              {Object.entries(state?.preview.fields || {}).map(([key, value]) => (
                <div key={key}>
                  <span className={styles.previewLabel}>{key}：</span>
                  <span>{value || "-"}</span>
                </div>
              ))}
            </div>
          </div>
          {state?.preview.reference_images?.length ? (
            <div className={styles.previewReferenceSection}>
              <div className={styles.previewSectionTitle}>参考图输入</div>
              <div className={styles.previewReferenceGrid}>
                {state.preview.reference_images.map((image) => (
                  <button
                    key={`${image.type}:${image.name}`}
                    type="button"
                    className={styles.previewReferenceCard}
                    onClick={() => onPreviewReference(image.url, image.name)}
                  >
                    <div className={styles.previewReferenceImageWrap}>
                      <img
                        src={image.url}
                        alt={image.name}
                        className={styles.previewReferenceImage}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className={styles.previewReferenceName}>{image.name}</div>
                    <div className={styles.previewReferenceSource}>{image.source}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className={styles.previewSection}>
            <div className={styles.previewPromptHeader}>
              <div className={styles.previewSectionTitle}>
                最终 Prompt{promptIsEditable ? "（可编辑）" : ""}
              </div>
              {promptIsEditable ? (
                <div className={styles.promptCount}>{state?.promptDraft.length || 0} / 10000</div>
              ) : null}
            </div>
            {promptIsEditable ? (
              <Textarea
                value={state?.promptDraft || ""}
                maxLength={10000}
                onChange={(event) => onPromptChange(event.target.value)}
                className={styles.promptTextarea}
                aria-label="可编辑的最终 Prompt"
              />
            ) : (
              <pre className={styles.promptPreview}>
                {formatPromptForDisplay(state?.preview.final_prompt)}
              </pre>
            )}
          </div>
        </div>
        <DialogFooter className={styles.dialogFooter}>
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            className={styles.confirmButton}
            onClick={onConfirm}
            disabled={loading || (promptIsEditable && !state?.promptDraft.trim())}
          >
            {state?.confirmLabel || "确认生成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
