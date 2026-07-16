import { Settings2 } from "lucide-react";
import type { VideoResolution } from "../../api";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";

const SEEDANCE_RESOLUTIONS: VideoResolution[] = ["480p", "720p", "1080p"];

type VideoGenerationSettingsProps = {
  model: string;
  resolution: VideoResolution;
  duration: number;
  generateAudio: boolean;
  onResolutionChange: (resolution: VideoResolution) => void;
  onDurationChange: (duration: number) => void;
  onGenerateAudioChange: (generateAudio: boolean) => void;
};

export function getVideoGenerationSpecLabel(
  resolution: VideoResolution,
  duration: number,
  generateAudio: boolean,
) {
  return `${resolution} / ${duration}秒 / ${generateAudio ? "有声" : "无声"}`;
}

export function VideoGenerationSettings({
  model,
  resolution,
  duration,
  generateAudio,
  onResolutionChange,
  onDurationChange,
  onGenerateAudioChange,
}: VideoGenerationSettingsProps) {
  const isSeedance = model === "seedance-2.0";

  return (
    <Popover>
      <PopoverTrigger className="flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-md border border-white/10 bg-[var(--storyboard-surface)] px-2 text-[10px] text-gray-400 transition hover:border-teal-300/30 hover:bg-white/[0.07] hover:text-gray-200">
        <Settings2 className="h-3.5 w-3.5 flex-none" />
        <span className="truncate">
          {getVideoGenerationSpecLabel(resolution, duration, generateAudio)}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        className="w-72 space-y-4 border-white/10 bg-[#1b2525]/95 text-gray-100 shadow-2xl shadow-black/60 backdrop-blur-xl"
      >
        <div>
          <div className="text-sm font-medium">生成规格</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">
            {isSeedance
              ? "Seedance 2.0 支持 480p、720p、1080p 和 4-15 秒输出。"
              : "Wan 2.7 当前固定使用 720p、5 秒和有声输出。"}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] text-gray-500">分辨率</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {SEEDANCE_RESOLUTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={
                  resolution === option
                    ? "h-8 rounded-md border border-teal-300/35 bg-teal-300/10 text-xs text-teal-100"
                    : "h-8 rounded-md border border-white/[0.07] bg-[#0f1717]/80 text-xs text-gray-500 transition hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-35"
                }
                onClick={() => onResolutionChange(option)}
                disabled={!isSeedance}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-gray-500">时长</Label>
            <span className="text-xs font-medium text-teal-100">{duration} 秒</span>
          </div>
          <Slider
            value={[duration]}
            min={isSeedance ? 4 : 5}
            max={isSeedance ? 15 : 5}
            step={1}
            disabled={!isSeedance}
            onValueChange={(value) => onDurationChange(value[0] ?? duration)}
            aria-label="视频时长"
            className="py-2 [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-range]]:bg-teal-300 [&_[data-slot=slider-thumb]]:border-teal-200 [&_[data-slot=slider-thumb]]:bg-[#d8fffa]"
          />
          <div className="flex justify-between text-[9px] text-gray-700">
            <span>{isSeedance ? "4 秒" : "固定"}</span>
            <span>{isSeedance ? "15 秒" : "5 秒"}</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#0f1717]/80 px-3 py-2.5">
          <div>
            <div className="text-xs text-gray-300">生成音频</div>
            <div className="mt-0.5 text-[10px] text-gray-600">关闭后不校验角色主语音</div>
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
