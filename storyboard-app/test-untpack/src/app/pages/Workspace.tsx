import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Film,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  MoreHorizontal,
  Play,
  Save,
  Download,
  Users,
  Package,
  Clock,
  Camera,
  MessageSquare,
  Image as ImageIcon,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";

// 模拟数据
const mockData = {
  chapters: [
    {
      id: "ch1",
      title: "第一章：觉醒",
      scenes: [
        { id: "sc1", title: "都市夜晚-天台", shotCount: 5 },
        { id: "sc2", title: "回忆闪回-校园", shotCount: 3 },
        { id: "sc3", title: "回到现实-天台", shotCount: 4 },
      ],
    },
    {
      id: "ch2",
      title: "第二章：抉择",
      scenes: [
        { id: "sc4", title: "公司会议室", shotCount: 6 },
        { id: "sc5", title: "咖啡厅对话", shotCount: 4 },
      ],
    },
  ],
  shots: [
    {
      id: "shot-1",
      shotNumber: "001",
      sceneId: "sc1",
      thumbnail: null,
      scene: "都市夜晚-天台",
      characters: ["李明"],
      description: "夜晚的都市天台全景，霓虹灯光从远处的摩天大楼映射过来，天台空旷寂寥。",
      dialogue: "",
      duration: "5s",
      shotType: "全景",
      cameraAngle: "平视",
      emotion: "孤独",
      notes: "",
    },
    {
      id: "shot-2",
      shotNumber: "002",
      sceneId: "sc1",
      thumbnail: null,
      scene: "都市夜晚-天台",
      characters: ["李明"],
      description: "李明中景，背对镜头站在天台边缘，衣角被夜风吹动，城市灯光在他身后闪烁。",
      dialogue: "",
      duration: "4s",
      shotType: "中景",
      cameraAngle: "平视",
      emotion: "沉思",
      notes: "",
    },
    {
      id: "shot-3",
      shotNumber: "003",
      sceneId: "sc1",
      thumbnail: null,
      scene: "都市夜晚-天台",
      characters: ["李明"],
      description: "李明特写，侧脸，霓虹灯光映在脸上，表情复杂，眼神空洞望向远方。",
      dialogue: "如果能重来一次，我一定不会选择这条路。",
      duration: "6s",
      shotType: "特写",
      cameraAngle: "侧面",
      emotion: "悔恨",
      notes: "重点刻画人物情绪",
    },
    {
      id: "shot-4",
      shotNumber: "004",
      sceneId: "sc1",
      thumbnail: null,
      scene: "都市夜晚-天台",
      characters: ["李明"],
      description: "俯视视角，李明站在天台边缘，显得更加渺小孤独，城市灯光如星海。",
      dialogue: "",
      duration: "4s",
      shotType: "全景",
      cameraAngle: "俯视",
      emotion: "渺小",
      notes: "",
    },
    {
      id: "shot-5",
      shotNumber: "005",
      sceneId: "sc1",
      thumbnail: null,
      scene: "都市夜晚-天台",
      characters: ["李明"],
      description: "李明手部特写，手指颤抖地掏出手机，屏幕亮起。",
      dialogue: "",
      duration: "3s",
      shotType: "特写",
      cameraAngle: "特写",
      emotion: "紧张",
      notes: "",
    },
    {
      id: "shot-6",
      shotNumber: "006",
      sceneId: "sc2",
      thumbnail: null,
      scene: "回忆闪回-校园",
      characters: ["李明", "林婉"],
      description: "阳光明媚的大学校园，樱花树下，暖色调的回忆画面。",
      dialogue: "",
      duration: "4s",
      shotType: "全景",
      cameraAngle: "平视",
      emotion: "温暖",
      notes: "使用暖色滤镜",
    },
    {
      id: "shot-7",
      shotNumber: "007",
      sceneId: "sc2",
      thumbnail: null,
      scene: "回忆闪回-校园",
      characters: ["林婉"],
      description: "林婉中景，阳光下微笑，樱花瓣飘落，青春洋溢。",
      dialogue: "你好，我叫林婉。",
      duration: "5s",
      shotType: "中景",
      cameraAngle: "平视",
      emotion: "温柔",
      notes: "",
    },
    {
      id: "shot-8",
      shotNumber: "008",
      sceneId: "sc2",
      thumbnail: null,
      scene: "回忆闪回-校园",
      characters: ["李明"],
      description: "年轻的李明特写，有些紧张但眼神清澈，樱花树下的光影映在脸上。",
      dialogue: "我...我是李明。",
      duration: "4s",
      shotType: "特写",
      cameraAngle: "平视",
      emotion: "紧张",
      notes: "表现年轻时的青涩",
    },
  ],
};

