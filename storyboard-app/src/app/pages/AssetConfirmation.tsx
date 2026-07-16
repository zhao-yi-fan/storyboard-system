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
    <article className="overflow-hidden rounded-2xl bg-white/[0.045] ring-1 ring-white/[0.06]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#101313]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-700">
            <Image className="h-10 w-10" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-teal-200 backdrop-blur">
          {KIND_LABELS[item.kind]}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-gray-200 backdrop-blur">
          {STATUS_LABELS[item.status]}
        </span>
      </div>
      <div className="p-4">
        <h3 className="truncate font-semibold text-white">{item.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-gray-500">
          {item.description || "暂无补充描述"}
        </p>
        {item.error_message ? (
          <p className="mt-2 text-xs text-red-300">{item.error_message}</p>
        ) : null}
        {item.blocking_reason ? (
          <p className="mt-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            {item.blocking_reason}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={item.can_generate === false ? onComplete : onGenerate}
            className="bg-teal-400 text-[#07110f] hover:bg-teal-300"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {item.can_generate === false ? "完善参考素材" : imageUrl ? "再生成" : "Seedream 生成"}
          </Button>
          <Button size="sm" variant="outline" onClick={onImport}>
            <Library className="h-3.5 w-3.5" />
            个人空间
          </Button>
          {imageUrl ? (
            <Button size="sm" variant="ghost" onClick={onVersions}>
              版本
            </Button>
          ) : null}
          {imageUrl ? (
            <Button size="sm" variant="ghost" onClick={onSave}>
              <Save className="h-3.5 w-3.5" />
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
    (item) => (item.status === "pending" || item.status === "failed") && item.can_generate !== false,
  ).length;
  const blockedCount = requirements.filter(
    (item) => (item.status === "pending" || item.status === "failed") && item.can_generate === false,
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
    <div className="min-h-screen bg-[#090b0b] text-gray-100">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-[#090b0b]/85 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold">{project?.name || "项目"} · 资产准备</h1>
            <p className="text-xs text-gray-600">按集整理人物、场景和道具，已有图片可直接使用</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate(`/assets?project=${projectId}`)}>
            项目资产编辑
          </Button>
          <Button variant="outline" onClick={() => navigate(`/workspace?project=${projectId}`)}>
            进入分镜工作台
          </Button>
          <Button
            disabled={busyId !== null || readyCount === 0}
            onClick={() => generate()}
            className="bg-teal-400 text-[#07110f] hover:bg-teal-300"
          >
            {busyId === "batch" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {readyCount ? `生成可用资产 (${readyCount})` : blockedCount ? `${blockedCount} 项待补素材` : "本集资产已齐"}
          </Button>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1500px] gap-8 px-6 py-8">
        <aside className="w-48 flex-none">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-gray-600">
            按集查看
          </div>
          <button
            onClick={() => selectChapter(undefined)}
            className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left text-sm ${chapterId == null ? "bg-teal-400/15 text-teal-200" : "text-gray-500 hover:bg-white/5"}`}
          >
            全部资产
          </button>
          {chapters.map((chapter, index) => (
            <button
              key={chapter.id}
              onClick={() => selectChapter(chapter.id)}
              className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left text-sm ${chapterId === chapter.id ? "bg-teal-400/15 text-teal-200" : "text-gray-500 hover:bg-white/5"}`}
            >
              第 {index + 1} 集 · {chapter.title}
            </button>
          ))}
        </aside>
        <section className="min-w-0 flex-1">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold">资产需求</h2>
              <p className="mt-1 text-sm text-gray-600">
                {requirements.length} 项 · 已有版本直接可用，缺失图片由 Seedream 补齐
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => loadRequirements()}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
          </div>
          <div className="mb-6 flex gap-2 border-b border-white/[0.06] pb-3">
            {KIND_TABS.map((tab) => {
              const count = requirements.filter((item) => item.kind === tab.value).length;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveKind(tab.value)}
                  className={`rounded-full px-4 py-2 text-sm transition ${activeKind === tab.value ? "bg-teal-400 text-[#07110f]" : "bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-white"}`}
                >
                  {tab.label}
                  <span className="ml-2 text-xs opacity-65">{count}</span>
                </button>
              );
            })}
          </div>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-teal-300" />
            </div>
          ) : filteredRequirements.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredRequirements.map((item) => (
                <RequirementCard
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onGenerate={() => generate(item.id)}
                  onImport={() => openPersonal(item)}
                  onSave={() => saveToPersonal(item)}
                  onVersions={() => openVersions(item)}
                  onComplete={() => navigate(`/assets?project=${projectId}&character=${item.linked_entity_id || ""}`)}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-72 flex-col items-center justify-center rounded-3xl bg-white/[0.025] text-gray-600">
              <Image className="mb-3 h-10 w-10" />
              <p>本集暂无{KIND_TABS.find((tab) => tab.value === activeKind)?.label}需求</p>
            </div>
          )}
        </section>
      </main>

      <Dialog open={Boolean(importTarget)} onOpenChange={(open) => !open && setImportTarget(null)}>
        <DialogContent className="max-w-3xl bg-[#121515] text-white">
          <DialogHeader>
            <DialogTitle>从个人空间导入 · {importTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto">
            {personalAssets.map((item) => (
              <button
                key={item.id}
                onClick={() => importPersonal(item)}
                className="overflow-hidden rounded-xl bg-white/5 text-left hover:bg-white/10"
              >
                <div className="aspect-square bg-black/30">
                  {item.file_url || item.preview_url ? (
                    <img
                      src={item.file_url || item.preview_url}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="p-3 text-sm">{item.name}</div>
              </button>
            ))}
            {!personalAssets.length ? (
              <p className="col-span-3 py-16 text-center text-gray-500">个人空间暂无同类资产</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(versionTarget)}
        onOpenChange={(open) => !open && setVersionTarget(null)}
      >
        <DialogContent className="max-w-3xl bg-[#121515] text-white">
          <DialogHeader>
            <DialogTitle>{versionTarget?.name} · 版本</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto">
            {versions.map((version) => (
              <button
                key={version.id}
                onClick={() => chooseVersion(version)}
                className={`overflow-hidden rounded-xl text-left ring-1 ${version.is_current ? "bg-teal-400/10 ring-teal-400" : "bg-white/5 ring-white/5"}`}
              >
                <div className="aspect-square bg-black/30">
                  <img
                    src={version.preview_url || version.file_url}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex justify-between p-3 text-xs">
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
