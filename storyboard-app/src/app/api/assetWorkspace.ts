import { ENTITY_TYPE, type EntityType } from "../constants/domain";
import { apiClient } from "./client";
import type { AssetRequirement, AssetVersion, CharacterVoiceVersion, PersonalAsset } from "./types";

export function getRequirements(projectId: number, chapterId?: number) {
  return apiClient.get<AssetRequirement[]>(`/projects/${projectId}/asset-requirements`, {
    chapter_id: chapterId,
  });
}

export function generateRequirements(
  projectId: number,
  data: { chapter_id?: number; requirement_id?: number; missing_only?: boolean },
) {
  return apiClient.post<Array<{ id: number; status: string; error?: string }>>(
    `/projects/${projectId}/asset-requirements/generate`,
    data,
  );
}

export function confirmRequirement(id: number) {
  return apiClient.post<AssetRequirement>(`/asset-requirements/${id}/confirm`, {});
}

export function getPersonalAssets(kind?: string) {
  return apiClient.get<PersonalAsset[]>("/personal-assets", { kind });
}

export function importPersonalAsset(
  id: number,
  data: { project_id: number; requirement_id?: number },
) {
  return apiClient.post<PersonalImportResult>(`/personal-assets/${id}/import-to-project`, data);
}

export function saveCharacterToPersonal(id: number) {
  return apiClient.post<PersonalAsset>(`/characters/${id}/save-to-personal`, {});
}

export type PersonalImageTarget = {
  entity_type: "character" | "asset";
  entity_id: number;
  name: string;
  image?: string;
  kind: "character" | "scene" | "prop";
};
export type PersonalImportResult = {
  entity_type: "character" | "asset";
  entity_id: number;
  version_id: number;
  changed: boolean;
};
export function applyPersonalImage(id: number, projectId: number, target: PersonalImageTarget) {
  return apiClient.post<PersonalImportResult>(`/personal-assets/${id}/apply-image`, {
    project_id: projectId,
    entity_type: target.entity_type,
    entity_id: target.entity_id,
  });
}

export function saveAssetToPersonal(id: number) {
  return apiClient.post<PersonalAsset>(`/assets/${id}/save-to-personal`, {});
}

export function getVersions(entityType: Exclude<EntityType, "project">, id: number) {
  return apiClient.get<AssetVersion[]>(
    `/${entityType === ENTITY_TYPE.CHARACTER ? "characters" : "assets"}/${id}/versions`,
  );
}

export function setCurrentVersion(
  entityType: Exclude<EntityType, "project">,
  id: number,
  versionId: number,
) {
  return apiClient.post<AssetVersion[]>(
    `/${entityType === ENTITY_TYPE.CHARACTER ? "characters" : "assets"}/${id}/versions/${versionId}/set-current`,
    {},
  );
}

export function getCharacterVoiceVersions(id: number) {
  return apiClient.get<CharacterVoiceVersion[]>(`/characters/${id}/voice-versions`);
}

export function setCurrentCharacterVoiceVersion(id: number, versionId: number) {
  return apiClient.post<CharacterVoiceVersion[]>(
    `/characters/${id}/voice-versions/${versionId}/set-current`,
    {},
  );
}
