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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
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
  type AIGenerationPreview,
  type AssetVersion,
  type CharacterVoiceVersion,
  type Project,
} from "../api";
import styles from "./AssetLibrary.module.scss";

type SelectedAsset = { type: "character"; data: Character } | { type: "asset"; data: Asset } | null;

type AssetKind = "scene" | "prop";
type AssetLibraryTab = "characters" | "scenes" | "props";
type CreateMode = "character" | AssetKind;

type DeleteTarget =
  | { type: "character"; id: number; name: string }
  | { type: "asset"; id: number; name: string; assetKind: AssetKind }
  | null;

type AIPreviewAction = "character-design-sheet" | "character-voice-reference" | "asset-cover";

type AIPreviewDialogState = {
  action: AIPreviewAction;
  title: string;
  description: string;
  confirmLabel: string;
  preview: AIGenerationPreview;
  promptDraft: string;
};

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

const CHARACTER_DESIGN_SHEET_MODEL_LABEL = "Seedream 4.5 图生图";
const FIXED_CHARACTER_VOICE_REFERENCE_TEXT = "今天风很轻，我们慢慢把事情说清楚。";
const CHARACTER_VOICE_REFERENCE_DURATION_HINT =
  "目标 3-5 秒；超过 5 秒会自动裁剪，低于 3 秒会生成失败且不覆盖已有语音。";
const CHARACTER_VOICE_REFERENCE_TEXT_HINT =
  "主语音参考统一使用系统固定短句，避免参考音频过长影响 Seedance。";

const getAssetPreviewSrc = (asset: Asset | null | undefined) =>
  asset?.thumbnail_url || asset?.cover_url || asset?.file_url || "";

const getAssetOriginalSrc = (asset: Asset | null | undefined) => asset?.file_url || "";

type ContainedAssetImageProps = {
  src: string;
  alt: string;
  className?: string;
};

function ContainedAssetImage({ src, alt, className = "" }: ContainedAssetImageProps) {
  return (
    <div className={`${styles.containedImage} ${className}`}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className={styles.containedImageBackdrop}
      />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={styles.containedImageSource}
      />
    </div>
  );
}

type VersionImageCardProps = {
  version: AssetVersion;
  src: string;
  alt: string;
  label: string;
  aspectClassName: string;
  switching: boolean;
  onPreview: () => void;
  onSetCurrent: () => void;
};

function VersionImageCard({
  version,
  src,
  alt,
  label,
  aspectClassName,
  switching,
  onPreview,
  onSetCurrent,
}: VersionImageCardProps) {
  return (
    <div className={version.is_current ? styles.versionCardCurrent : styles.versionCard}>
      <button
        type="button"
        className={styles.versionPreviewButton}
        onClick={onPreview}
        aria-label={`预览${label}`}
      >
        <ContainedAssetImage
          src={src}
          alt={alt}
          className={`${aspectClassName} ${styles.fullWidth}`}
        />
      </button>
      <div className={styles.versionLabel}>{version.is_current ? "当前版本" : label}</div>
      {!version.is_current ? (
        <Button
          type="button"
          size="sm"
          disabled={switching}
          aria-label="设为当前版本"
          title="设为当前版本"
          className={styles.setCurrentButton}
          onClick={onSetCurrent}
        >
          {switching ? (
            <>
              <Loader2 className={styles.switchingIcon} />
              切换中
            </>
          ) : (
            "设为当前"
          )}
        </Button>
      ) : null}
    </div>
  );
}

const isPropAsset = (asset: Asset) => {
  const type = String(asset.type || "").toLowerCase();
  return type.includes("prop") || type.includes("道具");
};

const getAssetKind = (asset: Asset): AssetKind => (isPropAsset(asset) ? "prop" : "scene");
const getAssetTab = (asset: Asset): AssetLibraryTab => (isPropAsset(asset) ? "props" : "scenes");
const getAssetKindLabel = (asset: Asset) => (isPropAsset(asset) ? "道具" : "场景");

