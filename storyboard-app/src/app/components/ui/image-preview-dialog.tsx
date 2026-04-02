import { Dialog, DialogContent } from "./dialog";

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
      <DialogContent className="w-auto max-w-[92vw] border-gray-800 bg-[#0b0b0b] p-2">
        <div className="max-h-[88vh] overflow-hidden rounded-lg bg-black">
          <img
            src={src}
            alt={alt}
            loading="eager"
            decoding="async"
            className="max-h-[88vh] max-w-[88vw] object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
