import { useEffect, useRef, useState } from "react";
import { Film, Image as ImageIcon, Loader2, Pause, Play, Video } from "lucide-react";
import type { Scene, SceneVideoFrame, StoryboardMediaGeneration } from "../../api/types";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Slider } from "../ui/slider";

type Thumbnail = {
  time: number;
  url: string;
};

type Props = {
  open: boolean;
  sourceScene: Scene;
  nextScene: Scene | null;
  generation: StoryboardMediaGeneration;
  onOpenChange: (open: boolean) => void;
  onInsert: (file: File, timestampMs: number, targetScene: Scene) => Promise<SceneVideoFrame>;
  onClip: (startMs: number, endMs: number) => Promise<void>;
};

function formatTime(seconds: number) {
  return `${Math.max(0, seconds).toFixed(1)}s`;
}

function mediaErrorMessage(target: HTMLMediaElement, stage: string) {
  const messages: Record<number, string> = {
    1: "视频读取被浏览器中止",
    2: "视频网络读取失败",
    3: "视频编码解码失败或文件损坏",
    4: "浏览器不支持该视频编码或格式",
  };
  const code = target.error?.code || 0;
  return `${messages[code] || "视频画面读取失败"}（${stage}${code ? `，错误码 ${code}` : ""}）`;
}

function waitForEvent(target: HTMLMediaElement, eventName: string, stage: string) {
  return new Promise<void>((resolve, reject) => {
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(mediaErrorMessage(target, stage)));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, onSuccess);
      target.removeEventListener("error", onError);
    };
    target.addEventListener(eventName, onSuccess, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

function waitForPresentedFrame(video: HTMLVideoElement) {
  const withFrameCallback = video as HTMLVideoElement & {
    requestVideoFrameCallback?: (callback: () => void) => number;
  };
  if (!withFrameCallback.requestVideoFrameCallback) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    withFrameCallback.requestVideoFrameCallback?.(finish);
    window.setTimeout(finish, 300);
  });
}

async function seekVideo(video: HTMLVideoElement, time: number) {
  const safeTime = Math.max(0, Math.min(time, Math.max(0, video.duration - 0.01)));
  if (Math.abs(video.currentTime - safeTime) < 0.02 && video.readyState >= 2) return;
  const ready = waitForEvent(video, "seeked", "定位视频画面");
  video.currentTime = safeTime;
  await ready;
  await waitForPresentedFrame(video);
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("浏览器无法生成抽帧图片"))),
      "image/webp",
      quality,
    );
  });
}

async function drawFrame(video: HTMLVideoElement, maxWidth?: number, quality = 0.82) {
  if (!video.videoWidth || !video.videoHeight) throw new Error("视频画面尺寸不可用");
  const scale = maxWidth ? Math.min(1, maxWidth / video.videoWidth) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器不支持 Canvas 抽帧");
  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await canvasBlob(canvas, quality);
  } catch {
    throw new Error("视频跨域配置不允许抽帧，请检查 OSS CORS 的 GET/HEAD 配置");
  }
}

async function sampleThumbnails(sourceUrl: string, duration: number) {
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.src = sourceUrl;
  if (video.readyState < 1) await waitForEvent(video, "loadedmetadata", "读取视频元数据");
  const count = Math.min(30, Math.max(8, Math.ceil(duration * 2)));
  const timestamps = Array.from({ length: count }, (_, index) =>
    count === 1 ? 0 : (Math.max(0, duration - 0.05) * index) / (count - 1),
  );
  const result: Thumbnail[] = [];
  for (const time of timestamps) {
    await seekVideo(video, time);
    const blob = await drawFrame(video, 112, 0.64);
    result.push({ time, url: URL.createObjectURL(blob) });
  }
  video.removeAttribute("src");
  video.load();
  return result;
}

