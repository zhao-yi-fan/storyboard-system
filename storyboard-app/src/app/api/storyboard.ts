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
import type { Asset } from "./types";

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

export function addStoryboardCharacter(id: number, characterId: number) {
  return apiClient.post<Storyboard>(`/storyboards/${id}/characters`, { character_id: characterId });
}

export function removeStoryboardCharacter(id: number, characterId: number) {
  return apiClient.delete<Storyboard>(`/storyboards/${id}/characters/${characterId}`);
}

export function addStoryboardAsset(id: number, assetId: number) {
  return apiClient.post<Storyboard>(`/storyboards/${id}/assets`, { asset_id: assetId });
}

export function removeStoryboardAsset(id: number, assetId: number) {
  return apiClient.delete<Storyboard>(`/storyboards/${id}/assets/${assetId}`);
}

export function getStoryboardCoverGenerationPreview(id: number, data?: { model?: string }) {
  const params = new URLSearchParams();
  if (data?.model) {
    params.set("model", data.model);
  }
  const query = params.toString();
  return apiClient.get<StoryboardCoverGenerationPreview>(`/storyboards/${id}/cover-generation-preview${query ? `?${query}` : ""}`);
}

export function generateStoryboardCover(id: number, data?: { model?: string; use_text_only?: boolean }) {
  return apiClient.post<GenerateStoryboardCoverResult>(`/storyboards/${id}/generate-cover`, data ?? {});
}

export function getStoryboardVideoGenerationPreview(id: number, data?: { model?: string; duration?: number; use_first_frame?: boolean }) {
  const params = new URLSearchParams();
  if (data?.model) {
    params.set("model", data.model);
  }
  if (data?.duration) {
    params.set("duration", String(data.duration));
  }
  if (typeof data?.use_first_frame === "boolean") {
    params.set("use_first_frame", String(data.use_first_frame));
  }
  const query = params.toString();
  return apiClient.get<StoryboardVideoGenerationPreview>(`/storyboards/${id}/video-generation-preview${query ? `?${query}` : ""}`);
}

export function generateStoryboardVideo(id: number, data?: { model?: string; duration?: number; use_first_frame?: boolean }) {
  return apiClient.post<GenerateStoryboardVideoResult>(`/storyboards/${id}/generate-video`, data);
}

export function uploadStoryboardCover(id: number, thumbnailUrl: string) {
  return apiClient.post<StoryboardMediaMutationResult>(`/storyboards/${id}/upload-cover`, {
    thumbnail_url: thumbnailUrl,
  });
}
