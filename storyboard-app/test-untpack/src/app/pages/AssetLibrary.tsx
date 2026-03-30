import { useState } from "react";
import { useNavigate } from "react-router";
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
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

// 模拟数据
const mockCharacters = [
  {
    id: "char-1",
    name: "李明",
    role: "主角",
    age: "28岁",
    description: "IT公司项目经理，面临人生重大抉择，性格内敛但坚韧。",
    appearance: "中等身材，短发，常穿商务休闲装，眼神深邃。",
    tags: ["主角", "男性", "都市"],
    usageCount: 15,
  },
  {
    id: "char-2",
    name: "林婉",
    role: "女主角",
    age: "26岁",
    description: "李明的大学同学，温柔善良，独立自主的职业女性。",
    appearance: "长发，气质优雅，喜欢穿简约风格的服装。",
    tags: ["主角", "女性", "都市"],
    usageCount: 12,
  },
  {
    id: "char-3",
    name: "张总",
    role: "配角",
    age: "45岁",
    description: "公司CEO，精明强干，对李明寄予厚望。",
    appearance: "中年男性，西装革履，气场强大。",
    tags: ["配角", "男性", "商务"],
    usageCount: 6,
  },
  {
    id: "char-4",
    name: "小雨",
    role: "配角",
    age: "22岁",
    description: "公司新人，活泼开朗，对李明很崇拜。",
    appearance: "短发，年轻有活力，休闲装扮。",
    tags: ["配角", "女性", "都市"],
    usageCount: 4,
  },
];

const mockScenes = [
  {
    id: "scene-1",
    name: "都市天台",
    type: "外景",
    timeOfDay: "夜晚",
    description: "高层建筑天台，视野开阔，能看到整个城市夜景，霓虹灯闪烁。",
    atmosphere: "孤独、思考、城市感",
    tags: ["都市", "夜景", "天台"],
    usageCount: 9,
  },
  {
    id: "scene-2",
    name: "大学校园",
    type: "外景",
    timeOfDay: "白天",
    description: "春日校园，樱花盛开，学生来往，充满青春气息。",
    atmosphere: "温暖、怀旧、青春",
    tags: ["校园", "樱花", "回忆"],
    usageCount: 3,
  },
  {
    id: "scene-3",
    name: "公司会议室",
    type: "内景",
    timeOfDay: "白天",
    description: "现代化会议室，玻璃幕墙，长桌，商务氛围浓厚。",
    atmosphere: "严肃、专业、压力",
    tags: ["办公", "商务", "室内"],
    usageCount: 6,
  },
  {
    id: "scene-4",
    name: "街边咖啡厅",
    type: "内景",
    timeOfDay: "下午",
    description: "温馨的小咖啡厅，木质装修，暖黄灯光，轻松惬意。",
    atmosphere: "放松、私密、温暖",
    tags: ["咖啡厅", "都市", "室内"],
    usageCount: 4,
  },
  {
    id: "scene-5",
    name: "李明公寓",
    type: "内景",
    timeOfDay: "夜晚",
    description: "简约现代的单身公寓，落地窗外是城市夜景。",
    atmosphere: "私密、孤独、现代",
    tags: ["公寓", "居住", "室内"],
    usageCount: 7,
  },
];

