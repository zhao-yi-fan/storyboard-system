import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router";
import {
  Film,
  Search,
  Plus,
  Users,
  MapPin,
  ArrowLeft,
  MoreHorizontal,
  X,
  Grid3x3,
  List,
  Trash2,
  Save,
  Loader2,
  Sparkles,
  Upload,
  Package,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ImagePreviewDialog } from "../components/shared/ImagePreviewDialog";
import { AssetVersionsDialog } from "../components/assets/dialogs/AssetVersionsDialog";
import { VoiceVersionsDialog } from "../components/assets/dialogs/VoiceVersionsDialog";
import {
  AI_PREVIEW_ACTION,
  AIGenerationPreviewDialog,
  type AIPreviewDialogState,
} from "../components/assets/dialogs/AIGenerationPreviewDialog";
import {
  CreateAssetDialog,
  type CreateAssetMode,
} from "../components/assets/dialogs/CreateAssetDialog";
import {
  DeleteAssetDialog,
  type DeleteAssetTarget,
} from "../components/assets/dialogs/DeleteAssetDialog";
import {
  AssetCollection,
  ContainedAssetImage,
  getAssetKind,
  getAssetKindLabel,
  getAssetTab,
  isPropAsset,
} from "../components/assets/AssetCollection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  characterApi,
  assetApi,
  assetWorkspaceApi,
  projectApi,
  ossApi,
  type Character,
  type Asset,
  type AssetVersion,
  type CharacterVoiceVersion,
  type Project,
} from "../api";
import {
  ASSET_KIND,
  ASSET_LIBRARY_TAB,
  ASSET_VIEW_MODE,
  ENTITY_TYPE,
  GENERATION_STATUS,
  type AssetLibraryTab,
  type AssetViewMode,
} from "../constants/domain";
import styles from "./AssetLibrary.module.scss";

type SelectedAsset =
  | { type: typeof ENTITY_TYPE.CHARACTER; data: Character }
  | { type: typeof ENTITY_TYPE.ASSET; data: Asset }
  | null;

type CreateMode = CreateAssetMode;

type DeleteTarget = DeleteAssetTarget;

type AIPreviewDialogInput = Omit<AIPreviewDialogState, "promptDraft">;

const getCharacterPreviewSrc = (character: Character | null | undefined) =>
  character?.design_sheet_url || "";

const getCharacterDesignSheetPreviewSrc = (character: Character | null | undefined) =>
  character?.design_sheet_url || "";

const getCharacterReferenceSrc = (character: Character | null | undefined) =>
  character?.avatar_url || "";

const getCharacterVoiceReferenceSrc = (character: Character | null | undefined) =>
  character?.voice_reference_url || "";

const hasCharacterVoiceReference = (character: Character | null | undefined) =>
  Boolean(character?.voice_reference_url);

const CHARACTER_GENERATION_COPY = {
  DESIGN_SHEET_MODEL_LABEL: "Seedream 4.5 图生图",
  VOICE_REFERENCE_TEXT: "今天风很轻，我们慢慢把事情说清楚。",
  VOICE_REFERENCE_DURATION_HINT:
    "目标 3-5 秒；超过 5 秒会自动裁剪，低于 3 秒会生成失败且不覆盖已有语音。",
  VOICE_REFERENCE_TEXT_HINT:
    "主语音参考统一使用系统固定短句，避免参考音频过长影响 Seedance。",
} as const;

const getAssetOriginalSrc = (asset: Asset | null | undefined) => asset?.file_url || "";

