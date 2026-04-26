import { apiClient } from "./client";
import type { AIGenerationPreview, Asset } from "./types";

export function getAssetsByProject(projectId: number) {
  return apiClient.get<Asset[]>(`/projects/${projectId}/assets`);
}

export function getAssetsByCharacter(characterId: number) {
  return apiClient.get<Asset[]>(`/characters/${characterId}/assets`);
}

export function createAsset(
  projectId: number,
  data: { character_id?: number; name: string; type: string; file_url?: string; meta?: string }
) {
  return apiClient.post<Asset>(`/projects/${projectId}/assets`, data);
}

export function updateAsset(
  id: number,
  data: { character_id?: number; name?: string; type?: string; file_url?: string; meta?: string }
) {
  return apiClient.put<Asset>(`/assets/${id}`, data);
}

export function getAssetCoverGenerationPreview(id: number) {
  return apiClient.get<AIGenerationPreview>(`/assets/${id}/cover-generation-preview`);
}

export function generateAssetCover(id: number) {
  return apiClient.post<Asset>(`/assets/${id}/generate-cover`);
}

export function deleteAsset(id: number) {
  return apiClient.delete<{ success: boolean }>(`/assets/${id}`);
}