export default function Workspace() {
  const navigate = useNavigate();
  const [selectedShot, setSelectedShot] = useState(mockData.shots[2]);
  const [expandedChapters, setExpandedChapters] = useState(["ch1"]);
  const [selectedScene, setSelectedScene] = useState("sc1");
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) =>
      prev.includes(chapterId)
        ? prev.filter((id) => id !== chapterId)
        : [...prev, chapterId]
    );
  };

  const filteredShots = mockData.shots.filter(
    (shot) => shot.sceneId === selectedScene
  );

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-gray-100">
      {/* Top Toolbar */}
      <header className="border-b border-gray-800 bg-[#111111] flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-600 rounded flex items-center justify-center">
                <Film className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm">《觉醒之路》分镜工作台</span>
            </div>

            <div className="h-6 w-px bg-gray-700"></div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-gray-400 hover:text-gray-200"
              >
                <Save className="w-4 h-4 mr-1.5" />
                保存
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-gray-400 hover:text-gray-200"
                onClick={() => navigate("/assets")}
              >
                <Package className="w-4 h-4 mr-1.5" />
                资产库
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-gray-400 hover:text-gray-200"
              >
                <Download className="w-4 h-4 mr-1.5" />
                导出
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500">
              共 {mockData.shots.length} 个镜头 · 预计时长 36s
            </div>
            <Button
              size="sm"
              className="h-8 bg-purple-600 hover:bg-purple-700"
              onClick={() => {
                setIsGenerating(true);
                setTimeout(() => setIsGenerating(false), 2000);
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  AI 优化
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Scene Tree */}
        <aside className="w-64 border-r border-gray-800 bg-[#0f0f0f] flex flex-col">
          <div className="p-3 border-b border-gray-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="搜索场景..."
                className="pl-9 h-8 bg-[#1a1a1a] border-gray-700 text-sm"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {mockData.chapters.map((chapter) => (
                <div key={chapter.id}>
                  <button
                    onClick={() => toggleChapter(chapter.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-[#1a1a1a] rounded"
                  >
                    {expandedChapters.includes(chapter.id) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <Film className="w-4 h-4 text-purple-400" />
                    <span className="flex-1 text-left">{chapter.title}</span>
                  </button>

                  {expandedChapters.includes(chapter.id) && (
                    <div className="ml-6 mt-1 space-y-0.5">
                      {chapter.scenes.map((scene) => (
                        <button
                          key={scene.id}
                          onClick={() => setSelectedScene(scene.id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded ${
                            selectedScene === scene.id
                              ? "bg-purple-600/20 text-purple-300"
                              : "hover:bg-[#1a1a1a] text-gray-300"
                          }`}
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span className="flex-1 text-left truncate">
                            {scene.title}
                          </span>
                          <span className="text-xs text-gray-500">
                            {scene.shotCount}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-gray-800">
            <Button size="sm" variant="outline" className="w-full h-8 border-gray-700 text-gray-400">
              <Plus className="w-4 h-4 mr-1.5" />
              新建场景
            </Button>
          </div>
        </aside>

        {/* Center: Shot Cards */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-[#0f0f0f]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm">
                {mockData.chapters[0].scenes.find((s) => s.id === selectedScene)?.title}
              </h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  插入镜头
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="grid grid-cols-2 gap-4 pb-4">
              {filteredShots.map((shot) => (
                <button
                  key={shot.id}
                  onClick={() => setSelectedShot(shot)}
                  className={`text-left bg-[#141414] border rounded-lg overflow-hidden transition-all ${
                    selectedShot?.id === shot.id
                      ? "border-purple-500 shadow-lg shadow-purple-500/20"
                      : "border-gray-800 hover:border-gray-700"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-gray-700" />
                    </div>
                    <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded text-xs font-mono">
                      {shot.shotNumber}
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Badge className="bg-purple-600/90 text-white text-xs px-1.5 py-0">
                        {shot.shotType}
                      </Badge>
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {shot.duration}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                        {shot.scene}
                      </Badge>
                      {shot.characters.map((char) => (
                        <Badge
                          key={char}
                          variant="outline"
                          className="text-xs border-blue-800 text-blue-400"
                        >
                          <Users className="w-3 h-3 mr-1" />
                          {char}
                        </Badge>
                      ))}
                    </div>

                    <p className="text-xs text-gray-400 line-clamp-2">
                      {shot.description}
                    </p>

                    {shot.dialogue && (
                      <div className="flex items-start gap-1.5 text-xs text-gray-500">
                        <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <p className="line-clamp-1">{shot.dialogue}</p>
                      </div>
                    )}

                    {shot.emotion && (
                      <div className="flex items-center gap-1">
                        <Badge className="text-xs bg-pink-600/20 text-pink-400 border-0">
                          {shot.emotion}
                        </Badge>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {filteredShots.length === 0 && (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">暂无镜头</p>
                  <p className="text-xs mt-1">点击上方按钮添加新镜头</p>
                </div>
              </div>
            )}
          </ScrollArea>
        </main>

        {/* Right Sidebar: Shot Details */}
        <aside className="w-96 border-l border-gray-800 bg-[#0f0f0f] flex flex-col">
          {selectedShot ? (
            <>
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-sm">镜头详情</h3>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {/* Shot Number */}
                  <div>
                    <Label className="text-xs text-gray-400">镜头编号</Label>
                    <Input
                      value={selectedShot.shotNumber}
                      className="mt-1.5 bg-[#1a1a1a] border-gray-700 font-mono"
                      readOnly
                    />
                  </div>

                  {/* Preview */}
                  <div>
                    <Label className="text-xs text-gray-400">预览图</Label>
                    <div className="mt-1.5 aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded border border-gray-700 flex items-center justify-center">
                      <ImageIcon className="w-16 h-16 text-gray-700" />
                    </div>
                  </div>

                  {/* Scene */}
                  <div>
                    <Label className="text-xs text-gray-400">所属场景</Label>
                    <Input
                      value={selectedShot.scene}
                      className="mt-1.5 bg-[#1a1a1a] border-gray-700"
                    />
                  </div>

                  {/* Characters */}
                  <div>
                    <Label className="text-xs text-gray-400">角色</Label>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {selectedShot.characters.map((char) => (
                        <Badge
                          key={char}
                          variant="outline"
                          className="border-blue-700 text-blue-400"
                        >
                          {char}
                          <button className="ml-1.5 hover:text-blue-300">
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

                  {/* Description */}
                  <div>
                    <Label className="text-xs text-gray-400">画面描述</Label>
                    <Textarea
                      value={selectedShot.description}
                      className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[100px]"
                    />
                  </div>

                  {/* Dialogue */}
                  <div>
                    <Label className="text-xs text-gray-400">台词</Label>
                    <Textarea
                      value={selectedShot.dialogue}
                      placeholder="无台词"
                      className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[60px]"
                    />
                  </div>

                  {/* Shot Type */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-400">景别</Label>
                      <Select value={selectedShot.shotType}>
                        <SelectTrigger className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-gray-700">
                          <SelectItem value="远景">远景</SelectItem>
                          <SelectItem value="全景">全景</SelectItem>
                          <SelectItem value="中景">中景</SelectItem>
                          <SelectItem value="近景">近景</SelectItem>
                          <SelectItem value="特写">特写</SelectItem>
                          <SelectItem value="大特写">大特写</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs text-gray-400">机位</Label>
                      <Select value={selectedShot.cameraAngle}>
                        <SelectTrigger className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-gray-700">
                          <SelectItem value="平视">平视</SelectItem>
                          <SelectItem value="俯视">俯视</SelectItem>
                          <SelectItem value="仰视">仰视</SelectItem>
                          <SelectItem value="侧面">侧面</SelectItem>
                          <SelectItem value="特写">特写</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Duration & Emotion */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-400">时长</Label>
                      <Input
                        value={selectedShot.duration}
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-gray-400">情绪</Label>
                      <Input
                        value={selectedShot.emotion}
                        className="mt-1.5 bg-[#1a1a1a] border-gray-700 h-9"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label className="text-xs text-gray-400">备注</Label>
                    <Textarea
                      value={selectedShot.notes}
                      placeholder="添加备注..."
                      className="mt-1.5 bg-[#1a1a1a] border-gray-700 min-h-[60px]"
                    />
                  </div>
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-gray-800 flex gap-2">
                <Button className="flex-1 bg-purple-600 hover:bg-purple-700">
                  保存修改
                </Button>
                <Button variant="outline" className="border-gray-700">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">请选择一个镜头</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
