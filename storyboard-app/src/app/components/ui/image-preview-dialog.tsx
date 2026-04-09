import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./dialog";

type PreviewItem = {
  src: string;
  alt: string;
};

type ImagePreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt?: string;
  items?: PreviewItem[];
  currentIndex?: number;
  onNavigate?: (nextIndex: number) => void;
};

export function ImagePreviewDialog({
  open,
  onOpenChange,
  src,
  alt = "图片预览",
  items,
  currentIndex = 0,
  onNavigate,
}: ImagePreviewDialogProps) {
  const canNavigate = !!items && items.length > 1 && typeof onNavigate === "function";

  useEffect(() => {
    if (!open || !canNavigate || !items || !onNavigate) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onNavigate((currentIndex - 1 + items.length) % items.length);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onNavigate((currentIndex + 1) % items.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, canNavigate, items, currentIndex, onNavigate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen max-h-screen w-screen max-w-none border-0 bg-black/95 p-6 shadow-none sm:rounded-none [&>button]:top-5 [&>button]:right-5 [&>button]:bg-black/40 [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-black/60">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div className="flex h-full w-full items-center justify-center overflow-hidden">
          {canNavigate ? (
            <button
              type="button"
              className="mr-3 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              onClick={() => onNavigate?.((currentIndex - 1 + (items?.length || 0)) % (items?.length || 1))}
              aria-label="上一张"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : null}
          <div className="flex min-w-0 flex-1 items-center justify-center overflow-hidden">
            <img
              src={src}
              alt={alt}
              loading="eager"
              decoding="async"
              className="max-h-full max-w-full select-none object-contain"
            />
          </div>
          {canNavigate ? (
            <button
              type="button"
              className="ml-3 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              onClick={() => onNavigate?.((currentIndex + 1) % (items?.length || 1))}
              aria-label="下一张"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
