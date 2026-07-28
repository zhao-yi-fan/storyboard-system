import { AlertCircle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import styles from "./PromptOptimizationDialog.module.scss";

type PromptOptimizationDialogProps = {
  open: boolean;
  originalPrompt: string;
  optimizedPrompt: string;
  model: string;
  loading: boolean;
  error: string;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  loadingText?: string;
  reviewText?: string;
  originalLabel?: string;
  optimizedLabel?: string;
  confirmLabel?: string;
};

type PromptColumnProps = {
  label: string;
  prompt: string;
  accent?: boolean;
};

function PromptColumn({ label, prompt, accent = false }: PromptColumnProps) {
  return (
    <section className={styles.promptColumn}>
      <div className={styles.promptColumnHeader}>
        <span className={accent ? styles.promptLabelAccent : styles.promptLabel}>{label}</span>
        <span className={styles.characterCount}>{prompt.length} 字符</span>
      </div>
      <div className={accent ? styles.promptContentAccent : styles.promptContent}>
        {prompt || "暂无内容"}
      </div>
    </section>
  );
}

export function PromptOptimizationDialog({
  open,
  originalPrompt,
  optimizedPrompt,
  model,
  loading,
  error,
  onOpenChange,
  onRetry,
  onConfirm,
  title = "AI 优化提示词",
  description = "DeepSeek 只生成候选稿。确认前不会覆盖编辑器，也不会保存到数据库。",
  loadingText = "DeepSeek 正在整理镜号、镜头语言和生成约束...",
  reviewText = "请核对剧情事实、台词、镜号和 @ 资产引用后再替换。",
  originalLabel = "当前原文",
  optimizedLabel = "AI 候选稿",
  confirmLabel = "确认替换",
}: PromptOptimizationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName={styles.overlay} className={styles.dialog}>
        <DialogHeader className={styles.header}>
          <DialogTitle className={styles.dialogTitle}>
            <Sparkles className={styles.titleIcon} />
            {title}
          </DialogTitle>
          <DialogDescription className={styles.dialogDescription}>{description}</DialogDescription>
        </DialogHeader>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loadingState}>
              <Loader2 className={styles.loadingIcon} />
              <p>{loadingText}</p>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <div className={styles.errorMessage}>
                <AlertCircle className={styles.errorIcon} />
                {error}
              </div>
              <Button variant="outline" onClick={onRetry}>
                <RefreshCw className={styles.retryIcon} />
                重新优化
              </Button>
            </div>
          ) : (
            <>
              <div className={styles.reviewHint}>
                <span>{reviewText}</span>
                <span>模型：{model || "DeepSeek"}</span>
              </div>
              <div className={styles.promptGrid}>
                <PromptColumn label={originalLabel} prompt={originalPrompt} />
                <PromptColumn label={optimizedLabel} prompt={optimizedPrompt} accent />
              </div>
            </>
          )}
        </div>

        <DialogFooter className={styles.footer}>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            className={styles.confirmButton}
            disabled={loading || !!error || !optimizedPrompt}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PromptOptimizeButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  onClick: () => void;
};

export function PromptOptimizeButton({
  disabled,
  loading,
  compact = false,
  onClick,
}: PromptOptimizeButtonProps) {
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={disabled || loading}
      className={compact ? styles.optimizeButtonCompact : styles.optimizeButton}
      onClick={onClick}
    >
      {loading ? (
        <Loader2 className={styles.optimizeIconLoading} />
      ) : (
        <Sparkles className={styles.optimizeIcon} />
      )}
      AI 优化
    </Button>
  );
}
