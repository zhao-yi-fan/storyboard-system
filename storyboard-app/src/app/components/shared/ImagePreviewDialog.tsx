import "react-photo-view/dist/react-photo-view.css";

import { useEffect, useRef } from "react";
import { PhotoSlider } from "react-photo-view";

import { freshMediaUrl, mediaIdentity } from "../../lib/signedMedia";
import { useSignedMediaUrls } from "../media/useSignedMediaUrls";

function PreviewFailure({ retry, autoRetry }: { retry: () => void; autoRetry: () => void }) {
  useEffect(autoRetry, [autoRetry]);
  return <span role="alert">图片加载失败 <button type="button" onClick={retry}>重试</button></span>;
}

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
  const urls = useSignedMediaUrls(previewItems.map((item) => item.src), open);
  const tried = useRef(new Set<string>());
  const source = previewItems[safeIndex]?.src ?? "";
  const identity = mediaIdentity(source);
  const retry = () => { void freshMediaUrl(source, true).catch(() => undefined); };

  return (
    <PhotoSlider
      images={previewItems.map((item, index) => ({
        key: `${mediaIdentity(item.src)}-${index}`,
        src: urls[index],
      }))}
      visible={open && previewItems.length > 0}
      index={safeIndex}
      onIndexChange={(nextIndex) => onNavigate?.(nextIndex)}
      onClose={() => onOpenChange(false)}
      maskClosable
      maskOpacity={0.72}
      photoClosable={false}
      loop={previewItems.length > 1}
      brokenElement={<PreviewFailure retry={retry} autoRetry={() => {
        if (tried.current.has(identity)) return;
        tried.current.add(identity);
        retry();
      }} />}
    />
  );
}
