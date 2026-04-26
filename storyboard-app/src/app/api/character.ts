import { apiClient } from "./client";
import type { AIGenerationPreview, Character } from "./types";

export function getCharactersByProject(projectId: number) {
  return apiClient.get<Character[]>(`/projects/${projectId}/characters`);
}

export function getCharacter(id: number) {
  return apiClient.get<Character>(`/characters/${id}`);
}

export function createCharacter(
  projectId: number,
  data: { name: string; description?: string; avatar_url?: string; design_sheet_url?: string; voice_prompt?: string }
) {
  return apiClient.post<Character>(`/projects/${projectId}/characters`, data);
}

export function updateCharacter(
  id: number,
  data: { name?: string; description?: string; avatar_url?: string; design_sheet_url?: string; voice_prompt?: string }
) {
  return apiClient.put<Character>(`/characters/${id}`, data);
}

export function getCharacterCoverGenerationPreview(id: number) {
  return apiClient.get<AIGenerationPreview>(`/characters/${id}/cover-generation-preview`);
}

export function generateCharacterCover(id: number) {
  return apiClient.post<Character>(`/characters/${id}/generate-cover`);
}

export function getCharacterDesignSheetGenerationPreview(id: number, data?: { mode?: "draft" | "final" }) {
  const mode = data?.mode ? `?mode=${encodeURIComponent(data.mode)}` : "";
  return apiClient.get<AIGenerationPreview>(`/characters/${id}/design-sheet-generation-preview${mode}`);
}

export function generateCharacterDesignSheet(id: number, data?: { mode?: "draft" | "final" }) {
  return apiClient.post<Character>(`/characters/${id}/generate-design-sheet`, data ?? {});
}

export function getCharacterVoiceReferenceGenerationPreview(id: number, data?: { voice_prompt?: string; preview_text?: string }) {
  const params = new URLSearchParams();
  if (data?.voice_prompt) params.set("voice_prompt", data.voice_prompt);
  if (data?.preview_text) params.set("preview_text", data.preview_text);
  const query = params.toString();
  return apiClient.get<AIGenerationPreview>(`/characters/${id}/voice-reference-generation-preview${query ? `?${query}` : ""}`);
}

export function generateCharacterVoiceReference(id: number, data?: { voice_prompt?: string; preview_text?: string }) {
  return apiClient.post<Character>(`/characters/${id}/generate-voice-reference`, data ?? {});
}

export function deleteCharacter(id: number) {
  return apiClient.delete<{ success: boolean }>(`/characters/${id}`);
}
