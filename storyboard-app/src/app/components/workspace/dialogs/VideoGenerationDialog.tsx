import type { StoryboardVideoGenerationPreview } from "../../../api";
import { ASSET_KIND, VIDEO_ASPECT_RATIO } from "../../../constants/domain";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Switch } from "../../ui/switch";
import styles from "../../../pages/Workspace.module.scss";

type VideoGenerationDialogProps = {
  open: boolean;
  preview: StoryboardVideoGenerationPreview | null;
  previewSpecLabel: string;
  sceneTitle: string;
  selectedModel: string;
  activeDuration: number;
  useFirstFrame: boolean;
  shotNumberLabel: string;
  formattedPrompt: string;
  onOpenChange: (open: boolean) => void;
  onUseFirstFrameChange: (checked: boolean) => void;
  onConfirm: () => void;
};

export function VideoGenerationDialog({
  open,
  preview,
  previewSpecLabel,
  sceneTitle,
  selectedModel,
  activeDuration,
  useFirstFrame,
  shotNumberLabel,
  formattedPrompt,
  onOpenChange,
  onUseFirstFrameChange,
  onConfirm,
}: VideoGenerationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.detailDialog}>
        <DialogHeader>
          <DialogTitle>确认生成视频</DialogTitle>
          <DialogDescription className={styles.dialogDescriptionLeading}>
            会为当前片段生成 {previewSpecLabel}{" "}
            视频。弹窗展示的是本次将实际传给大模型的详细参数和最终 prompt。
          </DialogDescription>
        </DialogHeader>
        <div className={styles.detailScroll}>
          <div className={styles.summaryGrid}>
            <div className={styles.detailRow}>
              <span className={styles.labelText}>片段</span>
              <span>{sceneTitle}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.labelText}>实际模型</span>
              <span>{preview?.model || selectedModel}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.labelText}>时长</span>
              <span>{preview?.duration || activeDuration} 秒</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.labelText}>输出规格</span>
              <span>
                {preview
                  ? `${preview.aspect_ratio || VIDEO_ASPECT_RATIO.PORTRAIT} / ${preview.resolution} / ${preview.duration}秒 / ${preview.audio ? "有声" : "无声"}`
                  : previewSpecLabel}
              </span>
            </div>
            <div className={styles.detailRowWide}>
              <span className={styles.labelText}>首帧来源</span>
              <span>
                {preview?.use_first_frame
                  ? preview.will_generate_cover
                    ? "当前无首帧，后端会先自动生成首帧"
                    : "使用当前片段首帧作为首帧输入"
                  : "不使用首帧，直接文生视频"}
              </span>
            </div>
          </div>

          <div className={styles.settingSection}>
            <div className={styles.sectionHeaderRow}>
              <div>
                <p className={styles.settingTitle}>指定首帧控制开场</p>
                <p className={styles.settingDescription}>
                  Seedance
                  的首帧模式与参考素材模式互斥。开启后只发送首帧，关闭后发送角色、场景和语音参考素材。
                </p>
              </div>
              <Switch checked={useFirstFrame} onCheckedChange={onUseFirstFrameChange} />
            </div>
          </div>

          {preview?.use_first_frame ? (
            <div className={styles.detailSection}>
              <div className={styles.sectionTitle}>首帧图</div>
              {preview.source_image_url ? (
                <div className={styles.firstFrameGrid}>
                  <div className={styles.firstFrameThumbnail}>
                    <img
                      src={preview.source_image_url}
                      alt={shotNumberLabel ? `${shotNumberLabel} 首帧图` : "首帧图"}
                      loading="lazy"
                      decoding="async"
                      className={styles.thumbnailImage}
                    />
                  </div>
                  <div className={styles.firstFrameDetails}>
                    <div className={styles.detailRow}>
                      <span className={styles.labelText}>状态</span>
                      <span>
                        {preview.source_image_status === "existing-cover"
                          ? "已有首帧"
                          : "将自动补首帧"}
                      </span>
                    </div>
                    <div>
                      <div className={styles.fieldLabelLegacy}>URL</div>
                      <div className={styles.breakableContent}>{preview.source_image_url}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.warningText}>
                  当前片段还没有首帧。开始生成后，后端会先自动补一张首帧，再继续生成视频。
                </div>
              )}
            </div>
          ) : null}

          {!!preview?.omitted_reference_images?.length && (
            <div className={styles.warningPanel}>
              当前为首帧模式，已绑定的 {preview.omitted_reference_images.length}{" "}
              张视觉参考图不会发送给 Seedance。关闭“指定首帧控制开场”即可改用参考素材模式。
            </div>
          )}

          {!!preview?.reference_images?.length && (
            <div className={styles.detailSectionRelaxed}>
              <div className={styles.sectionHeaderRow}>
                <div className={styles.sectionTitle}>参考图输入</div>
                <div className={styles.itemCount}>
                  用于生成前确认；Seedance 2.0 会额外传入角色主语音参考
                </div>
              </div>
              <div className={styles.cardGrid}>
                {preview.reference_images.map((reference, index) => (
                  <div key={`${reference.name}-${index}`} className={styles.referenceCard}>
                    <div className={styles.borderedReferenceThumbnail}>
                      <img
                        src={reference.url}
                        alt={reference.name}
                        loading="lazy"
                        decoding="async"
                        className={styles.thumbnailImage}
                      />
                    </div>
                    <div className={styles.referenceDetails}>
                      <div className={styles.inlineItems}>
                        <Badge className={styles.referenceTypeBadge}>
                          {reference.type === ASSET_KIND.CHARACTER
                            ? "角色"
                            : reference.type === ASSET_KIND.SCENE
                              ? "背景"
                              : reference.type === "video_frame"
                                ? "视频抽帧"
                                : reference.type}
                        </Badge>
                        <span className={styles.truncateContent}>{reference.name}</span>
                      </div>
                      <div>
                        <span className={styles.labelText}>来源：</span>
                        <span className={styles.contentText}>{reference.source}</span>
                      </div>
                      <div>
                        <div className={styles.fieldLabel}>URL</div>
                        <div className={styles.breakableValue}>{reference.url}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {!!preview.missing_references?.length && (
                <div className={styles.compactWarning}>
                  <div className={styles.warningTitle}>以下参考项缺少可用图片：</div>
                  <div className={styles.breakableText}>
                    {preview.missing_references.join("、")}
                  </div>
                </div>
              )}
            </div>
          )}

          {preview?.audio_reference_limits ? (
            <div className={styles.detailSectionRelaxed}>
              <div className={styles.sectionHeaderRow}>
                <div className={styles.sectionTitle}>角色主语音参考</div>
                <div className={styles.itemCount}>
                  最多 {preview.audio_reference_limits.max_count} 段 / 总时长不超过{" "}
                  {preview.audio_reference_limits.max_total_duration} 秒
                </div>
              </div>
              {preview.audio_reference_assets?.length ? (
                <div className={styles.cardGrid}>
                  {preview.audio_reference_assets.map((reference) => (
                    <div
                      key={reference.reference_id || reference.url}
                      className={styles.audioReferenceCard}
                    >
                      <div className={styles.compactHeaderRow}>
                        <div className={styles.minWidthContent}>
                          <div className={styles.truncateContent}>{reference.name}</div>
                          <div className={styles.secondaryMetadata}>
                            {reference.voice_name || "角色主语音"} ·{" "}
                            {reference.duration ? `${reference.duration.toFixed(1)}s` : "未知时长"}
                          </div>
                        </div>
                        <Badge className={styles.audioTypeBadge}>reference_audio</Badge>
                      </div>
                      <audio controls className={styles.audioPlayer} src={reference.url} />
                      <div className={styles.breakableMutedValue}>{reference.url}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyReference}>当前片段没有可传入的角色主语音参考。</div>
              )}
              {!!preview.missing_audio_references?.length && (
                <div className={styles.compactWarning}>
                  <div className={styles.warningTitle}>以下角色缺少主语音参考：</div>
                  <div className={styles.breakableText}>
                    {preview.missing_audio_references.join("、")}
                  </div>
                </div>
              )}
              {!!preview.blocking_reasons?.length && (
                <div className={styles.blockingError}>
                  <div className={styles.errorTitle}>当前不能生成 Seedance 2.0 视频：</div>
                  <ul className={styles.issueList}>
                    {preview.blocking_reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          <div className={styles.summarySection}>
            <div className={styles.metadataBadges}>
              <Badge className={styles.modeBadge}>
                {preview?.prompt_mode === "composite" ? "完整原文" : "兼容模式"}
              </Badge>
              <span className={styles.emptyText}>
                生成时长 {preview?.duration || activeDuration} 秒
              </span>
              <span className={styles.emptyText}>
                首帧 {preview?.use_first_frame ? "开启" : "关闭"}
              </span>
            </div>
            <div className={styles.detailPromptTitle}>最终提交 Prompt</div>
            <pre className={styles.scrollablePrompt}>{formattedPrompt}</pre>
          </div>
        </div>
        <DialogFooter className={styles.dialogFooter}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            className={styles.primaryButton}
            onClick={onConfirm}
            disabled={!!preview?.blocking_reasons?.length}
          >
            确认生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
