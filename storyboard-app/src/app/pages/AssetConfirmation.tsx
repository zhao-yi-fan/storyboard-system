import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Image, Library, Loader2, RefreshCw, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  assetWorkspaceApi,
  chapterApi,
  projectApi,
  type AssetRequirement,
  type AssetVersion,
  type Chapter,
  type PersonalAsset,
  type Project,
} from "../api";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import styles from "./AssetConfirmation.module.scss";

const KIND_LABELS = { character: "角色", scene: "场景", prop: "道具" } as const;
const KIND_TABS = [
  { value: "character", label: "人物" },
  { value: "scene", label: "场景" },
  { value: "prop", label: "道具" },
] as const;
type RequirementKind = (typeof KIND_TABS)[number]["value"];
const STATUS_LABELS = {
  pending: "待生成",
  generating: "生成中",
  generated: "可用",
  confirmed: "可用",
  failed: "生成失败",
} as const;

function RequirementCard({
  item,
  busy,
  onGenerate,
  onImport,
  onSave,
  onVersions,
  onComplete,
}: {
  item: AssetRequirement;
  busy: boolean;
  onGenerate: () => void;
  onImport: () => void;
  onSave: () => void;
  onVersions: () => void;
  onComplete: () => void;
}) {
  const imageUrl = item.file_url || item.preview_url;
  return (
    <article className={styles.requirementCard}>
      <div className={styles.requirementPreview}>
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} className={styles.image} loading="lazy" />
        ) : (
          <div className={styles.imagePlaceholder}>
            <Image className={styles.placeholderIcon} />
          </div>
        )}
        <span className={styles.kindBadge}>{KIND_LABELS[item.kind]}</span>
        <span className={styles.statusBadge}>{STATUS_LABELS[item.status]}</span>
      </div>
      <div className={styles.cardContent}>
        <h3 className={styles.requirementName}>{item.name}</h3>
        <p className={styles.requirementDescription}>{item.description || "暂无补充描述"}</p>
        {item.error_message ? (
          <p className={styles.requirementError}>{item.error_message}</p>
        ) : null}
        {item.blocking_reason ? (
          <p className={styles.blockingReason}>{item.blocking_reason}</p>
        ) : null}
        <div className={styles.cardActions}>
          <Button
            size="sm"
            disabled={busy}
            onClick={item.can_generate === false ? onComplete : onGenerate}
            className={styles.primaryButton}
          >
            {busy ? (
              <Loader2 className={styles.smallLoadingIcon} />
            ) : (
              <Sparkles className={styles.smallIcon} />
            )}
            {item.can_generate === false ? "完善参考素材" : imageUrl ? "再生成" : "Seedream 生成"}
          </Button>
          <Button size="sm" variant="outline" onClick={onImport}>
            <Library className={styles.smallIcon} />
            个人空间
          </Button>
          {imageUrl ? (
            <Button size="sm" variant="ghost" onClick={onVersions}>
              版本
            </Button>
          ) : null}
          {imageUrl ? (
            <Button size="sm" variant="ghost" onClick={onSave}>
              <Save className={styles.smallIcon} />
              保存复用
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function AssetConfirmation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = Number(searchParams.get("project") || 0);
  const [project, setProject] = useState<Project | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState<number | undefined>();
  const [activeKind, setActiveKind] = useState<RequirementKind>("character");
  const [requirements, setRequirements] = useState<AssetRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | "batch" | null>(null);
  const [importTarget, setImportTarget] = useState<AssetRequirement | null>(null);
  const [personalAssets, setPersonalAssets] = useState<PersonalAsset[]>([]);
  const [versionTarget, setVersionTarget] = useState<AssetRequirement | null>(null);
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const filteredRequirements = requirements.filter((item) => item.kind === activeKind);
  const readyCount = requirements.filter(
    (item) =>
      (item.status === "pending" || item.status === "failed") && item.can_generate !== false,
  ).length;
  const blockedCount = requirements.filter(
    (item) =>
      (item.status === "pending" || item.status === "failed") && item.can_generate === false,
  ).length;

  const loadRequirements = async (selectedChapterId = chapterId) => {
    setRequirements(await assetWorkspaceApi.getRequirements(projectId, selectedChapterId));
  };

  useEffect(() => {
    if (!projectId) {
      navigate("/projects", { replace: true });
      return;
    }
    Promise.all([projectApi.getProject(projectId), chapterApi.getChaptersByProject(projectId)])
      .then(async ([projectData, chapterData]) => {
        setProject(projectData);
        setChapters(chapterData);
        const firstId = chapterData[0]?.id;
        setChapterId(firstId);
        setRequirements(await assetWorkspaceApi.getRequirements(projectId, firstId));
      })
      .finally(() => setLoading(false));
  }, [navigate, projectId]);

  const selectChapter = async (id?: number) => {
    setChapterId(id);
    setLoading(true);
    try {
      await loadRequirements(id);
    } finally {
      setLoading(false);
    }
  };

  const generate = async (requirementId?: number) => {
    setBusyId(requirementId || "batch");
    try {
      const result = await assetWorkspaceApi.generateRequirements(projectId, {
        chapter_id: chapterId,
        requirement_id: requirementId,
      });
      const failedItems = result.filter((item) => item.status === "failed");
      const blockedItems = result.filter((item) => item.status === "blocked");
      if (failedItems.length) {
        const firstError = failedItems.find((item) => item.error)?.error;
        toast.error(
          requirementId && firstError ? firstError : `${failedItems.length} 项生成失败，可单独重试`,
          firstError && !requirementId ? { description: firstError } : undefined,
        );
      } else if (blockedItems.length) {
        toast.info(`${blockedItems.length} 项需要先补充参考素材`);
      } else {
        toast.success("Seedream 生成完成");
      }
      await loadRequirements();
    } finally {
      setBusyId(null);
    }
  };

  const openPersonal = async (item: AssetRequirement) => {
    setImportTarget(item);
    setPersonalAssets(await assetWorkspaceApi.getPersonalAssets(item.kind));
  };

  const importPersonal = async (personal: PersonalAsset) => {
    if (!importTarget) return;
    await assetWorkspaceApi.importPersonalAsset(personal.id, {
      project_id: projectId,
      requirement_id: importTarget.id,
    });
    toast.success("已导入项目快照");
    setImportTarget(null);
    await loadRequirements();
  };

  const openVersions = async (item: AssetRequirement) => {
    if (!item.linked_entity_type || !item.linked_entity_id) return;
    setVersionTarget(item);
    setVersions(
      await assetWorkspaceApi.getVersions(item.linked_entity_type, item.linked_entity_id),
    );
  };

  const chooseVersion = async (version: AssetVersion) => {
    if (!versionTarget?.linked_entity_type || !versionTarget.linked_entity_id) return;
    setVersions(
      await assetWorkspaceApi.setCurrentVersion(
        versionTarget.linked_entity_type,
        versionTarget.linked_entity_id,
        version.id,
      ),
    );
    await loadRequirements();
  };

  const saveToPersonal = async (item: AssetRequirement) => {
    if (!item.linked_entity_id || !item.linked_entity_type) return;
    if (item.linked_entity_type === "character")
      await assetWorkspaceApi.saveCharacterToPersonal(item.linked_entity_id);
    else await assetWorkspaceApi.saveAssetToPersonal(item.linked_entity_id);
    toast.success("已保存到个人空间");
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerStart}>
          <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
            <ArrowLeft className={styles.icon} />
          </Button>
          <div>
            <h1 className={styles.title}>{project?.name || "项目"} · 资产准备</h1>
            <p className={styles.subtitle}>按集整理人物、场景和道具，已有图片可直接使用</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="ghost" onClick={() => navigate(`/assets?project=${projectId}`)}>
            项目资产编辑
          </Button>
          <Button variant="outline" onClick={() => navigate(`/workspace?project=${projectId}`)}>
            进入分镜工作台
          </Button>
          <Button
            disabled={busyId !== null || readyCount === 0}
            onClick={() => generate()}
            className={styles.primaryButton}
          >
            {busyId === "batch" ? (
              <Loader2 className={styles.loadingIcon} />
            ) : (
              <Sparkles className={styles.icon} />
            )}
            {readyCount
              ? `生成可用资产 (${readyCount})`
              : blockedCount
                ? `${blockedCount} 项待补素材`
                : "本集资产已齐"}
          </Button>
        </div>
      </header>
      <main className={styles.main}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>按集查看</div>
          <button
            onClick={() => selectChapter(undefined)}
            className={chapterId == null ? styles.chapterActive : styles.chapterButton}
          >
            全部资产
          </button>
          {chapters.map((chapter, index) => (
            <button
              key={chapter.id}
              onClick={() => selectChapter(chapter.id)}
              className={chapterId === chapter.id ? styles.chapterActive : styles.chapterButton}
            >
              第 {index + 1} 集 · {chapter.title}
            </button>
          ))}
        </aside>
        <section className={styles.content}>
          <div className={styles.contentHeader}>
            <div>
              <h2 className={styles.contentTitle}>资产需求</h2>
              <p className={styles.contentDescription}>
                {requirements.length} 项 · 已有版本直接可用，缺失图片由 Seedream 补齐
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => loadRequirements()}>
              <RefreshCw className={styles.icon} />
              刷新
            </Button>
          </div>
          <div className={styles.kindTabs}>
            {KIND_TABS.map((tab) => {
              const count = requirements.filter((item) => item.kind === tab.value).length;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveKind(tab.value)}
                  className={activeKind === tab.value ? styles.kindTabActive : styles.kindTab}
                >
                  {tab.label}
                  <span className={styles.tabCount}>{count}</span>
                </button>
              );
            })}
          </div>
          {loading ? (
            <div className={styles.loadingState}>
              <Loader2 className={styles.pageLoadingIcon} />
            </div>
          ) : filteredRequirements.length ? (
            <div className={styles.requirementGrid}>
              {filteredRequirements.map((item) => (
                <RequirementCard
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onGenerate={() => generate(item.id)}
                  onImport={() => openPersonal(item)}
                  onSave={() => saveToPersonal(item)}
                  onVersions={() => openVersions(item)}
                  onComplete={() =>
                    navigate(
                      `/assets?project=${projectId}&character=${item.linked_entity_id || ""}`,
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <Image className={styles.emptyIcon} />
              <p>本集暂无{KIND_TABS.find((tab) => tab.value === activeKind)?.label}需求</p>
            </div>
          )}
        </section>
      </main>

      <Dialog open={Boolean(importTarget)} onOpenChange={(open) => !open && setImportTarget(null)}>
        <DialogContent className={styles.dialog}>
          <DialogHeader>
            <DialogTitle>从个人空间导入 · {importTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className={styles.dialogGrid}>
            {personalAssets.map((item) => (
              <button
                key={item.id}
                onClick={() => importPersonal(item)}
                className={styles.personalAsset}
              >
                <div className={styles.squarePreview}>
                  {item.file_url || item.preview_url ? (
                    <img src={item.file_url || item.preview_url} className={styles.image} />
                  ) : null}
                </div>
                <div className={styles.personalAssetName}>{item.name}</div>
              </button>
            ))}
            {!personalAssets.length ? (
              <p className={styles.dialogEmpty}>个人空间暂无同类资产</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(versionTarget)}
        onOpenChange={(open) => !open && setVersionTarget(null)}
      >
        <DialogContent className={styles.dialog}>
          <DialogHeader>
            <DialogTitle>{versionTarget?.name} · 版本</DialogTitle>
          </DialogHeader>
          <div className={styles.dialogGrid}>
            {versions.map((version) => (
              <button
                key={version.id}
                onClick={() => chooseVersion(version)}
                className={version.is_current ? styles.versionCurrent : styles.version}
              >
                <div className={styles.squarePreview}>
                  <img src={version.preview_url || version.file_url} className={styles.image} />
                </div>
                <div className={styles.versionInfo}>
                  <span>{version.model}</span>
                  <span>{version.is_current ? "当前版本" : "设为当前"}</span>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