export function VideoFrameExtractionDialog({
  open,
  sourceScene,
  nextScene,
  generation,
  onOpenChange,
  onInsert,
  onClip,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrlRef = useRef("");
  const thumbnailUrlsRef = useRef<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSampling, setIsSampling] = useState(false);
  const [savingTargetId, setSavingTargetId] = useState<number | null>(null);
  const [isSavingClip, setIsSavingClip] = useState(false);
  const [mode, setMode] = useState<"image" | "video">("image");
  const [clipRange, setClipRange] = useState<[number, number]>([0, 4]);
  const [error, setError] = useState("");
  const [samplingWarning, setSamplingWarning] = useState("");
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const source = generation.result_url || generation.preview_url || "";
    setMode("image");
    setClipRange([0, 4]);
    setError("");
    setSamplingWarning("");
    setCurrentTime(0);
    setDuration(0);
    setIsLoading(true);
    void fetch(source, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`视频读取失败（HTTP ${response.status}）`);
        return response.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setVideoUrl(url);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "视频读取失败");
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [generation, open]);

  useEffect(() => {
    if (!duration) return;
    setClipRange([0, Math.min(duration, 4)]);
  }, [duration]);

  useEffect(() => {
    if (!open || !videoUrl || !duration) return;
    let cancelled = false;
    setIsSampling(true);
    setSamplingWarning("");
    void sampleThumbnails(videoUrl, duration)
      .then((items) => {
        if (cancelled) {
          items.forEach((item) => URL.revokeObjectURL(item.url));
          return;
        }
        thumbnailUrlsRef.current = items.map((item) => item.url);
        setThumbnails(items);
      })
      .catch((reason) =>
        setSamplingWarning(
          `${reason instanceof Error ? reason.message : "视频缩略图采样失败"}。仍可拖动时间轴完成截取。`,
        ),
      )
      .finally(() => setIsSampling(false));
    return () => {
      cancelled = true;
    };
  }, [duration, open, videoUrl]);

  useEffect(() => {
    if (open) return;
    const video = videoRef.current;
    video?.pause();
    thumbnailUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    thumbnailUrlsRef.current = [];
    setThumbnails([]);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = "";
    setVideoUrl("");
  }, [open]);

  useEffect(
    () => () => {
      thumbnailUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const seek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    const nextTime = Math.max(0, Math.min(time, duration));
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (mode === "video" && (video.currentTime < clipRange[0] || video.currentTime >= clipRange[1])) {
        video.currentTime = clipRange[0];
        setCurrentTime(clipRange[0]);
      }
      try {
        await video.play();
      } catch {
        setError(mediaErrorMessage(video, "播放视频"));
        return;
      }
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const insertFrame = async (targetScene: Scene) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    setSavingTargetId(targetScene.id);
    setError("");
    try {
      video.pause();
      setIsPlaying(false);
      const timestampMs = Math.round((video.currentTime * 1000) / 100) * 100;
      await seekVideo(video, timestampMs / 1000);
      await waitForPresentedFrame(video);
      const blob = await drawFrame(video, undefined, 0.92);
      if (blob.size > 10 * 1024 * 1024) throw new Error("当前抽帧超过 10MB，请降低源视频分辨率");
      const file = new File([blob], `video-frame-${timestampMs}.webp`, { type: "image/webp" });
      await onInsert(file, timestampMs, targetScene);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "抽帧保存失败");
    } finally {
      setSavingTargetId(null);
    }
  };

  const saveClip = async () => {
    const selectedDuration = Math.round((clipRange[1] - clipRange[0]) * 10) / 10;
    if (selectedDuration < 4) return;
    setIsSavingClip(true);
    setError("");
    try {
      await onClip(
        Math.round((clipRange[0] * 1000) / 100) * 100,
        Math.round((clipRange[1] * 1000) / 100) * 100,
      );
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "视频截取失败");
    } finally {
      setIsSavingClip(false);
    }
  };

  const updateClipRange = ([start, end]: number[]) => {
    const next: [number, number] = [start, end];
    const movedTime =
      Math.abs(start - clipRange[0]) >= Math.abs(end - clipRange[1]) ? start : end;
    setClipRange(next);
    seek(movedTime);
  };

  const selectedClipDuration = Math.round((clipRange[1] - clipRange[0]) * 10) / 10;

  const switchMode = (nextMode: "image" | "video") => {
    const video = videoRef.current;
    video?.pause();
    if (video) video.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    setClipRange([0, Math.min(duration, 4)]);
    setError("");
    setMode(nextMode);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[92dvh] max-h-[880px] max-w-[min(1280px,96vw)] grid-cols-none flex-col gap-4 overflow-hidden border-white/10 bg-[#101514] p-6 text-gray-100"
        overlayClassName="bg-black/70 backdrop-blur-md"
      >
        <DialogHeader className="flex-none">
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <Film className="h-6 w-6 text-teal-300" />
            视频截取
          </DialogTitle>
          <DialogDescription>
            可截取单张图片作为片段参考，也可截取至少 4 秒的视频并保存为新的视频版本。
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <section className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden rounded-2xl bg-black/30 p-4">
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black">
              {isLoading ? <Loader2 className="h-9 w-9 animate-spin text-teal-300" /> : null}
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  crossOrigin="anonymous"
                  playsInline
                  preload="auto"
                  className="h-full max-h-full w-full max-w-full object-contain"
                  onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                  onError={(event) => setError(mediaErrorMessage(event.currentTarget, "加载主视频"))}
                  onTimeUpdate={(event) => {
                    const video = event.currentTarget;
                    if (mode === "video" && !video.paused && video.currentTime >= clipRange[1]) {
                      video.pause();
                      video.currentTime = clipRange[1];
                    }
                    setCurrentTime(video.currentTime);
                  }}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
              ) : null}
              {!isLoading && !videoUrl && !error ? (
                <span className="text-sm text-gray-500">视频不可用</span>
              ) : null}
              <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 rounded-xl bg-black/70 p-1 backdrop-blur-md">
                <button
                  type="button"
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs transition ${mode === "image" ? "bg-white/15 text-white" : "text-gray-400 hover:text-white"}`}
                  onClick={() => switchMode("image")}
                >
                  <ImageIcon className="h-4 w-4" /> 截取图片
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs transition ${mode === "video" ? "bg-white/15 text-white" : "text-gray-400 hover:text-white"}`}
                  onClick={() => switchMode("video")}
                >
                  <Video className="h-4 w-4" /> 截取视频
                </button>
              </div>
            </div>

            <div className="flex-none space-y-3">
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={!videoUrl || !duration}
                  onClick={() => void togglePlayback()}
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                {mode === "image" ? (
                  <Slider
                    value={[currentTime]}
                    min={0}
                    max={duration || 1}
                    step={0.1}
                    onValueChange={([value]) => seek(value)}
                    disabled={!duration}
                    className="flex-1"
                  />
                ) : (
                  <Slider
                    value={clipRange}
                    min={0}
                    max={duration || 1}
                    step={0.1}
                    minStepsBetweenThumbs={40}
                    onValueChange={updateClipRange}
                    disabled={duration < 4}
                    className="flex-1"
                  />
                )}
                <span className="w-24 text-right font-mono text-xs text-gray-400">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              {mode === "video" ? (
                <div className="flex justify-center gap-5 text-xs text-gray-400">
                  <span>开始 {formatTime(clipRange[0])}</span>
                  <span>结束 {formatTime(clipRange[1])}</span>
                  <span className="text-teal-300">
                    截取 {formatTime(selectedClipDuration)}
                  </span>
                </div>
              ) : null}
              <div className="flex h-[72px] w-full gap-1 overflow-hidden rounded-xl bg-black/35 p-2">
                {thumbnails.map((item) => (
                  <button
                    type="button"
                    key={`${item.time}-${item.url}`}
                    className="relative h-14 min-w-0 flex-1 overflow-hidden rounded-md bg-black"
                    onClick={() => seek(item.time)}
                    title={formatTime(item.time)}
                  >
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-[9px] text-white">
                      {formatTime(item.time)}
                    </span>
                  </button>
                ))}
                {isSampling ? (
                  <div className="flex h-14 items-center gap-2 px-3 text-xs text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> 采样缩略图
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>

        {error ? (
          <div className="rounded-xl bg-red-950/50 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}
        {!error && samplingWarning ? (
          <div className="rounded-xl bg-amber-950/45 px-4 py-2 text-xs text-amber-200">
            {samplingWarning}
          </div>
        ) : null}

        <DialogFooter className="flex-none items-center border-t border-white/[0.06] pt-4 sm:justify-between">
          <div className="text-xs text-gray-500">
            {mode === "image"
              ? `当前画面 ${formatTime(currentTime)}，按 0.1 秒保存`
              : `视频区间 ${formatTime(clipRange[0])} - ${formatTime(clipRange[1])}`}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            {mode === "image" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!duration || savingTargetId !== null}
                  onClick={() => void insertFrame(sourceScene)}
                >
                  {savingTargetId === sourceScene.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  插入本片段
                </Button>
                <Button
                  type="button"
                  disabled={!duration || !nextScene || savingTargetId !== null}
                  onClick={() => nextScene && void insertFrame(nextScene)}
                  title={nextScene ? `插入「${nextScene.title}」` : "当前已经是本集最后一个片段"}
                >
                  {nextScene && savingTargetId === nextScene.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  插入下一片段
                </Button>
              </>
            ) : (
              <Button
                type="button"
                disabled={duration < 4 || selectedClipDuration < 4 || isSavingClip}
                onClick={() => void saveClip()}
                title={duration < 4 ? "来源视频不足 4 秒，无法截取" : "保存为新的视频版本"}
              >
                {isSavingClip ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                保存到视频版本
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
