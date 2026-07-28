import { Settings2 } from "lucide-react";
import type { VideoAspectRatio, VideoResolution } from "../../api";
import { VIDEO_MODEL, VIDEO_RESOLUTION } from "../../constants/domain";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import styles from "./VideoGenerationSettings.module.scss";

const SEEDANCE_RESOLUTIONS: VideoResolution[] = Object.values(VIDEO_RESOLUTION);

type VideoGenerationSettingsProps = {
  model: string;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
  duration: number;
  generateAudio: boolean;
  onResolutionChange: (resolution: VideoResolution) => void;
  onDurationChange: (duration: number) => void;
  onGenerateAudioChange: (generateAudio: boolean) => void;
};

export function getVideoGenerationSpecLabel(
  aspectRatio: VideoAspectRatio,
  resolution: VideoResolution,
  duration: number,
  generateAudio: boolean,
) {
  return `${aspectRatio} / ${resolution} / ${duration}秒 / ${generateAudio ? "有声" : "无声"}`;
}

export function VideoGenerationSettings({
  model,
  aspectRatio,
  resolution,
  duration,
  generateAudio,
  onResolutionChange,
  onDurationChange,
  onGenerateAudioChange,
}: VideoGenerationSettingsProps) {
  const isSeedance = model === VIDEO_MODEL.SEEDANCE_2;

  return (
    <Popover>
      <PopoverTrigger className={styles.trigger}>
        <Settings2 className={styles.triggerIcon} />
        <span className={styles.triggerLabel}>
          {getVideoGenerationSpecLabel(aspectRatio, resolution, duration, generateAudio)}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className={styles.content}>
        <div>
          <div className={styles.title}>生成规格</div>
          <div className={styles.description}>
            {isSeedance
              ? "Seedance 2.0 支持 480p、720p、1080p 和 4-15 秒输出。"
              : "Wan 2.7 当前固定使用 720p、5 秒和有声输出。"}
          </div>
        </div>

        <div className={styles.field}>
          <Label className={styles.label}>画幅</Label>
          <div className={styles.aspectRatio}>{aspectRatio} 竖屏</div>
        </div>

        <div className={styles.field}>
          <Label className={styles.label}>分辨率</Label>
          <div className={styles.resolutionGrid}>
            {SEEDANCE_RESOLUTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={
                  resolution === option ? styles.resolutionActive : styles.resolutionOption
                }
                onClick={() => onResolutionChange(option)}
                disabled={!isSeedance}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.durationHeader}>
            <Label className={styles.label}>时长</Label>
            <span className={styles.durationValue}>{duration} 秒</span>
          </div>
          <Slider
            value={[duration]}
            min={isSeedance ? 4 : 5}
            max={isSeedance ? 15 : 5}
            step={1}
            disabled={!isSeedance}
            onValueChange={(value) => onDurationChange(value[0] ?? duration)}
            aria-label="视频时长"
            className={styles.slider}
          />
          <div className={styles.durationRange}>
            <span>{isSeedance ? "4 秒" : "固定"}</span>
            <span>{isSeedance ? "15 秒" : "5 秒"}</span>
          </div>
        </div>

        <div className={styles.audioSetting}>
          <div>
            <div className={styles.audioTitle}>生成音频</div>
            <div className={styles.audioDescription}>关闭后不校验角色主语音</div>
          </div>
          <Switch
            checked={generateAudio}
            onCheckedChange={onGenerateAudioChange}
            disabled={!isSeedance}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
