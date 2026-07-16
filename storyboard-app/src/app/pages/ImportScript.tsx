import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { FileText, Play, ChevronRight, Film, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { UserMenu } from "../components/UserMenu";
import { projectApi } from "../api";

export default function ImportScript() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

  const handleGenerate = async () => {
    if (!projectName.trim() || !scriptText.trim()) {
      const message = "请先填写项目名称并输入剧本内容";
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    let parsingTimer: number | null = null;
    let createdProjectId: number | null = null;
    try {
      const project = await projectApi.createProject(
        {
          name: projectName,
          description: projectDescription,
        },
        { suppressToast: true },
      );

      const targetProjectId = project.id;
      createdProjectId = targetProjectId;
      window.localStorage.setItem("currentProjectId", String(targetProjectId));
      parsingTimer = window.setTimeout(() => {
        setIsParsing(true);
      }, 300);

      await projectApi.importScript(project.id, scriptText, {
        suppressToast: true,
      });
      if (parsingTimer !== null) {
        window.clearTimeout(parsingTimer);
      }
      navigate(`/asset-confirmation?project=${targetProjectId}`);
    } catch (error) {
      console.error("Failed to create project:", error);
      if (createdProjectId) {
        try {
          await projectApi.deleteProject(createdProjectId);
          window.localStorage.removeItem("currentProjectId");
        } catch (cleanupError) {
          console.error("Failed to clean up incomplete project:", cleanupError);
        }
      }
      if (parsingTimer !== null) {
        window.clearTimeout(parsingTimer);
      }
      const message = error instanceof Error ? error.message : "创建项目失败";
      setErrorMessage(message);
      toast.error(message);
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
              onClick={() => navigate("/projects")}
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
            <span className="text-gray-600">2. 确认资产</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-600">3. 生成分镜</span>
            <div className="ml-3">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {isParsing ? (
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-[0_16px_40px_rgba(168,85,247,0.28)]">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold">正在解析《{projectName || "未命名项目"}》</h2>
          <p className="mt-2 text-sm text-gray-400">
            正在创建章节、片段、镜头和按集资产需求，完成后会进入资产确认页。
          </p>
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
                <p className="text-sm text-gray-400">粘贴剧本文本，系统将自动解析剧本结构</p>
              </div>

              <div className="bg-[#141414] border border-gray-800 rounded-lg overflow-hidden">
                <div className="border-b border-gray-800 flex">
                  <div className="px-4 py-3 text-sm bg-[#1a1a1a] border-b-2 border-purple-500 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    文本导入
                  </div>
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
                          <div
                            key={scene.title}
                            className="bg-[#0a0a0a] border border-gray-800 rounded p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm">{scene.title}</span>
                              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                                {scene.shotEstimate}
                              </span>
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
                        <div className="text-2xl text-blue-400">
                          ~{Math.max(previewScenes.length * 2, 1)}
                        </div>
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
