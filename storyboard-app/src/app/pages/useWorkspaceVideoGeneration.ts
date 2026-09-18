import type { SetStateAction } from "react";
import { useState } from "react";

import type {
  Scene,
  Storyboard,
  StoryboardMediaGeneration,
  StoryboardVideoGenerationOptions,
  StoryboardVideoGenerationPreview,
  VideoResolution,
} from "../api";
import { sceneApi } from "../api";
import { useSceneVideoPolling } from "../components/workspace/hooks/useSceneVideoPolling";
import { getVideoGenerationSpecLabel } from "../components/workspace/VideoGenerationSettings";
import { GENERATION_STATUS, VIDEO_RESOLUTION } from "../constants/domain";
import {
  FIXED_VIDEO_ASPECT_RATIO,
  isSeedanceVideoModel,
  sceneMediaToWorkspaceMedia,
  VIDEO_MODEL_OPTIONS,
} from "./Workspace.helpers";

type UseWorkspaceVideoGenerationDeps = {
  selectedShot: Storyboard | null;
  isSavingShot: boolean;
  saveShotDraftBeforeGeneration: () => Promise<boolean>;
  applyClipSceneUpdate: (scene: Scene) => void;
  loadMediaGenerations: (sceneId: number) => Promise<void>;
  setMediaGenerations: (value: SetStateAction<StoryboardMediaGeneration[]>) => void;
};

export function useWorkspaceVideoGeneration({
  selectedShot,
  isSavingShot,
  saveShotDraftBeforeGeneration,
  applyClipSceneUpdate,
  loadMediaGenerations,
  setMediaGenerations,
}: UseWorkspaceVideoGenerationDeps) {
  const [generatingVideoId, setGeneratingVideoId] = useState<number | null>(null);
  const [selectedVideoModel, setSelectedVideoModel] = useState<
    (typeof VIDEO_MODEL_OPTIONS)[number]["value"]
  >(VIDEO_MODEL_OPTIONS[0].value);
  const [selectedVideoResolution, setSelectedVideoResolution] = useState<VideoResolution>(
    VIDEO_RESOLUTION.HD,
  );
  const [selectedVideoDuration, setSelectedVideoDuration] = useState(5);
  const [generateVideoAudio, setGenerateVideoAudio] = useState(true);
  const [useFirstFrameForVideo, setUseFirstFrameForVideo] = useState(false);
  const [isLoadingVideoPreview, setIsLoadingVideoPreview] = useState(false);
  const [videoGenerationPreview, setVideoGenerationPreview] =
    useState<StoryboardVideoGenerationPreview | null>(null);
  const [videoGenerationRequest, setVideoGenerationRequest] =
    useState<StoryboardVideoGenerationOptions | null>(null);
  const [isVideoConfirmOpen, setIsVideoConfirmOpen] = useState(false);

  const activeVideoResolution: VideoResolution = isSeedanceVideoModel(selectedVideoModel)
    ? selectedVideoResolution
    : VIDEO_RESOLUTION.HD;
  const activeVideoDuration = isSeedanceVideoModel(selectedVideoModel) ? selectedVideoDuration : 5;
  const activeVideoAudio = isSeedanceVideoModel(selectedVideoModel) ? generateVideoAudio : true;
  const activeVideoSpecLabel = getVideoGenerationSpecLabel(
    FIXED_VIDEO_ASPECT_RATIO,
    activeVideoResolution,
    activeVideoDuration,
    activeVideoAudio,
  );
  const previewVideoSpecLabel = videoGenerationPreview
    ? getVideoGenerationSpecLabel(
        videoGenerationPreview.aspect_ratio || FIXED_VIDEO_ASPECT_RATIO,
        videoGenerationPreview.resolution as VideoResolution,
        videoGenerationPreview.duration,
        videoGenerationPreview.audio,
      )
    : activeVideoSpecLabel;

  const buildVideoGenerationRequest = (): StoryboardVideoGenerationOptions => ({
    model: selectedVideoModel,
    aspect_ratio: FIXED_VIDEO_ASPECT_RATIO,
    resolution: activeVideoResolution,
    duration: activeVideoDuration,
    generate_audio: activeVideoAudio,
    use_first_frame: useFirstFrameForVideo,
  });

  const handleVideoModelChange = (value: string) => {
    const model = value as (typeof VIDEO_MODEL_OPTIONS)[number]["value"];
    setSelectedVideoModel(model);
    if (!isSeedanceVideoModel(model)) {
      setSelectedVideoResolution(VIDEO_RESOLUTION.HD);
      setSelectedVideoDuration(5);
      setGenerateVideoAudio(true);
    }
  };

  const { start: pollStoryboardVideo, stop: stopVideoPolling } = useSceneVideoPolling({
    onScene: applyClipSceneUpdate,
    onGenerations: (generations) =>
      setMediaGenerations(generations.map(sceneMediaToWorkspaceMedia)),
    onTerminal: () => setGeneratingVideoId(null),
    onError: (error) => {
      console.error("Failed to poll storyboard video status:", error);
      setGeneratingVideoId(null);
    },
  });

  const runGenerateVideo = async () => {
    if (!selectedShot) {
      return;
    }

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

    if (!(await saveShotDraftBeforeGeneration())) {
      return;
    }

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

  return {
    generatingVideoId,
    setGeneratingVideoId,
    selectedVideoModel,
    selectedVideoResolution,
    setSelectedVideoResolution,
    selectedVideoDuration,
    setSelectedVideoDuration,
    generateVideoAudio,
    setGenerateVideoAudio,
    useFirstFrameForVideo,
    setUseFirstFrameForVideo,
    isLoadingVideoPreview,
    videoGenerationPreview,
    videoGenerationRequest,
    isVideoConfirmOpen,
    activeVideoResolution,
    activeVideoDuration,
    activeVideoAudio,
    activeVideoSpecLabel,
    previewVideoSpecLabel,
    buildVideoGenerationRequest,
    handleVideoModelChange,
    pollStoryboardVideo,
    stopVideoPolling,
    runGenerateVideo,
    handleGenerateVideo,
    confirmGenerateVideo,
    handleVideoConfirmOpenChange,
  };
}
