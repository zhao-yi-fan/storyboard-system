import { apiClient } from "./client";
import type {
  GenerateStoryboardCoverResult,
  GenerateStoryboardVideoResult,
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
    camera_direction?: string;
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
    camera_direction?: string;
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

export function generateStoryboardCover(id: number) {
  return apiClient.post<GenerateStoryboardCoverResult>(`/storyboards/${id}/generate-cover`);
}

export function generateStoryboardVideo(id: number) {
  return apiClient.post<GenerateStoryboardVideoResult>(`/storyboards/${id}/generate-video`);
}
