import type { StoryboardCoverGenerationPreview } from "../../../api";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import styles from "../../../pages/Workspace.module.scss";

type CoverGenerationDialogProps = {
  open: boolean;
  sceneTitle: string;
  preview: StoryboardCoverGenerationPreview | null;
  formattedPrompt: string;
  onOpenChange: (open: boolean) => void;
  onPreviewReference: (index: number) => void;
  onManageCharacters: () => void;
  onManageAssets: () => void;
  onConfirm: (textOnly: boolean) => void;
};

export function CoverGenerationDialog({
  open,
  sceneTitle,
  preview,
  formattedPrompt,
  onOpenChange,
  onPreviewReference,
  onManageCharacters,
  onManageAssets,
  onConfirm,
}: CoverGenerationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.detailDialog}>
        <DialogHeader>
          <DialogTitle>确认生成首帧</DialogTitle>
          <DialogDescription className={styles.dialogDescriptionLeading}>
            会为当前片段调用图像模型生成 1
            张新首帧，并消耗模型额度。弹窗展示的是本次将实际传给大模型的参数。
          </DialogDescription>
        </DialogHeader>
        <div className={styles.detailScroll}>
          <div className={styles.summaryGrid}>
            <div className={styles.detailRow}>
              <span className={styles.labelText}>片段</span>
              <span>{sceneTitle}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.labelText}>生成模式</span>
              <span>{preview?.mode === "reference" ? "参考图生成" : "纯文本生成"}</span>
            </div>
            <div className={styles.detailRowWide}>
              <span className={styles.labelText}>实际模型</span>
              <span>{preview?.model || "-"}</span>
            </div>
          </div>
          <div className={styles.detailSection}>
            <div className={styles.sectionTitle}>参考图</div>
            {preview?.reference_images?.length ? (
              <div className={styles.referenceList}>
                {preview.reference_images.map((reference, index) => (
                  <div
                    key={`${reference.type}-${reference.name}-${index}`}
                    className={styles.compactReferenceCard}
                  >
                    <div className={styles.referenceGrid}>
                      <button
                        type="button"
                        className={styles.referenceThumbnail}
                        onClick={() => onPreviewReference(index)}
                        aria-label={`预览参考图 ${reference.name || index + 1}`}
                      >
                        <img
                          src={reference.url}
                          alt={reference.name || `${reference.type} 参考图`}
                          loading="lazy"
                          decoding="async"
                          className={styles.thumbnailImage}
                        />
                      </button>
                      <div className={styles.compactDetails}>
                        {[
                          { label: "类型", value: reference.type },
                          { label: "名称", value: reference.name || "-" },
                          { label: "来源字段", value: reference.source },
                          {
                            label: "Prompt 映射",
                            value: preview.mappings?.[index]?.is_mentioned
                              ? `已对应 ${preview.mappings[index].mention}`
                              : "已绑定但正文未引用",
                          },
                        ].map((item) => (
                          <div className={styles.detailRow} key={item.label}>
                            <span className={styles.labelText}>{item.label}</span>
                            <span>{item.value}</span>
                          </div>
                        ))}
                        <div>
                          <div className={styles.fieldLabelLegacy}>URL</div>
                          <div className={styles.breakableContent}>{reference.url}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.warningTextInline}>当前片段没有任何可用参考图。</div>
            )}
            {!!preview?.missing_references?.length && (
              <div>
                <div className={styles.fieldLabelLegacy}>缺失参考图</div>
                <div className={styles.compactContent}>
                  {preview.missing_references.join("、")}
                </div>
              </div>
            )}
          </div>
          <div className={styles.detailSection}>
            <div className={styles.sectionTitle}>结构化字段</div>
            <div className={styles.detailFieldGrid}>
              {[
                ["片段标题", preview?.fields.scene_title || "-"],
                ["地点", preview?.fields.location || "-"],
                ["时间", preview?.fields.time_of_day || "-"],
                ["角色", preview?.fields.characters?.join("、") || "-"],
                ["画面描述", preview?.fields.content || "-"],
                ["情绪", preview?.fields.mood || "-"],
                ["台词", preview?.fields.dialogue || "-"],
                ["备注", preview?.fields.notes || "-"],
              ].map(([label, value], index) => (
                <div className={[3, 4, 7].includes(index) ? styles.wideField : undefined} key={label}>
                  <span className={styles.labelText}>{label}：</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.detailSection}>
            <div className={styles.sectionTitle}>最终 Prompt</div>
            <pre className={styles.promptPreview}>{formattedPrompt}</pre>
          </div>
        </div>
        <DialogFooter className={styles.dialogFooter}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          {preview?.reference_images?.length ? (
            <Button type="button" className={styles.primaryButton} onClick={() => onConfirm(false)}>
              确认生成
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onManageCharacters}>
                管理角色参考
              </Button>
              <Button type="button" variant="outline" onClick={onManageAssets}>
                管理场景参考
              </Button>
              <Button
                type="button"
                className={styles.primaryButton}
                onClick={() => onConfirm(true)}
              >
                继续用纯文本生成
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
