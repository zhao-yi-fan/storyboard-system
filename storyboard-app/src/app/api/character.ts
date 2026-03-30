import { apiClient } from "./client";
import type { Character } from "./types";

// 获取项目下所有角色
export function getCharactersByProject(projectId: number) {
  return apiClient.get<Character[]>(`/projects/${projectId}/characters`);
}

// 获取单个角色详情
export function getCharacter(id: number) {
  return apiClient.get<Character>(`/characters/${id}`);
}

// 创建角色
export function createCharacter(
  projectId: number,
  data: { name: string; description?: string; avatar_url?: string }
) {
  return apiClient.post<Character>(`/projects/${projectId}/characters`, data);
}

// 更新角色
export function updateCharacter(
  id: number,
  data: { name?: string; description?: string; avatar_url?: string }
) {
  return apiClient.put<Character>(`/characters/${id}`, data);
}

// 删除角色
export function deleteCharacter(id: number) {
  return apiClient.delete<{ success: boolean }>(`/characters/${id}`);
}