export default function AssetLibrary() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("characters");
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCharacters = mockCharacters.filter(
    (char) =>
      char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      char.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredScenes = mockScenes.filter(
    (scene) =>
      scene.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scene.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-gray-100">
      {/* Top Header */}
      <header className="border-b border-gray-800 bg-[#111111] flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate("/workspace")}
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
                      {mockCharacters.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="scenes"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-purple-500 rounded-none px-4"
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    场景资产
                    <Badge className="ml-2 bg-gray-800 text-gray-400 text-xs">
                      {mockScenes.length}
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
              <ScrollArea className="h-full p-4">
                {viewMode === "grid" ? (
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
                          <Users className="w-16 h-16 text-gray-700" />
                          <div className="absolute top-3 right-3">
                            <Badge className="bg-purple-600 text-white text-xs">
                              {character.role}
                            </Badge>
                          </div>
                        </div>

                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{character.name}</h4>
                            <span className="text-xs text-gray-500">
                              {character.usageCount} 次引用
                            </span>
                          </div>

                          <p className="text-xs text-gray-400 line-clamp-2">
                            {character.description}
                          </p>

                          <div className="flex flex-wrap gap-1">
                            {character.tags.slice(0, 3).map((tag) => (
                              <Badge
                                key={tag}
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
                          <Users className="w-8 h-8 text-gray-700" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{character.name}</h4>
                            <Badge className="bg-purple-600 text-white text-xs">
                              {character.role}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {character.age}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-1">
                            {character.description}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {character.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-xs border-gray-700 text-gray-400"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="text-sm text-gray-400">{character.usageCount}</div>
                          <div className="text-xs text-gray-600">次引用</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {filteredCharacters.length === 0 && (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">暂无角色资产</p>
                      <p className="text-xs mt-1">点击右上角按钮添加新角色</p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="scenes" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full p-4">
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-3 gap-4 pb-4">
                    {filteredScenes.map((scene) => (
                      <button
                        key={scene.id}
                        onClick={() => setSelectedAsset({ type: "scene", data: scene })}
                        className={`text-left bg-[#141414] border rounded-lg overflow-hidden transition-all ${
                          selectedAsset?.data?.id === scene.id
                            ? "border-purple-500 shadow-lg shadow-purple-500/20"
                            : "border-gray-800 hover:border-gray-700"
                        }`}
                      >
                        <div className="aspect-video bg-gradient-to-br from-green-900/20 to-blue-900/20 relative flex items-center justify-center">
                          <MapPin className="w-16 h-16 text-gray-700" />
                          <div className="absolute top-3 left-3">
                            <Badge className="bg-green-600 text-white text-xs">
                              {scene.type}
                            </Badge>
                          </div>
                          <div className="absolute top-3 right-3">
                            <Badge className="bg-blue-600 text-white text-xs">
                              {scene.timeOfDay}
                            </Badge>
                          </div>
                        </div>

                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{scene.name}</h4>
                            <span className="text-xs text-gray-500">
                              {scene.usageCount} 次引用
                            </span>
                          </div>

                          <p className="text-xs text-gray-400 line-clamp-2">
                            {scene.description}
                          </p>

                          <div className="flex flex-wrap gap-1">
                            {scene.tags.slice(0, 3).map((tag) => (
                              <Badge
                                key={tag}
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
                    {filteredScenes.map((scene) => (
                      <button
                        key={scene.id}
                        onClick={() => setSelectedAsset({ type: "scene", data: scene })}
                        className={`w-full text-left bg-[#141414] border rounded-lg p-4 transition-all flex items-center gap-4 ${
                          selectedAsset?.data?.id === scene.id
                            ? "border-purple-500"
                            : "border-gray-800 hover:border-gray-700"
                        }`}
                      >
                        <div className="w-20 h-14 bg-gradient-to-br from-green-900/20 to-blue-900/20 rounded flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-8 h-8 text-gray-700" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{scene.name}</h4>
                            <Badge className="bg-green-600 text-white text-xs">
                              {scene.type}
                            </Badge>
                            <Badge className="bg-blue-600 text-white text-xs">
                              {scene.timeOfDay}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-1 mb-2">
                            {scene.description}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {scene.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-xs border-gray-700 text-gray-400"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="text-sm text-gray-400">{scene.usageCount}</div>
                          <div className="text-xs text-gray-600">次引用</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {filteredScenes.length === 0 && (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">暂无场景资产</p>
                      <p className="text-xs mt-1">点击右上角按钮添加新场景</p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </main>

        {/* Right Sidebar: Asset Details */}
        <aside className="w-96 border-l border-gray-800 bg-[#0f0f0f] flex flex-col">
          {selectedAsset ? (
            <>
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
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

              <ScrollArea className="flex-1 p-4">
                {selectedAsset.type === "character" ? (
                  <div className="space-y-4">
                    {/* Preview */}
                    <div className="aspect-square bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded border border-gray-700 flex items-center justify-center">
                      <Users className="w-24 h-24 text-gray-700" />
                    </div>

                    {/* Name */}
                    <div>
                      <Label className="text-xs text-gray-400">角色名称</Label>
                      <Input
                        value={selectedAsset.data.name}
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                      />
                    </div>

                    {/* Role & Age */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-400">角色定位</Label>
                        <Input
                          value={selectedAsset.data.role}
                          className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">年龄</Label>
                        <Input
                          value={selectedAsset.data.age}
                          className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <Label className="text-xs text-gray-400">角色描述</Label>
                      <Textarea
                        value={selectedAsset.data.description}
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[80px]"
                      />
                    </div>

                    {/* Appearance */}
                    <div>
                      <Label className="text-xs text-gray-400">外貌特征</Label>
                      <Textarea
                        value={selectedAsset.data.appearance}
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[60px]"
                      />
                    </div>

                    {/* Tags */}
                    <div>
                      <Label className="text-xs text-gray-400">标签</Label>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {selectedAsset.data.tags.map((tag: string) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="border-gray-700 text-gray-400"
                          >
                            {tag}
                            <button className="ml-1.5 hover:text-gray-300">
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs border-gray-700"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          添加
                        </Button>
                      </div>
                    </div>

                    {/* Usage */}
                    <div>
                      <Label className="text-xs text-gray-400">使用统计</Label>
                      <div className="mt-1.5 bg-[#1a1a1a] border border-gray-700 rounded p-3">
                        <div className="text-2xl text-purple-400">
                          {selectedAsset.data.usageCount}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">次引用</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Preview */}
                    <div className="aspect-video bg-gradient-to-br from-green-900/20 to-blue-900/20 rounded border border-gray-700 flex items-center justify-center">
                      <MapPin className="w-24 h-24 text-gray-700" />
                    </div>

                    {/* Name */}
                    <div>
                      <Label className="text-xs text-gray-400">场景名称</Label>
                      <Input
                        value={selectedAsset.data.name}
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                      />
                    </div>

                    {/* Type & Time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-400">场景类型</Label>
                        <Input
                          value={selectedAsset.data.type}
                          className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">时间</Label>
                        <Input
                          value={selectedAsset.data.timeOfDay}
                          className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <Label className="text-xs text-gray-400">场景描述</Label>
                      <Textarea
                        value={selectedAsset.data.description}
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[80px]"
                      />
                    </div>

                    {/* Atmosphere */}
                    <div>
                      <Label className="text-xs text-gray-400">氛围感</Label>
                      <Textarea
                        value={selectedAsset.data.atmosphere}
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[60px]"
                      />
                    </div>

                    {/* Tags */}
                    <div>
                      <Label className="text-xs text-gray-400">标签</Label>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {selectedAsset.data.tags.map((tag: string) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="border-gray-700 text-gray-400"
                          >
                            {tag}
                            <button className="ml-1.5 hover:text-gray-300">
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs border-gray-700"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          添加
                        </Button>
                      </div>
                    </div>

                    {/* Usage */}
                    <div>
                      <Label className="text-xs text-gray-400">使用统计</Label>
                      <div className="mt-1.5 bg-[#1a1a1a] border border-gray-700 rounded p-3">
                        <div className="text-2xl text-green-400">
                          {selectedAsset.data.usageCount}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">次引用</div>
                      </div>
                    </div>
                  </div>
                )}
              </ScrollArea>

              <div className="p-4 border-t border-gray-800 space-y-2">
                <Button className="w-full bg-purple-600 hover:bg-purple-700">
                  <Check className="w-4 h-4 mr-2" />
                  插入到当前镜头
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-gray-700 text-gray-400"
                >
                  保存修改
                </Button>
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
