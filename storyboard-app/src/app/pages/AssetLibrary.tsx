import { useEffect, useMemo, useState } from "react";
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
  Check,
  Grid3x3,
  List,
  Trash2,
  Save,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ImagePreviewDialog } from "../components/ui/image-preview-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
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
  characterApi,
  assetApi,
  apiClient,
  type Character,
  type Asset,
  type AIGenerationPreview,
} from "../api";

type SelectedAsset =
  | { type: "character"; data: Character }
  | { type: "asset"; data: Asset }
  | null;

type CreateMode = "character" | "asset";

type DeleteTarget =
  | { type: "character"; id: number; name: string }
  | { type: "asset"; id: number; name: string }
  | null;

type AIPreviewAction = "character-cover" | "character-design-sheet" | "character-voice-reference" | "asset-cover";

type AIPreviewDialogState = {
  action: AIPreviewAction;
  title: string;
  description: string;
  confirmLabel: string;
  preview: AIGenerationPreview;
};

const getCharacterPreviewSrc = (character: Character | null | undefined) =>
  character?.avatar_preview_url || character?.avatar_url || character?.design_sheet_preview_url || character?.design_sheet_url || "";

const getCharacterDesignSheetPreviewSrc = (character: Character | null | undefined) =>
  character?.design_sheet_preview_url || character?.design_sheet_url || "";

const getCharacterVoiceReferenceSrc = (character: Character | null | undefined) =>
  character?.voice_reference_url || "";

const hasCharacterDesignSheet = (character: Character | null | undefined) =>
  Boolean(character?.design_sheet_url || character?.design_sheet_preview_url);

const hasCharacterVoiceReference = (character: Character | null | undefined) =>
  Boolean(character?.voice_reference_url);

const CHARACTER_DESIGN_SHEET_MODE_OPTIONS = [
  { value: "draft", label: "快速草案（Qwen 2.0）" },
  { value: "final", label: "最终定稿（Wan 2.7 Pro）" },
] as const;

const getAssetPreviewSrc = (asset: Asset | null | undefined) =>
  asset?.thumbnail_url || asset?.cover_url || asset?.file_url || "";

const getAssetOriginalSrc = (asset: Asset | null | undefined) =>
  asset?.cover_url || asset?.file_url || "";

