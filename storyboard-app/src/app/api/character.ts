import { apiClient } from "./client";
import type { Character } from "./types";

export function getCharactersByProject(projectId: number) {
  return apiClient.get<Character[]>(`/projects/${projectId}/characters`);
}

export function getCharacter(id: number) {
  return apiClient.get<Character>(`/characters/${id}`);
}

export function createCharacter(
  projectId: number,
  data: { name: string; description?: string; avatar_url?: string; design_sheet_url?: string }
) {
  return apiClient.post<Character>(`/projects/${projectId}/characters`, data);
}

export function updateCharacter(
  id: number,
  data: { name?: string; description?: string; avatar_url?: string; design_sheet_url?: string }
) {
  return apiClient.put<Character>(`/characters/${id}`, data);
}

export function generateCharacterCover(id: number) {
  return apiClient.post<Character>(`/characters/${id}/generate-cover`);
}

export function generateCharacterDesignSheet(id: number, data?: { mode?: "draft" | "final" }) {
  return apiClient.post<Character>(`/characters/${id}/generate-design-sheet`, data ?? {});
}

export function deleteCharacter(id: number) {
  return apiClient.delete<{ success: boolean }>(`/characters/${id}`);
}
