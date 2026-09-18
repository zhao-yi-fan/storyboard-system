import type { Asset, Character } from "../api";
import type { AIPreviewDialogState } from "../components/assets/dialogs/AIGenerationPreviewDialog";
import type { CreateAssetMode } from "../components/assets/dialogs/CreateAssetDialog";
import type { DeleteAssetTarget } from "../components/assets/dialogs/DeleteAssetDialog";
import type { ENTITY_TYPE } from "../constants/domain";

export type SelectedAsset =
  | { type: typeof ENTITY_TYPE.CHARACTER; data: Character }
  | { type: typeof ENTITY_TYPE.ASSET; data: Asset }
  | null;

export type CreateMode = CreateAssetMode;

export type DeleteTarget = DeleteAssetTarget;

export type AIPreviewDialogInput = Omit<AIPreviewDialogState, "promptDraft">;

export const getCharacterPreviewSrc = (character: Character | null | undefined) =>
  character?.design_sheet_url ?? "";

export const getCharacterDesignSheetPreviewSrc = (character: Character | null | undefined) =>
  character?.design_sheet_url ?? "";

export const getCharacterReferenceSrc = (character: Character | null | undefined) =>
  character?.avatar_url ?? "";

export const getCharacterVoiceReferenceSrc = (character: Character | null | undefined) =>
  character?.voice_reference_url ?? "";

export const hasCharacterVoiceReference = (character: Character | null | undefined) =>
  Boolean(character?.voice_reference_url);

export const CHARACTER_GENERATION_COPY = {
  DESIGN_SHEET_MODEL_LABEL: "Seedream 4.5 图生图",
  VOICE_REFERENCE_TEXT: "今天风很轻，我们慢慢把事情说清楚。",
  VOICE_REFERENCE_DURATION_HINT:
    "目标 3-5 秒；超过 5 秒会自动裁剪，低于 3 秒会生成失败且不覆盖已有语音。",
  VOICE_REFERENCE_TEXT_HINT: "主语音参考统一使用系统固定短句，避免参考音频过长影响 Seedance。",
} as const;

export const getAssetOriginalSrc = (asset: Asset | null | undefined) => asset?.file_url ?? "";
