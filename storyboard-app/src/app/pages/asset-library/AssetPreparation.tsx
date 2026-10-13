import { useState } from "react";

import type { AssetRequirement, Chapter } from "../../api";
import { SignedImage } from "../../components/media/SignedMedia";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import {
  isGenerating,
  missingCandidates,
  PREPARATION_KINDS,
  preparationSummary,
  uniqueRequirements,
} from "./AssetPreparation.helpers";
import styles from "./AssetPreparation.module.scss";

type Props = {
  chapters: Chapter[];
  chapterId?: number;
  kind: string;
  items: AssetRequirement[];
  loading: boolean;
  error: string;
  busy: boolean;
  onChapter: (value: string) => void;
  onKind: (value: string) => void;
  onOpen: (item: AssetRequirement) => void;
  onGenerate: () => Promise<void>;
  onRefresh: () => void;
};

export function AssetPreparation({
  chapters,
  chapterId,
  kind,
  items,
  loading,
  error,
  busy,
  onChapter,
  onKind,
  onOpen,
  onGenerate,
  onRefresh,
}: Props) {
  const [confirmBatch, setConfirmBatch] = useState(false);
  const summary = preparationSummary(items);
  const candidates = missingCandidates(items);
  const filtered = uniqueRequirements(items).filter((item) => item.kind === kind);
  const scope = chapterId ? "本集" : "全部集";
  return (
    <div className={styles.layout}>
      <aside className={styles.chapters} aria-label="按集查看">
        <h2>按集查看</h2>
        <button aria-pressed={!chapterId} onClick={() => onChapter("all")}>
          全部集
        </button>
        {chapters.map((chapter, index) => (
          <button
            key={chapter.id}
            aria-pressed={chapterId === chapter.id}
            onClick={() => onChapter(String(chapter.id))}
          >
            第 {index + 1} 集 · {chapter.title}
          </button>
        ))}
      </aside>
      <section className={styles.content}>
        <div className={styles.toolbar}>
          <p>
            有图片 {summary.available} 项 · 缺图片 {summary.missing} 项 · 生成中{" "}
            {summary.generating} 项 · 失败 {summary.failed} 项
          </p>
          <Button size="sm" variant="ghost" onClick={onRefresh}>
            刷新
          </Button>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.kinds}>
            {PREPARATION_KINDS.map((tab) => (
              <button
                key={tab.value}
                aria-pressed={kind === tab.value}
                onClick={() => onKind(tab.value)}
              >
                {tab.label}{" "}
                {uniqueRequirements(items).filter((item) => item.kind === tab.value).length}
              </button>
            ))}
          </div>
          <Button
            disabled={busy || loading || !candidates.length}
            onClick={() => setConfirmBatch(true)}
          >
            {busy ? "正在补齐图片…" : `补齐${scope}缺失图片（${candidates.length}）`}
          </Button>
        </div>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <p className={styles.hint}>
          图片准备不代表制作全部完成；角色语音在资产详情中独立配置。可随时进入分镜工作台。
        </p>
        {loading ? (
          <p role="status">正在加载资产需求…</p>
        ) : !filtered.length ? (
          <p>当前范围暂无{PREPARATION_KINDS.find((tab) => tab.value === kind)?.label}需求</p>
        ) : (
          <div className={styles.grid}>
            {filtered.map((item) => (
              <RequirementCard key={item.id} item={item} onOpen={() => onOpen(item)} />
            ))}
          </div>
        )}
      </section>
      <Dialog open={confirmBatch} onOpenChange={setConfirmBatch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>补齐{scope}缺失图片</DialogTitle>
          </DialogHeader>
          <p>范围包含当前集选择下的所有分类，不受当前分类筛选影响。</p>
          {PREPARATION_KINDS.map((tab) => (
            <p key={tab.value}>
              {tab.label}：{candidates.filter((item) => item.kind === tab.value).length} 项
            </p>
          ))}
          <p>
            跳过：已有图片 {summary.available} 项、缺生成条件 {summary.blocked} 项、生成中{" "}
            {summary.generating} 项。共享资产只生成一次。
          </p>
          <Button
            disabled={busy}
            onClick={() => {
              setConfirmBatch(false);
              void onGenerate();
            }}
          >
            确认生成 {candidates.length} 项
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequirementCard({ item, onOpen }: { item: AssetRequirement; onOpen: () => void }) {
  const busy = isGenerating(item);
  const failed = (item.generation_status ?? item.status) === "failed";
  const image = item.preview_url?.length ? item.preview_url : item.file_url;
  const action = busy
    ? "查看生成状态"
    : !item.file_url && item.can_generate === false
      ? "补参考素材"
      : failed
        ? "查看并重试"
        : item.file_url
          ? "查看资产"
          : "生成图片";
  return (
    <article className={styles.card}>
      <button className={styles.preview} onClick={onOpen} aria-label={`查看${item.name}`}>
        {image ? <SignedImage src={image} alt={item.name} loading="lazy" /> : <span>暂无图片</span>}
      </button>
      <div className={styles.cardBody}>
        <h3>{item.name}</h3>
        <span
          className={
            busy
              ? styles.generating
              : failed
                ? styles.error
                : item.file_url
                  ? styles.available
                  : styles.missing
          }
        >
          {busy ? "生成中" : failed ? "生成失败" : item.file_url ? "有图片" : "缺图片"}
        </span>
        <p>{item.description || "暂无描述"}</p>
        {item.generation_error || item.error_message ? (
          <p className={styles.error}>
            {item.generation_error?.length ? item.generation_error : item.error_message}
          </p>
        ) : null}
        {!item.file_url && item.blocking_reason ? (
          <p className={styles.missing}>{item.blocking_reason}</p>
        ) : null}
        <Button size="sm" variant="outline" onClick={onOpen}>
          {action}
        </Button>
      </div>
    </article>
  );
}
