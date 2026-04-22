import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Upload,
  FileText,
  Play,
  Settings2,
  ChevronRight,
  Film,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Layers,
  Video,
  Camera,
  Users,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { projectApi } from "../api";

type ParsingStageConfig = {
  id: string;
  label: string;
  icon: any;
  color: "purple" | "blue" | "green" | "pink";
};

type ParsingStats = {
  chapters: number;
  scenes: number;
  shots: number;
  characters: number;
};

const parsingStages: ParsingStageConfig[] = [
  { id: "analyze", label: "正在分析章节", icon: Layers, color: "purple" },
  { id: "split", label: "正在拆分场景", icon: Video, color: "blue" },
  { id: "generate", label: "正在生成分镜草稿", icon: Camera, color: "green" },
  { id: "extract", label: "正在提取角色", icon: Users, color: "pink" },
];

const colorClasses = {
  purple: {
    bg: "bg-purple-600",
    text: "text-purple-400",
    border: "border-purple-500",
    glow: "shadow-purple-500/40",
  },
  blue: {
    bg: "bg-blue-600",
    text: "text-blue-400",
    border: "border-blue-500",
    glow: "shadow-blue-500/40",
  },
  green: {
    bg: "bg-emerald-600",
    text: "text-emerald-400",
    border: "border-emerald-500",
    glow: "shadow-emerald-500/40",
  },
  pink: {
    bg: "bg-pink-600",
    text: "text-pink-400",
    border: "border-pink-500",
    glow: "shadow-pink-500/40",
  },
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ImportScript() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [splitRule, setSplitRule] = useState("scene");
  const [generationMode, setGenerationMode] = useState("standard");
  const [shotDuration, setShotDuration] = useState("3-8");
  const [loading, setLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentStage, setCurrentStage] = useState(0);
  const [parsingStats, setParsingStats] = useState<ParsingStats>({
    chapters: 0,
    scenes: 0,
    shots: 0,
    characters: 0,
  });
  const parsingTargetRef = useRef<ParsingStats | null>(null);

  const exampleScript = `第一章：觉醒

场景1：都市夜晚-天台
[夜晚的都市天台，霓虹灯光映照在主角脸上]
李明站在天台边缘，望着这座从未真正属于他的城市。

李明（独白）：“如果能重来一次，我一定不会选择这条路。”

场景2：回忆闪回-校园
[阳光明媚的大学校园]
年轻的李明和林婉在樱花树下相遇。

林婉：“你好，我叫林婉。”
李明（紧张）：“我...我是李明。”

场景3：回到现实-天台
[手机铃声响起]
李明接起电话，神情凝重。

神秘声音：“你的时间不多了，最后一次机会。”`;

  const previewScenes = useMemo(() => {
    if (!scriptText.trim()) return [];

    const sceneLines = scriptText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => /^场景\d+[:：]/.test(line))
      .slice(0, 3);

    return sceneLines.map((line, index) => ({
      title: line.replace(/^场景\d+[:：]\s*/, ""),
      shotEstimate: index === 0 ? "约3镜" : "约2镜",
      description:
        index === 0
          ? "主角在天台回忆过往"
          : index === 1
            ? "回忆中的相遇场景"
            : "关键事件推动剧情发展",
    }));
  }, [scriptText]);

  const handleLoadExample = () => {
    setScriptText(exampleScript);
    setProjectName("觉醒之路");
    setProjectDescription("一个关于人生选择与自我觉醒的都市剧情短片");
  };

  useEffect(() => {
    if (!isParsing) return;

    let cancelled = false;

    const runProgress = async () => {
      const estimatedScenes = Math.max(previewScenes.length, 1);
      const estimatedStats: ParsingStats = {
        chapters: 1,
        scenes: estimatedScenes,
        shots: Math.max(estimatedScenes * 2, 2),
        characters: Math.min(estimatedScenes + 1, 6),
      };

      const stageSnapshots: ParsingStats[] = [
        { chapters: estimatedStats.chapters, scenes: 0, shots: 0, characters: 0 },
        { chapters: estimatedStats.chapters, scenes: estimatedStats.scenes, shots: 0, characters: 0 },
        { chapters: estimatedStats.chapters, scenes: estimatedStats.scenes, shots: estimatedStats.shots, characters: 0 },
        { chapters: estimatedStats.chapters, scenes: estimatedStats.scenes, shots: estimatedStats.shots, characters: estimatedStats.characters },
      ];

      for (let index = 0; index < parsingStages.length; index += 1) {
        if (cancelled) return;
        setCurrentStage(index);
        setParsingStats(stageSnapshots[index]);
        await sleep(index === parsingStages.length - 1 ? 700 : 900);
      }
    };

    runProgress();

    return () => {
      cancelled = true;
    };
  }, [isParsing, previewScenes.length]);

  const handleGenerate = async () => {
    if (!projectName.trim() || !scriptText.trim()) {
      setErrorMessage("请先填写项目名称并输入剧本内容");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    parsingTargetRef.current = null;
    setParsingStats({ chapters: 0, scenes: 0, shots: 0, characters: 0 });
    setCurrentStage(0);
    let parsingShown = false;
    let parsingTimer: number | null = null;
    try {
      const project = await projectApi.createProject({
        name: projectName,
        description: projectDescription,
      }, { suppressToast: true });

      const targetProjectId = project.id;
      window.localStorage.setItem("currentProjectId", String(targetProjectId));
      parsingTimer = window.setTimeout(() => {
        parsingShown = true;
        setIsParsing(true);
      }, 300);

      const importResult = await projectApi.importScript(project.id, scriptText, { suppressToast: true });
      if (parsingTimer !== null) {
        window.clearTimeout(parsingTimer);
      }
      const finalStats: ParsingStats = {
        chapters: importResult.chapter_count,
        scenes: importResult.scene_count,
        shots: importResult.storyboard_count,
        characters: importResult.character_count,
      };
      parsingTargetRef.current = finalStats;
      if (parsingShown) {
        setCurrentStage(parsingStages.length - 1);
        setParsingStats(finalStats);
        await sleep(900);
      }
      navigate(`/workspace?project=${targetProjectId}`);
    } catch (error) {
      console.error("Failed to create project:", error);
      if (parsingTimer !== null) {
        window.clearTimeout(parsingTimer);
      }
      setErrorMessage(error instanceof Error ? error.message : "创建项目失败");
      setIsParsing(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen bg-[#0a0a0a] text-gray-100">
      <header className="border-b border-gray-800 bg-[#111111]">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate("/")}
              className="h-8 text-gray-400 hover:text-gray-200"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              返回项目列表
            </Button>
            <div className="h-6 w-px bg-gray-700"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-[0_8px_24px_rgba(168,85,247,0.35)]">
                <Film className="w-5 h-5 text-white" />
              </div>
              <span className="text-base">新建项目</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="text-purple-400">1. 导入剧本</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-600">2. 生成分镜</span>
          </div>
        </div>
      </header>

      {isParsing ? (
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="bg-[#141414] border border-gray-800 rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="p-8 border-b border-gray-800 bg-gradient-to-br from-purple-900/12 to-pink-900/8">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center animate-pulse shadow-[0_16px_40px_rgba(168,85,247,0.35)]">
                  <Film className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-2xl text-center font-semibold mb-2">《{projectName || "未命名项目"}》</h2>
              <p className="text-sm text-gray-400 text-center">正在创建你的分镜项目...</p>
            </div>

            <div className="p-8 space-y-4">
              {parsingStages.map((stage, index) => {
                const Icon = stage.icon;
                const isCompleted = index < currentStage;
                const isCurrent = index === currentStage;
                const colors = colorClasses[stage.color];

                return (
                  <div key={stage.id} className="relative">
                    <div
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        isCompleted
                          ? "bg-[#0f0f0f] border-gray-700"
                          : isCurrent
                            ? `bg-[#1a1a1a] ${colors.border} shadow-lg ${colors.glow}`
                            : "bg-[#0f0f0f] border-gray-800"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isCompleted ? "bg-gray-700" : isCurrent ? `${colors.bg} animate-pulse` : "bg-gray-800"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-6 h-6 text-gray-300" />
                        ) : isCurrent ? (
                          <Icon className="w-6 h-6 text-white" />
                        ) : (
                          <Icon className="w-6 h-6 text-gray-600" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div
                          className={`text-sm ${
                            isCompleted ? "text-gray-400" : isCurrent ? "text-white font-medium" : "text-gray-600"
                          }`}
                        >
                          {stage.label}
                        </div>
                        {isCurrent && (
                          <div className="flex items-center gap-2 mt-1">
                            <Loader2 className={`w-3 h-3 ${colors.text} animate-spin`} />
                            <span className={`text-xs ${colors.text}`}>处理中...</span>
                          </div>
                        )}
                        {isCompleted && <div className="text-xs text-gray-500 mt-1">已完成</div>}
                      </div>
                    </div>
                    {index < parsingStages.length - 1 && (
                      <div className={`w-px h-4 ml-6 ${index < currentStage ? "bg-gray-700" : "bg-gray-800"}`}></div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-8 pb-8">
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
                <div className="text-sm text-gray-400 mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  实时统计
                </div>
                <div className="grid grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className={`text-3xl font-bold mb-2 transition-all ${parsingStats.chapters > 0 ? "text-purple-400 scale-110" : "text-gray-700"}`}>
                      {parsingStats.chapters}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                      <Layers className="w-3 h-3" />已识别章节
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-3xl font-bold mb-2 transition-all ${parsingStats.scenes > 0 ? "text-blue-400 scale-110" : "text-gray-700"}`}>
                      {parsingStats.scenes}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                      <Video className="w-3 h-3" />已拆分场景
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-3xl font-bold mb-2 transition-all ${parsingStats.shots > 0 ? "text-emerald-400 scale-110" : "text-gray-700"}`}>
                      {parsingStats.shots}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                      <Camera className="w-3 h-3" />已生成镜头
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-3xl font-bold mb-2 transition-all ${parsingStats.characters > 0 ? "text-pink-400 scale-110" : "text-gray-700"}`}>
                      {parsingStats.characters}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                      <Users className="w-3 h-3" />已提取角色
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-8 pb-8 text-center text-xs text-gray-500">
              <p>系统正在智能解析你的剧本，这通常需要几秒钟</p>
              <p className="mt-1">解析完成后将自动跳转到分镜工作台</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8 bg-[#141414] border border-gray-800 rounded-lg p-6">
            <h2 className="text-base font-medium mb-4">项目信息</h2>
            {errorMessage && (
              <div className="mb-4 rounded-xl border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-300">项目名称</Label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="例如：觉醒之路"
                  className="mt-1.5 bg-[#0a0a0a] border-gray-700 text-gray-100"
                />
              </div>
              <div>
                <Label className="text-sm text-gray-300">项目描述（可选）</Label>
                <Input
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="简短描述项目内容"
                  className="mt-1.5 bg-[#0a0a0a] border-gray-700 text-gray-100"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h2 className="mb-2 text-[28px] font-semibold tracking-tight">剧本导入</h2>
                <p className="text-sm text-gray-400">支持文本粘贴或文件上传，系统将自动解析剧本结构</p>
              </div>

              <div className="bg-[#141414] border border-gray-800 rounded-lg overflow-hidden">
                <div className="border-b border-gray-800 flex">
                  <button className="px-4 py-3 text-sm bg-[#1a1a1a] border-b-2 border-purple-500 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    文本导入
                  </button>
                  <button className="px-4 py-3 text-sm text-gray-400 hover:text-gray-200 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    文件上传
                  </button>
                </div>

                <div className="p-4">
                  <Textarea
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    placeholder="请粘贴剧本内容...&#10;&#10;格式示例：&#10;场景1：都市夜晚-天台&#10;[场景描述]&#10;人物台词..."
                    className="min-h-[400px] bg-[#0a0a0a] border-gray-700 text-gray-100 font-mono text-sm resize-none"
                  />
                  <div className="mt-3 flex justify-between items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadExample}
                      className="text-gray-400 border-gray-700 hover:bg-gray-800"
                    >
                      加载示例剧本
                    </Button>
                    <span className="text-xs text-gray-500">{scriptText.length} 字符</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#141414] border border-gray-800 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Settings2 className="w-4 h-4 text-purple-400" />
                  <span>拆分规则配置</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-gray-300">拆分依据</Label>
                    <Select value={splitRule} onValueChange={setSplitRule}>
                      <SelectTrigger className="mt-1.5 bg-[#0a0a0a] border-gray-700 text-gray-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scene">按场景拆分</SelectItem>
                        <SelectItem value="dialog">按对话拆分</SelectItem>
                        <SelectItem value="action">按动作拆分</SelectItem>
                        <SelectItem value="mixed">智能混合拆分</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-300">默认镜头时长（秒）</Label>
                    <Input
                      value={shotDuration}
                      onChange={(e) => setShotDuration(e.target.value)}
                      className="mt-1.5 bg-[#0a0a0a] border-gray-700 text-gray-100"
                    />
                  </div>

                  <div>
                    <Label className="text-sm text-gray-300">生成模式</Label>
                    <Select value={generationMode} onValueChange={setGenerationMode}>
                      <SelectTrigger className="mt-1.5 bg-[#0a0a0a] border-gray-700 text-gray-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">标准分镜</SelectItem>
                        <SelectItem value="detailed">详细分镜</SelectItem>
                        <SelectItem value="simple">简化分镜</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={loading || !projectName.trim() || !scriptText.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    创建项目中...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    开始生成分镜草稿
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="mb-2 text-[28px] font-semibold tracking-tight">剧本结构预览</h2>
                <p className="text-sm text-gray-400">解析后的章节和场景结构</p>
              </div>

              <div className="bg-[#141414] border border-gray-800 rounded-lg p-4">
                {scriptText && previewScenes.length > 0 ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-purple-400">
                        <div className="w-1 h-4 bg-purple-500 rounded"></div>
                        第一章：觉醒
                      </div>
                      <div className="ml-4 space-y-3">
                        {previewScenes.map((scene) => (
                          <div key={scene.title} className="bg-[#0a0a0a] border border-gray-800 rounded p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">{scene.title}</span>
                              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">{scene.shotEstimate}</span>
                            </div>
                            <p className="text-xs text-gray-500">{scene.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-800 grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl text-purple-400">1</div>
                        <div className="text-xs text-gray-500 mt-1">章节</div>
                      </div>
                      <div>
                        <div className="text-2xl text-pink-400">{previewScenes.length}</div>
                        <div className="text-xs text-gray-500 mt-1">场景</div>
                      </div>
                      <div>
                        <div className="text-2xl text-blue-400">~{Math.max(previewScenes.length * 2, 1)}</div>
                        <div className="text-xs text-gray-500 mt-1">预估镜头</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">请先输入剧本内容</p>
                    <p className="text-xs mt-1">系统将自动解析剧本结构</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
