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
import { ImagePreviewDialog } from "../components/ui/image-preview-dialog";
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
const FIXED_CHARACTER_VOICE_REFERENCE_TEXT =
  "今天风很轻，我们慢慢把事情说清楚。";
const CHARACTER_VOICE_REFERENCE_DURATION_HINT =
  "目标 3-5 秒；超过 5 秒会自动裁剪，低于 3 秒会生成失败且不覆盖已有语音。";
const CHARACTER_VOICE_REFERENCE_TEXT_HINT =
  "主语音参考统一使用系统固定短句，避免参考音频过长影响 Seedance。";

const getAssetPreviewSrc = (asset: Asset | null | undefined) =>
  asset?.thumbnail_url || asset?.cover_url || asset?.file_url || "";

const getAssetOriginalSrc = (asset: Asset | null | undefined) =>
  asset?.file_url || "";

type ContainedAssetImageProps = {
  src: string;
  alt: string;
  className?: string;
};

function ContainedAssetImage({ src, alt, className = "" }: ContainedAssetImageProps) {
  return (
    <div className={`relative overflow-hidden bg-[#101010] ${className}`}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-xl"
      />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="relative h-full w-full object-contain p-1"
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
    <div
      className={`group relative overflow-hidden rounded-lg bg-[#191919] ${
        version.is_current ? "ring-2 ring-purple-500" : ""
      }`}
    >
      <button
        type="button"
        className="block w-full"
        onClick={onPreview}
        aria-label={`预览${label}`}
      >
        <ContainedAssetImage src={src} alt={alt} className={`${aspectClassName} w-full`} />
      </button>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1.5 text-[11px] text-gray-200">
        {version.is_current ? "当前版本" : label}
      </div>
      {!version.is_current ? (
        <Button
          type="button"
          size="sm"
          disabled={switching}
          aria-label="设为当前版本"
          title="设为当前版本"
          className="absolute right-2 top-2 h-7 px-2.5 text-[11px] bg-purple-600 text-white opacity-0 shadow-lg transition-opacity hover:bg-purple-500 group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={onSetCurrent}
        >
          {switching ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
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
      <div className="h-full flex items-center justify-center text-gray-500">
        <Loader2 className="w-12 h-12 animate-spin opacity-30" />
      </div>
    );
  }
  if (!assets.length) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        {emptyLabel}
      </div>
    );
  }

  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-3 gap-4 pb-4">
        {assets.map((asset) => {
          const AssetIcon = isPropAsset(asset) ? Package : MapPin;
          return (
            <button
              key={asset.id}
              onClick={() => onSelect(asset)}
              className={`text-left bg-[#141414] border rounded-lg overflow-hidden transition-all ${selectedAsset?.type === "asset" && selectedAsset.data.id === asset.id ? "border-purple-500 shadow-lg shadow-purple-500/20" : "border-gray-800 hover:border-gray-700"}`}
            >
              <div className="aspect-video bg-gradient-to-br from-green-900/20 to-blue-900/20 relative flex items-center justify-center">
                {getAssetPreviewSrc(asset) ? (
                  <ContainedAssetImage
                    src={getAssetPreviewSrc(asset)}
                    alt={asset.name}
                    className="h-full w-full"
                  />
                ) : (
                  <AssetIcon className="w-16 h-16 text-gray-700" />
                )}
                <div className="absolute top-3 left-3">
                  <Badge className="bg-green-600 text-white text-xs">
                    {deriveAssetPrimaryTag(asset)}
                  </Badge>
                </div>
                <div className="absolute top-3 right-3">
                  <Badge className="bg-blue-600 text-white text-xs">
                    {deriveAssetSecondaryTag(asset)}
                  </Badge>
                </div>
              </div>
              <div className="p-3 space-y-2">
                <h4 className="font-medium">{asset.name}</h4>
                <p className="text-xs text-gray-400 line-clamp-2">
                  {deriveAssetDescription(asset)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-4">
      {assets.map((asset) => {
        const AssetIcon = isPropAsset(asset) ? Package : MapPin;
        return (
          <button
            key={asset.id}
            onClick={() => onSelect(asset)}
            className={`w-full text-left bg-[#141414] border rounded-lg p-4 transition-all flex items-center gap-4 ${selectedAsset?.type === "asset" && selectedAsset.data.id === asset.id ? "border-purple-500" : "border-gray-800 hover:border-gray-700"}`}
          >
            <div className="w-20 h-14 bg-gradient-to-br from-green-900/20 to-blue-900/20 rounded flex items-center justify-center flex-shrink-0">
              {getAssetPreviewSrc(asset) ? (
                <ContainedAssetImage
                  src={getAssetPreviewSrc(asset)}
                  alt={asset.name}
                  className="h-full w-full rounded"
                />
              ) : (
                <AssetIcon className="w-8 h-8 text-gray-700" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium">{asset.name}</h4>
                <Badge className="bg-green-600 text-white text-xs">
                  {deriveAssetPrimaryTag(asset)}
                </Badge>
              </div>
              <p className="text-sm text-gray-400 line-clamp-1">
                {deriveAssetDescription(asset)}
              </p>
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
          const requestedCharacter = characterData?.find((item) => item.id === requestedCharacterId);
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
      const preview = await characterApi.getCharacterVoiceReferenceGenerationPreview(
        saved!.id,
        {
          voice_prompt: saved!.voice_prompt || "",
        },
      );
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
      setVersions(
        await assetWorkspaceApi.getVersions(selectedAsset.type, selectedAsset.data.id),
      );
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
        type === "character"
          ? await characterApi.getCharacter(id)
          : await assetApi.getAsset(id);
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
      setVoiceVersions(
        await assetWorkspaceApi.getCharacterVoiceVersions(selectedAsset.data.id),
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "语音版本加载失败");
    }
  };

  const chooseVoiceVersion = async (version: CharacterVoiceVersion) => {
    if (!selectedAsset || selectedAsset.type !== "character") return;
    const id = selectedAsset.data.id;
    setVoiceVersions(
      await assetWorkspaceApi.setCurrentCharacterVoiceVersion(id, version.id),
    );
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
    <div className="storyboard-product-shell dark h-screen flex flex-col bg-[var(--storyboard-bg)] text-gray-100">
      <header className="border-b border-gray-800 bg-[#111111] flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                navigate(currentProjectId ? `/workspace?project=${currentProjectId}` : "/projects")
              }
              className="h-8 text-gray-400 hover:text-gray-200"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              返回工作台
            </Button>
            <div className="h-6 w-px bg-gray-700"></div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-600 rounded flex items-center justify-center">
                <Film className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm">{project?.name || "项目"} · 资产库</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="h-8 bg-purple-600 hover:bg-purple-700"
              onClick={openCreateDialog}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              新建资产
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden">
          {loadError ? (
            <div className="m-4 rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {loadError}
            </div>
          ) : null}
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as AssetLibraryTab);
              setSelectedAsset(null);
              setShowActionMenu(false);
            }}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="border-b border-gray-800 bg-[#0f0f0f] px-4">
              <div className="flex items-center justify-between">
                <TabsList className="bg-transparent border-0">
                  <TabsTrigger
                    value="characters"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-purple-500 rounded-none px-4"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    角色资产
                    <Badge className="ml-2 bg-gray-800 text-gray-400 text-xs">
                      {characters.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="scenes"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-purple-500 rounded-none px-4"
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    场景资产
                    <Badge className="ml-2 bg-gray-800 text-gray-400 text-xs">
                      {sceneAssetCount}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="props"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-purple-500 rounded-none px-4"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    道具资产
                    <Badge className="ml-2 bg-gray-800 text-gray-400 text-xs">
                      {propAssetCount}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2 py-2">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      placeholder="搜索资产..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-8 bg-[#1a1a1a] border-gray-700 text-sm"
                    />
                  </div>
                  <div className="flex bg-[#1a1a1a] rounded border border-gray-700">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-8 w-8 p-0 rounded-none ${viewMode === "grid" ? "bg-gray-800" : ""}`}
                      onClick={() => setViewMode("grid")}
                    >
                      <Grid3x3 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-8 w-8 p-0 rounded-none ${viewMode === "list" ? "bg-gray-800" : ""}`}
                      onClick={() => setViewMode("list")}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <TabsContent
              value="characters"
              className="flex-1 m-0 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
            >
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <Loader2 className="w-12 h-12 animate-spin opacity-30" />
                  </div>
                ) : filteredCharacters.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                    暂无角色资产
                  </div>
                ) : viewMode === "grid" ? (
                  <div className="grid grid-cols-3 gap-4 pb-4">
                    {filteredCharacters.map((character) => (
                      <button
                        key={character.id}
                        onClick={() => setSelectedAsset({ type: "character", data: character })}
                        className={`text-left bg-[#141414] border rounded-lg overflow-hidden transition-all ${selectedAsset?.type === "character" && selectedAsset.data.id === character.id ? "border-purple-500 shadow-lg shadow-purple-500/20" : "border-gray-800 hover:border-gray-700"}`}
                      >
                        <div className="aspect-square bg-gradient-to-br from-blue-900/20 to-purple-900/20 relative flex items-center justify-center">
                          {getCharacterPreviewSrc(character) ? (
                            <ContainedAssetImage
                              src={getCharacterPreviewSrc(character)}
                              alt={character.name}
                              className="h-full w-full"
                            />
                          ) : (
                            <Users className="w-16 h-16 text-gray-700" />
                          )}
                          <div className="absolute top-3 right-3">
                            <Badge className="bg-purple-600 text-white text-xs">角色</Badge>
                          </div>
                        </div>
                        <div className="p-3 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-medium">{character.name}</h4>
                            {hasCharacterVoiceReference(character) ? (
                              <Badge className="bg-emerald-600/15 text-emerald-300 border border-emerald-500/30 text-[10px]">
                                角色语音
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-2">
                            {character.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 pb-4">
                    {filteredCharacters.map((character) => (
                      <button
                        key={character.id}
                        onClick={() => setSelectedAsset({ type: "character", data: character })}
                        className={`w-full text-left bg-[#141414] border rounded-lg p-4 transition-all flex items-center gap-4 ${selectedAsset?.type === "character" && selectedAsset.data.id === character.id ? "border-purple-500" : "border-gray-800 hover:border-gray-700"}`}
                      >
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded flex items-center justify-center flex-shrink-0">
                          {getCharacterPreviewSrc(character) ? (
                            <ContainedAssetImage
                              src={getCharacterPreviewSrc(character)}
                              alt={character.name}
                              className="h-full w-full rounded"
                            />
                          ) : (
                            <Users className="w-8 h-8 text-gray-700" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className="font-medium">{character.name}</h4>
                            <Badge className="bg-purple-600 text-white text-xs">角色</Badge>
                            {hasCharacterVoiceReference(character) ? (
                              <Badge className="bg-emerald-600/15 text-emerald-300 border border-emerald-500/30 text-[10px]">
                                角色语音
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-1">
                            {character.description}
                          </p>
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
                className="flex-1 m-0 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
              >
                <div className="flex-1 min-h-0 overflow-y-auto p-4">
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
              className={`resize-handle resize-handle-left relative flex-shrink-0 w-3 z-20 ${isResizingDetailSidebar ? "dragging" : ""}`}
              onMouseDown={handleDetailSidebarMouseDown}
            />

            <aside
              style={{ width: detailSidebarWidth }}
              className="border-l border-gray-800 bg-[#0f0f0f] flex flex-col flex-shrink-0"
            >
              <>
                <div className="p-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
                  <h3 className="text-sm">
                    {selectedAsset.type === "character"
                      ? "角色详情"
                      : `${getAssetKindLabel(selectedAsset.data)}详情`}
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="资产操作"
                        aria-expanded={showActionMenu}
                        className="h-7 w-7 p-0"
                        onClick={() => setShowActionMenu((open) => !open)}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                      {showActionMenu ? (
                        <div className="absolute right-0 top-9 z-50 min-w-40 rounded-md bg-[#171717] p-1 shadow-2xl ring-1 ring-white/10">
                          <button
                            type="button"
                            className="w-full rounded px-3 py-2 text-left text-sm hover:bg-white/10"
                            onClick={() => { setShowActionMenu(false); void openSelectedVersions(); }}
                          >
                            查看生成版本
                          </button>
                          {selectedAsset.type === "character" ? (
                            <button
                              type="button"
                              className="w-full rounded px-3 py-2 text-left text-sm hover:bg-white/10"
                              onClick={() => { setShowActionMenu(false); void openVoiceVersions(); }}
                            >
                              查看语音版本
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={isSavingPersonal}
                            className="w-full rounded px-3 py-2 text-left text-sm hover:bg-white/10 disabled:opacity-50"
                            onClick={() => { setShowActionMenu(false); void saveSelectedToPersonal(); }}
                          >
                            保存到个人空间
                          </button>
                          <button
                            type="button"
                            className="w-full rounded px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
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
                      className="h-7 w-7 p-0"
                      onClick={() => setSelectedAsset(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 min-h-0">
                  {selectedAsset.type === "character" ? (
                    <div className="space-y-4">
                      <div className="space-y-3 rounded border border-gray-800 bg-[#111111] p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-gray-100">角色参考图</div>
                            <div className="text-xs text-gray-500">
                              只用于生成主设定图，不参与其他展示和分镜参考链路
                            </div>
                          </div>
                          <Badge className="bg-amber-600 text-white text-xs">内部参考</Badge>
                        </div>
                        <div className="aspect-square bg-gradient-to-br from-amber-900/20 to-orange-900/10 rounded border border-gray-700 flex items-center justify-center overflow-hidden">
                          {getCharacterReferenceSrc(selectedAsset.data) ? (
                            <button
                              type="button"
                              className="w-full h-full"
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
                                className="h-full w-full rounded"
                              />
                            </button>
                          ) : (
                            <Users className="w-24 h-24 text-gray-700" />
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-gray-400">角色参考图地址</Label>
                          <Input
                            value={selectedAsset.data.avatar_url || ""}
                            onChange={(e) =>
                              setSelectedAsset({
                                type: "character",
                                data: { ...selectedAsset.data, avatar_url: e.target.value },
                              })
                            }
                            placeholder="https://..."
                            className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                          />
                        </div>
                        <div className="flex gap-2">
                          <input
                            ref={selectedCharacterReferenceInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              void handleUploadSelectedCharacterReference(
                                e.target.files?.[0] || null,
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 border-gray-700 text-gray-200 hover:bg-gray-900"
                            disabled={uploadingCharacterReferenceId === selectedAsset.data.id}
                            onClick={() => selectedCharacterReferenceInputRef.current?.click()}
                          >
                            {uploadingCharacterReferenceId === selectedAsset.data.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                上传中
                              </>
                            ) : (
                              <>上传参考图</>
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-3 rounded border border-gray-800 bg-[#111111] p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-gray-100">角色主设定图</div>
                            <div className="text-xs text-gray-500">
                              角色正式展示图，以及后续分镜封面的人物核心参考图
                            </div>
                          </div>
                          <Badge className="bg-blue-600 text-white text-xs">角色设定</Badge>
                        </div>
                        <div className="aspect-square bg-gradient-to-br from-slate-900/30 to-blue-900/20 rounded border border-gray-700 flex items-center justify-center overflow-hidden">
                          {getCharacterDesignSheetPreviewSrc(selectedAsset.data) ? (
                            <button
                              type="button"
                              className="w-full h-full"
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
                                className="h-full w-full rounded"
                              />
                            </button>
                          ) : (
                            <Users className="w-24 h-24 text-gray-700" />
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-400">主设定图版本</div>
                            <div className="text-[11px] text-gray-600">
                              {isLoadingVersions ? "加载中" : `${versions.length} 个版本`}
                            </div>
                          </div>
                          {versions.length ? (
                            <div className="grid grid-cols-3 gap-2">
                              {versions.slice(0, 6).map((version, index) => (
                                <VersionImageCard
                                  key={version.id}
                                  version={version}
                                  src={version.file_url}
                                  alt={`${selectedAsset.data.name} 主设定图版本 ${versions.length - index}`}
                                  label={`v${versions.length - index}`}
                                  aspectClassName="aspect-square"
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
                            <div className="rounded bg-[#191919] px-3 py-3 text-center text-xs text-gray-600">
                              {isLoadingVersions ? "正在加载版本" : "生成后会在这里保留历史版本"}
                            </div>
                          )}
                          {versions.length > 6 ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="w-full text-xs text-gray-400"
                              onClick={() => void openSelectedVersions()}
                            >
                              查看全部 {versions.length} 个版本
                            </Button>
                          ) : null}
                        </div>
                        {selectedAsset.data.design_sheet_error ? (
                          <div className="rounded bg-red-950/40 px-3 py-2 text-xs text-red-200">
                            {selectedAsset.data.design_sheet_error}
                          </div>
                        ) : null}
                        <div className="space-y-2">
                          <div className="rounded border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-gray-200">
                            {CHARACTER_DESIGN_SHEET_MODEL_LABEL}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full border-gray-700 text-gray-200 hover:bg-gray-900"
                            disabled={
                              generatingCharacterDesignSheetId === selectedAsset.data.id ||
                              selectedAsset.data.design_sheet_status === "generating"
                            }
                            onClick={() => void handleGenerateCharacterDesignSheet()}
                          >
                            {generatingCharacterDesignSheetId === selectedAsset.data.id ||
                            selectedAsset.data.design_sheet_status === "generating" ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                正在生成主设定图
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                生成主设定图
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">角色名称</Label>
                        <Input
                          value={selectedAsset.data.name}
                          onChange={(e) =>
                            setSelectedAsset({
                              type: "character",
                              data: { ...selectedAsset.data, name: e.target.value },
                            })
                          }
                          className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">角色描述</Label>
                        <Textarea
                          value={selectedAsset.data.description || ""}
                          onChange={(e) =>
                            setSelectedAsset({
                              type: "character",
                              data: { ...selectedAsset.data, description: e.target.value },
                            })
                          }
                          className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[100px]"
                        />
                      </div>
                      <div className="space-y-3 rounded border border-gray-800 bg-[#111111] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm text-gray-100">主语音参考</div>
                            <div className="text-xs text-gray-500">
                              {CHARACTER_VOICE_REFERENCE_DURATION_HINT}
                            </div>
                          </div>
                          <Badge className="bg-emerald-600 text-white text-xs">角色语音</Badge>
                        </div>
                        {characterVoiceReferenceError?.id === selectedAsset.data.id ? (
                          <div className="rounded border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-200">
                            {characterVoiceReferenceError.message}
                          </div>
                        ) : null}
                        {selectedAsset.data.voice_reference_error ? (
                          <div className="rounded bg-red-950/40 px-3 py-2 text-xs text-red-200">
                            {selectedAsset.data.voice_reference_error}
                          </div>
                        ) : null}
                        {getCharacterVoiceReferenceSrc(selectedAsset.data) ? (
                          <audio
                            key={selectedAsset.data.voice_reference_url}
                            controls
                            className="w-full"
                          >
                            <source src={getCharacterVoiceReferenceSrc(selectedAsset.data)} />
                          </audio>
                        ) : (
                          <div className="rounded border border-dashed border-gray-700 px-3 py-4 text-xs text-gray-500">
                            还没有主语音参考。生成后会自动绑定到这个角色。
                          </div>
                        )}
                        <div>
                          <Label className="text-xs text-gray-400">声音提示词</Label>
                          <Textarea
                            value={selectedAsset.data.voice_prompt || ""}
                            onChange={(e) =>
                              setSelectedAsset({
                                type: "character",
                                data: { ...selectedAsset.data, voice_prompt: e.target.value },
                              })
                            }
                            className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[88px]"
                            placeholder="例如：年轻男性，低沉克制，略带疲惫感，真实自然，不要播音腔。"
                          />
                          <div className="mt-1 text-[11px] text-gray-500">
                            系统会在生成时追加 3-5 秒短句约束。
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-400">参考文本</Label>
                          <div className="mt-1.5 rounded border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-gray-200">
                            {FIXED_CHARACTER_VOICE_REFERENCE_TEXT}
                          </div>
                          <div className="mt-1 text-[11px] text-gray-500">
                            {CHARACTER_VOICE_REFERENCE_TEXT_HINT}
                          </div>
                        </div>
                        {selectedAsset.data.voice_name ||
                        selectedAsset.data.voice_reference_duration ? (
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                            <div className="rounded border border-gray-800 bg-[#0d0d0d] px-3 py-2">
                              <div className="text-[11px] text-gray-500">音色名称</div>
                              <div className="mt-1 text-gray-200 break-all">
                                {selectedAsset.data.voice_name || "未生成"}
                              </div>
                            </div>
                            <div className="rounded border border-gray-800 bg-[#0d0d0d] px-3 py-2">
                              <div className="text-[11px] text-gray-500">音频时长</div>
                              <div className="mt-1 text-gray-200">
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
                          className="w-full border-gray-700 text-gray-200 hover:bg-gray-900"
                          disabled={
                            generatingCharacterVoiceReferenceId === selectedAsset.data.id ||
                            selectedAsset.data.voice_reference_status === "generating"
                          }
                          onClick={() => void handleGenerateCharacterVoiceReference()}
                        >
                          {generatingCharacterVoiceReferenceId === selectedAsset.data.id ||
                          selectedAsset.data.voice_reference_status === "generating" ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              生成中
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              生成主语音参考
                            </>
                          )}
                        </Button>
                        <input
                          ref={selectedCharacterVoiceReferenceInputRef}
                          type="file"
                          accept="audio/wav,audio/mpeg,.wav,.mp3"
                          className="hidden"
                          onChange={(event) =>
                            void handleUploadSelectedCharacterVoiceReference(
                              event.target.files?.[0] || null,
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full border-gray-700 text-gray-200 hover:bg-gray-900"
                          disabled={uploadingCharacterVoiceReferenceId === selectedAsset.data.id}
                          onClick={() => selectedCharacterVoiceReferenceInputRef.current?.click()}
                        >
                          {uploadingCharacterVoiceReferenceId === selectedAsset.data.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              上传中
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              上传/替换主语音参考
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="pt-4 border-t border-gray-800">
                        <Button
                          className="w-full bg-purple-600 hover:bg-purple-700"
                          disabled={isSavingCharacter}
                          onClick={saveSelectedCharacter}
                        >
                          {isSavingCharacter ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              保存中
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              保存修改
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full mt-2 border-red-800 text-red-400 hover:bg-red-900/20"
                          onClick={() =>
                            setDeleteTarget({
                              type: "character",
                              id: selectedAsset.data.id,
                              name: selectedAsset.data.name,
                            })
                          }
                        >
                          {" "}
                          <Trash2 className="w-4 h-4 mr-2" /> 删除角色
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "原始素材", src: getAssetOriginalSrc(selectedAsset.data) },
                          { label: "AI 封面", src: selectedAsset.data.cover_url || "" },
                        ].map((media) => (
                          <div key={media.label} className="space-y-1.5">
                            <div className="text-xs text-gray-400">{media.label}</div>
                            <button
                              type="button"
                              disabled={!media.src}
                              className="aspect-video w-full overflow-hidden rounded bg-[#171717] disabled:cursor-default"
                              onClick={() => media.src && setPreviewImage({ src: media.src, alt: media.label })}
                            >
                              {media.src ? (
                                <ContainedAssetImage
                                  src={media.src}
                                  alt={media.label}
                                  className="h-full w-full"
                                />
                              ) : (
                                <MapPin className="mx-auto h-full w-8 text-gray-700" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                      <input
                        ref={selectedAssetFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => void handleUploadSelectedAssetFile(event.target.files?.[0] || null)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-gray-700 text-gray-200 hover:bg-gray-900"
                        onClick={() => selectedAssetFileInputRef.current?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />替换原始素材
                      </Button>
                      {selectedAsset.data.cover_error ? (
                        <div className="rounded bg-red-950/40 px-3 py-2 text-xs text-red-200">
                          {selectedAsset.data.cover_error}
                        </div>
                      ) : null}
                      {selectedAsset.data.type === "scene" || selectedAsset.data.type === "prop" ? <Button
                        type="button"
                        variant="outline"
                        className="w-full border-gray-700 text-gray-200 hover:bg-gray-900"
                        disabled={
                          generatingAssetCoverId === selectedAsset.data.id ||
                          selectedAsset.data.cover_status === "generating"
                        }
                        onClick={() => void handleGenerateAssetCover()}
                      >
                        {generatingAssetCoverId === selectedAsset.data.id ||
                        selectedAsset.data.cover_status === "generating" ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            正在生成
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            生成封面
                          </>
                        )}
                      </Button> : (
                        <div className="rounded bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                          当前类型不支持 AI 生成封面。
                        </div>
                      )}
                      <div>
                        <Label className="text-xs text-gray-400">
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
                          className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">资源类型</Label>
                        <Select
                          value={selectedAsset.data.type === "prop" ? "prop" : "scene"}
                          onValueChange={(value) =>
                            setSelectedAsset({
                              type: "asset",
                              data: { ...selectedAsset.data, type: value },
                            })
                          }
                        >
                          <SelectTrigger className="mt-1.5 bg-[#1a1a1a] border-gray-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scene">场景</SelectItem>
                            <SelectItem value="prop">道具</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">
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
                          className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[100px]"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">资源地址</Label>
                        <Textarea
                          value={selectedAsset.data.file_url || ""}
                          className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[60px]"
                          readOnly
                        />
                      </div>
                      <div className="pt-4 border-t border-gray-800">
                        <Button
                          className="w-full bg-purple-600 hover:bg-purple-700"
                          disabled={isSavingAsset}
                          onClick={saveSelectedAsset}
                        >
                          {isSavingAsset ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              保存中
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              保存修改
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full mt-2 border-red-800 text-red-400 hover:bg-red-900/20"
                          onClick={() =>
                            setDeleteTarget({
                              type: "asset",
                              id: selectedAsset.data.id,
                              name: selectedAsset.data.name,
                            })
                          }
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
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
        <DialogContent className="bg-[#111111] border-gray-800 text-gray-100 max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{aiPreviewDialog?.title || "确认 AI 生成"}</DialogTitle>
            <DialogDescription className="text-gray-400 leading-6">
              {aiPreviewDialog?.description || ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">实际模型</span>
                <span>{aiPreviewDialog?.preview.model || "-"}</span>
              </div>
              {aiPreviewDialog?.preview.notes?.length ? (
                <div>
                  <div className="text-gray-500 mb-1">说明</div>
                  <ul className="space-y-1 text-xs text-gray-300 list-disc pl-5">
                    {aiPreviewDialog.preview.notes.map((note, index) => (
                      <li key={`${note}-${index}`}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-2">
              <div className="text-gray-300 font-medium">详细参数</div>
              <div className="grid gap-2 md:grid-cols-2 text-xs">
                {Object.entries(aiPreviewDialog?.preview.fields || {}).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-gray-500">{key}：</span>
                    <span>{value || "-"}</span>
                  </div>
                ))}
              </div>
            </div>
            {aiPreviewDialog?.preview.reference_images?.length ? (
              <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-3">
                <div className="text-gray-300 font-medium">参考图输入</div>
                <div className="grid gap-3 md:grid-cols-2">
                  {aiPreviewDialog.preview.reference_images.map((image) => (
                    <button
                      key={`${image.type}:${image.name}`}
                      type="button"
                      className="rounded border border-gray-800 bg-[#111111] p-2 text-left"
                      onClick={() => setPreviewImage({ src: image.url, alt: image.name })}
                    >
                      <div className="aspect-[4/3] overflow-hidden rounded border border-gray-800 bg-black/20">
                        <img
                          src={image.url}
                          alt={image.name}
                          className="h-full w-full object-contain"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div className="mt-2 text-xs text-gray-200">{image.name}</div>
                      <div className="mt-1 text-[11px] text-gray-500">{image.source}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-gray-300 font-medium">
                  最终 Prompt
                  {aiPreviewDialog?.action === "character-design-sheet" ? "（可编辑）" : ""}
                </div>
                {aiPreviewDialog?.action === "character-design-sheet" ? (
                  <div className="text-[11px] text-gray-500">
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
                  className="min-h-72 resize-y border-gray-800 bg-[#111111] font-mono text-xs leading-6 text-gray-300"
                  aria-label="可编辑的最终 Prompt"
                />
              ) : (
                <pre className="whitespace-pre-wrap break-words rounded border border-gray-800 bg-[#111111] p-3 text-xs text-gray-300 leading-6">
                  {formatPromptForDisplay(aiPreviewDialog?.preview.final_prompt)}
                </pre>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setAiPreviewDialog(null)}>
              取消
            </Button>
            <Button
              type="button"
              className="bg-purple-600 hover:bg-purple-700 text-white"
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
        <DialogContent className="bg-[#121212] text-gray-100 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>生成版本</DialogTitle>
            <DialogDescription>
              点击图片仅预览；移入非当前版本后，点击右上角按钮才会切换。
            </DialogDescription>
          </DialogHeader>
          {versions.length ? (
            <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
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
                    aspectClassName="aspect-video"
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
            <div className="py-12 text-center text-sm text-gray-500">尚无生成版本</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showVoiceVersions} onOpenChange={setShowVoiceVersions}>
        <DialogContent className="bg-[#121212] text-gray-100 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>主语音版本</DialogTitle>
            <DialogDescription>试听并恢复以前生成或上传的角色主语音。</DialogDescription>
          </DialogHeader>
          {voiceVersions.length ? (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {voiceVersions.map((version) => (
                <div key={version.id} className={`rounded-lg bg-[#191919] p-3 ${version.is_current ? "ring-2 ring-emerald-500" : ""}`}>
                  <audio controls className="w-full"><source src={version.file_url} /></audio>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>{version.source_type === "manual-upload" ? "手动上传" : "AI 生成"} · {version.duration.toFixed(1)}s</span>
                    <Button size="sm" variant="ghost" disabled={version.is_current} onClick={() => void chooseVoiceVersion(version)}>
                      {version.is_current ? "当前版本" : "设为当前"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-gray-500">尚无语音版本</div>
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
          className="bg-[#121212] border-gray-800 text-gray-100 sm:max-w-lg"
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>新建资产</DialogTitle>
            <DialogDescription className="text-gray-400">
              选择角色、场景或道具资产，创建后会进入对应分类。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-400">资产类型</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
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
                        ? "bg-purple-600 hover:bg-purple-700"
                        : "border-gray-700 text-gray-300"
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
                  <Label className="text-xs text-gray-400">名称</Label>
                  <Input
                    value={newCharacter.name}
                    onChange={(e) => setNewCharacter((prev) => ({ ...prev, name: e.target.value }))}
                    className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-400">描述</Label>
                  <Textarea
                    value={newCharacter.description}
                    onChange={(e) =>
                      setNewCharacter((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[100px]"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-400">角色参考图地址（可选）</Label>
                  <Input
                    value={newCharacter.avatar_url}
                    onChange={(e) =>
                      setNewCharacter((prev) => ({ ...prev, avatar_url: e.target.value }))
                    }
                    placeholder="https://..."
                    disabled={Boolean(createCharacterFile)}
                    className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-400">上传角色参考图（可选）</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCreateCharacterFile(e.target.files?.[0] || null)}
                    className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="text-xs text-gray-400">名称</Label>
                  <Input
                    value={newAsset.name}
                    onChange={(e) => setNewAsset((prev) => ({ ...prev, name: e.target.value }))}
                    className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-400">
                    {createMode === "prop" ? "道具说明" : "场景说明"}
                  </Label>
                  <Textarea
                    value={newAsset.meta}
                    onChange={(e) => setNewAsset((prev) => ({ ...prev, meta: e.target.value }))}
                    className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[100px]"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-400">资源地址（可选）</Label>
                  <Input
                    value={newAsset.file_url}
                    onChange={(e) => setNewAsset((prev) => ({ ...prev, file_url: e.target.value }))}
                    placeholder="https://..."
                    disabled={Boolean(createAssetFile)}
                    className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-400">上传图片（可选）</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCreateAssetFile(e.target.files?.[0] || null)}
                    className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-gray-600 bg-[#1a1a1a] text-gray-100 hover:bg-[#262626] hover:text-white"
              onClick={() => setShowCreateDialog(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="bg-purple-600 hover:bg-purple-700"
              disabled={isCreating}
              onClick={handleCreate}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
        <AlertDialogContent className="bg-[#121212] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === "character"
                ? "确认删除角色"
                : `确认删除${deleteTarget?.assetKind === "prop" ? "道具" : "场景"}资产`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {deleteTarget?.type === "character"
                ? "该操作会从资产库隐藏该角色，不会删除服务器原始文件。"
                : "该操作会从资产库隐藏该资产，不会删除服务器原始文件。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-600 bg-[#1a1a1a] text-gray-100 hover:bg-[#262626] hover:text-white">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteActionKey === `${deleteTarget?.type}:${deleteTarget?.id}`}
              onClick={confirmDelete}
            >
              {deleteActionKey === `${deleteTarget?.type}:${deleteTarget?.id}` ? (
                <Loader2 className="w-4 h-4 animate-spin" />
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
