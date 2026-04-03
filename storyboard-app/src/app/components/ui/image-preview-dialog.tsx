import { Dialog, DialogContent, DialogTitle } from "./dialog";

type ImagePreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt?: string;
};

export function ImagePreviewDialog({
  open,
  onOpenChange,
  src,
  alt = "图片预览",
}: ImagePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen max-h-screen w-screen max-w-none border-0 bg-black/95 p-6 shadow-none sm:rounded-none [&>button]:top-5 [&>button]:right-5 [&>button]:bg-black/40 [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-black/60">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div className="flex h-full w-full items-center justify-center overflow-hidden">
          <img
            src={src}
            alt={alt}
            loading="eager"
            decoding="async"
            className="max-h-full max-w-full select-none object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
