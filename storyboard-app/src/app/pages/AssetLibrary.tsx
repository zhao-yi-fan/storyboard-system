import { useState, useEffect } from "react";
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
  Filter,
  Grid3x3,
  List,
  Upload,
  Trash2,
  Save,
  Loader2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  characterApi,
  assetApi,
  apiClient,
  type Character,
  type Asset,
} from "../api";

export default function AssetLibrary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentProjectId = Number(searchParams.get("project") || window.localStorage.getItem("currentProjectId") || "0");
  const [activeTab, setActiveTab] = useState("characters");
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCharacter, setNewCharacter] = useState({
    name: "",
    description: "",
    avatar_url: "",
  });

  useEffect(() => {
    if (activeTab === "characters") {
      loadCharacters();
    } else {
      loadAssets();
    }
  }, [activeTab, currentProjectId]);

  const loadCharacters = async () => {
    setLoading(true);
    try {
      if (!currentProjectId) {
        setCharacters([]);
        return;
      }
      const data = await characterApi.getCharactersByProject(currentProjectId);
      setCharacters(data);
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
      setAssets(data);
    } catch (error) {
      console.error("Failed to load assets:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get OSS signature and upload file
  const handleFileUpload = async (file: File): Promise<string> => {
    // 1. Get signature from backend
    const ext = file.name.split(".").pop();
    const fileName = `assets/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const signature = await apiClient.get<{
      upload_url: string;
      public_url: string;
      object_key: string;
    }>(`/oss/sign?filename=${fileName}&content_type=${encodeURIComponent(file.type)}`);

    // 2. Upload directly to OSS
    await fetch(signature.upload_url, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });

    return signature.public_url;
  };

  const createCharacter = async () => {
    if (!newCharacter.name.trim()) return;

    try {
      await characterApi.createCharacter(currentProjectId, newCharacter);
      setNewCharacter({ name: "", description: "", avatar_url: "" });
      setShowCreateDialog(false);
      loadCharacters();
    } catch (error) {
      console.error("Failed to create character:", error);
    }
  };

  const deleteAsset = async (id: number) => {
    try {
      await assetApi.deleteAsset(id);
      loadAssets();
      setSelectedAsset(null);
    } catch (error) {
      console.error("Failed to delete asset:", error);
    }
  };

  const deleteCharacter = async (id: number) => {
    try {
      await characterApi.deleteCharacter(id);
      loadCharacters();
      setSelectedAsset(null);
    } catch (error) {
      console.error("Failed to delete character:", error);
    }
  };

  const filteredCharacters = characters.filter(
    (char) =>
      char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      char.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAssets = assets.filter(
    (asset) =>
      asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const deriveAssetSecondaryTag = (asset: Asset) => {
    const type = asset.type?.trim();
    return type || "资源";
  };

  const deriveAssetDescription = (asset: Asset) => {
    return asset.meta?.trim() || `${asset.name} 资源文件`;
  };

  const deriveAssetTags = (asset: Asset) => {
    const tags = [deriveAssetPrimaryTag(asset)];
    if (asset.type) tags.push(asset.type);
    return Array.from(new Set(tags.filter(Boolean))).slice(0, 3);
  };

  return (
    <div className="dark h-screen flex flex-col bg-[#0a0a0a] text-gray-100">
      <header className="border-b border-gray-800 bg-[#111111] flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate("/")}
              className="h-8 text-gray-400 hover:text-gray-200"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              项目列表
            </Button>
            <div className="h-6 w-px bg-gray-700"></div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate(currentProjectId ? `/workspace?project=${currentProjectId}` : "/workspace")}
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
              <span className="text-sm">资产库</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-8 bg-purple-600 hover:bg-purple-700"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              新建资产
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
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
                    value="assets"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-purple-500 rounded-none px-4"
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    场景资产
                    <Badge className="ml-2 bg-gray-800 text-gray-400 text-xs">
                      {assets.length}
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
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                  >
                    <Filter className="w-4 h-4" />
                  </Button>
                  <div className="flex bg-[#1a1a1a] rounded border border-gray-700">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-8 w-8 p-0 rounded-none ${
                        viewMode === "grid" ? "bg-gray-800" : ""
                      }`}
                      onClick={() => setViewMode("grid")}
                    >
                      <Grid3x3 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-8 w-8 p-0 rounded-none ${
                        viewMode === "list" ? "bg-gray-800" : ""
                      }`}
                      onClick={() => setViewMode("list")}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <TabsContent value="characters" className="flex-1 m-0 overflow-hidden">
              <div className="h-full overflow-y-auto p-4">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin opacity-30" />
                      <p className="text-sm">加载中...</p>
                    </div>
                  </div>
                ) : filteredCharacters.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">暂无角色资产</p>
                      <p className="text-xs mt-1">点击右上角按钮添加新角色</p>
                    </div>
                  </div>
                ) : viewMode === "grid" ? (
                  <div className="grid grid-cols-3 gap-4 pb-4">
                    {filteredCharacters.map((character) => (
                      <button
                        key={character.id}
                        onClick={() => setSelectedAsset({ type: "character", data: character })}
                        className={`text-left bg-[#141414] border rounded-lg overflow-hidden transition-all ${
                          selectedAsset?.data?.id === character.id
                            ? "border-purple-500 shadow-lg shadow-purple-500/20"
                            : "border-gray-800 hover:border-gray-700"
                        }`}
                      >
                        <div className="aspect-square bg-gradient-to-br from-blue-900/20 to-purple-900/20 relative flex items-center justify-center">
                          {character.avatar_url ? (
                            <img
                              src={character.avatar_url}
                              alt={character.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Users className="w-16 h-16 text-gray-700" />
                          )}
                          <div className="absolute top-3 right-3">
                            <Badge className="bg-purple-600 text-white text-xs">
                              角色
                            </Badge>
                          </div>
                        </div>

                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{character.name}</h4>
                            <span className="text-xs text-gray-500">
                              {/* TODO: usage count */}
                            </span>
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
                        className={`w-full text-left bg-[#141414] border rounded-lg p-4 transition-all flex items-center gap-4 ${
                          selectedAsset?.data?.id === character.id
                            ? "border-purple-500"
                            : "border-gray-800 hover:border-gray-700"
                        }`}
                      >
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded flex items-center justify-center flex-shrink-0">
                          {character.avatar_url ? (
                            <img
                              src={character.avatar_url}
                              alt={character.name}
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <Users className="w-8 h-8 text-gray-700" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{character.name}</h4>
                            <Badge className="bg-purple-600 text-white text-xs">
                              角色
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-1">
                            {character.description}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          {/* <div className="text-sm text-gray-400">{character.usageCount}</div> */}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="assets" className="flex-1 m-0 overflow-hidden">
              <div className="h-full overflow-y-auto p-4">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin opacity-30" />
                      <p className="text-sm">加载中...</p>
                    </div>
                  </div>
                ) : filteredAssets.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">暂无场景资产</p>
                      <p className="text-xs mt-1">点击右上角按钮添加新资产</p>
                    </div>
                  </div>
                ) : viewMode === "grid" ? (
                  <div className="grid grid-cols-3 gap-4 pb-4">
                    {filteredAssets.map((asset) => (
                      <button
                        key={asset.id}
                        onClick={() => setSelectedAsset({ type: "asset", data: asset })}
                        className={`text-left bg-[#141414] border rounded-lg overflow-hidden transition-all ${
                          selectedAsset?.data?.id === asset.id
                            ? "border-purple-500 shadow-lg shadow-purple-500/20"
                            : "border-gray-800 hover:border-gray-700"
                        }`}
                      >
                        <div className="aspect-video bg-gradient-to-br from-green-900/20 to-blue-900/20 relative flex items-center justify-center">
                          <img
                            src={asset.file_url}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
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
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{asset.name}</h4>
                            <span className="text-xs text-gray-500">
                              {/* TODO: usage count */}
                            </span>
                          </div>

                          <p className="text-xs text-gray-400 line-clamp-2">
                            {deriveAssetDescription(asset)}
                          </p>

                          <div className="flex flex-wrap gap-1">
                            {deriveAssetTags(asset).map((tag) => (
                              <Badge
                                key={`${asset.id}-${tag}`}
                                variant="outline"
                                className="text-xs border-gray-700 text-gray-400"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 pb-4">
                    {filteredAssets.map((asset) => (
                      <button
                        key={asset.id}
                        onClick={() => setSelectedAsset({ type: "asset", data: asset })}
                        className={`w-full text-left bg-[#141414] border rounded-lg p-4 transition-all flex items-center gap-4 ${
                          selectedAsset?.data?.id === asset.id
                            ? "border-purple-500"
                            : "border-gray-800 hover:border-gray-700"
                        }`}
                      >
                        <div className="w-20 h-14 bg-gradient-to-br from-green-900/20 to-blue-900/20 rounded flex items-center justify-center flex-shrink-0">
                          <img
                            src={asset.file_url}
                            alt={asset.name}
                            className="w-full h-full object-cover rounded"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{asset.name}</h4>
                          <Badge className="bg-green-600 text-white text-xs">
                            {deriveAssetPrimaryTag(asset)}
                          </Badge>
                          <Badge className="bg-blue-600 text-white text-xs">
                            {deriveAssetSecondaryTag(asset)}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-400 line-clamp-1 mb-2">
                          {deriveAssetDescription(asset)}
                        </p>

                        <div className="flex flex-wrap gap-1">
                          {deriveAssetTags(asset).map((tag) => (
                            <Badge
                              key={`${asset.id}-${tag}`}
                              variant="outline"
                              className="text-xs border-gray-700 text-gray-400"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>

                        <div className="text-right flex-shrink-0">
                          {/* <div className="text-sm text-gray-400">{asset.usageCount}</div> */}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>

        {/* Right Sidebar: Asset Details */}
        <aside className="w-96 border-l border-gray-800 bg-[#0f0f0f] flex flex-col">
          {selectedAsset ? (
            <>
              <div className="p-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
                <h3 className="text-sm">
                  {selectedAsset.type === "character" ? "角色详情" : "场景详情"}
                </h3>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
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
                    {/* Preview */}
                    <div className="aspect-square bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded border border-gray-700 flex items-center justify-center">
                      {selectedAsset.data.avatar_url ? (
                        <img
                          src={selectedAsset.data.avatar_url}
                          alt={selectedAsset.data.name}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <Users className="w-24 h-24 text-gray-700" />
                      )}
                    </div>

                    {/* Name */}
                    <div>
                      <Label className="text-xs text-gray-400">角色名称</Label>
                      <Input
                        value={selectedAsset.data.name}
                        onChange={(e) =>
                          setSelectedAsset({
                            ...selectedAsset,
                            data: { ...selectedAsset.data, name: e.target.value },
                          })
                        }
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <Label className="text-xs text-gray-400">角色描述</Label>
                      <Textarea
                        value={selectedAsset.data.description || ""}
                        onChange={(e) =>
                          setSelectedAsset({
                            ...selectedAsset,
                            data: { ...selectedAsset.data, description: e.target.value },
                          })
                        }
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[80px]"
                      />
                    </div>

                    <div className="pt-4 border-t border-gray-800">
                      <Button
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        onClick={() => {
                          // TODO: update
                          alert("保存功能开发中");
                        }}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        保存修改
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full mt-2 border-red-800 text-red-400 hover:bg-red-900/20"
                        onClick={() => deleteCharacter(selectedAsset.data.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        删除角色
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Preview */}
                    <div className="aspect-video bg-gradient-to-br from-green-900/20 to-blue-900/20 rounded border border-gray-700 flex items-center justify-center">
                      <img
                        src={selectedAsset.data.file_url}
                        alt={selectedAsset.data.name}
                        className="w-full h-full object-cover rounded"
                      />
                    </div>

                    {/* Name */}
                    <div>
                      <Label className="text-xs text-gray-400">场景名称</Label>
                      <Input
                        value={selectedAsset.data.name}
                        onChange={(e) =>
                          setSelectedAsset({
                            ...selectedAsset,
                            data: { ...selectedAsset.data, name: e.target.value },
                          })
                        }
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-400">资源类型</Label>
                        <Input
                          value={deriveAssetPrimaryTag(selectedAsset.data)}
                          className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9"
                          readOnly
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">资源分类</Label>
                        <Input
                          value={deriveAssetSecondaryTag(selectedAsset.data)}
                          className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9"
                          readOnly
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-gray-400">场景描述</Label>
                      <Textarea
                        value={deriveAssetDescription(selectedAsset.data)}
                        onChange={(e) =>
                          setSelectedAsset({
                            ...selectedAsset,
                            data: { ...selectedAsset.data, meta: e.target.value },
                          })
                        }
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[88px]"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-gray-400">资源地址</Label>
                      <Textarea
                        value={selectedAsset.data.file_url}
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[60px]"
                        readOnly
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-gray-400">标签</Label>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {deriveAssetTags(selectedAsset.data).map((tag) => (
                          <Badge
                            key={`selected-${tag}`}
                            variant="outline"
                            className="border-gray-700 text-gray-400"
                          >
                            {tag}
                            <button className="ml-1.5 hover:text-gray-300">
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-800">
                      <Button
                        variant="outline"
                        className="w-full border-gray-700 text-gray-300 hover:bg-gray-900"
                        onClick={() =>
                          navigate(currentProjectId ? `/workspace?project=${currentProjectId}` : "/workspace")
                        }
                      >
                        <Check className="w-4 h-4 mr-2" />
                        插入到当前镜头
                      </Button>
                      <Button
                        className="w-full mt-2 bg-purple-600 hover:bg-purple-700"
                        onClick={() => {
                          // TODO: update
                          alert("保存功能开发中");
                        }}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        保存修改
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full mt-2 border-red-800 text-red-400 hover:bg-red-900/20"
                        onClick={() => deleteAsset(selectedAsset.data.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        删除资产
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center px-8">
                <div className="w-16 h-16 mx-auto mb-3 bg-gray-800 rounded-full flex items-center justify-center">
                  {activeTab === "characters" ? (
                    <Users className="w-8 h-8 text-gray-600" />
                  ) : (
                    <MapPin className="w-8 h-8 text-gray-600" />
                  )}
                </div>
                <p className="text-sm">请选择一个资产</p>
                <p className="text-xs mt-1 text-gray-600">
                  查看详情并插入到镜头中
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
