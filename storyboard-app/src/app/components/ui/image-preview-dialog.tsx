import { useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "./dialog";

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

  if (!src) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/95 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none sm:p-8"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              onOpenChange(false);
            }
          }}
        >
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          {canNavigate ? (
            <button
              type="button"
              className="absolute left-4 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6"
              onClick={(event) => {
                event.stopPropagation();
                onNavigate?.((currentIndex - 1 + (items?.length || 0)) % (items?.length || 1));
              }}
              aria-label="上一张"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : null}

          <div
            className="flex h-full w-full items-center justify-center overflow-hidden"
            onPointerDown={(event) => event.stopPropagation()}
          >
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
              className="absolute right-4 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6"
              onClick={(event) => {
                event.stopPropagation();
                onNavigate?.((currentIndex + 1) % (items?.length || 1));
              }}
              aria-label="下一张"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
