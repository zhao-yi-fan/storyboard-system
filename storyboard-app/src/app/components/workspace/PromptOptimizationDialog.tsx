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
};

type PromptColumnProps = {
  label: string;
  prompt: string;
  accent?: boolean;
};

function PromptColumn({ label, prompt, accent = false }: PromptColumnProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className={accent ? "text-sm font-medium text-teal-300" : "text-sm text-gray-400"}>
          {label}
        </span>
        <span className="text-xs text-gray-600">{prompt.length} 字符</span>
      </div>
      <div
        className={`min-h-[280px] flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl p-4 text-sm leading-7 ${
          accent
            ? "bg-teal-400/[0.055] text-gray-100 ring-1 ring-inset ring-teal-300/15"
            : "bg-black/25 text-gray-400"
        }`}
      >
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
}: PromptOptimizationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-black/60 backdrop-blur-md"
        className="flex h-[88vh] max-h-[900px] !w-[94vw] !max-w-[1280px] flex-col overflow-hidden border-white/10 bg-[#121515] p-0 text-gray-100"
      >
        <DialogHeader className="flex-none border-b border-white/[0.06] px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-300" />
            AI 优化提示词
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            DeepSeek 只生成候选稿。确认前不会覆盖编辑器，也不会保存到数据库。
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-gray-400">
              <Loader2 className="h-7 w-7 animate-spin text-teal-300" />
              <p>DeepSeek 正在整理镜号、镜头语言和生成约束...</p>
            </div>
          ) : error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <div className="max-w-xl rounded-xl bg-red-500/10 px-5 py-4 text-sm text-red-200 ring-1 ring-inset ring-red-400/20">
                <AlertCircle className="mx-auto mb-2 h-5 w-5" />
                {error}
              </div>
              <Button variant="outline" onClick={onRetry}>
                <RefreshCw className="h-4 w-4" />
                重新优化
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between text-xs text-gray-600">
                <span>请核对剧情事实、台词、镜号和 @ 资产引用后再替换。</span>
                <span>模型：{model || "DeepSeek"}</span>
              </div>
              <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
                <PromptColumn label="当前原文" prompt={originalPrompt} />
                <PromptColumn label="AI 候选稿" prompt={optimizedPrompt} accent />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-none border-t border-white/[0.06] px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            className="bg-teal-400 text-[#071514] hover:bg-teal-300"
            disabled={loading || !!error || !optimizedPrompt}
            onClick={onConfirm}
          >
            确认替换
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
      className={
        compact
          ? "h-7 gap-1 px-2 text-[10px] text-teal-300 hover:bg-teal-400/10 hover:text-teal-200"
          : "text-teal-300 hover:bg-teal-400/10 hover:text-teal-200"
      }
      onClick={onClick}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      AI 优化
    </Button>
  );
}
