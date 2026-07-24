import { useState } from "react";
import {
  AlertCircle,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Package,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { SceneGenerationReferences } from "../../api";
import styles from "./CoverReferencePanel.module.scss";

type CoverHistoryItem = {
  id: number;
  src: string;
  label: string;
  isCurrent: boolean;
  status: string;
};

type CoverReferencePanelProps = {
  currentCoverUrl: string;
  references: SceneGenerationReferences | null;
  isLoadingReferences: boolean;
  referenceError: string;
  generationError: string;
  isGenerating: boolean;
  history: CoverHistoryItem[];
  onGenerate: () => void;
  onUpload: () => void;
  onManageCharacters: () => void;
  onManageAssets: () => void;
  onPreviewCurrent: () => void;
  onPreviewReference: (index: number) => void;
  onPreviewHistory: (id: number) => void;
  onDismissError: () => void;
};

function referenceTypeLabel(type: string) {
  const labels: Record<string, string> = {
    character: "角色主设定图",
    scene: "场景参考",
    prop: "道具参考",
    costume: "服装参考",
    asset: "图片参考",
    video_frame: "视频抽帧",
  };
  return labels[type] || type || "图片参考";
}

export function CoverReferencePanel({
  currentCoverUrl,
  references,
  isLoadingReferences,
  referenceError,
  generationError,
  isGenerating,
  history,
  onGenerate,
  onUpload,
  onManageCharacters,
  onManageAssets,
  onPreviewCurrent,
  onPreviewReference,
  onPreviewHistory,
  onDismissError,
}: CoverReferencePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const images = references?.reference_images || [];
  const collapsedImages = images.length > 3 ? images.slice(0, 2) : images;
  const visibleImages = expanded ? images : collapsedImages;
  const hiddenCount = images.length - visibleImages.length;

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>首帧与参考</span>
        <div className={styles.actions}>
          <Button
            size="sm"
            variant="ghost"
            className={styles.generateButton}
            onClick={onGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className={styles.generateLoadingIcon} />
            ) : (
              <Sparkles className={styles.generateIcon} />
            )}
            {currentCoverUrl ? "重新生成首帧" : "生成首帧"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className={styles.menuTrigger}>
              <MoreHorizontal className={styles.menuTriggerIcon} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.menuContent}>
              <DropdownMenuItem onClick={onUpload}>
                <Upload className={styles.menuIcon} />
                上传首帧
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onManageCharacters}>
                <Users className={styles.menuIcon} />
                管理角色参考
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onManageAssets}>
                <Package className={styles.menuIcon} />
                管理场景参考
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {(generationError || referenceError) && (
        <div className={styles.error}>
          <AlertCircle className={styles.errorIcon} />
          <span className={styles.errorMessage}>{generationError || referenceError}</span>
          <button type="button" className={styles.dismissError} onClick={onDismissError}>
            关闭
          </button>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>当前首帧</span>
          <span className={styles.sectionHint}>生成结果，不参与本次首帧生成</span>
        </div>
        <button
          type="button"
          className={styles.currentCover}
          onClick={onPreviewCurrent}
          disabled={!currentCoverUrl}
        >
          {currentCoverUrl ? (
            <img src={currentCoverUrl} alt="当前首帧" className={styles.coverImage} />
          ) : (
            <span className={styles.coverPlaceholder}>
              <ImageIcon className={styles.placeholderIcon} /> 尚未生成首帧
            </span>
          )}
          {currentCoverUrl && <span className={styles.previewOverlay}>查看原图</span>}
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>本次真实参考图</span>
          <span>{isLoadingReferences ? "读取中" : `${images.length} 张`}</span>
        </div>
        {isLoadingReferences ? (
          <div className={styles.referencesLoading}>
            <Loader2 className={styles.referencesLoadingIcon} /> 正在读取真实生成输入
          </div>
        ) : images.length ? (
          <div className={styles.referenceGrid}>
            {visibleImages.map((reference, index) => {
              const actualIndex = images.findIndex(
                (item) => item.url === reference.url && item.name === reference.name,
              );
              return (
                <button
                  key={`${reference.type}-${reference.name}-${reference.url}`}
                  type="button"
                  className={styles.referenceCard}
                  onClick={() => onPreviewReference(actualIndex >= 0 ? actualIndex : index)}
                  title={`${reference.name} · ${reference.source}`}
                >
                  <img
                    src={reference.url}
                    alt={reference.name || referenceTypeLabel(reference.type)}
                    className={styles.coverImage}
                  />
                  <span className={styles.referenceCaption}>
                    <span className={styles.referenceName}>{reference.name}</span>
                    <span className={styles.referenceType}>
                      {referenceTypeLabel(reference.type)}
                    </span>
                    <span className={styles.referenceSource}>{reference.source}</span>
                  </span>
                </button>
              );
            })}
            {!expanded && hiddenCount > 0 && (
              <button
                type="button"
                className={styles.expandReferences}
                onClick={() => setExpanded(true)}
              >
                +{hiddenCount}
                <span className={styles.expandHint}>查看全部</span>
              </button>
            )}
          </div>
        ) : (
          <div className={styles.emptyReferences}>当前片段没有可用参考图，可从右上角菜单绑定</div>
        )}
        {expanded && images.length > 3 && (
          <button
            type="button"
            className={styles.collapseReferences}
            onClick={() => setExpanded(false)}
          >
            收起参考图
          </button>
        )}
        {!!references?.missing_references.length && (
          <div className={styles.missingReferences}>
            缺少可用图片：{references.missing_references.join("、")}
          </div>
        )}
      </div>

      <div className={styles.model}>
        <div className={styles.modelLabel}>画面模型</div>
        <div className={styles.modelValue}>Seedream 4.5</div>
      </div>

      {!!history.length && (
        <div className={styles.section}>
          <div className={styles.historyTitle}>首帧历史</div>
          <div className={styles.historyList}>
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.isCurrent ? styles.historyItemCurrent : styles.historyItem}
                onClick={() => onPreviewHistory(item.id)}
                disabled={!item.src}
                title={`查看首帧版本 ${item.label}`}
              >
                {item.src ? (
                  <img src={item.src} alt="" className={styles.coverImage} />
                ) : (
                  <span className={styles.historyStatus}>{item.status}</span>
                )}
                <span className={styles.historyLabel}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function PromptReferenceStatus({
  references,
}: {
  references: SceneGenerationReferences | null;
}) {
  if (!references || (!references.mappings.length && !references.unbound_mentions.length))
    return null;

  return (
    <div className={styles.referenceStatus}>
      <div className={styles.referenceStatusTitle}>已绑定参考</div>
      <div className={styles.referenceMappings}>
        {references.mappings.map((mapping) => (
          <span
            key={`${mapping.type}-${mapping.index}-${mapping.name}`}
            className={mapping.is_mentioned ? styles.mappingMentioned : styles.mappingBound}
            title={mapping.prompt_text}
          >
            @{mapping.name} ·{" "}
            {mapping.is_mentioned ? "已在 Prompt 引用" : "仅绑定，未在 Prompt 引用"}
          </span>
        ))}
      </div>
      {!!references.unbound_mentions.length && (
        <div className={styles.unboundReferences}>
          未绑定引用：{references.unbound_mentions.map((name) => `@${name}`).join("、")}
        </div>
      )}
    </div>
  );
}