export default function AssetLibrary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentProjectId = Number(searchParams.get("project") || window.localStorage.getItem("currentProjectId") || "0");
  const [activeTab, setActiveTab] = useState("characters");
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
  const [isLoadingAIPreview, setIsLoadingAIPreview] = useState(false);

  const [newCharacter, setNewCharacter] = useState({ name: "", description: "", avatar_url: "" });
  const [newAsset, setNewAsset] = useState({ name: "", type: "scene", meta: "", file_url: "" });
  const [createCharacterFile, setCreateCharacterFile] = useState<File | null>(null);
  const [createAssetFile, setCreateAssetFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingCharacter, setIsSavingCharacter] = useState(false);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [generatingCharacterCoverId, setGeneratingCharacterCoverId] = useState<number | null>(null);
  const [generatingCharacterDesignSheetId, setGeneratingCharacterDesignSheetId] = useState<number | null>(null);
  const [generatingCharacterVoiceReferenceId, setGeneratingCharacterVoiceReferenceId] = useState<number | null>(null);
  const [generatingAssetCoverId, setGeneratingAssetCoverId] = useState<number | null>(null);
  const [deleteActionKey, setDeleteActionKey] = useState<string | null>(null);
  const [characterDesignSheetMode, setCharacterDesignSheetMode] = useState<"draft" | "final">("final");
  const [detailSidebarWidth, setDetailSidebarWidth] = useState(384);
  const [isResizingDetailSidebar, setIsResizingDetailSidebar] = useState(false);

  const MIN_DETAIL_SIDEBAR_WIDTH = 320;
  const MAX_DETAIL_SIDEBAR_WIDTH = 560;

  useEffect(() => {
    if (activeTab === "characters") {
      void loadCharacters();
    } else {
      void loadAssets();
    }
  }, [activeTab, currentProjectId]);

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
        char.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [characters, searchQuery]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => asset.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [assets, searchQuery]);

  const loadCharacters = async () => {
    setLoading(true);
    try {
      if (!currentProjectId) {
        setCharacters([]);
        return;
      }
      const data = await characterApi.getCharactersByProject(currentProjectId);
      setCharacters(data ?? []);
    } catch (error) {
      console.error("Failed to load characters:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAssets = async () => {
    setLoading(true);
    try {
      if (!currentProjectId) {
        setAssets([]);
        return;
      }
      const data = await assetApi.getAssetsByProject(currentProjectId);
      setAssets(data ?? []);
    } catch (error) {
      console.error("Failed to load assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshCurrentTab = async () => {
    if (activeTab === "characters") {
      await loadCharacters();
    } else {
      await loadAssets();
    }
  };

  const handleFileUpload = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const fileName = `assets/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const signature = await apiClient.get<{
      upload_url: string;
      public_url: string;
      object_key: string;
    } | null>(`/oss/sign?filename=${fileName}&content_type=${encodeURIComponent(file.type)}`);

    if (!signature?.upload_url || !signature?.public_url) {
      throw new Error("当前未配置文件上传服务，请直接创建空资产后再用 AI 生成封面，或先配置 OSS 上传。");
    }

    await fetch(signature.upload_url, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });

    return signature.public_url;
  };

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
        if (!avatarURL && createCharacterFile) {
          avatarURL = await handleFileUpload(createCharacterFile);
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
          toast.error("请填写完整的场景资产信息");
          return;
        }
        let fileURL = newAsset.file_url.trim();
        if (!fileURL && createAssetFile) {
          fileURL = await handleFileUpload(createAssetFile);
        }
        const created = await assetApi.createAsset(currentProjectId, {
          name: newAsset.name.trim(),
          type: newAsset.type.trim(),
          meta: newAsset.meta.trim(),
          file_url: fileURL,
        });
        await loadAssets();
        setActiveTab("assets");
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
        design_sheet_url: selectedAsset.data.design_sheet_url || "",
        voice_prompt: selectedAsset.data.voice_prompt || "",
      });
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: "character", data: updated });
    } catch (error) {
      console.error("Failed to save character:", error);
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
    } catch (error) {
      console.error("Failed to save asset:", error);
    } finally {
      setIsSavingAsset(false);
    }
  };

  const runGenerateSelectedCharacterCover = async () => {
    if (!selectedAsset || selectedAsset.type !== "character") return;
    setGeneratingCharacterCoverId(selectedAsset.data.id);
    try {
      const updated = await characterApi.generateCharacterCover(selectedAsset.data.id);
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: "character", data: updated });
    } catch (error) {
      console.error("Failed to generate character cover:", error);
    } finally {
      setGeneratingCharacterCoverId(null);
    }
  };

  const runGenerateSelectedCharacterDesignSheet = async () => {
    if (!selectedAsset || selectedAsset.type !== "character") return;
    setGeneratingCharacterDesignSheetId(selectedAsset.data.id);
    try {
      const updated = await characterApi.generateCharacterDesignSheet(selectedAsset.data.id, {
        mode: characterDesignSheetMode,
      });
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: "character", data: updated });
    } catch (error) {
      console.error("Failed to generate character design sheet:", error);
    } finally {
      setGeneratingCharacterDesignSheetId(null);
    }
  };

  const runGenerateSelectedCharacterVoiceReference = async () => {
    if (!selectedAsset || selectedAsset.type !== "character") return;
    setGeneratingCharacterVoiceReferenceId(selectedAsset.data.id);
    try {
      const updated = await characterApi.generateCharacterVoiceReference(selectedAsset.data.id, {
        voice_prompt: selectedAsset.data.voice_prompt || "",
        preview_text: selectedAsset.data.voice_reference_text || "",
      });
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAsset({ type: "character", data: updated });
      toast.success("主语音参考已生成");
    } catch (error) {
      console.error("Failed to generate character voice reference:", error);
      toast.error(error instanceof Error ? error.message : "生成主语音参考失败");
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

  const openAIPreviewDialog = (state: AIPreviewDialogState) => {
    setAiPreviewDialog(state);
  };

  const handleGenerateCharacterCover = async () => {
    if (!selectedAsset || selectedAsset.type !== "character") return;
    setIsLoadingAIPreview(true);
    try {
      const preview = await characterApi.getCharacterCoverGenerationPreview(selectedAsset.data.id);
      openAIPreviewDialog({
        action: "character-cover",
        title: "确认生成角色封面",
        description: "会为当前角色生成一张资产库展示封面。开始前可先查看本次使用的模型、结构化字段和最终 prompt。",
        confirmLabel: "确认生成",
        preview,
      });
    } catch (error) {
      console.error("Failed to preview character cover generation:", error);
      toast.error(error instanceof Error ? error.message : "获取角色封面预览失败");
    } finally {
      setIsLoadingAIPreview(false);
    }
  };

  const handleGenerateCharacterDesignSheet = async () => {
    if (!selectedAsset || selectedAsset.type !== "character") return;
    setIsLoadingAIPreview(true);
    try {
      const preview = await characterApi.getCharacterDesignSheetGenerationPreview(selectedAsset.data.id, {
        mode: characterDesignSheetMode,
      });
      openAIPreviewDialog({
        action: "character-design-sheet",
        title: "确认生成主设定图",
        description: "会为当前角色生成主设定图，并作为后续镜头封面生成的人物核心参考图。",
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

  const handleGenerateCharacterVoiceReference = async () => {
    if (!selectedAsset || selectedAsset.type !== "character") return;
    setIsLoadingAIPreview(true);
    try {
      const preview = await characterApi.getCharacterVoiceReferenceGenerationPreview(selectedAsset.data.id, {
        voice_prompt: selectedAsset.data.voice_prompt || "",
        preview_text: selectedAsset.data.voice_reference_text || "",
      });
      openAIPreviewDialog({
        action: "character-voice-reference",
        title: "确认生成主语音参考",
        description: "会用大模型生成当前角色的主语音参考，并绑定到角色资产上，后续对白和视频音频优先参考这段声音。",
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
      const preview = await assetApi.getAssetCoverGenerationPreview(selectedAsset.data.id);
      openAIPreviewDialog({
        action: "asset-cover",
        title: "确认生成资产封面",
        description: "会为当前场景/背景资产生成一张封面图，用于资产库预览。",
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
    setAiPreviewDialog(null);
    switch (action) {
      case "character-cover":
        await runGenerateSelectedCharacterCover();
        return;
      case "character-design-sheet":
        await runGenerateSelectedCharacterDesignSheet();
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

  const deriveAssetPrimaryTag = (asset: Asset) => {
    const type = asset.type?.toLowerCase?.() || "";
    if (type.includes("scene") || type.includes("background") || type.includes("场景") || type.includes("背景")) {
      return "场景";
    }
    if (type.includes("prop") || type.includes("道具")) {
      return "道具";
    }
    return "素材";
  };

  const deriveAssetSecondaryTag = (asset: Asset) => asset.type?.trim() || "资源";
  const deriveAssetDescription = (asset: Asset) => asset.meta?.trim() || `${asset.name} 资源文件`;
  const deriveAssetTags = (asset: Asset) => Array.from(new Set([deriveAssetPrimaryTag(asset), asset.type].filter(Boolean))).slice(0, 3);

  return (
    <div className="dark h-screen flex flex-col bg-[#0a0a0a] text-gray-100">
      <header className="border-b border-gray-800 bg-[#111111] flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" onClick={() => navigate("/")} className="h-8 text-gray-400 hover:text-gray-200">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              项目列表
            </Button>
            <div className="h-6 w-px bg-gray-700"></div>
            <Button size="sm" variant="ghost" onClick={() => navigate(currentProjectId ? `/workspace?project=${currentProjectId}` : "/workspace")} className="h-8 text-gray-400 hover:text-gray-200">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              返回工作台
            </Button>
            <div className="h-6 w-px bg-gray-700"></div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-600 rounded flex items-center justify-center">
                <Film className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm">资产库</span>
            </div>
          </div>
          <Button size="sm" className="h-8 bg-purple-600 hover:bg-purple-700" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            新建资产
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="border-b border-gray-800 bg-[#0f0f0f] px-4">
              <div className="flex items-center justify-between">
                <TabsList className="bg-transparent border-0">
                  <TabsTrigger value="characters" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-purple-500 rounded-none px-4">
                    <Users className="w-4 h-4 mr-2" />角色资产
                    <Badge className="ml-2 bg-gray-800 text-gray-400 text-xs">{characters.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="assets" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-purple-500 rounded-none px-4">
                    <MapPin className="w-4 h-4 mr-2" />场景资产
                    <Badge className="ml-2 bg-gray-800 text-gray-400 text-xs">{assets.length}</Badge>
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2 py-2">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input placeholder="搜索资产..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-8 bg-[#1a1a1a] border-gray-700 text-sm" />
                  </div>
                  <div className="flex bg-[#1a1a1a] rounded border border-gray-700">
                    <Button size="sm" variant="ghost" className={`h-8 w-8 p-0 rounded-none ${viewMode === "grid" ? "bg-gray-800" : ""}`} onClick={() => setViewMode("grid")}><Grid3x3 className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" className={`h-8 w-8 p-0 rounded-none ${viewMode === "list" ? "bg-gray-800" : ""}`} onClick={() => setViewMode("list")}><List className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            </div>

            <TabsContent value="characters" className="flex-1 m-0 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-gray-500"><Loader2 className="w-12 h-12 animate-spin opacity-30" /></div>
                ) : filteredCharacters.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-sm">暂无角色资产</div>
                ) : viewMode === "grid" ? (
                  <div className="grid grid-cols-3 gap-4 pb-4">
                    {filteredCharacters.map((character) => (
                      <button key={character.id} onClick={() => setSelectedAsset({ type: "character", data: character })} className={`text-left bg-[#141414] border rounded-lg overflow-hidden transition-all ${selectedAsset?.type === "character" && selectedAsset.data.id === character.id ? "border-purple-500 shadow-lg shadow-purple-500/20" : "border-gray-800 hover:border-gray-700"}`}>
                        <div className="aspect-square bg-gradient-to-br from-blue-900/20 to-purple-900/20 relative flex items-center justify-center">
                          {getCharacterPreviewSrc(character) ? <img src={getCharacterPreviewSrc(character)} alt={character.name} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <Users className="w-16 h-16 text-gray-700" />}
                          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[70%]">
                            {hasCharacterDesignSheet(character) ? <Badge className="bg-blue-600/90 text-white text-[10px]">主设定图</Badge> : null}
                            {hasCharacterVoiceReference(character) ? <Badge className="bg-emerald-600/90 text-white text-[10px]">角色语音</Badge> : null}
                          </div>
                          <div className="absolute top-3 right-3"><Badge className="bg-purple-600 text-white text-xs">角色</Badge></div>
                        </div>
                        <div className="p-3 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-medium">{character.name}</h4>
                            {hasCharacterDesignSheet(character) ? <Badge className="bg-blue-600/15 text-blue-300 border border-blue-500/30 text-[10px]">主设定图</Badge> : null}
                            {hasCharacterVoiceReference(character) ? <Badge className="bg-emerald-600/15 text-emerald-300 border border-emerald-500/30 text-[10px]">角色语音</Badge> : null}
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-2">{character.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 pb-4">
                    {filteredCharacters.map((character) => (
                      <button key={character.id} onClick={() => setSelectedAsset({ type: "character", data: character })} className={`w-full text-left bg-[#141414] border rounded-lg p-4 transition-all flex items-center gap-4 ${selectedAsset?.type === "character" && selectedAsset.data.id === character.id ? "border-purple-500" : "border-gray-800 hover:border-gray-700"}`}>
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded flex items-center justify-center flex-shrink-0">
                          {getCharacterPreviewSrc(character) ? <img src={getCharacterPreviewSrc(character)} alt={character.name} loading="lazy" decoding="async" className="w-full h-full object-cover rounded" /> : <Users className="w-8 h-8 text-gray-700" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className="font-medium">{character.name}</h4>
                            <Badge className="bg-purple-600 text-white text-xs">角色</Badge>
                            {hasCharacterDesignSheet(character) ? <Badge className="bg-blue-600/15 text-blue-300 border border-blue-500/30 text-[10px]">主设定图</Badge> : null}
                            {hasCharacterVoiceReference(character) ? <Badge className="bg-emerald-600/15 text-emerald-300 border border-emerald-500/30 text-[10px]">角色语音</Badge> : null}
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-1">{character.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="assets" className="flex-1 m-0 overflow-hidden min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-gray-500"><Loader2 className="w-12 h-12 animate-spin opacity-30" /></div>
                ) : filteredAssets.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-sm">暂无场景资产</div>
                ) : viewMode === "grid" ? (
                  <div className="grid grid-cols-3 gap-4 pb-4">
                    {filteredAssets.map((asset) => (
                      <button key={asset.id} onClick={() => setSelectedAsset({ type: "asset", data: asset })} className={`text-left bg-[#141414] border rounded-lg overflow-hidden transition-all ${selectedAsset?.type === "asset" && selectedAsset.data.id === asset.id ? "border-purple-500 shadow-lg shadow-purple-500/20" : "border-gray-800 hover:border-gray-700"}`}>
                        <div className="aspect-video bg-gradient-to-br from-green-900/20 to-blue-900/20 relative flex items-center justify-center">
                          {getAssetPreviewSrc(asset) ? <img src={getAssetPreviewSrc(asset)} alt={asset.name} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <MapPin className="w-16 h-16 text-gray-700" />}
                          <div className="absolute top-3 left-3"><Badge className="bg-green-600 text-white text-xs">{deriveAssetPrimaryTag(asset)}</Badge></div>
                          <div className="absolute top-3 right-3"><Badge className="bg-blue-600 text-white text-xs">{deriveAssetSecondaryTag(asset)}</Badge></div>
                        </div>
                        <div className="p-3 space-y-2"><h4 className="font-medium">{asset.name}</h4><p className="text-xs text-gray-400 line-clamp-2">{deriveAssetDescription(asset)}</p></div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 pb-4">
                    {filteredAssets.map((asset) => (
                      <button key={asset.id} onClick={() => setSelectedAsset({ type: "asset", data: asset })} className={`w-full text-left bg-[#141414] border rounded-lg p-4 transition-all flex items-center gap-4 ${selectedAsset?.type === "asset" && selectedAsset.data.id === asset.id ? "border-purple-500" : "border-gray-800 hover:border-gray-700"}`}>
                        <div className="w-20 h-14 bg-gradient-to-br from-green-900/20 to-blue-900/20 rounded flex items-center justify-center flex-shrink-0">
                          {getAssetPreviewSrc(asset) ? <img src={getAssetPreviewSrc(asset)} alt={asset.name} loading="lazy" decoding="async" className="w-full h-full object-cover rounded" /> : <MapPin className="w-8 h-8 text-gray-700" />}
                        </div>
                        <div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><h4 className="font-medium">{asset.name}</h4><Badge className="bg-green-600 text-white text-xs">{deriveAssetPrimaryTag(asset)}</Badge></div><p className="text-sm text-gray-400 line-clamp-1">{deriveAssetDescription(asset)}</p></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>

        {selectedAsset ? (
          <>
            <div
              className={`resize-handle resize-handle-left relative flex-shrink-0 w-3 z-20 ${isResizingDetailSidebar ? "dragging" : ""}`}
              onMouseDown={handleDetailSidebarMouseDown}
            />

            <aside style={{ width: detailSidebarWidth }} className="border-l border-gray-800 bg-[#0f0f0f] flex flex-col flex-shrink-0">
            <>
              <div className="p-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
                <h3 className="text-sm">{selectedAsset.type === "character" ? "角色详情" : "场景详情"}</h3>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><MoreHorizontal className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelectedAsset(null)}><X className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                {selectedAsset.type === "character" ? (
                  <div className="space-y-4">
                    <div className="aspect-square bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded border border-gray-700 flex items-center justify-center overflow-hidden">
                      {getCharacterPreviewSrc(selectedAsset.data) ? (
                        <button
                          type="button"
                          className="w-full h-full"
                          onClick={() =>
                            setPreviewImage({
                              src: selectedAsset.data.avatar_url || selectedAsset.data.design_sheet_url || selectedAsset.data.avatar_preview_url || selectedAsset.data.design_sheet_preview_url || "",
                              alt: selectedAsset.data.name,
                            })
                          }
                        >
                          <img src={getCharacterPreviewSrc(selectedAsset.data)} alt={selectedAsset.data.name} loading="lazy" decoding="async" className="w-full h-full object-cover rounded" />
                        </button>
                      ) : (
                        <Users className="w-24 h-24 text-gray-700" />
                      )}
                    </div>
                    <Button type="button" variant="outline" className="w-full border-gray-700 text-gray-200 hover:bg-gray-900" disabled={generatingCharacterCoverId === selectedAsset.data.id} onClick={() => void handleGenerateCharacterCover()}>
                      {generatingCharacterCoverId === selectedAsset.data.id ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />正在生成</> : <><Sparkles className="w-4 h-4 mr-2" />生成封面</>}
                    </Button>
                    <div className="space-y-3 rounded border border-gray-800 bg-[#111111] p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-100">主设定图</div>
                          <div className="text-xs text-gray-500">默认作为镜头封面生成时的人物核心参考图</div>
                        </div>
                        <Badge className="bg-blue-600 text-white text-xs">角色设定</Badge>
                      </div>
                      <div className="aspect-video bg-gradient-to-br from-slate-900/30 to-blue-900/20 rounded border border-gray-700 flex items-center justify-center overflow-hidden">
                        {getCharacterDesignSheetPreviewSrc(selectedAsset.data) ? (
                          <button
                            type="button"
                            className="w-full h-full"
                            onClick={() =>
                              setPreviewImage({
                                src: selectedAsset.data.design_sheet_url || selectedAsset.data.design_sheet_preview_url || "",
                                alt: `${selectedAsset.data.name} 主设定图`,
                              })
                            }
                          >
                            <img
                              src={getCharacterDesignSheetPreviewSrc(selectedAsset.data)}
                              alt={`${selectedAsset.data.name} 主设定图`}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover rounded"
                            />
                          </button>
                        ) : (
                          <Users className="w-16 h-16 text-gray-700" />
                        )}
                      </div>
                      <div className="space-y-2">
                        <Select value={characterDesignSheetMode} onValueChange={(value) => setCharacterDesignSheetMode(value as "draft" | "final")}>
                          <SelectTrigger className="w-full bg-[#1a1a1a] border-gray-700 text-gray-100">
                            <SelectValue placeholder="选择生成档位" />
                          </SelectTrigger>
                          <SelectContent>
                            {CHARACTER_DESIGN_SHEET_MODE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full border-gray-700 text-gray-200 hover:bg-gray-900"
                          disabled={generatingCharacterDesignSheetId === selectedAsset.data.id}
                          onClick={() => void handleGenerateCharacterDesignSheet()}
                        >
                          {generatingCharacterDesignSheetId === selectedAsset.data.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              生成中
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
                    <div><Label className="text-xs text-gray-400">角色名称</Label><Input value={selectedAsset.data.name} onChange={(e) => setSelectedAsset({ type: "character", data: { ...selectedAsset.data, name: e.target.value } })} className="mt-1.5 bg-[#1a1a1a] border-gray-700" /></div>
                    <div><Label className="text-xs text-gray-400">角色描述</Label><Textarea value={selectedAsset.data.description || ""} onChange={(e) => setSelectedAsset({ type: "character", data: { ...selectedAsset.data, description: e.target.value } })} className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[100px]" /></div>
                    <div className="space-y-3 rounded border border-gray-800 bg-[#111111] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm text-gray-100">主语音参考</div>
                          <div className="text-xs text-gray-500">由大模型生成并绑定到角色，后续对白和视频音频优先参考这段声音</div>
                        </div>
                        <Badge className="bg-emerald-600 text-white text-xs">角色语音</Badge>
                      </div>
                      {getCharacterVoiceReferenceSrc(selectedAsset.data) ? (
                        <audio key={selectedAsset.data.voice_reference_url} controls className="w-full">
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
                          onChange={(e) => setSelectedAsset({ type: "character", data: { ...selectedAsset.data, voice_prompt: e.target.value } })}
                          className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[88px]"
                          placeholder="例如：年轻男性，低沉克制，略带疲惫感，真实自然，不要播音腔。"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">参考文本</Label>
                        <Textarea
                          value={selectedAsset.data.voice_reference_text || ""}
                          onChange={(e) => setSelectedAsset({ type: "character", data: { ...selectedAsset.data, voice_reference_text: e.target.value } })}
                          className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[88px]"
                          placeholder="不填则自动使用系统默认参考文本。"
                        />
                      </div>
                      {(selectedAsset.data.voice_name || selectedAsset.data.voice_reference_duration) ? (
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                          <div className="rounded border border-gray-800 bg-[#0d0d0d] px-3 py-2">
                            <div className="text-[11px] text-gray-500">音色名称</div>
                            <div className="mt-1 text-gray-200 break-all">{selectedAsset.data.voice_name || "未生成"}</div>
                          </div>
                          <div className="rounded border border-gray-800 bg-[#0d0d0d] px-3 py-2">
                            <div className="text-[11px] text-gray-500">音频时长</div>
                            <div className="mt-1 text-gray-200">{selectedAsset.data.voice_reference_duration ? `${selectedAsset.data.voice_reference_duration.toFixed(1)}s` : "未生成"}</div>
                          </div>
                        </div>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-gray-700 text-gray-200 hover:bg-gray-900"
                        disabled={generatingCharacterVoiceReferenceId === selectedAsset.data.id}
                        onClick={() => void handleGenerateCharacterVoiceReference()}
                      >
                        {generatingCharacterVoiceReferenceId === selectedAsset.data.id ? (
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
                    </div>
                    <div className="pt-4 border-t border-gray-800">
                      <Button className="w-full bg-purple-600 hover:bg-purple-700" disabled={isSavingCharacter} onClick={saveSelectedCharacter}>{isSavingCharacter ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中</> : <><Save className="w-4 h-4 mr-2" />保存修改</>}</Button>
                      <Button variant="outline" className="w-full mt-2 border-red-800 text-red-400 hover:bg-red-900/20" onClick={() => setDeleteTarget({ type: "character", id: selectedAsset.data.id, name: selectedAsset.data.name })}> <Trash2 className="w-4 h-4 mr-2" /> 删除角色</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="aspect-video bg-gradient-to-br from-green-900/20 to-blue-900/20 rounded border border-gray-700 flex items-center justify-center overflow-hidden">
                      {getAssetPreviewSrc(selectedAsset.data) ? (
                        <button type="button" className="w-full h-full" onClick={() => setPreviewImage({ src: getAssetOriginalSrc(selectedAsset.data), alt: selectedAsset.data.name })}>
                          <img src={getAssetPreviewSrc(selectedAsset.data)} alt={selectedAsset.data.name} loading="lazy" decoding="async" className="w-full h-full object-cover rounded" />
                        </button>
                      ) : (
                        <MapPin className="w-24 h-24 text-gray-700" />
                      )}
                    </div>
                    <Button type="button" variant="outline" className="w-full border-gray-700 text-gray-200 hover:bg-gray-900" disabled={generatingAssetCoverId === selectedAsset.data.id} onClick={() => void handleGenerateAssetCover()}>
                      {generatingAssetCoverId === selectedAsset.data.id ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />正在生成</> : <><Sparkles className="w-4 h-4 mr-2" />生成封面</>}
                    </Button>
                    <div><Label className="text-xs text-gray-400">场景名称</Label><Input value={selectedAsset.data.name} onChange={(e) => setSelectedAsset({ type: "asset", data: { ...selectedAsset.data, name: e.target.value } })} className="mt-1.5 bg-[#1a1a1a] border-gray-700" /></div>
                    <div><Label className="text-xs text-gray-400">资源类型</Label><Input value={selectedAsset.data.type} onChange={(e) => setSelectedAsset({ type: "asset", data: { ...selectedAsset.data, type: e.target.value } })} className="mt-1.5 bg-[#1a1a1a] border-gray-700" /></div>
                    <div><Label className="text-xs text-gray-400">场景描述</Label><Textarea value={selectedAsset.data.meta || ""} onChange={(e) => setSelectedAsset({ type: "asset", data: { ...selectedAsset.data, meta: e.target.value } })} className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[100px]" /></div>
                    <div><Label className="text-xs text-gray-400">资源地址</Label><Textarea value={selectedAsset.data.file_url || ""} className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[60px]" readOnly /></div>
                    <div className="pt-4 border-t border-gray-800">
                      <Button variant="outline" className="w-full border-gray-700 text-gray-300 hover:bg-gray-900" onClick={() => navigate(currentProjectId ? `/workspace?project=${currentProjectId}` : "/workspace")}><Check className="w-4 h-4 mr-2" />插入到当前镜头</Button>
                      <Button className="w-full mt-2 bg-purple-600 hover:bg-purple-700" disabled={isSavingAsset} onClick={saveSelectedAsset}>{isSavingAsset ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中</> : <><Save className="w-4 h-4 mr-2" />保存修改</>}</Button>
                      <Button variant="outline" className="w-full mt-2 border-red-800 text-red-400 hover:bg-red-900/20" onClick={() => setDeleteTarget({ type: "asset", id: selectedAsset.data.id, name: selectedAsset.data.name })}><Trash2 className="w-4 h-4 mr-2" />删除资产</Button>
                    </div>
                  </div>
                )}
              </div>
            </>
            </aside>
          </>
        ) : null}
      </div>

      <Dialog open={!!aiPreviewDialog} onOpenChange={(open) => { if (!open) setAiPreviewDialog(null); }}>
        <DialogContent className="bg-[#111111] border-gray-800 text-gray-100 max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{aiPreviewDialog?.title || "确认 AI 生成"}</DialogTitle>
            <DialogDescription className="text-gray-400 leading-6">
              {aiPreviewDialog?.description || ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-2">
              <div className="flex justify-between gap-4"><span className="text-gray-500">实际模型</span><span>{aiPreviewDialog?.preview.model || "-"}</span></div>
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
                  <div key={key}><span className="text-gray-500">{key}：</span><span>{value || "-"}</span></div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-gray-800 bg-[#161616] p-3 text-sm space-y-2">
              <div className="text-gray-300 font-medium">最终 Prompt</div>
              <pre className="whitespace-pre-wrap break-words rounded border border-gray-800 bg-[#111111] p-3 text-xs text-gray-300 leading-6">{aiPreviewDialog?.preview.final_prompt || "-"}</pre>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setAiPreviewDialog(null)}>取消</Button>
            <Button type="button" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => void confirmAIPreviewGeneration()} disabled={isLoadingAIPreview}>{aiPreviewDialog?.confirmLabel || "确认生成"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) resetCreateState(); }}>
        <DialogContent
          className="bg-[#121212] border-gray-800 text-gray-100 sm:max-w-lg"
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>新建资产</DialogTitle>
            <DialogDescription className="text-gray-400">先选择创建角色资产还是场景资产。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-400">资产类型</Label>
              <div className="mt-1.5 flex gap-2">
                <Button type="button" variant={createMode === "character" ? "default" : "outline"} className={createMode === "character" ? "bg-purple-600 hover:bg-purple-700" : "border-gray-700 text-gray-300"} onClick={() => setCreateMode("character")}>角色资产</Button>
                <Button type="button" variant={createMode === "asset" ? "default" : "outline"} className={createMode === "asset" ? "bg-purple-600 hover:bg-purple-700" : "border-gray-700 text-gray-300"} onClick={() => setCreateMode("asset")}>场景资产</Button>
              </div>
            </div>
            {createMode === "character" ? (
              <>
                <div><Label className="text-xs text-gray-400">名称</Label><Input value={newCharacter.name} onChange={(e) => setNewCharacter((prev) => ({ ...prev, name: e.target.value }))} className="mt-1.5 bg-[#1a1a1a] border-gray-700" /></div>
                <div><Label className="text-xs text-gray-400">描述</Label><Textarea value={newCharacter.description} onChange={(e) => setNewCharacter((prev) => ({ ...prev, description: e.target.value }))} className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[100px]" /></div>
                <div><Label className="text-xs text-gray-400">头像地址（可选）</Label><Input value={newCharacter.avatar_url} onChange={(e) => setNewCharacter((prev) => ({ ...prev, avatar_url: e.target.value }))} placeholder="https://..." className="mt-1.5 bg-[#1a1a1a] border-gray-700" /></div>
                <div><Label className="text-xs text-gray-400">头像上传（可选）</Label><Input type="file" accept="image/*" onChange={(e) => setCreateCharacterFile(e.target.files?.[0] || null)} className="mt-1.5 bg-[#1a1a1a] border-gray-700" /></div>
              </>
            ) : (
              <>
                <div><Label className="text-xs text-gray-400">名称</Label><Input value={newAsset.name} onChange={(e) => setNewAsset((prev) => ({ ...prev, name: e.target.value }))} className="mt-1.5 bg-[#1a1a1a] border-gray-700" /></div>
                <div><Label className="text-xs text-gray-400">类型</Label><Input value={newAsset.type} onChange={(e) => setNewAsset((prev) => ({ ...prev, type: e.target.value }))} className="mt-1.5 bg-[#1a1a1a] border-gray-700" /></div>
                <div><Label className="text-xs text-gray-400">说明</Label><Textarea value={newAsset.meta} onChange={(e) => setNewAsset((prev) => ({ ...prev, meta: e.target.value }))} className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[100px]" /></div>
                <div><Label className="text-xs text-gray-400">资源地址（可选）</Label><Input value={newAsset.file_url} onChange={(e) => setNewAsset((prev) => ({ ...prev, file_url: e.target.value }))} placeholder="https://..." className="mt-1.5 bg-[#1a1a1a] border-gray-700" /></div>
                <div><Label className="text-xs text-gray-400">上传图片（可选）</Label><Input type="file" accept="image/*" onChange={(e) => setCreateAssetFile(e.target.files?.[0] || null)} className="mt-1.5 bg-[#1a1a1a] border-gray-700" /></div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="border-gray-600 bg-[#1a1a1a] text-gray-100 hover:bg-[#262626] hover:text-white" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button type="button" className="bg-purple-600 hover:bg-purple-700" disabled={isCreating} onClick={handleCreate}>{isCreating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />创建中</> : "确认创建"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-[#121212] border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTarget?.type === "character" ? "确认删除角色" : "确认删除场景资产"}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {deleteTarget?.type === "character"
                ? "该操作会从资产库隐藏该角色，不会删除服务器原始文件。"
                : "该操作会从资产库隐藏该资产，不会删除服务器原始文件。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-600 bg-[#1a1a1a] text-gray-100 hover:bg-[#262626] hover:text-white">取消</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={deleteActionKey === `${deleteTarget?.type}:${deleteTarget?.id}`} onClick={confirmDelete}>
              {deleteActionKey === `${deleteTarget?.type}:${deleteTarget?.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImagePreviewDialog open={!!previewImage} onOpenChange={(open) => { if (!open) setPreviewImage(null); }} src={previewImage?.src || ""} alt={previewImage?.alt || "资产预览图"} />
    </div>
  );
}
