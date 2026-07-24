import { PhotoSlider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

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
  items,
  currentIndex = 0,
  onNavigate,
}: ImagePreviewDialogProps) {
  const previewItems = items?.length ? items : src ? [{ src, alt: "" }] : [];
  const safeIndex = Math.min(Math.max(currentIndex, 0), Math.max(previewItems.length - 1, 0));

  return (
    <PhotoSlider
      images={previewItems.map((item, index) => ({
        key: `${item.src}-${index}`,
        src: item.src,
      }))}
      visible={open && previewItems.length > 0}
      index={safeIndex}
      onIndexChange={(nextIndex) => onNavigate?.(nextIndex)}
      onClose={() => onOpenChange(false)}
      maskClosable
      maskOpacity={0.72}
      photoClosable={false}
      loop={previewItems.length > 1}
    />
  );
}
