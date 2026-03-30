import { apiClient } from "./client";
import type { Asset } from "./types";

// 获取项目下所有资产
export function getAssetsByProject(projectId: number) {
  return apiClient.get<Asset[]>(`/projects/${projectId}/assets`);
}

// 获取角色下所有资产
export function getAssetsByCharacter(characterId: number) {
  return apiClient.get<Asset[]>(`/characters/${characterId}/assets`);
}

// 删除资产
export function deleteAsset(id: number) {
  return apiClient.delete<{ success: boolean }>(`/assets/${id}`);
}
