import { useState } from "react";

import type { AssetRequirement } from "../../api";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import {
  missingCandidates,
  PREPARATION_KINDS,
  preparationSummary,
} from "./AssetPreparation.helpers";

type Props = {
  chapterId?: number;
  items: AssetRequirement[];
  loading: boolean;
  busy: boolean;
  onGenerate: () => Promise<void>;
};

export function AssetBatchGenerateAction({ chapterId, items, loading, busy, onGenerate }: Props) {
  const [open, setOpen] = useState(false);
  const candidates = missingCandidates(items);
  const summary = preparationSummary(items);
  const scope = chapterId ? "本集" : "全部集";
  const disabled = busy || loading || !candidates.length;
  return (
    <>
      <Button size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        {busy ? "正在补齐图片…" : `补齐${scope}缺失图片（${candidates.length}）`}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
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
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              void onGenerate();
            }}
          >
            确认生成 {candidates.length} 项
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
