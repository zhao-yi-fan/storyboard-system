import { useEffect, useState } from "react";

import { type AssetRequirement, assetWorkspaceApi, type PersonalAsset } from "../../api";
import { SignedImage } from "../../components/media/SignedMedia";
import { EmptyState } from "../../components/shared/EmptyState";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";

export function PersonalImportDialog({
  open,
  kind,
  target,
  projectId,
  onClose,
  onImported,
}: {
  open: boolean;
  kind: string;
  target?: AssetRequirement;
  projectId: number;
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [items, setItems] = useState<PersonalAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const kindLabel =
    kind === "character" ? "角色" : kind === "scene" ? "场景" : kind === "prop" ? "道具" : "同类";
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setLoadError("");
    setItems([]);
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
  }, [open, kind, reload]);
  const importItem = async (item: PersonalAsset) => {
    setBusy(true);
    setError("");
    try {
      await assetWorkspaceApi.importPersonalAsset(item.id, {
        project_id: projectId,
        requirement_id: target?.id,
      });
      await onImported();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导入失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>从个人空间导入{target ? ` · ${target.name}` : "新资产"}</DialogTitle>
        </DialogHeader>
        <p>
          {target
            ? "将更新此需求对应的项目共享资产，不修改已有分镜输出。"
            : "导入为独立项目快照，不自动绑定到当前集。"}
        </p>
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
          items.map((item) => (
            <Button
              key={item.id}
              disabled={busy}
              variant="outline"
              onClick={() => void importItem(item)}
              style={{ height: "auto", justifyContent: "flex-start", gap: 12 }}
            >
              {item.preview_url || item.file_url ? (
                <SignedImage
                  src={item.preview_url?.length ? item.preview_url : item.file_url}
                  alt={item.name}
                  style={{ width: 72, height: 72, objectFit: "contain" }}
                />
              ) : null}
              {item.name}
            </Button>
          ))
        )}
      </DialogContent>
    </Dialog>
  );
}
