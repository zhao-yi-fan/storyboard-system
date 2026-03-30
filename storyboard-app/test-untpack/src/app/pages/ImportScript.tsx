import { useState } from "react";
import { useNavigate } from "react-router";
import { Upload, FileText, Play, Settings2, ChevronRight, Film } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

export default function ImportScript() {
  const navigate = useNavigate();
  const [scriptText, setScriptText] = useState("");
  const [splitRule, setSplitRule] = useState("scene");

  const exampleScript = `第一章：觉醒

场景1：都市夜晚-天台
[夜晚的都市天台，霓虹灯光映照在主角脸上]
李明站在天台边缘，望着这座从未真正属于他的城市。

李明（独白）："如果能重来一次，我一定不会选择这条路。"

场景2：回忆闪回-校园
[阳光明媚的大学校园]
年轻的李明和林婉在樱花树下相遇。

林婉："你好，我叫林婉。"
李明（紧张）："我...我是李明。"

场景3：回到现实-天台
[手机铃声响起]
李明接起电话，神情凝重。

神秘声音："你的时间不多了，最后一次机会。"`;

  const handleLoadExample = () => {
    setScriptText(exampleScript);
  };

  const handleGenerate = () => {
    // 模拟生成分镜
    navigate("/workspace");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#111111]">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
              <Film className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg">漫剧分镜系统</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>导入剧本</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-600">生成分镜</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 gap-8">
          {/* Left: Import Area */}
          <div className="space-y-6">
            <div>
              <h2 className="mb-2">剧本导入</h2>
              <p className="text-sm text-gray-400">支持文本粘贴或文件上传，系统将自动解析剧本结构</p>
            </div>

            {/* Import Tabs */}
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
                  <span className="text-xs text-gray-500">
                    {scriptText.length} 字符
                  </span>
                </div>
              </div>
            </div>

            {/* Split Rules */}
            <div className="bg-[#141414] border border-gray-800 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Settings2 className="w-4 h-4 text-purple-400" />
                <span>拆分规则配置</span>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-gray-300">拆分依据</Label>
                  <Select value={splitRule} onValueChange={setSplitRule}>
                    <SelectTrigger className="mt-1.5 bg-[#0a0a0a] border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-gray-700">
                      <SelectItem value="scene">按场景拆分</SelectItem>
                      <SelectItem value="dialog">按对话拆分</SelectItem>
                      <SelectItem value="action">按动作拆分</SelectItem>
                      <SelectItem value="mixed">智能混合拆分</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm text-gray-300">镜头时长（秒）</Label>
                  <Input
                    type="number"
                    defaultValue="3-8"
                    className="mt-1.5 bg-[#0a0a0a] border-gray-700"
                  />
                </div>

                <div>
                  <Label className="text-sm text-gray-300">生成模式</Label>
                  <Select defaultValue="standard">
                    <SelectTrigger className="mt-1.5 bg-[#0a0a0a] border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-gray-700">
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
              disabled={!scriptText}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
            >
              <Play className="w-4 h-4 mr-2" />
              开始生成分镜草稿
            </Button>
          </div>

          {/* Right: Preview Area */}
          <div className="space-y-6">
            <div>
              <h2 className="mb-2">剧本结构预览</h2>
              <p className="text-sm text-gray-400">解析后的章节和场景结构</p>
            </div>

            <div className="bg-[#141414] border border-gray-800 rounded-lg p-4">
              {scriptText ? (
                <div className="space-y-4">
                  {/* Chapter */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-purple-400">
                      <div className="w-1 h-4 bg-purple-500 rounded"></div>
                      第一章：觉醒
                    </div>
                    
                    {/* Scenes */}
                    <div className="ml-4 space-y-3">
                      <div className="bg-[#0a0a0a] border border-gray-800 rounded p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">场景1：都市夜晚-天台</span>
                          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">约3镜</span>
                        </div>
                        <p className="text-xs text-gray-500">主角在天台回忆过往</p>
                      </div>

                      <div className="bg-[#0a0a0a] border border-gray-800 rounded p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">场景2：回忆闪回-校园</span>
                          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">约2镜</span>
                        </div>
                        <p className="text-xs text-gray-500">回忆中的相遇场景</p>
                      </div>

                      <div className="bg-[#0a0a0a] border border-gray-800 rounded p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">场景3：回到现实-天台</span>
                          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">约2镜</span>
                        </div>
                        <p className="text-xs text-gray-500">神秘电话打断回忆</p>
                      </div>
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="pt-4 border-t border-gray-800 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl text-purple-400">1</div>
                      <div className="text-xs text-gray-500 mt-1">章节</div>
                    </div>
                    <div>
                      <div className="text-2xl text-pink-400">3</div>
                      <div className="text-xs text-gray-500 mt-1">场景</div>
                    </div>
                    <div>
                      <div className="text-2xl text-blue-400">~7</div>
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
    </div>
  );
}