export default function AssetLibrary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentProjectId = Number(searchParams.get("project") || "0");
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState<AssetLibraryTab>(
    ASSET_LIBRARY_TAB.CHARACTERS,
  );
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset>(null);
  const [viewMode, setViewMode] = useState<AssetViewMode>(ASSET_VIEW_MODE.GRID);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>(ASSET_KIND.CHARACTER);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [aiPreviewDialog, setAiPreviewDialog] = useState<AIPreviewDialogState | null>(null);
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [switchingVersionId, setSwitchingVersionId] = useState<number | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [voiceVersions, setVoiceVersions] = useState<CharacterVoiceVersion[]>([]);
  const [showVoiceVersions, setShowVoiceVersions] = useState(false);
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isLoadingAIPreview, setIsLoadingAIPreview] = useState(false);

  const [newCharacter, setNewCharacter] = useState({ name: "", description: "", avatar_url: "" });
  const [newAsset, setNewAsset] = useState({
    name: "",
    type: ASSET_KIND.SCENE,
    meta: "",
    file_url: "",
  });
  const [createCharacterFile, setCreateCharacterFile] = useState<File | null>(null);
  const [createAssetFile, setCreateAssetFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingCharacter, setIsSavingCharacter] = useState(false);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [uploadingCharacterReferenceId, setUploadingCharacterReferenceId] = useState<number | null>(
    null,
  );
  const [uploadingCharacterVoiceReferenceId, setUploadingCharacterVoiceReferenceId] = useState<
    number | null
  >(null);
  const [generatingCharacterDesignSheetId, setGeneratingCharacterDesignSheetId] = useState<
    number | null
  >(null);
  const [generatingCharacterVoiceReferenceId, setGeneratingCharacterVoiceReferenceId] = useState<
    number | null
  >(null);
  const [characterVoiceReferenceError, setCharacterVoiceReferenceError] = useState<{
    id: number;
    message: string;
  } | null>(null);
  const [generatingAssetCoverId, setGeneratingAssetCoverId] = useState<number | null>(null);
  const [deleteActionKey, setDeleteActionKey] = useState<string | null>(null);
  const [detailSidebarWidth, setDetailSidebarWidth] = useState(384);
  const [isResizingDetailSidebar, setIsResizingDetailSidebar] = useState(false);
  const selectedCharacterReferenceInputRef = useRef<HTMLInputElement | null>(null);
  const selectedCharacterVoiceReferenceInputRef = useRef<HTMLInputElement | null>(null);
  const selectedAssetFileInputRef = useRef<HTMLInputElement | null>(null);

  const MIN_DETAIL_SIDEBAR_WIDTH = 320;
  const MAX_DETAIL_SIDEBAR_WIDTH = 560;

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingDetailSidebar) return;
      const newWidth = window.innerWidth - event.clientX;
      if (newWidth >= MIN_DETAIL_SIDEBAR_WIDTH && newWidth <= MAX_DETAIL_SIDEBAR_WIDTH) {
        setDetailSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingDetailSidebar(false);
    };

    if (isResizingDetailSidebar) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingDetailSidebar]);

  const handleDetailSidebarMouseDown = () => {
    setIsResizingDetailSidebar(true);
  };

  const filteredCharacters = useMemo(() => {
    return characters.filter(
      (char) =>
        char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        char.description?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [characters, searchQuery]);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return assets.filter(
      (asset) =>
        asset.name.toLowerCase().includes(normalizedQuery) ||
        asset.meta?.toLowerCase().includes(normalizedQuery),
    );
  }, [assets, searchQuery]);
  const filteredSceneAssets = useMemo(
    () => filteredAssets.filter((asset) => !isPropAsset(asset)),
    [filteredAssets],
  );
  const filteredPropAssets = useMemo(
    () => filteredAssets.filter((asset) => isPropAsset(asset)),
    [filteredAssets],
  );
  const sceneAssetCount = useMemo(
    () => assets.filter((asset) => !isPropAsset(asset)).length,
    [assets],
  );
  const propAssetCount = assets.length - sceneAssetCount;
  const selectedAssetType = selectedAsset?.type;
  const selectedAssetId = selectedAsset?.data.id;

  const loadCharacters = async () => {
    try {
      if (!currentProjectId) {
        setCharacters([]);
        return;
      }
      const data = await characterApi.getCharactersByProject(currentProjectId);
      setCharacters(data ?? []);
    } catch (error) {
      console.error("Failed to load characters:", error);
    }
  };

  const loadAssets = async () => {
    try {
      if (!currentProjectId) {
        setAssets([]);
        return;
      }
      const data = await assetApi.getAssetsByProject(currentProjectId);
      setAssets(data ?? []);
    } catch (error) {
      console.error("Failed to load assets:", error);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadLibraryData = async () => {
      setLoading(true);
      setLoadError("");
      try {
        if (!currentProjectId) {
          navigate("/projects", { replace: true });
          return;
        }
        const [projectData, characterData, assetData] = await Promise.all([
          projectApi.getProject(currentProjectId),
          characterApi.getCharactersByProject(currentProjectId),
          assetApi.getAssetsByProject(currentProjectId),
        ]);
        if (!cancelled) {
          setProject(projectData);
          setCharacters(characterData ?? []);
          setAssets(assetData ?? []);
          const requestedCharacterId = Number(searchParams.get("character") || 0);
          const requestedCharacter = characterData?.find(
            (item) => item.id === requestedCharacterId,
          );
          if (requestedCharacter) {
            setActiveTab(ASSET_LIBRARY_TAB.CHARACTERS);
            setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: requestedCharacter });
          }
        }
      } catch (error) {
        console.error("Failed to load asset library data:", error);
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "资产库加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadLibraryData();
    return () => {
      cancelled = true;
    };
  }, [currentProjectId, navigate, searchParams]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedAssetType || !selectedAssetId) {
      setVersions([]);
      return;
    }
    setIsLoadingVersions(true);
    void assetWorkspaceApi
      .getVersions(selectedAssetType, selectedAssetId)
      .then((items) => {
        if (!cancelled) setVersions(items);
      })
      .catch((error) => {
        if (!cancelled) {
          setVersions([]);
          console.error("Failed to load asset versions:", error);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingVersions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAssetId, selectedAssetType]);

  const resetCreateState = () => {
    setNewCharacter({ name: "", description: "", avatar_url: "" });
    setNewAsset({ name: "", type: ASSET_KIND.SCENE, meta: "", file_url: "" });
    setCreateCharacterFile(null);
    setCreateAssetFile(null);
  };

  const handleCreate = async () => {
    if (!currentProjectId) return;
    setIsCreating(true);
    try {
      if (createMode === ASSET_KIND.CHARACTER) {
        if (!newCharacter.name.trim()) {
          toast.error("请输入角色名称");
          return;
        }
        let avatarURL = newCharacter.avatar_url.trim();
        if (createCharacterFile) {
          avatarURL = await ossApi.uploadFileToOss(createCharacterFile);
        }
        const created = await characterApi.createCharacter(currentProjectId, {
          name: newCharacter.name.trim(),
          description: newCharacter.description.trim(),
          avatar_url: avatarURL || undefined,
        });
        await loadCharacters();
        setActiveTab(ASSET_LIBRARY_TAB.CHARACTERS);
        setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: created });
      } else {
        if (!newAsset.name.trim() || !newAsset.type.trim()) {
          toast.error(
            `请填写完整的${createMode === ASSET_KIND.PROP ? "道具" : "场景"}资产信息`,
          );
          return;
        }
        let fileURL = newAsset.file_url.trim();
        if (createAssetFile) {
          fileURL = await ossApi.uploadFileToOss(createAssetFile);
        }
        const created = await assetApi.createAsset(currentProjectId, {
          name: newAsset.name.trim(),
          type: newAsset.type.trim(),
          meta: newAsset.meta.trim(),
          file_url: fileURL,
        });
        await loadAssets();
        setActiveTab(getAssetTab(created));
        setSelectedAsset({ type: ENTITY_TYPE.ASSET, data: created });
      }
      resetCreateState();
      setShowCreateDialog(false);
    } catch (error) {
      console.error("Failed to create asset:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const saveSelectedCharacter = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setIsSavingCharacter(true);
    try {
      const updated = await characterApi.updateCharacter(selectedAsset.data.id, {
        name: selectedAsset.data.name,
        description: selectedAsset.data.description || "",
        avatar_url: selectedAsset.data.avatar_url || "",
        voice_prompt: selectedAsset.data.voice_prompt || "",
      });
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: updated });
      toast.success("角色修改已保存");
      return updated;
    } catch (error) {
      console.error("Failed to save character:", error);
      throw error;
    } finally {
      setIsSavingCharacter(false);
    }
  };

  const saveSelectedAsset = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.ASSET) return;
    setIsSavingAsset(true);
    try {
      const updated = await assetApi.updateAsset(selectedAsset.data.id, {
        name: selectedAsset.data.name,
        type: selectedAsset.data.type,
        meta: selectedAsset.data.meta || "",
        file_url: selectedAsset.data.file_url || "",
      });
      setAssets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.ASSET, data: updated });
      setActiveTab(getAssetTab(updated));
      toast.success("资产修改已保存");
      return updated;
    } catch (error) {
      console.error("Failed to save asset:", error);
      throw error;
    } finally {
      setIsSavingAsset(false);
    }
  };

  const runGenerateSelectedCharacterDesignSheet = async (promptOverride: string) => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setGeneratingCharacterDesignSheetId(selectedAsset.data.id);
    try {
      const updated = await characterApi.generateCharacterDesignSheet(
        selectedAsset.data.id,
        promptOverride,
      );
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: updated });
      setVersions(await assetWorkspaceApi.getVersions(ENTITY_TYPE.CHARACTER, updated.id));
      toast.success("主设定图已生成并保存为新版本");
    } catch (error) {
      console.error("Failed to generate character design sheet:", error);
      toast.error(error instanceof Error ? error.message : "生成主设定图失败");
    } finally {
      setGeneratingCharacterDesignSheetId(null);
    }
  };

  const runGenerateSelectedCharacterVoiceReference = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setGeneratingCharacterVoiceReferenceId(selectedAsset.data.id);
    setCharacterVoiceReferenceError(null);
    try {
      const updated = await characterApi.generateCharacterVoiceReference(selectedAsset.data.id, {
        voice_prompt: selectedAsset.data.voice_prompt || "",
      });
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: updated });
      setCharacterVoiceReferenceError(null);
      toast.success("主语音参考已生成");
    } catch (error) {
      console.error("Failed to generate character voice reference:", error);
      const message = error instanceof Error ? error.message : "生成主语音参考失败";
      setCharacterVoiceReferenceError({ id: selectedAsset.data.id, message });
      toast.error(message);
    } finally {
      setGeneratingCharacterVoiceReferenceId(null);
    }
  };

  const runGenerateSelectedAssetCover = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.ASSET) return;
    setGeneratingAssetCoverId(selectedAsset.data.id);
    try {
      const updated = await assetApi.generateAssetCover(selectedAsset.data.id);
      setAssets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.ASSET, data: updated });
    } catch (error) {
      console.error("Failed to generate asset cover:", error);
    } finally {
      setGeneratingAssetCoverId(null);
    }
  };

  const openAIPreviewDialog = (state: AIPreviewDialogInput) => {
    setAiPreviewDialog({
      ...state,
      promptDraft: state.preview.final_prompt || "",
    });
  };

  const handleGenerateCharacterDesignSheet = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setIsLoadingAIPreview(true);
    try {
      const saved = await saveSelectedCharacter();
      const preview = await characterApi.getCharacterDesignSheetGenerationPreview(saved!.id);
      openAIPreviewDialog({
        action: AI_PREVIEW_ACTION.CHARACTER_DESIGN_SHEET,
        title: "确认生成主设定图",
        description:
          "会用 Seedream 图生图生成当前角色的主设定图。角色参考图只用于这次生成，不参与其他展示链路。",
        confirmLabel: "确认生成",
        preview,
      });
    } catch (error) {
      console.error("Failed to preview character design sheet generation:", error);
      toast.error(error instanceof Error ? error.message : "获取主设定图预览失败");
    } finally {
      setIsLoadingAIPreview(false);
    }
  };

  const handleUploadSelectedCharacterReference = async (file: File | null) => {
    if (!file || !selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setUploadingCharacterReferenceId(selectedAsset.data.id);
    try {
      const avatarURL = await ossApi.uploadFileToOss(file);
      const updated = await characterApi.updateCharacter(selectedAsset.data.id, {
        avatar_url: avatarURL,
      });
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: updated });
      toast.success("角色参考图已更新");
    } catch (error) {
      console.error("Failed to upload character reference image:", error);
      toast.error(error instanceof Error ? error.message : "上传角色参考图失败");
    } finally {
      setUploadingCharacterReferenceId(null);
      if (selectedCharacterReferenceInputRef.current) {
        selectedCharacterReferenceInputRef.current.value = "";
      }
    }
  };

  const handleUploadSelectedCharacterVoiceReference = async (file: File | null) => {
    if (!file || !selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setUploadingCharacterVoiceReferenceId(selectedAsset.data.id);
    try {
      const voiceReferenceURL = await ossApi.uploadFileToOss(file);
      const updated = await characterApi.uploadCharacterVoiceReference(
        selectedAsset.data.id,
        voiceReferenceURL,
      );
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: updated });
      setCharacterVoiceReferenceError(null);
      toast.success("主语音参考已更新");
    } catch (error) {
      console.error("Failed to upload character voice reference:", error);
      toast.error(error instanceof Error ? error.message : "上传主语音参考失败");
    } finally {
      setUploadingCharacterVoiceReferenceId(null);
      if (selectedCharacterVoiceReferenceInputRef.current) {
        selectedCharacterVoiceReferenceInputRef.current.value = "";
      }
    }
  };

  const handleUploadSelectedAssetFile = async (file: File | null) => {
    if (!file || !selectedAsset || selectedAsset.type !== ENTITY_TYPE.ASSET) return;
    setIsSavingAsset(true);
    try {
      const fileURL = await ossApi.uploadFileToOss(file);
      const updated = await assetApi.updateAsset(selectedAsset.data.id, { file_url: fileURL });
      setAssets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: ENTITY_TYPE.ASSET, data: updated });
      toast.success("原始素材已替换");
    } finally {
      setIsSavingAsset(false);
      if (selectedAssetFileInputRef.current) selectedAssetFileInputRef.current.value = "";
    }
  };

  const handleGenerateCharacterVoiceReference = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setIsLoadingAIPreview(true);
    try {
      const saved = await saveSelectedCharacter();
      const preview = await characterApi.getCharacterVoiceReferenceGenerationPreview(saved!.id, {
        voice_prompt: saved!.voice_prompt || "",
      });
      openAIPreviewDialog({
        action: AI_PREVIEW_ACTION.CHARACTER_VOICE_REFERENCE,
        title: "确认生成主语音参考",
        description: `会用大模型生成当前角色的主语音参考，并绑定到角色资产上。${CHARACTER_GENERATION_COPY.VOICE_REFERENCE_DURATION_HINT}`,
        confirmLabel: "确认生成",
        preview,
      });
    } catch (error) {
      console.error("Failed to preview character voice reference generation:", error);
      toast.error(error instanceof Error ? error.message : "获取主语音参考预览失败");
    } finally {
      setIsLoadingAIPreview(false);
    }
  };

  const handleGenerateAssetCover = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.ASSET) return;
    setIsLoadingAIPreview(true);
    try {
      const saved = await saveSelectedAsset();
      const preview = await assetApi.getAssetCoverGenerationPreview(saved!.id);
      openAIPreviewDialog({
        action: AI_PREVIEW_ACTION.ASSET_COVER,
        title: `确认生成${getAssetKindLabel(saved!)}封面`,
        description: `会为当前${getAssetKindLabel(saved!)}资产生成一张封面图，用于资产库预览。`,
        confirmLabel: "确认生成",
        preview,
      });
    } catch (error) {
      console.error("Failed to preview asset cover generation:", error);
      toast.error(error instanceof Error ? error.message : "获取资产封面预览失败");
    } finally {
      setIsLoadingAIPreview(false);
    }
  };

  const confirmAIPreviewGeneration = async () => {
    if (!aiPreviewDialog) return;
    const action = aiPreviewDialog.action;
    const promptOverride = aiPreviewDialog.promptDraft.trim();
    if (action === AI_PREVIEW_ACTION.CHARACTER_DESIGN_SHEET && !promptOverride) {
      toast.error("最终 Prompt 不能为空");
      return;
    }
    setAiPreviewDialog(null);
    switch (action) {
      case AI_PREVIEW_ACTION.CHARACTER_DESIGN_SHEET:
        await runGenerateSelectedCharacterDesignSheet(promptOverride);
        return;
      case AI_PREVIEW_ACTION.CHARACTER_VOICE_REFERENCE:
        await runGenerateSelectedCharacterVoiceReference();
        return;
      case AI_PREVIEW_ACTION.ASSET_COVER:
        await runGenerateSelectedAssetCover();
        return;
      default:
        return;
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const actionKey = `${deleteTarget.type}:${deleteTarget.id}`;
    setDeleteActionKey(actionKey);
    try {
      if (deleteTarget.type === ENTITY_TYPE.CHARACTER) {
        await characterApi.deleteCharacter(deleteTarget.id);
        await loadCharacters();
      } else {
        await assetApi.deleteAsset(deleteTarget.id);
        await loadAssets();
      }
      if (selectedAsset?.data.id === deleteTarget.id && selectedAsset?.type === deleteTarget.type) {
        setSelectedAsset(null);
      }
      setDeleteTarget(null);
    } catch (error) {
      console.error("Failed to delete item:", error);
    } finally {
      setDeleteActionKey(null);
    }
  };

  const openSelectedVersions = async () => {
    if (!selectedAsset) return;
    setShowVersions(true);
    setVersions([]);
    try {
      setVersions(await assetWorkspaceApi.getVersions(selectedAsset.type, selectedAsset.data.id));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "版本加载失败");
    }
  };

  const chooseSelectedVersion = async (version: AssetVersion) => {
    if (!selectedAsset) return;
    const type = selectedAsset.type;
    const id = selectedAsset.data.id;
    setSwitchingVersionId(version.id);
    try {
      setVersions(await assetWorkspaceApi.setCurrentVersion(type, id, version.id));
      if (type === ENTITY_TYPE.CHARACTER) await loadCharacters();
      else await loadAssets();
      const refreshed =
        type === ENTITY_TYPE.CHARACTER ? await characterApi.getCharacter(id) : await assetApi.getAsset(id);
      if (refreshed) setSelectedAsset({ type, data: refreshed } as SelectedAsset);
      toast.success(type === ENTITY_TYPE.CHARACTER ? "已切换主设定图版本" : "已切换资产版本");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "切换版本失败");
    } finally {
      setSwitchingVersionId(null);
    }
  };

  const saveSelectedToPersonal = async () => {
    if (!selectedAsset) return;
    setIsSavingPersonal(true);
    try {
      if (selectedAsset.type === ENTITY_TYPE.CHARACTER) {
        await assetWorkspaceApi.saveCharacterToPersonal(selectedAsset.data.id);
      } else {
        await assetWorkspaceApi.saveAssetToPersonal(selectedAsset.data.id);
      }
      toast.success("已同步到个人空间");
    } finally {
      setIsSavingPersonal(false);
    }
  };

  const openVoiceVersions = async () => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    setShowVoiceVersions(true);
    setVoiceVersions([]);
    try {
      setVoiceVersions(await assetWorkspaceApi.getCharacterVoiceVersions(selectedAsset.data.id));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "语音版本加载失败");
    }
  };

  const chooseVoiceVersion = async (version: CharacterVoiceVersion) => {
    if (!selectedAsset || selectedAsset.type !== ENTITY_TYPE.CHARACTER) return;
    const id = selectedAsset.data.id;
    setVoiceVersions(await assetWorkspaceApi.setCurrentCharacterVoiceVersion(id, version.id));
    const refreshed = await characterApi.getCharacter(id);
    setCharacters((prev) => prev.map((item) => (item.id === id ? refreshed : item)));
    setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: refreshed });
  };

  const openCreateDialog = () => {
    const nextMode: CreateMode =
      activeTab === ASSET_LIBRARY_TAB.PROPS
        ? ASSET_KIND.PROP
        : activeTab === ASSET_LIBRARY_TAB.SCENES
          ? ASSET_KIND.SCENE
          : ASSET_KIND.CHARACTER;
    setCreateMode(nextMode);
    if (nextMode !== ASSET_KIND.CHARACTER) {
      setNewAsset((prev) => ({ ...prev, type: nextMode }));
    }
    setShowCreateDialog(true);
  };

  const selectCreateMode = (mode: CreateMode) => {
    setCreateMode(mode);
    if (mode !== ASSET_KIND.CHARACTER) {
      setNewAsset((prev) => ({ ...prev, type: mode }));
    }
  };
  return (
    <div className={`storyboard-product-shell dark ${styles.page}`}>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderContent}>
          <div className={styles.pageHeaderStart}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                navigate(currentProjectId ? `/workspace?project=${currentProjectId}` : "/projects")
              }
              className={styles.backButton}
            >
              <ArrowLeft className={styles.backIcon} />
              返回工作台
            </Button>
            <div className={styles.headerDivider}></div>
            <div className={styles.pageBrand}>
              <div className={styles.pageBrandIcon}>
                <Film className={styles.icon} />
              </div>
              <span className={styles.pageBrandTitle}>{project?.name || "项目"} · 资产库</span>
            </div>
          </div>
          <div className={styles.pageHeaderActions}>
            <Button size="sm" className={styles.createButton} onClick={openCreateDialog}>
              <Plus className={styles.createButtonIcon} />
              新建资产
            </Button>
          </div>
        </div>
      </header>

      <div className={styles.pageBody}>
        <main className={styles.assetMain}>
          {loadError ? <div className={styles.loadError}>{loadError}</div> : null}
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as AssetLibraryTab);
              setSelectedAsset(null);
              setShowActionMenu(false);
            }}
            className={styles.assetTabs}
          >
            <div className={styles.assetToolbar}>
              <div className={styles.assetToolbarContent}>
                <TabsList className={styles.tabsList}>
                  <TabsTrigger value={ASSET_LIBRARY_TAB.CHARACTERS} className={styles.tabTrigger}>
                    <Users className={styles.tabIcon} />
                    角色资产
                    <Badge className={styles.tabBadge}>{characters.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value={ASSET_LIBRARY_TAB.SCENES} className={styles.tabTrigger}>
                    <MapPin className={styles.tabIcon} />
                    场景资产
                    <Badge className={styles.tabBadge}>{sceneAssetCount}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value={ASSET_LIBRARY_TAB.PROPS} className={styles.tabTrigger}>
                    <Package className={styles.tabIcon} />
                    道具资产
                    <Badge className={styles.tabBadge}>{propAssetCount}</Badge>
                  </TabsTrigger>
                </TabsList>
                <div className={styles.toolbarActions}>
                  <div className={styles.search}>
                    <Search className={styles.searchIcon} />
                    <Input
                      placeholder="搜索资产..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={styles.searchInput}
                    />
                  </div>
                  <div className={styles.viewToggle}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={
                        viewMode === ASSET_VIEW_MODE.GRID
                          ? styles.viewToggleButtonActive
                          : styles.viewToggleButton
                      }
                      onClick={() => setViewMode(ASSET_VIEW_MODE.GRID)}
                    >
                      <Grid3x3 className={styles.icon} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={
                        viewMode === ASSET_VIEW_MODE.LIST
                          ? styles.viewToggleButtonActive
                          : styles.viewToggleButton
                      }
                      onClick={() => setViewMode(ASSET_VIEW_MODE.LIST)}
                    >
                      <List className={styles.icon} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <TabsContent value={ASSET_LIBRARY_TAB.CHARACTERS} className={styles.tabContent}>
              <div className={styles.collectionScroll}>
                {loading ? (
                  <div className={styles.collectionLoading}>
                    <Loader2 className={styles.collectionLoadingIcon} />
                  </div>
                ) : filteredCharacters.length === 0 ? (
                  <div className={styles.collectionEmpty}>暂无角色资产</div>
                ) : viewMode === ASSET_VIEW_MODE.GRID ? (
                  <div className={styles.characterGrid}>
                    {filteredCharacters.map((character) => (
                      <button
                        key={character.id}
                        onClick={() => setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: character })}
                        className={
                          selectedAsset?.type === ENTITY_TYPE.CHARACTER &&
                          selectedAsset.data.id === character.id
                            ? styles.characterGridCardSelected
                            : styles.characterGridCard
                        }
                      >
                        <div className={styles.characterGridPreview}>
                          {getCharacterPreviewSrc(character) ? (
                            <ContainedAssetImage
                              src={getCharacterPreviewSrc(character)}
                              alt={character.name}
                              className={styles.fullSize}
                            />
                          ) : (
                            <Users className={styles.assetGridPlaceholderIcon} />
                          )}
                          <div className={styles.secondaryBadgePosition}>
                            <Badge className={styles.characterBadge}>角色</Badge>
                          </div>
                        </div>
                        <div className={styles.assetGridContent}>
                          <div className={styles.characterNameRow}>
                            <h4 className={styles.assetName}>{character.name}</h4>
                            {hasCharacterVoiceReference(character) ? (
                              <Badge className={styles.voiceBadge}>角色语音</Badge>
                            ) : null}
                          </div>
                          <p className={styles.assetGridDescription}>{character.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={styles.assetList}>
                    {filteredCharacters.map((character) => (
                      <button
                        key={character.id}
                        onClick={() => setSelectedAsset({ type: ENTITY_TYPE.CHARACTER, data: character })}
                        className={
                          selectedAsset?.type === ENTITY_TYPE.CHARACTER &&
                          selectedAsset.data.id === character.id
                            ? styles.assetListCardSelected
                            : styles.assetListCard
                        }
                      >
                        <div className={styles.characterListPreview}>
                          {getCharacterPreviewSrc(character) ? (
                            <ContainedAssetImage
                              src={getCharacterPreviewSrc(character)}
                              alt={character.name}
                              className={styles.assetListImage}
                            />
                          ) : (
                            <Users className={styles.assetListPlaceholderIcon} />
                          )}
                        </div>
                        <div className={styles.assetListContent}>
                          <div className={styles.characterListHeader}>
                            <h4 className={styles.assetName}>{character.name}</h4>
                            <Badge className={styles.characterBadge}>角色</Badge>
                            {hasCharacterVoiceReference(character) ? (
                              <Badge className={styles.voiceBadge}>角色语音</Badge>
                            ) : null}
                          </div>
                          <p className={styles.assetListDescription}>{character.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {[
              { value: ASSET_LIBRARY_TAB.SCENES, items: filteredSceneAssets, emptyLabel: "暂无场景资产" },
              { value: ASSET_LIBRARY_TAB.PROPS, items: filteredPropAssets, emptyLabel: "暂无道具资产" },
            ].map((collection) => (
              <TabsContent
                key={collection.value}
                value={collection.value}
                className={styles.tabContent}
              >
                <div className={styles.collectionScroll}>
                  <AssetCollection
                    assets={collection.items}
                    emptyLabel={collection.emptyLabel}
                    loading={loading}
                    viewMode={viewMode}
                    selectedAssetId={
                      selectedAsset?.type === ENTITY_TYPE.ASSET ? selectedAsset.data.id : null
                    }
                    onSelect={(asset) => setSelectedAsset({ type: ENTITY_TYPE.ASSET, data: asset })}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </main>

        {selectedAsset ? (
          <>
            <div
              className={`resize-handle resize-handle-left ${styles.resizeHandle} ${isResizingDetailSidebar ? "dragging" : ""}`}
              onMouseDown={handleDetailSidebarMouseDown}
            />

            <aside style={{ width: detailSidebarWidth }} className={styles.detailSidebar}>
              <>
                <div className={styles.detailHeader}>
                  <h3 className={styles.detailTitle}>
                    {selectedAsset.type === ENTITY_TYPE.CHARACTER
                      ? "角色详情"
                      : `${getAssetKindLabel(selectedAsset.data)}详情`}
                  </h3>
                  <div className={styles.detailHeaderActions}>
                    <div className={styles.actionMenuWrap}>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="资产操作"
                        aria-expanded={showActionMenu}
                        className={styles.detailIconButton}
                        onClick={() => setShowActionMenu((open) => !open)}
                      >
                        <MoreHorizontal className={styles.icon} />
                      </Button>
                      {showActionMenu ? (
                        <div className={styles.actionMenu}>
                          <button
                            type="button"
                            className={styles.actionMenuItem}
                            onClick={() => {
                              setShowActionMenu(false);
                              void openSelectedVersions();
                            }}
                          >
                            查看生成版本
                          </button>
                          {selectedAsset.type === ENTITY_TYPE.CHARACTER ? (
                            <button
                              type="button"
                              className={styles.actionMenuItem}
                              onClick={() => {
                                setShowActionMenu(false);
                                void openVoiceVersions();
                              }}
                            >
                              查看语音版本
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={isSavingPersonal}
                            className={styles.actionMenuItem}
                            onClick={() => {
                              setShowActionMenu(false);
                              void saveSelectedToPersonal();
                            }}
                          >
                            保存到个人空间
                          </button>
                          <button
                            type="button"
                            className={styles.actionMenuDelete}
                            onClick={() => {
                              setShowActionMenu(false);
                              setDeleteTarget({
                                type: selectedAsset.type,
                                id: selectedAsset.data.id,
                                name: selectedAsset.data.name,
                                ...(selectedAsset.type === ENTITY_TYPE.ASSET
                                  ? { assetKind: getAssetKind(selectedAsset.data) }
                                  : {}),
                              });
                            }}
                          >
                            删除资产
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={styles.detailIconButton}
                      onClick={() => setSelectedAsset(null)}
                    >
                      <X className={styles.icon} />
                    </Button>
                  </div>
                </div>
                <div className={styles.detailScroll}>
                  {selectedAsset.type === ENTITY_TYPE.CHARACTER ? (
                    <div className={styles.detailSections}>
                      <div className={styles.detailCard}>
                        <div className={styles.detailCardHeader}>
                          <div>
                            <div className={styles.detailCardTitle}>角色参考图</div>
                            <div className={styles.detailCardDescription}>
                              只用于生成主设定图，不参与其他展示和分镜参考链路
                            </div>
                          </div>
                          <Badge className={styles.internalBadge}>内部参考</Badge>
                        </div>
                        <div className={styles.characterReferencePreview}>
                          {getCharacterReferenceSrc(selectedAsset.data) ? (
                            <button
                              type="button"
                              className={styles.fullSize}
                              onClick={() =>
                                setPreviewImage({
                                  src: getCharacterReferenceSrc(selectedAsset.data),
                                  alt: `${selectedAsset.data.name} 角色参考图`,
                                })
                              }
                            >
                              <ContainedAssetImage
                                src={getCharacterReferenceSrc(selectedAsset.data)}
                                alt={`${selectedAsset.data.name} 角色参考图`}
                                className={styles.assetListImage}
                              />
                            </button>
                          ) : (
                            <Users className={styles.largePlaceholderIcon} />
                          )}
                        </div>
                        <div>
                          <Label className={styles.detailLabel}>角色参考图地址</Label>
                          <Input
                            value={selectedAsset.data.avatar_url || ""}
                            onChange={(e) =>
                              setSelectedAsset({
                                type: ENTITY_TYPE.CHARACTER,
                                data: { ...selectedAsset.data, avatar_url: e.target.value },
                              })
                            }
                            placeholder="https://..."
                            className={styles.detailInput}
                          />
                        </div>
                        <div className={styles.buttonRow}>
                          <input
                            ref={selectedCharacterReferenceInputRef}
                            type="file"
                            accept="image/*"
                            className={styles.hiddenInput}
                            onChange={(e) =>
                              void handleUploadSelectedCharacterReference(
                                e.target.files?.[0] || null,
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className={styles.secondaryFullButton}
                            disabled={uploadingCharacterReferenceId === selectedAsset.data.id}
                            onClick={() => selectedCharacterReferenceInputRef.current?.click()}
                          >
                            {uploadingCharacterReferenceId === selectedAsset.data.id ? (
                              <>
                                <Loader2 className={styles.buttonLoadingIcon} />
                                上传中
                              </>
                            ) : (
                              <>上传参考图</>
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className={styles.detailCard}>
                        <div className={styles.detailCardHeader}>
                          <div>
                            <div className={styles.detailCardTitle}>角色主设定图</div>
                            <div className={styles.detailCardDescription}>
                              角色正式展示图，以及后续分镜封面的人物核心参考图
                            </div>
                          </div>
                          <Badge className={styles.secondaryBadge}>角色设定</Badge>
                        </div>
                        <div className={styles.characterDesignPreview}>
                          {getCharacterDesignSheetPreviewSrc(selectedAsset.data) ? (
                            <button
                              type="button"
                              className={styles.fullSize}
                              onClick={() =>
                                setPreviewImage({
                                  src: selectedAsset.data.design_sheet_url || "",
                                  alt: `${selectedAsset.data.name} 设定图`,
                                })
                              }
                            >
                              <ContainedAssetImage
                                src={getCharacterDesignSheetPreviewSrc(selectedAsset.data)}
                                alt={`${selectedAsset.data.name} 设定图`}
                                className={styles.assetListImage}
                              />
                            </button>
                          ) : (
                            <Users className={styles.largePlaceholderIcon} />
                          )}
                        </div>
                        <div className={styles.subsection}>
                          <div className={styles.subsectionHeader}>
                            <div className={styles.detailLabel}>主设定图版本</div>
                            <div className={styles.versionCount}>
                              {isLoadingVersions ? "加载中" : `${versions.length} 个版本`}
                            </div>
                          </div>
                          {versions.length ? (
                            <div className={styles.versionGrid}>
                              {versions.slice(0, 6).map((version, index) => (
                                <VersionImageCard
                                  key={version.id}
                                  version={version}
                                  src={version.file_url}
                                  alt={`${selectedAsset.data.name} 主设定图版本 ${versions.length - index}`}
                                  label={`v${versions.length - index}`}
                                  aspectClassName={styles.aspectSquare}
                                  switching={switchingVersionId === version.id}
                                  onPreview={() =>
                                    setPreviewImage({
                                      src: version.file_url,
                                      alt: `${selectedAsset.data.name} 主设定图版本 ${versions.length - index}`,
                                    })
                                  }
                                  onSetCurrent={() => void chooseSelectedVersion(version)}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className={styles.versionsEmpty}>
                              {isLoadingVersions ? "正在加载版本" : "生成后会在这里保留历史版本"}
                            </div>
                          )}
                          {versions.length > 6 ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className={styles.showAllVersions}
                              onClick={() => void openSelectedVersions()}
                            >
                              查看全部 {versions.length} 个版本
                            </Button>
                          ) : null}
                        </div>
                        {selectedAsset.data.design_sheet_error ? (
                          <div className={styles.inlineError}>
                            {selectedAsset.data.design_sheet_error}
                          </div>
                        ) : null}
                        <div className={styles.subsection}>
                          <div className={styles.modelLabel}>
                            {CHARACTER_GENERATION_COPY.DESIGN_SHEET_MODEL_LABEL}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className={styles.secondaryButton}
                            disabled={
                              generatingCharacterDesignSheetId === selectedAsset.data.id ||
                              selectedAsset.data.design_sheet_status === GENERATION_STATUS.GENERATING
                            }
                            onClick={() => void handleGenerateCharacterDesignSheet()}
                          >
                            {generatingCharacterDesignSheetId === selectedAsset.data.id ||
                            selectedAsset.data.design_sheet_status === GENERATION_STATUS.GENERATING ? (
                              <>
                                <Loader2 className={styles.buttonLoadingIcon} />
                                正在生成主设定图
                              </>
                            ) : (
                              <>
                                <Sparkles className={styles.buttonIcon} />
                                生成主设定图
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label className={styles.detailLabel}>角色名称</Label>
                        <Input
                          value={selectedAsset.data.name}
                          onChange={(e) =>
                            setSelectedAsset({
                              type: ENTITY_TYPE.CHARACTER,
                              data: { ...selectedAsset.data, name: e.target.value },
                            })
                          }
                          className={styles.detailInput}
                        />
                      </div>
                      <div>
                        <Label className={styles.detailLabel}>角色描述</Label>
                        <Textarea
                          value={selectedAsset.data.description || ""}
                          onChange={(e) =>
                            setSelectedAsset({
                              type: ENTITY_TYPE.CHARACTER,
                              data: { ...selectedAsset.data, description: e.target.value },
                            })
                          }
                          className={styles.detailTextarea}
                        />
                      </div>
                      <div className={styles.detailCard}>
                        <div className={styles.voiceHeader}>
                          <div>
                            <div className={styles.detailCardTitle}>主语音参考</div>
                            <div className={styles.detailCardDescription}>
                              {CHARACTER_GENERATION_COPY.VOICE_REFERENCE_DURATION_HINT}
                            </div>
                          </div>
                          <Badge className={styles.voiceStatusBadge}>角色语音</Badge>
                        </div>
                        {characterVoiceReferenceError?.id === selectedAsset.data.id ? (
                          <div className={styles.voiceError}>
                            {characterVoiceReferenceError.message}
                          </div>
                        ) : null}
                        {selectedAsset.data.voice_reference_error ? (
                          <div className={styles.inlineError}>
                            {selectedAsset.data.voice_reference_error}
                          </div>
                        ) : null}
                        {getCharacterVoiceReferenceSrc(selectedAsset.data) ? (
                          <audio
                            key={selectedAsset.data.voice_reference_url}
                            controls
                            className={styles.fullWidth}
                          >
                            <source src={getCharacterVoiceReferenceSrc(selectedAsset.data)} />
                          </audio>
                        ) : (
                          <div className={styles.audioEmpty}>
                            还没有主语音参考。生成后会自动绑定到这个角色。
                          </div>
                        )}
                        <div>
                          <Label className={styles.detailLabel}>声音提示词</Label>
                          <Textarea
                            value={selectedAsset.data.voice_prompt || ""}
                            onChange={(e) =>
                              setSelectedAsset({
                                type: ENTITY_TYPE.CHARACTER,
                                data: { ...selectedAsset.data, voice_prompt: e.target.value },
                              })
                            }
                            className={styles.voiceTextarea}
                            placeholder="例如：年轻男性，低沉克制，略带疲惫感，真实自然，不要播音腔。"
                          />
                          <div className={styles.fieldHint}>
                            系统会在生成时追加 3-5 秒短句约束。
                          </div>
                        </div>
                        <div>
                          <Label className={styles.detailLabel}>参考文本</Label>
                          <div className={styles.referenceText}>
                            {CHARACTER_GENERATION_COPY.VOICE_REFERENCE_TEXT}
                          </div>
                          <div className={styles.fieldHint}>
                            {CHARACTER_GENERATION_COPY.VOICE_REFERENCE_TEXT_HINT}
                          </div>
                        </div>
                        {selectedAsset.data.voice_name ||
                        selectedAsset.data.voice_reference_duration ? (
                          <div className={styles.voiceMetadata}>
                            <div className={styles.voiceMetadataCard}>
                              <div className={styles.voiceMetadataLabel}>音色名称</div>
                              <div className={styles.voiceMetadataValueBreak}>
                                {selectedAsset.data.voice_name || "未生成"}
                              </div>
                            </div>
                            <div className={styles.voiceMetadataCard}>
                              <div className={styles.voiceMetadataLabel}>音频时长</div>
                              <div className={styles.voiceMetadataValue}>
                                {selectedAsset.data.voice_reference_duration
                                  ? `${selectedAsset.data.voice_reference_duration.toFixed(1)}s`
                                  : "未生成"}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          className={styles.secondaryButton}
                          disabled={
                            generatingCharacterVoiceReferenceId === selectedAsset.data.id ||
                            selectedAsset.data.voice_reference_status === GENERATION_STATUS.GENERATING
                          }
                          onClick={() => void handleGenerateCharacterVoiceReference()}
                        >
                          {generatingCharacterVoiceReferenceId === selectedAsset.data.id ||
                          selectedAsset.data.voice_reference_status === GENERATION_STATUS.GENERATING ? (
                            <>
                              <Loader2 className={styles.buttonLoadingIcon} />
                              生成中
                            </>
                          ) : (
                            <>
                              <Sparkles className={styles.buttonIcon} />
                              生成主语音参考
                            </>
                          )}
                        </Button>
                        <input
                          ref={selectedCharacterVoiceReferenceInputRef}
                          type="file"
                          accept="audio/wav,audio/mpeg,.wav,.mp3"
                          className={styles.hiddenInput}
                          onChange={(event) =>
                            void handleUploadSelectedCharacterVoiceReference(
                              event.target.files?.[0] || null,
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className={styles.secondaryButton}
                          disabled={uploadingCharacterVoiceReferenceId === selectedAsset.data.id}
                          onClick={() => selectedCharacterVoiceReferenceInputRef.current?.click()}
                        >
                          {uploadingCharacterVoiceReferenceId === selectedAsset.data.id ? (
                            <>
                              <Loader2 className={styles.buttonLoadingIcon} />
                              上传中
                            </>
                          ) : (
                            <>
                              <Upload className={styles.buttonIcon} />
                              上传/替换主语音参考
                            </>
                          )}
                        </Button>
                      </div>
                      <div className={styles.detailFooter}>
                        <Button
                          className={styles.saveButton}
                          disabled={isSavingCharacter}
                          onClick={saveSelectedCharacter}
                        >
                          {isSavingCharacter ? (
                            <>
                              <Loader2 className={styles.buttonLoadingIcon} />
                              保存中
                            </>
                          ) : (
                            <>
                              <Save className={styles.buttonIcon} />
                              保存修改
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className={styles.deleteButton}
                          onClick={() =>
                            setDeleteTarget({
                              type: ENTITY_TYPE.CHARACTER,
                              id: selectedAsset.data.id,
                              name: selectedAsset.data.name,
                            })
                          }
                        >
                          {" "}
                          <Trash2 className={styles.buttonIcon} /> 删除角色
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.detailSections}>
                      <div className={styles.assetMediaGrid}>
                        {[
                          { label: "原始素材", src: getAssetOriginalSrc(selectedAsset.data) },
                          { label: "AI 封面", src: selectedAsset.data.cover_url || "" },
                        ].map((media) => (
                          <div key={media.label} className={styles.mediaItem}>
                            <div className={styles.detailLabel}>{media.label}</div>
                            <button
                              type="button"
                              disabled={!media.src}
                              className={styles.mediaPreview}
                              onClick={() =>
                                media.src && setPreviewImage({ src: media.src, alt: media.label })
                              }
                            >
                              {media.src ? (
                                <ContainedAssetImage
                                  src={media.src}
                                  alt={media.label}
                                  className={styles.fullSize}
                                />
                              ) : (
                                <MapPin className={styles.mediaPlaceholderIcon} />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                      <input
                        ref={selectedAssetFileInputRef}
                        type="file"
                        accept="image/*"
                        className={styles.hiddenInput}
                        onChange={(event) =>
                          void handleUploadSelectedAssetFile(event.target.files?.[0] || null)
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className={styles.secondaryButton}
                        onClick={() => selectedAssetFileInputRef.current?.click()}
                      >
                        <Upload className={styles.buttonIcon} />
                        替换原始素材
                      </Button>
                      {selectedAsset.data.cover_error ? (
                        <div className={styles.inlineError}>{selectedAsset.data.cover_error}</div>
                      ) : null}
                      {selectedAsset.data.type === ASSET_KIND.SCENE ||
                      selectedAsset.data.type === ASSET_KIND.PROP ? (
                        <Button
                          type="button"
                          variant="outline"
                          className={styles.secondaryButton}
                          disabled={
                            generatingAssetCoverId === selectedAsset.data.id ||
                            selectedAsset.data.cover_status === GENERATION_STATUS.GENERATING
                          }
                          onClick={() => void handleGenerateAssetCover()}
                        >
                          {generatingAssetCoverId === selectedAsset.data.id ||
                          selectedAsset.data.cover_status === GENERATION_STATUS.GENERATING ? (
                            <>
                              <Loader2 className={styles.buttonLoadingIcon} />
                              正在生成
                            </>
                          ) : (
                            <>
                              <Sparkles className={styles.buttonIcon} />
                              生成封面
                            </>
                          )}
                        </Button>
                      ) : (
                        <div className={styles.unsupportedNotice}>当前类型不支持 AI 生成封面。</div>
                      )}
                      <div>
                        <Label className={styles.detailLabel}>
                          {getAssetKindLabel(selectedAsset.data)}名称
                        </Label>
                        <Input
                          value={selectedAsset.data.name}
                          onChange={(e) =>
                            setSelectedAsset({
                              type: ENTITY_TYPE.ASSET,
                              data: { ...selectedAsset.data, name: e.target.value },
                            })
                          }
                          className={styles.detailInput}
                        />
                      </div>
                      <div>
                        <Label className={styles.detailLabel}>资源类型</Label>
                        <Select
                          value={
                            selectedAsset.data.type === ASSET_KIND.PROP
                              ? ASSET_KIND.PROP
                              : ASSET_KIND.SCENE
                          }
                          onValueChange={(value) =>
                            setSelectedAsset({
                              type: ENTITY_TYPE.ASSET,
                              data: { ...selectedAsset.data, type: value },
                            })
                          }
                        >
                          <SelectTrigger className={styles.detailInput}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ASSET_KIND.SCENE}>场景</SelectItem>
                            <SelectItem value={ASSET_KIND.PROP}>道具</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className={styles.detailLabel}>
                          {getAssetKindLabel(selectedAsset.data)}描述
                        </Label>
                        <Textarea
                          value={selectedAsset.data.meta || ""}
                          onChange={(e) =>
                            setSelectedAsset({
                              type: ENTITY_TYPE.ASSET,
                              data: { ...selectedAsset.data, meta: e.target.value },
                            })
                          }
                          className={styles.detailTextarea}
                        />
                      </div>
                      <div>
                        <Label className={styles.detailLabel}>资源地址</Label>
                        <Textarea
                          value={selectedAsset.data.file_url || ""}
                          className={styles.urlTextarea}
                          readOnly
                        />
                      </div>
                      <div className={styles.detailFooter}>
                        <Button
                          className={styles.saveButton}
                          disabled={isSavingAsset}
                          onClick={saveSelectedAsset}
                        >
                          {isSavingAsset ? (
                            <>
                              <Loader2 className={styles.buttonLoadingIcon} />
                              保存中
                            </>
                          ) : (
                            <>
                              <Save className={styles.buttonIcon} />
                              保存修改
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className={styles.deleteButton}
                          onClick={() =>
                            setDeleteTarget({
                              type: ENTITY_TYPE.ASSET,
                              id: selectedAsset.data.id,
                              name: selectedAsset.data.name,
                            })
                          }
                        >
                          <Trash2 className={styles.buttonIcon} />
                          删除资产
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            </aside>
          </>
        ) : null}
      </div>

      <AIGenerationPreviewDialog
        state={aiPreviewDialog}
        loading={isLoadingAIPreview}
        onClose={() => setAiPreviewDialog(null)}
        onPromptChange={(promptDraft) =>
          setAiPreviewDialog((current) => (current ? { ...current, promptDraft } : current))
        }
        onPreviewReference={(src, alt) => setPreviewImage({ src, alt })}
        onConfirm={() => void confirmAIPreviewGeneration()}
      />

      <AssetVersionsDialog
        open={showVersions}
        versions={versions}
        isCharacter={selectedAsset?.type === ENTITY_TYPE.CHARACTER}
        switchingVersionId={switchingVersionId}
        onOpenChange={setShowVersions}
        onPreview={(src, alt) => setPreviewImage({ src, alt })}
        onSetCurrent={(version) => void chooseSelectedVersion(version)}
      />

      <VoiceVersionsDialog
        open={showVoiceVersions}
        versions={voiceVersions}
        onOpenChange={setShowVoiceVersions}
        onSetCurrent={(version) => void chooseVoiceVersion(version)}
      />

      <CreateAssetDialog
        open={showCreateDialog}
        mode={createMode}
        character={newCharacter}
        asset={newAsset}
        hasCharacterFile={Boolean(createCharacterFile)}
        hasAssetFile={Boolean(createAssetFile)}
        creating={isCreating}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) resetCreateState();
        }}
        onModeChange={selectCreateMode}
        onCharacterChange={setNewCharacter}
        onAssetChange={setNewAsset}
        onCharacterFileChange={setCreateCharacterFile}
        onAssetFileChange={setCreateAssetFile}
        onCreate={handleCreate}
      />

      <DeleteAssetDialog
        target={deleteTarget}
        deleting={deleteActionKey === `${deleteTarget?.type}:${deleteTarget?.id}`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <ImagePreviewDialog
        open={!!previewImage}
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null);
        }}
        src={previewImage?.src || ""}
        alt={previewImage?.alt || "资产预览图"}
      />
    </div>
  );
}
