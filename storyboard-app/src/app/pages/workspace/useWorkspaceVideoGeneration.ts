import { useEffect } from "react";

import {
  type Scene,
  sceneApi,
  type StoryboardVideoGenerationOptions,
} from "../../api";
import { useSceneVideoPolling } from "../../components/workspace/hooks/useSceneVideoPolling";
import { GENERATION_STATUS } from "../../constants/domain";
import { type WorkspaceState } from "./useWorkspaceState";
import {
  sceneMediaToWorkspaceMedia,
} from "./utils";

type VideoGenerationDeps = Pick<
  WorkspaceState,
  | "selectedShot"
  | "selectedScene"
  | "generatingVideoId"
  | "setGeneratingVideoId"
  | "videoGenerationPreview"
  | "setVideoGenerationPreview"
  | "videoGenerationRequest"
  | "setVideoGenerationRequest"
  | "isLoadingVideoPreview"
  | "setIsLoadingVideoPreview"
  | "isSavingShot"
  | "isVideoConfirmOpen"
  | "setIsVideoConfirmOpen"
  | "applyClipSceneUpdate"
  | "loadMediaGenerations"
  | "activeVideoDuration"
  | "activeVideoResolution"
  | "activeVideoAudio"
  | "useFirstFrameForVideo"
  | "selectedVideoModel"
  | "setFrameExtractionGeneration"
  | "setPreviewSceneVideo"
> & {
  saveShotDraftBeforeGeneration: () => Promise<boolean>;
  buildVideoGenerationRequest: () => StoryboardVideoGenerationOptions;
};

export function useWorkspaceVideoGeneration(deps: VideoGenerationDeps) {
  const {
    selectedShot,
    generatingVideoId,
    setGeneratingVideoId,
    videoGenerationPreview,
    setVideoGenerationPreview,
    videoGenerationRequest,
    setVideoGenerationRequest,
    isLoadingVideoPreview,
    setIsLoadingVideoPreview,
    isSavingShot,
    isVideoConfirmOpen,
    setIsVideoConfirmOpen,
    applyClipSceneUpdate,
    loadMediaGenerations,
    useFirstFrameForVideo,
    setFrameExtractionGeneration,
    setPreviewSceneVideo,
    saveShotDraftBeforeGeneration,
    buildVideoGenerationRequest,
  } = deps;

  // ── Video polling ──────────────────────────────────────────────────

  const applyClipUpdate = (nextScene: Scene) => {
    applyClipSceneUpdate(nextScene);
  };

  const { start: pollStoryboardVideo, stop: stopVideoPolling } = useSceneVideoPolling({
    onScene: applyClipUpdate,
    onGenerations: (generations) =>
      (deps as unknown as { setMediaGenerations: (g: ReturnType<typeof sceneMediaToWorkspaceMedia>[]) => void }).setMediaGenerations(
        generations.map(sceneMediaToWorkspaceMedia),
      ),
    onTerminal: () => setGeneratingVideoId(null),
    onError: (error) => {
      console.error("Failed to poll storyboard video status:", error);
      setGeneratingVideoId(null);
    },
  });

  // ── Generation ─────────────────────────────────────────────────────

  const runGenerateVideo = async () => {
    if (!selectedShot) return;

    setGeneratingVideoId(selectedShot.id);
    try {
      const result = await sceneApi.generateSceneVideo(
        selectedShot.id,
        videoGenerationRequest ?? buildVideoGenerationRequest(),
      );
      const nextScene = result.scene;
      applyClipSceneUpdate(nextScene);
      await loadMediaGenerations(nextScene.id);
      if (nextScene.video_status === GENERATION_STATUS.GENERATING) {
        pollStoryboardVideo(nextScene.id);
      } else {
        setGeneratingVideoId(null);
      }
    } catch (error) {
      console.error("Failed to generate storyboard video:", error);
      setGeneratingVideoId(null);
    } finally {
      setVideoGenerationRequest(null);
    }
  };

  const handleGenerateVideo = async () => {
    if (
      !selectedShot ||
      generatingVideoId === selectedShot.id ||
      isLoadingVideoPreview ||
      isSavingShot
    ) {
      return;
    }

    if (!(await saveShotDraftBeforeGeneration())) return;

    const request = buildVideoGenerationRequest();
    setIsLoadingVideoPreview(true);
    try {
      const preview = await sceneApi.getSceneVideoGenerationPreview(selectedShot.id, request);
      setVideoGenerationRequest(request);
      setVideoGenerationPreview(preview);
      setIsVideoConfirmOpen(true);
    } catch (error) {
      console.error("Failed to preview storyboard video generation:", error);
    } finally {
      setIsLoadingVideoPreview(false);
    }
  };

  const confirmGenerateVideo = async () => {
    setIsVideoConfirmOpen(false);
    await runGenerateVideo();
  };

  const handleVideoConfirmOpenChange = (open: boolean) => {
    setIsVideoConfirmOpen(open);
    if (!open && !generatingVideoId) {
      setVideoGenerationRequest(null);
      setVideoGenerationPreview(null);
    }
  };

  // ── Video preview ──────────────────────────────────────────────────

  const handleOpenSceneVideoPreview = (src: string, originalSrc?: string) => {
    setPreviewSceneVideo({ src, originalSrc, title: "片段视频预览" });
  };

  // ── Effect: resume polling for in-progress videos ───────────────────

  useEffect(() => {
    if (selectedShot?.video_status === GENERATION_STATUS.GENERATING) {
      setGeneratingVideoId(selectedShot.id);
      pollStoryboardVideo(selectedShot.id);
      return;
    }
    if (selectedShot?.id !== generatingVideoId) {
      stopVideoPolling();
      setGeneratingVideoId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShot?.id, selectedShot?.video_status]);

  return {
    pollStoryboardVideo,
    stopVideoPolling,
    runGenerateVideo,
    handleGenerateVideo,
    confirmGenerateVideo,
    handleVideoConfirmOpenChange,
    handleOpenSceneVideoPreview,
  };
}
