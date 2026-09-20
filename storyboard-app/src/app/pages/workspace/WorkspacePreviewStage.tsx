import { Camera, Loader2, Play, Scissors, X } from "lucide-react";

import type { Storyboard, StoryboardMediaGeneration } from "../../api";
import { GENERATION_STATUS } from "../../constants/domain";
import {
  getGenerationPreviewSrc,
  getStoryboardPreviewSrc,
  getStoryboardVideoPreviewSrc,
} from "./Workspace.helpers";
import styles from "./Workspace.module.scss";

type WorkspacePreviewStageProps = {
  selectedShot: Storyboard | null;
  isEpisodeRailCollapsed: boolean;
  currentVideoGeneration: StoryboardMediaGeneration | null;
  setFrameExtractionGeneration: (generation: StoryboardMediaGeneration | null) => void;
  videoGenerations: StoryboardMediaGeneration[];
  activeMediaActionKey: string | null;
  handleSetCurrentGeneration: (generation: StoryboardMediaGeneration) => void;
  handleRequestDeleteGeneration: (generation: StoryboardMediaGeneration) => void;
};

export function WorkspacePreviewStage({
  selectedShot,
  isEpisodeRailCollapsed,
  currentVideoGeneration,
  setFrameExtractionGeneration,
  videoGenerations,
  activeMediaActionKey,
  handleSetCurrentGeneration,
  handleRequestDeleteGeneration,
}: WorkspacePreviewStageProps) {
  return (
    <main
      className={
        isEpisodeRailCollapsed
          ? `storyboard-center-stage ${styles.centerStageCollapsed}`
          : `storyboard-center-stage ${styles.centerStage}`
      }
    >
      <div className={styles.previewStage}>
        {selectedShot ? (
          <div className={styles.previewContainer}>
            {selectedShot.video_status === GENERATION_STATUS.GENERATING ? (
              <div className={`storyboard-media-frame ${styles.generatingPreview}`}>
                <Loader2 className={styles.previewLoadingIcon} />
                <span className={styles.generatingText}>视频生成中，状态会自动刷新</span>
              </div>
            ) : getStoryboardVideoPreviewSrc(selectedShot) ? (
              <div className={`storyboard-media-frame ${styles.videoPreview}`}>
                <video
                  key={getStoryboardVideoPreviewSrc(selectedShot)}
                  src={getStoryboardVideoPreviewSrc(selectedShot)}
                  controls
                  playsInline
                  className={styles.video}
                />
                {currentVideoGeneration ? (
                  <button
                    type="button"
                    className={styles.extractButton}
                    onClick={() => setFrameExtractionGeneration(currentVideoGeneration)}
                  >
                    <Scissors className={styles.actionIcon} /> 截取
                  </button>
                ) : null}
              </div>
            ) : (
              <div className={`storyboard-media-frame ${styles.emptyVideoPreview}`}>
                {getStoryboardPreviewSrc(selectedShot) ? (
                  <img
                    src={getStoryboardPreviewSrc(selectedShot)}
                    alt=""
                    className={styles.coverBackdrop}
                  />
                ) : null}
                <div className={styles.playPlaceholder}>
                  <Play className={styles.playPlaceholderIcon} />
                </div>
                <span className={styles.emptyVideoText}>点击右侧“生视频”开始生成</span>
              </div>
            )}

            {selectedShot.video_status === GENERATION_STATUS.FAILED && selectedShot.video_error ? (
              <div className={styles.videoError}>
                <div className={styles.videoErrorTitle}>视频生成失败</div>
                <div className={styles.videoErrorMessage}>{selectedShot.video_error}</div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className={styles.emptySelection}>
            <Camera className={styles.emptySelectionIcon} />
            <p className={styles.emptySelectionText}>从左侧选择一个片段</p>
          </div>
        )}
      </div>

      <div className={styles.history}>
        <div className={styles.historyTitle}>History</div>
        <div className={styles.historyList}>
          {videoGenerations.map((generation, index) => (
            <div
              key={generation.id}
              className={generation.is_current ? styles.historyItemCurrent : styles.historyItem}
            >
              {getGenerationPreviewSrc(generation) ? (
                <video
                  src={getGenerationPreviewSrc(generation)}
                  muted
                  className={styles.historyVideo}
                />
              ) : (
                <div className={styles.historyStatus}>{generation.status}</div>
              )}
              <button
                type="button"
                className={styles.historyVersionButton}
                onClick={() => void handleSetCurrentGeneration(generation)}
                disabled={
                  generation.is_current ||
                  generation.status !== GENERATION_STATUS.SUCCEEDED ||
                  !generation.result_url ||
                  activeMediaActionKey === "set-current:" + generation.id
                }
                title={
                  generation.status !== GENERATION_STATUS.SUCCEEDED || !generation.result_url
                    ? "该版本未生成成功，不能切换"
                    : generation.is_current
                      ? "当前版本"
                      : "设为当前版本"
                }
              >
                {generation.status === GENERATION_STATUS.SUCCEEDED
                  ? `v${videoGenerations.length - index}`
                  : generation.status === GENERATION_STATUS.FAILED
                    ? "失败"
                    : "生成中"}
              </button>
              {generation.status === GENERATION_STATUS.SUCCEEDED && generation.result_url ? (
                <button
                  type="button"
                  className={styles.historyExtractButton}
                  onClick={() => setFrameExtractionGeneration(generation)}
                  aria-label="从该视频版本截取图片或视频"
                  title="截取图片或视频"
                >
                  <Scissors className={styles.historyIcon} />
                </button>
              ) : null}
              {generation.extracted_frames?.length ? (
                <span className={styles.extractedFrameCount}>
                  {generation.extracted_frames.length} 帧
                </span>
              ) : null}
              <button
                type="button"
                className={styles.historyDeleteButton}
                onClick={() => handleRequestDeleteGeneration(generation)}
                aria-label="删除历史版本"
              >
                <X className={styles.historyIcon} />
              </button>
            </div>
          ))}
          {!videoGenerations.length ? (
            <div className={styles.historyEmpty}>还没有视频历史版本</div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
