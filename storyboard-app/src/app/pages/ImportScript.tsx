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
import styles from "./ImportScript.module.scss";

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
    <div className={`dark ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerStart}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate("/projects")}
              className={styles.backButton}
            >
              <ArrowLeft className={styles.backIcon} />
              返回项目列表
            </Button>
            <div className={styles.headerDivider}></div>
            <div className={styles.brand}>
              <div className={styles.brandIcon}>
                <Film className={styles.filmIcon} />
              </div>
              <span className={styles.brandTitle}>新建项目</span>
            </div>
          </div>
          <div className={styles.steps}>
            <span className={styles.stepActive}>1. 导入剧本</span>
            <ChevronRight className={styles.stepIcon} />
            <span className={styles.stepPending}>2. 确认资产</span>
            <ChevronRight className={styles.stepIcon} />
            <span className={styles.stepPending}>3. 生成分镜</span>
            <div className={styles.userMenu}>
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {isParsing ? (
        <div className={styles.parsingState}>
          <div className={styles.parsingIconWrap}>
            <Loader2 className={styles.parsingIcon} />
          </div>
          <h2 className={styles.parsingTitle}>正在解析《{projectName || "未命名项目"}》</h2>
          <p className={styles.parsingDescription}>
            正在创建章节、片段、镜头和按集资产需求，完成后会进入资产确认页。
          </p>
        </div>
      ) : (
        <div className={styles.main}>
          <div className={styles.projectInfo}>
            <h2 className={styles.projectInfoTitle}>项目信息</h2>
            {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
            <div className={styles.projectFields}>
              <div>
                <Label className={styles.label}>项目名称</Label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="例如：觉醒之路"
                  className={styles.input}
                />
              </div>
              <div>
                <Label className={styles.label}>项目描述（可选）</Label>
                <Input
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="简短描述项目内容"
                  className={styles.input}
                />
              </div>
            </div>
          </div>

          <div className={styles.columns}>
            <div className={styles.column}>
              <div>
                <h2 className={styles.sectionTitle}>剧本导入</h2>
                <p className={styles.sectionDescription}>粘贴剧本文本，系统将自动解析剧本结构</p>
              </div>

              <div className={styles.scriptPanel}>
                <div className={styles.scriptTabs}>
                  <div className={styles.scriptTabActive}>
                    <FileText className={styles.smallIcon} />
                    文本导入
                  </div>
                </div>

                <div className={styles.scriptBody}>
                  <Textarea
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    placeholder="请粘贴剧本内容...&#10;&#10;格式示例：&#10;场景1：都市夜晚-天台&#10;[场景描述]&#10;人物台词..."
                    className={styles.scriptTextarea}
                  />
                  <div className={styles.scriptFooter}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadExample}
                      className={styles.exampleButton}
                    >
                      加载示例剧本
                    </Button>
                    <span className={styles.characterCount}>{scriptText.length} 字符</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={loading || !projectName.trim() || !scriptText.trim()}
                className={styles.generateButton}
              >
                {loading ? (
                  <>
                    <Loader2 className={styles.generateLoadingIcon} />
                    创建项目中...
                  </>
                ) : (
                  <>
                    <Play className={styles.generateIcon} />
                    开始生成分镜草稿
                  </>
                )}
              </Button>
            </div>

            <div className={styles.column}>
              <div>
                <h2 className={styles.sectionTitle}>剧本结构预览</h2>
                <p className={styles.sectionDescription}>解析后的章节和场景结构</p>
              </div>

              <div className={styles.previewPanel}>
                {scriptText && previewScenes.length > 0 ? (
                  <div className={styles.previewContent}>
                    <div className={styles.chapter}>
                      <div className={styles.chapterTitle}>
                        <div className={styles.chapterMarker}></div>
                        第一章：觉醒
                      </div>
                      <div className={styles.sceneList}>
                        {previewScenes.map((scene) => (
                          <div key={scene.title} className={styles.sceneCard}>
                            <div className={styles.sceneHeader}>
                              <span className={styles.sceneTitle}>{scene.title}</span>
                              <span className={styles.shotEstimate}>{scene.shotEstimate}</span>
                            </div>
                            <p className={styles.sceneDescription}>{scene.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={styles.stats}>
                      <div>
                        <div className={styles.chapterStat}>1</div>
                        <div className={styles.statLabel}>章节</div>
                      </div>
                      <div>
                        <div className={styles.sceneStat}>{previewScenes.length}</div>
                        <div className={styles.statLabel}>场景</div>
                      </div>
                      <div>
                        <div className={styles.shotStat}>
                          ~{Math.max(previewScenes.length * 2, 1)}
                        </div>
                        <div className={styles.statLabel}>预估镜头</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.emptyPreview}>
                    <FileText className={styles.emptyPreviewIcon} />
                    <p className={styles.emptyPreviewTitle}>请先输入剧本内容</p>
                    <p className={styles.emptyPreviewDescription}>系统将自动解析剧本结构</p>
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
