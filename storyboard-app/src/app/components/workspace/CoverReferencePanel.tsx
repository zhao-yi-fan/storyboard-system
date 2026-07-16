import { useState } from "react";
import {
  AlertCircle,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Package,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { SceneGenerationReferences } from "../../api";

type CoverHistoryItem = {
  id: number;
  src: string;
  label: string;
  isCurrent: boolean;
  status: string;
};

type CoverReferencePanelProps = {
  currentCoverUrl: string;
  references: SceneGenerationReferences | null;
  isLoadingReferences: boolean;
  referenceError: string;
  generationError: string;
  isGenerating: boolean;
  history: CoverHistoryItem[];
  onGenerate: () => void;
  onUpload: () => void;
  onManageCharacters: () => void;
  onManageAssets: () => void;
  onPreviewCurrent: () => void;
  onPreviewReference: (index: number) => void;
  onPreviewHistory: (id: number) => void;
  onDismissError: () => void;
};

function referenceTypeLabel(type: string) {
  const labels: Record<string, string> = {
    character: "角色主设定图",
    scene: "场景参考",
    prop: "道具参考",
    costume: "服装参考",
    asset: "图片参考",
  };
  return labels[type] || type || "图片参考";
}

export function CoverReferencePanel({
  currentCoverUrl,
  references,
  isLoadingReferences,
  referenceError,
  generationError,
  isGenerating,
  history,
  onGenerate,
  onUpload,
  onManageCharacters,
  onManageAssets,
  onPreviewCurrent,
  onPreviewReference,
  onPreviewHistory,
  onDismissError,
}: CoverReferencePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const images = references?.reference_images || [];
  const collapsedImages = images.length > 3 ? images.slice(0, 2) : images;
  const visibleImages = expanded ? images : collapsedImages;
  const hiddenCount = images.length - visibleImages.length;

  return (
    <section className="p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-300">首帧与参考</span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[10px] text-fuchsia-300 hover:text-fuchsia-200"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-3 w-3" />
            )}
            {currentCoverUrl ? "重新生成首帧" : "生成首帧"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-white/5 hover:text-white">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-white/10 bg-[#1b1b20]/95 text-gray-100 backdrop-blur-xl"
            >
              <DropdownMenuItem onClick={onUpload}>
                <Upload className="h-4 w-4" />
                上传首帧
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onManageCharacters}>
                <Users className="h-4 w-4" />
                管理角色参考
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onManageAssets}>
                <Package className="h-4 w-4" />
                管理场景参考
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {(generationError || referenceError) && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-950/45 px-2.5 py-2 text-[10px] leading-4 text-red-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none" />
          <span className="min-w-0 flex-1">{generationError || referenceError}</span>
          <button type="button" className="text-red-300 hover:text-white" onClick={onDismissError}>
            关闭
          </button>
        </div>
      )}

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-[9px] text-gray-400">
          <span>当前首帧</span>
          <span className="text-gray-500">生成结果，不参与本次首帧生成</span>
        </div>
        <button
          type="button"
          className="group relative h-20 w-full overflow-hidden rounded-xl bg-black/35 text-left disabled:cursor-default"
          onClick={onPreviewCurrent}
          disabled={!currentCoverUrl}
        >
          {currentCoverUrl ? (
            <img src={currentCoverUrl} alt="当前首帧" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center gap-2 text-[10px] text-gray-500">
              <ImageIcon className="h-4 w-4" /> 尚未生成首帧
            </span>
          )}
          {currentCoverUrl && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-[10px] text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
              查看原图
            </span>
          )}
        </button>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-[9px] text-gray-400">
          <span>本次真实参考图</span>
          <span>{isLoadingReferences ? "读取中" : `${images.length} 张`}</span>
        </div>
        {isLoadingReferences ? (
          <div className="flex h-20 items-center justify-center rounded-xl bg-black/20 text-[10px] text-gray-500">
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> 正在读取真实生成输入
          </div>
        ) : images.length ? (
          <div className="grid grid-cols-3 gap-2">
            {visibleImages.map((reference, index) => {
              const actualIndex = images.findIndex(
                (item) => item.url === reference.url && item.name === reference.name,
              );
              return (
                <button
                  key={`${reference.type}-${reference.name}-${reference.url}`}
                  type="button"
                  className="group relative aspect-square overflow-hidden rounded-lg bg-black/35 text-left"
                  onClick={() => onPreviewReference(actualIndex >= 0 ? actualIndex : index)}
                  title={`${reference.name} · ${reference.source}`}
                >
                  <img
                    src={reference.url}
                    alt={reference.name || referenceTypeLabel(reference.type)}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1 pt-4">
                    <span className="block truncate text-[9px] text-white">{reference.name}</span>
                    <span className="block truncate text-[8px] text-gray-300">
                      {referenceTypeLabel(reference.type)}
                    </span>
                    <span className="block truncate text-[7px] text-gray-400">
                      {reference.source}
                    </span>
                  </span>
                </button>
              );
            })}
            {!expanded && hiddenCount > 0 && (
              <button
                type="button"
                className="aspect-square rounded-lg bg-white/[0.055] text-sm font-medium text-gray-200 hover:bg-white/[0.09]"
                onClick={() => setExpanded(true)}
              >
                +{hiddenCount}
                <span className="mt-1 block text-[8px] font-normal text-gray-500">查看全部</span>
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-black/20 px-3 py-4 text-center text-[10px] text-gray-500">
            当前片段没有可用参考图，可从右上角菜单绑定
          </div>
        )}
        {expanded && images.length > 3 && (
          <button
            type="button"
            className="mt-1.5 text-[9px] text-gray-400 hover:text-white"
            onClick={() => setExpanded(false)}
          >
            收起参考图
          </button>
        )}
        {!!references?.missing_references.length && (
          <div className="mt-1.5 text-[9px] leading-4 text-amber-300">
            缺少可用图片：{references.missing_references.join("、")}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-xl bg-black/20 px-3 py-2.5">
        <div className="text-[9px] text-gray-500">画面模型</div>
        <div className="mt-1 text-[11px] font-medium text-gray-200">Seedream 4.5</div>
      </div>

      {!!history.length && (
        <div className="mt-3">
          <div className="mb-1.5 text-[9px] uppercase tracking-[0.14em] text-gray-500">
            首帧历史
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`relative h-12 w-12 flex-none overflow-hidden rounded-md bg-black/35 ${item.isCurrent ? "ring-1 ring-fuchsia-400/70" : ""}`}
                onClick={() => onPreviewHistory(item.id)}
                disabled={!item.src}
                title={`查看首帧版本 ${item.label}`}
              >
                {item.src ? (
                  <img src={item.src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[8px] text-gray-500">{item.status}</span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-[8px] text-gray-300">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function PromptReferenceStatus({
  references,
}: {
  references: SceneGenerationReferences | null;
}) {
  if (!references || (!references.mappings.length && !references.unbound_mentions.length))
    return null;

  return (
    <div className="mb-2 rounded-xl bg-black/20 px-2.5 py-2">
      <div className="mb-1.5 text-[9px] text-gray-500">已绑定参考</div>
      <div className="flex flex-wrap gap-1.5">
        {references.mappings.map((mapping) => (
          <span
            key={`${mapping.type}-${mapping.index}-${mapping.name}`}
            className={`rounded-md px-1.5 py-1 text-[9px] ${
              mapping.is_mentioned
                ? "bg-fuchsia-400/15 text-fuchsia-200"
                : "bg-amber-400/10 text-amber-200"
            }`}
            title={mapping.prompt_text}
          >
            @{mapping.name} ·{" "}
            {mapping.is_mentioned ? "已在 Prompt 引用" : "仅绑定，未在 Prompt 引用"}
          </span>
        ))}
      </div>
      {!!references.unbound_mentions.length && (
        <div className="mt-1.5 text-[9px] leading-4 text-red-300">
          未绑定引用：{references.unbound_mentions.map((name) => `@${name}`).join("、")}
        </div>
      )}
    </div>
  );
}
