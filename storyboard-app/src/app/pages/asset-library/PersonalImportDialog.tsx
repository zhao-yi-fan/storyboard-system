import { useEffect, useRef, useState } from "react";

import { assetWorkspaceApi, type PersonalAsset } from "../../api";
import { EmptyState } from "../../components/shared/EmptyState";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { PersonalImageSelection } from "./PersonalImageSelection";
import styles from "./PersonalImportDialog.module.scss";

type Props = {
  open: boolean;
  mode: "create" | "apply-image";
  kind: string;
  target?: assetWorkspaceApi.PersonalImageTarget;
  projectId: number;
  onClose: () => void;
  onImported: () => Promise<void>;
};

export function PersonalImportDialog({
  open,
  mode,
  kind,
  target,
  projectId,
  onClose,
  onImported,
}: Props) {
  const [items, setItems] = useState<PersonalAsset[]>([]);
  const [selected, setSelected] = useState<PersonalAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [committed, setCommitted] = useState(false);
  const submitting = useRef(false);
  const kindLabel =
    kind === "character" ? "角色" : kind === "scene" ? "场景" : kind === "prop" ? "道具" : "同类";
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setLoadError("");
    setItems([]);
    setSelected(null);
    setCommitted(false);
    void assetWorkspaceApi
      .getPersonalAssets(kind)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((reason) => {
        if (!cancelled) setLoadError(reason instanceof Error ? reason.message : "个人空间加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, kind, reload, mode, target?.entity_type, target?.entity_id, projectId]);

  const refreshCommitted = async () => {
    try {
      await onImported();
      onClose();
    } catch {
      setError("操作已完成，刷新失败。请重新刷新，不需要再次提交。");
    }
  };
  const submit = async () => {
    if (submitting.current || !selected || (mode === "apply-image" && !target)) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      if (!committed) {
        if (mode === "apply-image" && target)
          await assetWorkspaceApi.applyPersonalImage(selected.id, projectId, target);
        else await assetWorkspaceApi.importPersonalAsset(selected.id, { project_id: projectId });
        setCommitted(true);
      }
      await refreshCommitted();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作失败，请重试");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !submitting.current) onClose();
      }}
    >
      <DialogContent className={styles.dialog} showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "从个人空间导入新资产"
              : `选择图片给「${target?.name ?? "当前资产"}」`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "导入为独立项目快照，不自动绑定到当前集，也不与个人空间持续同步。"
              : "采用后生成新的图片版本，旧版本可以恢复。"}
          </DialogDescription>
        </DialogHeader>
        {error ? <p role="alert">{error}</p> : null}
        {loading ? (
          <p role="status">正在加载…</p>
        ) : loadError ? (
          <EmptyState
            compact
            error
            title="个人空间加载失败"
            description={loadError}
            action={
              <Button variant="outline" onClick={() => setReload((value) => value + 1)}>
                重新加载
              </Button>
            }
          />
        ) : !items.length ? (
          <EmptyState
            compact
            title={`个人空间还没有${kindLabel}资产`}
            description="在项目资产的编辑面板中点击“保存到个人空间”，之后就可以在其他项目复用。"
            action={
              <Button variant="outline" onClick={onClose}>
                知道了
              </Button>
            }
          />
        ) : (
          <>
            <PersonalImageSelection
              items={items}
              selected={selected}
              onSelect={setSelected}
              disabled={busy || committed}
              mode={mode}
              target={target}
            />
            <div className={styles.footer}>
              <Button variant="ghost" disabled={busy} onClick={onClose}>
                {committed ? "关闭" : "取消"}
              </Button>
              <Button disabled={busy || !selected} onClick={() => void submit()}>
                {busy
                  ? "处理中…"
                  : committed
                    ? "重新刷新"
                    : mode === "create"
                      ? "导入为新资产"
                      : "采用为新版本"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
