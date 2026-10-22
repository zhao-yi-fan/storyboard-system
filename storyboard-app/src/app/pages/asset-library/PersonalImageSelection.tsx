import type { assetWorkspaceApi } from "../../api";
import { type PersonalAsset } from "../../api";
import { SignedImage } from "../../components/media/SignedMedia";
import { Button } from "../../components/ui/button";
import styles from "./PersonalImportDialog.module.scss";

export function PersonalImageSelection({
  items,
  selected,
  onSelect,
  disabled,
  mode,
  target,
}: {
  items: PersonalAsset[];
  selected: PersonalAsset | null;
  onSelect: (item: PersonalAsset) => void;
  disabled: boolean;
  mode: "create" | "apply-image";
  target?: assetWorkspaceApi.PersonalImageTarget;
}) {
  const pictures =
    mode === "apply-image"
      ? [
          { label: "当前图片", src: target?.image },
          { label: "所选图片", src: selected?.file_url },
        ]
      : [{ label: "素材预览", src: selected?.file_url }];
  return (
    <>
      <div className={styles.items} aria-label="个人图片素材">
        {items.map((item) => (
          <Button
            key={item.id}
            variant="outline"
            disabled={disabled}
            aria-pressed={selected?.id === item.id}
            onClick={() => onSelect(item)}
            className={styles.item}
          >
            {item.preview_url || item.file_url ? (
              <SignedImage
                src={item.preview_url?.length ? item.preview_url : item.file_url}
                alt=""
              />
            ) : null}
            <span>{item.name}</span>
          </Button>
        ))}
      </div>
      <div className={styles.comparison}>
        {pictures.map(({ label, src }) => (
          <div key={label}>
            <p>{label}</p>
            <div className={styles.preview}>
              {src ? (
                <SignedImage src={src} alt={label} />
              ) : (
                <span>{label === "当前图片" ? "尚无图片" : "请先选择素材"}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {mode === "apply-image" ? (
        <div className={styles.notice}>
          <p>保留当前资产的名称、描述、生成参考图和角色语音。</p>
          <p>影响本项目引用此资产的各集后续生成，不替换已有分镜图片和视频。</p>
        </div>
      ) : selected ? (
        <div className={styles.notice}>
          <p>名称：{selected.name}</p>
          <p>描述：{selected.description?.length ? selected.description : "暂无描述"}</p>
        </div>
      ) : null}
    </>
  );
}
