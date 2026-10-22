import { Loader2, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { SignedImage } from "../../components/media/SignedMedia";
import { Button } from "../../components/ui/button";
import { mediaIdentity } from "../../lib/signedMedia";
import styles from "./AssetMediaSections.module.scss";

function MediaPreview({
  src,
  label,
  onPreview,
}: {
  src: string;
  label: string;
  onPreview: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.preview}>
      <SignedImage
        src={src}
        alt={label}
        onError={() => setFailed(true)}
        onLoad={() => setFailed(false)}
      />
      {!failed && (
        <button
          type="button"
          className={styles.previewButton}
          aria-label={`预览${label}`}
          onClick={onPreview}
        />
      )}
    </div>
  );
}

type Props = {
  original: string;
  cover: string;
  generating: boolean;
  saving: boolean;
  canGenerate: boolean;
  coverError?: string;
  onPreview: (src: string, alt: string) => void;
  onUpload: (file: File | null) => void | Promise<void>;
  onGenerate: () => void | Promise<void>;
  onImport?: () => void;
};

export function AssetMediaSections({
  original,
  cover,
  generating,
  saving,
  canGenerate,
  coverError,
  onPreview,
  onUpload,
  onGenerate,
  onImport,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const upload = async (file: File | null) => {
    if (!file || uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    setUploadError("");
    try {
      await onUpload(file);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "上传失败，请重试");
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className={styles.sections}>
      <section className={styles.section} aria-label="原始素材">
        <h3>原始素材</h3>
        {original && (
          <MediaPreview
            key={mediaIdentity(original)}
            src={original}
            label="原始素材"
            onPreview={() => onPreview(original, "原始素材")}
          />
        )}
        <div className={styles.actions}>
          <Button
            type="button"
            variant="outline"
            disabled={saving || uploading}
            onClick={() => input.current?.click()}
          >
            {uploading ? <Loader2 className={styles.spinner} /> : <Upload />}
            {uploading ? "上传中" : original ? "替换素材" : "上传原始素材"}
          </Button>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          disabled={saving || uploading}
          aria-label="选择原始素材文件"
          onChange={(event) => void upload(event.target.files?.[0] ?? null)}
        />
        {uploadError && (
          <p role="alert" className={styles.error}>
            {uploadError}
          </p>
        )}
      </section>
      <section className={styles.section} aria-label="AI 封面">
        <h3>AI 封面</h3>
        {cover && (
          <MediaPreview
            key={mediaIdentity(cover)}
            src={cover}
            label="AI 封面"
            onPreview={() => onPreview(cover, "AI 封面")}
          />
        )}
        <div className={styles.actions}>
          {canGenerate && (
            <Button
              type="button"
              variant={cover ? "outline" : "default"}
              disabled={generating || uploading || saving}
              onClick={() => void onGenerate()}
            >
              {generating ? <Loader2 className={styles.spinner} /> : <Sparkles />}
              {generating ? "正在生成" : cover ? "重新生成" : "生成封面"}
            </Button>
          )}
          {onImport && (
            <Button
              type="button"
              variant="outline"
              disabled={generating || uploading || saving}
              onClick={onImport}
            >
              从个人空间选择
            </Button>
          )}
        </div>
        {!canGenerate && <p>当前类型不支持 AI 生成封面。</p>}
        {coverError && (
          <p role="alert" className={styles.error}>
            {coverError}
          </p>
        )}
      </section>
    </div>
  );
}