const deriveAssetPrimaryTag = (asset: Asset) => getAssetKindLabel(asset);
const deriveAssetSecondaryTag = (asset: Asset) => asset.type?.trim() || "资源";
const deriveAssetDescription = (asset: Asset) => asset.meta?.trim() || `${asset.name} 资源文件`;

type AssetCollectionProps = {
  assets: Asset[];
  emptyLabel: string;
  loading: boolean;
  viewMode: "grid" | "list";
  selectedAsset: SelectedAsset;
  onSelect: (asset: Asset) => void;
};

function AssetCollection({
  assets,
  emptyLabel,
  loading,
  viewMode,
  selectedAsset,
  onSelect,
}: AssetCollectionProps) {
  if (loading) {
    return (
      <div className={styles.collectionLoading}>
        <Loader2 className={styles.collectionLoadingIcon} />
      </div>
    );
  }
  if (!assets.length) {
    return <div className={styles.collectionEmpty}>{emptyLabel}</div>;
  }

  if (viewMode === "grid") {
    return (
      <div className={styles.assetGrid}>
        {assets.map((asset) => {
          const AssetIcon = isPropAsset(asset) ? Package : MapPin;
          return (
            <button
              key={asset.id}
              onClick={() => onSelect(asset)}
              className={
                selectedAsset?.type === "asset" && selectedAsset.data.id === asset.id
                  ? styles.assetGridCardSelected
                  : styles.assetGridCard
              }
            >
              <div className={styles.assetGridPreview}>
                {getAssetPreviewSrc(asset) ? (
                  <ContainedAssetImage
                    src={getAssetPreviewSrc(asset)}
                    alt={asset.name}
                    className={styles.fullSize}
                  />
                ) : (
                  <AssetIcon className={styles.assetGridPlaceholderIcon} />
                )}
                <div className={styles.primaryBadgePosition}>
                  <Badge className={styles.primaryBadge}>{deriveAssetPrimaryTag(asset)}</Badge>
                </div>
                <div className={styles.secondaryBadgePosition}>
                  <Badge className={styles.secondaryBadge}>{deriveAssetSecondaryTag(asset)}</Badge>
                </div>
              </div>
              <div className={styles.assetGridContent}>
                <h4 className={styles.assetName}>{asset.name}</h4>
                <p className={styles.assetGridDescription}>{deriveAssetDescription(asset)}</p>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.assetList}>
      {assets.map((asset) => {
        const AssetIcon = isPropAsset(asset) ? Package : MapPin;
        return (
          <button
            key={asset.id}
            onClick={() => onSelect(asset)}
            className={
              selectedAsset?.type === "asset" && selectedAsset.data.id === asset.id
                ? styles.assetListCardSelected
                : styles.assetListCard
            }
          >
            <div className={styles.assetListPreview}>
              {getAssetPreviewSrc(asset) ? (
                <ContainedAssetImage
                  src={getAssetPreviewSrc(asset)}
                  alt={asset.name}
                  className={styles.assetListImage}
                />
              ) : (
                <AssetIcon className={styles.assetListPlaceholderIcon} />
              )}
            </div>
            <div className={styles.assetListContent}>
              <div className={styles.assetListHeader}>
                <h4 className={styles.assetName}>{asset.name}</h4>
                <Badge className={styles.primaryBadge}>{deriveAssetPrimaryTag(asset)}</Badge>
              </div>
              <p className={styles.assetListDescription}>{deriveAssetDescription(asset)}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const PROMPT_SECTION_BREAKS = [
  "主体与画面核心：",
  "动作与叙事重点：",
  "镜头设计：",
  "风格气质：",
  "特效与氛围：",
  "一致性要求：",
  "音频要求：",
  "画质与完成度：",
  "输出要求：",
  "负向约束：",
  "节奏分段：",
  "首段：",
  "中段：",
  "尾段：",
  "开场：",
  "中段：",
  "高潮：",
  "收束：",
] as const;

const formatPromptForDisplay = (prompt: string | null | undefined) => {
  const raw = String(prompt || "").trim();
  if (!raw) return "-";
  return PROMPT_SECTION_BREAKS.reduce((formatted, marker) => {
    const next = formatted.replaceAll(marker, `\n${marker}`);
    return next.startsWith("\n") ? next.slice(1) : next;
  }, raw);
};

export default function AssetLibrary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentProjectId = Number(searchParams.get("project") || "0");
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState<AssetLibraryTab>("characters");
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>("character");
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
  const [newAsset, setNewAsset] = useState({ name: "", type: "scene", meta: "", file_url: "" });
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
            setActiveTab("characters");
            setSelectedAsset({ type: "character", data: requestedCharacter });
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
    setNewAsset({ name: "", type: "scene", meta: "", file_url: "" });
    setCreateCharacterFile(null);
    setCreateAssetFile(null);
  };

  const handleCreate = async () => {
    if (!currentProjectId) return;
    setIsCreating(true);
    try {
      if (createMode === "character") {
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
        setActiveTab("characters");
        setSelectedAsset({ type: "character", data: created });
      } else {
        if (!newAsset.name.trim() || !newAsset.type.trim()) {
          toast.error(`请填写完整的${createMode === "prop" ? "道具" : "场景"}资产信息`);
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
        setSelectedAsset({ type: "asset", data: created });
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
    if (!selectedAsset || selectedAsset.type !== "character") return;
    setIsSavingCharacter(true);
    try {
      const updated = await characterApi.updateCharacter(selectedAsset.data.id, {
        name: selectedAsset.data.name,
        description: selectedAsset.data.description || "",
        avatar_url: selectedAsset.data.avatar_url || "",
        voice_prompt: selectedAsset.data.voice_prompt || "",
      });
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: "character", data: updated });
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
    if (!selectedAsset || selectedAsset.type !== "asset") return;
    setIsSavingAsset(true);
    try {
      const updated = await assetApi.updateAsset(selectedAsset.data.id, {
        name: selectedAsset.data.name,
        type: selectedAsset.data.type,
        meta: selectedAsset.data.meta || "",
        file_url: selectedAsset.data.file_url || "",
      });
      setAssets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: "asset", data: updated });
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
    if (!selectedAsset || selectedAsset.type !== "character") return;
    setGeneratingCharacterDesignSheetId(selectedAsset.data.id);
    try {
      const updated = await characterApi.generateCharacterDesignSheet(
        selectedAsset.data.id,
        promptOverride,
      );
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: "character", data: updated });
      setVersions(await assetWorkspaceApi.getVersions("character", updated.id));
      toast.success("主设定图已生成并保存为新版本");
    } catch (error) {
      console.error("Failed to generate character design sheet:", error);
      toast.error(error instanceof Error ? error.message : "生成主设定图失败");
    } finally {
      setGeneratingCharacterDesignSheetId(null);
    }
  };

  const runGenerateSelectedCharacterVoiceReference = async () => {
    if (!selectedAsset || selectedAsset.type !== "character") return;
    setGeneratingCharacterVoiceReferenceId(selectedAsset.data.id);
    setCharacterVoiceReferenceError(null);
    try {
      const updated = await characterApi.generateCharacterVoiceReference(selectedAsset.data.id, {
        voice_prompt: selectedAsset.data.voice_prompt || "",
      });
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: "character", data: updated });
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
    if (!selectedAsset || selectedAsset.type !== "asset") return;
    setGeneratingAssetCoverId(selectedAsset.data.id);
    try {
      const updated = await assetApi.generateAssetCover(selectedAsset.data.id);
      setAssets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: "asset", data: updated });
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
    if (!selectedAsset || selectedAsset.type !== "character") return;
    setIsLoadingAIPreview(true);
    try {
      const saved = await saveSelectedCharacter();
      const preview = await characterApi.getCharacterDesignSheetGenerationPreview(saved!.id);
      openAIPreviewDialog({
        action: "character-design-sheet",
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
    if (!file || !selectedAsset || selectedAsset.type !== "character") return;
    setUploadingCharacterReferenceId(selectedAsset.data.id);
    try {
      const avatarURL = await ossApi.uploadFileToOss(file);
      const updated = await characterApi.updateCharacter(selectedAsset.data.id, {
        avatar_url: avatarURL,
      });
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: "character", data: updated });
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
    if (!file || !selectedAsset || selectedAsset.type !== "character") return;
    setUploadingCharacterVoiceReferenceId(selectedAsset.data.id);
    try {
      const voiceReferenceURL = await ossApi.uploadFileToOss(file);
      const updated = await characterApi.uploadCharacterVoiceReference(
        selectedAsset.data.id,
        voiceReferenceURL,
      );
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: "character", data: updated });
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
    if (!file || !selectedAsset || selectedAsset.type !== "asset") return;
    setIsSavingAsset(true);
    try {
      const fileURL = await ossApi.uploadFileToOss(file);
      const updated = await assetApi.updateAsset(selectedAsset.data.id, { file_url: fileURL });
      setAssets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: "asset", data: updated });
      toast.success("原始素材已替换");
    } finally {
      setIsSavingAsset(false);
      if (selectedAssetFileInputRef.current) selectedAssetFileInputRef.current.value = "";
    }
  };

  const handleGenerateCharacterVoiceReference = async () => {
    if (!selectedAsset || selectedAsset.type !== "character") return;
    setIsLoadingAIPreview(true);
    try {
      const saved = await saveSelectedCharacter();
      const preview = await characterApi.getCharacterVoiceReferenceGenerationPreview(saved!.id, {
        voice_prompt: saved!.voice_prompt || "",
      });
      openAIPreviewDialog({
        action: "character-voice-reference",
        title: "确认生成主语音参考",
        description: `会用大模型生成当前角色的主语音参考，并绑定到角色资产上。${CHARACTER_VOICE_REFERENCE_DURATION_HINT}`,
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
    if (!selectedAsset || selectedAsset.type !== "asset") return;
    setIsLoadingAIPreview(true);
    try {
      const saved = await saveSelectedAsset();
      const preview = await assetApi.getAssetCoverGenerationPreview(saved!.id);
      openAIPreviewDialog({
        action: "asset-cover",
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
    if (action === "character-design-sheet" && !promptOverride) {
      toast.error("最终 Prompt 不能为空");
      return;
    }
    setAiPreviewDialog(null);
    switch (action) {
      case "character-design-sheet":
        await runGenerateSelectedCharacterDesignSheet(promptOverride);
        return;
      case "character-voice-reference":
        await runGenerateSelectedCharacterVoiceReference();
        return;
      case "asset-cover":
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
      if (deleteTarget.type === "character") {
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
      if (type === "character") await loadCharacters();
      else await loadAssets();
      const refreshed =
        type === "character" ? await characterApi.getCharacter(id) : await assetApi.getAsset(id);
      if (refreshed) setSelectedAsset({ type, data: refreshed } as SelectedAsset);
      toast.success(type === "character" ? "已切换主设定图版本" : "已切换资产版本");
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
      if (selectedAsset.type === "character") {
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
    if (!selectedAsset || selectedAsset.type !== "character") return;
    setShowVoiceVersions(true);
    setVoiceVersions([]);
    try {
      setVoiceVersions(await assetWorkspaceApi.getCharacterVoiceVersions(selectedAsset.data.id));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "语音版本加载失败");
    }
  };

  const chooseVoiceVersion = async (version: CharacterVoiceVersion) => {
    if (!selectedAsset || selectedAsset.type !== "character") return;
    const id = selectedAsset.data.id;
    setVoiceVersions(await assetWorkspaceApi.setCurrentCharacterVoiceVersion(id, version.id));
    const refreshed = await characterApi.getCharacter(id);
    setCharacters((prev) => prev.map((item) => (item.id === id ? refreshed : item)));
    setSelectedAsset({ type: "character", data: refreshed });
  };

  const openCreateDialog = () => {
    const nextMode: CreateMode =
      activeTab === "props" ? "prop" : activeTab === "scenes" ? "scene" : "character";
    setCreateMode(nextMode);
    if (nextMode !== "character") {
      setNewAsset((prev) => ({ ...prev, type: nextMode }));
    }
    setShowCreateDialog(true);
  };

  const selectCreateMode = (mode: CreateMode) => {
    setCreateMode(mode);
    if (mode !== "character") {
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
                  <TabsTrigger value="characters" className={styles.tabTrigger}>
                    <Users className={styles.tabIcon} />
                    角色资产
                    <Badge className={styles.tabBadge}>{characters.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="scenes" className={styles.tabTrigger}>
                    <MapPin className={styles.tabIcon} />
                    场景资产
                    <Badge className={styles.tabBadge}>{sceneAssetCount}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="props" className={styles.tabTrigger}>
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
                        viewMode === "grid"
                          ? styles.viewToggleButtonActive
                          : styles.viewToggleButton
                      }
                      onClick={() => setViewMode("grid")}
                    >
                      <Grid3x3 className={styles.icon} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={
                        viewMode === "list"
                          ? styles.viewToggleButtonActive
                          : styles.viewToggleButton
                      }
                      onClick={() => setViewMode("list")}
                    >
                      <List className={styles.icon} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <TabsContent value="characters" className={styles.tabContent}>
              <div className={styles.collectionScroll}>
                {loading ? (
                  <div className={styles.collectionLoading}>
                    <Loader2 className={styles.collectionLoadingIcon} />
                  </div>
                ) : filteredCharacters.length === 0 ? (
                  <div className={styles.collectionEmpty}>暂无角色资产</div>
                ) : viewMode === "grid" ? (
                  <div className={styles.characterGrid}>
                    {filteredCharacters.map((character) => (
                      <button
                        key={character.id}
                        onClick={() => setSelectedAsset({ type: "character", data: character })}
                        className={
                          selectedAsset?.type === "character" &&
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
                        onClick={() => setSelectedAsset({ type: "character", data: character })}
                        className={
                          selectedAsset?.type === "character" &&
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
              { value: "scenes", items: filteredSceneAssets, emptyLabel: "暂无场景资产" },
              { value: "props", items: filteredPropAssets, emptyLabel: "暂无道具资产" },
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
                    selectedAsset={selectedAsset}
                    onSelect={(asset) => setSelectedAsset({ type: "asset", data: asset })}
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
                    {selectedAsset.type === "character"
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
                          {selectedAsset.type === "character" ? (
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
                                ...(selectedAsset.type === "asset"
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
                  {selectedAsset.type === "character" ? (
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
                                type: "character",
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
                            {CHARACTER_DESIGN_SHEET_MODEL_LABEL}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className={styles.secondaryButton}
                            disabled={
                              generatingCharacterDesignSheetId === selectedAsset.data.id ||
                              selectedAsset.data.design_sheet_status === "generating"
                            }
                            onClick={() => void handleGenerateCharacterDesignSheet()}
                          >
                            {generatingCharacterDesignSheetId === selectedAsset.data.id ||
                            selectedAsset.data.design_sheet_status === "generating" ? (
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
                              type: "character",
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
                              type: "character",
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
                              {CHARACTER_VOICE_REFERENCE_DURATION_HINT}
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
                                type: "character",
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
                            {FIXED_CHARACTER_VOICE_REFERENCE_TEXT}
                          </div>
                          <div className={styles.fieldHint}>
                            {CHARACTER_VOICE_REFERENCE_TEXT_HINT}
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
                            selectedAsset.data.voice_reference_status === "generating"
                          }
                          onClick={() => void handleGenerateCharacterVoiceReference()}
                        >
                          {generatingCharacterVoiceReferenceId === selectedAsset.data.id ||
                          selectedAsset.data.voice_reference_status === "generating" ? (
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
                              type: "character",
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
                      {selectedAsset.data.type === "scene" || selectedAsset.data.type === "prop" ? (
                        <Button
                          type="button"
                          variant="outline"
                          className={styles.secondaryButton}
                          disabled={
                            generatingAssetCoverId === selectedAsset.data.id ||
                            selectedAsset.data.cover_status === "generating"
                          }
                          onClick={() => void handleGenerateAssetCover()}
                        >
                          {generatingAssetCoverId === selectedAsset.data.id ||
                          selectedAsset.data.cover_status === "generating" ? (
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
                              type: "asset",
                              data: { ...selectedAsset.data, name: e.target.value },
                            })
                          }
                          className={styles.detailInput}
                        />
                      </div>
                      <div>
                        <Label className={styles.detailLabel}>资源类型</Label>
                        <Select
                          value={selectedAsset.data.type === "prop" ? "prop" : "scene"}
                          onValueChange={(value) =>
                            setSelectedAsset({
                              type: "asset",
                              data: { ...selectedAsset.data, type: value },
                            })
                          }
                        >
                          <SelectTrigger className={styles.detailInput}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scene">场景</SelectItem>
                            <SelectItem value="prop">道具</SelectItem>
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
                              type: "asset",
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
                              type: "asset",
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

      <Dialog
        open={!!aiPreviewDialog}
        onOpenChange={(open) => {
          if (!open) setAiPreviewDialog(null);
        }}
      >
        <DialogContent className={styles.aiPreviewDialog}>
          <DialogHeader>
            <DialogTitle>{aiPreviewDialog?.title || "确认 AI 生成"}</DialogTitle>
            <DialogDescription className={styles.aiPreviewDescription}>
              {aiPreviewDialog?.description || ""}
            </DialogDescription>
          </DialogHeader>
          <div className={styles.aiPreviewBody}>
            <div className={styles.previewSection}>
              <div className={styles.previewRow}>
                <span className={styles.previewLabel}>实际模型</span>
                <span>{aiPreviewDialog?.preview.model || "-"}</span>
              </div>
              {aiPreviewDialog?.preview.notes?.length ? (
                <div>
                  <div className={styles.previewNotesTitle}>说明</div>
                  <ul className={styles.previewNotes}>
                    {aiPreviewDialog.preview.notes.map((note, index) => (
                      <li key={`${note}-${index}`}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className={styles.previewSection}>
              <div className={styles.previewSectionTitle}>详细参数</div>
              <div className={styles.previewFields}>
                {Object.entries(aiPreviewDialog?.preview.fields || {}).map(([key, value]) => (
                  <div key={key}>
                    <span className={styles.previewLabel}>{key}：</span>
                    <span>{value || "-"}</span>
                  </div>
                ))}
              </div>
            </div>
            {aiPreviewDialog?.preview.reference_images?.length ? (
              <div className={styles.previewReferenceSection}>
                <div className={styles.previewSectionTitle}>参考图输入</div>
                <div className={styles.previewReferenceGrid}>
                  {aiPreviewDialog.preview.reference_images.map((image) => (
                    <button
                      key={`${image.type}:${image.name}`}
                      type="button"
                      className={styles.previewReferenceCard}
                      onClick={() => setPreviewImage({ src: image.url, alt: image.name })}
                    >
                      <div className={styles.previewReferenceImageWrap}>
                        <img
                          src={image.url}
                          alt={image.name}
                          className={styles.previewReferenceImage}
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div className={styles.previewReferenceName}>{image.name}</div>
                      <div className={styles.previewReferenceSource}>{image.source}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className={styles.previewSection}>
              <div className={styles.previewPromptHeader}>
                <div className={styles.previewSectionTitle}>
                  最终 Prompt
                  {aiPreviewDialog?.action === "character-design-sheet" ? "（可编辑）" : ""}
                </div>
                {aiPreviewDialog?.action === "character-design-sheet" ? (
                  <div className={styles.promptCount}>
                    {aiPreviewDialog.promptDraft.length} / 10000
                  </div>
                ) : null}
              </div>
              {aiPreviewDialog?.action === "character-design-sheet" ? (
                <Textarea
                  value={aiPreviewDialog.promptDraft}
                  maxLength={10000}
                  onChange={(event) =>
                    setAiPreviewDialog((current) =>
                      current ? { ...current, promptDraft: event.target.value } : current,
                    )
                  }
                  className={styles.promptTextarea}
                  aria-label="可编辑的最终 Prompt"
                />
              ) : (
                <pre className={styles.promptPreview}>
                  {formatPromptForDisplay(aiPreviewDialog?.preview.final_prompt)}
                </pre>
              )}
            </div>
          </div>
          <DialogFooter className={styles.dialogFooter}>
            <Button type="button" variant="outline" onClick={() => setAiPreviewDialog(null)}>
              取消
            </Button>
            <Button
              type="button"
              className={styles.confirmButton}
              onClick={() => void confirmAIPreviewGeneration()}
              disabled={
                isLoadingAIPreview ||
                (aiPreviewDialog?.action === "character-design-sheet" &&
                  !aiPreviewDialog.promptDraft.trim())
              }
            >
              {aiPreviewDialog?.confirmLabel || "确认生成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showVersions} onOpenChange={setShowVersions}>
        <DialogContent className={styles.versionsDialog}>
          <DialogHeader>
            <DialogTitle>生成版本</DialogTitle>
            <DialogDescription>
              点击图片仅预览；移入非当前版本后，点击右上角按钮才会切换。
            </DialogDescription>
          </DialogHeader>
          {versions.length ? (
            <div className={styles.versionsGrid}>
              {versions.map((version, index) => {
                const src =
                  selectedAsset?.type === "character"
                    ? version.file_url
                    : version.preview_url || version.file_url;
                const label = `v${versions.length - index}`;
                return (
                  <VersionImageCard
                    key={version.id}
                    version={version}
                    src={src}
                    alt={`资产生成版本 ${versions.length - index}`}
                    label={label}
                    aspectClassName={styles.aspectVideo}
                    switching={switchingVersionId === version.id}
                    onPreview={() =>
                      setPreviewImage({
                        src,
                        alt: `资产生成版本 ${versions.length - index}`,
                      })
                    }
                    onSetCurrent={() => void chooseSelectedVersion(version)}
                  />
                );
              })}
            </div>
          ) : (
            <div className={styles.dialogEmpty}>尚无生成版本</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showVoiceVersions} onOpenChange={setShowVoiceVersions}>
        <DialogContent className={styles.voiceVersionsDialog}>
          <DialogHeader>
            <DialogTitle>主语音版本</DialogTitle>
            <DialogDescription>试听并恢复以前生成或上传的角色主语音。</DialogDescription>
          </DialogHeader>
          {voiceVersions.length ? (
            <div className={styles.voiceVersionsList}>
              {voiceVersions.map((version) => (
                <div
                  key={version.id}
                  className={version.is_current ? styles.voiceVersionCurrent : styles.voiceVersion}
                >
                  <audio controls className={styles.fullWidth}>
                    <source src={version.file_url} />
                  </audio>
                  <div className={styles.voiceVersionFooter}>
                    <span>
                      {version.source_type === "manual-upload" ? "手动上传" : "AI 生成"} ·{" "}
                      {version.duration.toFixed(1)}s
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={version.is_current}
                      onClick={() => void chooseVoiceVersion(version)}
                    >
                      {version.is_current ? "当前版本" : "设为当前"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.dialogEmpty}>尚无语音版本</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) resetCreateState();
        }}
      >
        <DialogContent
          className={styles.createDialog}
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>新建资产</DialogTitle>
            <DialogDescription className={styles.dialogDescription}>
              选择角色、场景或道具资产，创建后会进入对应分类。
            </DialogDescription>
          </DialogHeader>
          <div className={styles.createFields}>
            <div>
              <Label className={styles.detailLabel}>资产类型</Label>
              <div className={styles.createTypeGrid}>
                {[
                  { value: "character" as const, label: "角色资产" },
                  { value: "scene" as const, label: "场景资产" },
                  { value: "prop" as const, label: "道具资产" },
                ].map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={createMode === option.value ? "default" : "outline"}
                    className={
                      createMode === option.value
                        ? styles.createTypeActive
                        : styles.createTypeButton
                    }
                    onClick={() => selectCreateMode(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            {createMode === "character" ? (
              <>
                <div>
                  <Label className={styles.detailLabel}>名称</Label>
                  <Input
                    value={newCharacter.name}
                    onChange={(e) => setNewCharacter((prev) => ({ ...prev, name: e.target.value }))}
                    className={styles.detailInput}
                  />
                </div>
                <div>
                  <Label className={styles.detailLabel}>描述</Label>
                  <Textarea
                    value={newCharacter.description}
                    onChange={(e) =>
                      setNewCharacter((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className={styles.detailTextarea}
                  />
                </div>
                <div>
                  <Label className={styles.detailLabel}>角色参考图地址（可选）</Label>
                  <Input
                    value={newCharacter.avatar_url}
                    onChange={(e) =>
                      setNewCharacter((prev) => ({ ...prev, avatar_url: e.target.value }))
                    }
                    placeholder="https://..."
                    disabled={Boolean(createCharacterFile)}
                    className={styles.detailInput}
                  />
                </div>
                <div>
                  <Label className={styles.detailLabel}>上传角色参考图（可选）</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCreateCharacterFile(e.target.files?.[0] || null)}
                    className={styles.detailInput}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className={styles.detailLabel}>名称</Label>
                  <Input
                    value={newAsset.name}
                    onChange={(e) => setNewAsset((prev) => ({ ...prev, name: e.target.value }))}
                    className={styles.detailInput}
                  />
                </div>
                <div>
                  <Label className={styles.detailLabel}>
                    {createMode === "prop" ? "道具说明" : "场景说明"}
                  </Label>
                  <Textarea
                    value={newAsset.meta}
                    onChange={(e) => setNewAsset((prev) => ({ ...prev, meta: e.target.value }))}
                    className={styles.detailTextarea}
                  />
                </div>
                <div>
                  <Label className={styles.detailLabel}>资源地址（可选）</Label>
                  <Input
                    value={newAsset.file_url}
                    onChange={(e) => setNewAsset((prev) => ({ ...prev, file_url: e.target.value }))}
                    placeholder="https://..."
                    disabled={Boolean(createAssetFile)}
                    className={styles.detailInput}
                  />
                </div>
                <div>
                  <Label className={styles.detailLabel}>上传图片（可选）</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCreateAssetFile(e.target.files?.[0] || null)}
                    className={styles.detailInput}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={styles.cancelButton}
              onClick={() => setShowCreateDialog(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className={styles.createConfirmButton}
              disabled={isCreating}
              onClick={handleCreate}
            >
              {isCreating ? (
                <>
                  <Loader2 className={styles.buttonLoadingIcon} />
                  创建中
                </>
              ) : (
                "确认创建"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className={styles.deleteDialog}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === "character"
                ? "确认删除角色"
                : `确认删除${deleteTarget?.assetKind === "prop" ? "道具" : "场景"}资产`}
            </AlertDialogTitle>
            <AlertDialogDescription className={styles.dialogDescription}>
              {deleteTarget?.type === "character"
                ? "该操作会从资产库隐藏该角色，不会删除服务器原始文件。"
                : "该操作会从资产库隐藏该资产，不会删除服务器原始文件。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={styles.cancelButton}>取消</AlertDialogCancel>
            <AlertDialogAction
              className={styles.deleteConfirmButton}
              disabled={deleteActionKey === `${deleteTarget?.type}:${deleteTarget?.id}`}
              onClick={confirmDelete}
            >
              {deleteActionKey === `${deleteTarget?.type}:${deleteTarget?.id}` ? (
                <Loader2 className={styles.iconLoading} />
              ) : (
                "确认删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
