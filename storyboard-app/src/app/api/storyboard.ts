import { apiClient } from "./client";
import type {
  GenerateStoryboardCoverResult,
  GenerateStoryboardVideoResult,
  StoryboardCoverGenerationPreview,
  StoryboardVideoGenerationPreview,
  Storyboard,
  StoryboardMediaGeneration,
  StoryboardMediaMutationResult,
} from "../api/types";

export function getStoryboardsByScene(sceneId: number) {
  return apiClient.get<Storyboard[]>(`/scenes/${sceneId}/storyboards`);
}

export function getStoryboard(id: number) {
  return apiClient.get<Storyboard>(`/storyboards/${id}`);
}

export function getStoryboardMediaGenerations(id: number) {
  return apiClient.get<StoryboardMediaGeneration[]>(`/storyboards/${id}/media-generations`);
}

export function setStoryboardMediaGenerationCurrent(storyboardId: number, generationId: number) {
  return apiClient.post<StoryboardMediaMutationResult>(`/storyboards/${storyboardId}/media-generations/${generationId}/set-current`);
}

export function deleteStoryboardMediaGeneration(storyboardId: number, generationId: number) {
  return apiClient.delete<StoryboardMediaMutationResult>(`/storyboards/${storyboardId}/media-generations/${generationId}`);
}

export function createStoryboard(
  sceneId: number,
  data: {
    shot_number?: number;
    content: string;
    dialogue?: string;
    shot_type?: string;
    mood?: string;
    camera_direction?: string;
    camera_motion?: string;
    style_preset?: string;
    style_notes?: string;
    duration?: number;
    background?: string;
    thumbnail_url?: string;
    notes?: string;
  }
) {
  return apiClient.post<Storyboard>(`/scenes/${sceneId}/storyboards`, data);
}

export function updateStoryboard(
  id: number,
  data: {
    shot_number?: number;
    content?: string;
    dialogue?: string;
    shot_type?: string;
    mood?: string;
    camera_direction?: string;
    camera_motion?: string;
    style_preset?: string;
    style_notes?: string;
    duration?: number;
    background?: string;
    thumbnail_url?: string;
    notes?: string;
    sort_order?: number;
  }
) {
  return apiClient.put<Storyboard>(`/storyboards/${id}`, data);
}

export function deleteStoryboard(id: number) {
  return apiClient.delete<{ success: boolean }>(`/storyboards/${id}`);
}

export function getStoryboardCoverGenerationPreview(id: number) {
  return apiClient.get<StoryboardCoverGenerationPreview>(`/storyboards/${id}/cover-generation-preview`);
}

export function generateStoryboardCover(id: number, data?: { use_text_only?: boolean }) {
  return apiClient.post<GenerateStoryboardCoverResult>(`/storyboards/${id}/generate-cover`, data ?? {});
}

export function getStoryboardVideoGenerationPreview(id: number, data?: { model?: string; duration?: number }) {
  const params = new URLSearchParams();
  if (data?.model) {
    params.set("model", data.model);
  }
  if (data?.duration) {
    params.set("duration", String(data.duration));
  }
  const query = params.toString();
  return apiClient.get<StoryboardVideoGenerationPreview>(`/storyboards/${id}/video-generation-preview${query ? `?${query}` : ""}`);
}

export function generateStoryboardVideo(id: number, data?: { model?: string; duration?: number }) {
  return apiClient.post<GenerateStoryboardVideoResult>(`/storyboards/${id}/generate-video`, data);
}
