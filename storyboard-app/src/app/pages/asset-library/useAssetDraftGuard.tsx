import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router";

import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import type { SelectedAsset } from "./AssetLibrary.helpers";

export function assetDraftFingerprint(asset: SelectedAsset): string {
  if (!asset) return "";
  return asset.type === "character"
    ? JSON.stringify([
        asset.type,
        asset.data.id,
        asset.data.name,
        asset.data.description,
        asset.data.avatar_url,
        asset.data.voice_prompt,
      ])
    : JSON.stringify([
        asset.type,
        asset.data.id,
        asset.data.name,
        asset.data.type,
        asset.data.meta,
        asset.data.file_url,
      ]);
}

export function useAssetDraftGuard(save: () => Promise<unknown>) {
  const [selectedAsset, setDraftValue] = useState<SelectedAsset>(null);
  const currentSelection = useRef<SelectedAsset>(null);
  const savedFingerprint = useRef("");
  const [baseline, setBaseline] = useState("");
  const [savedAsset, setSavedAsset] = useState<SelectedAsset>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = assetDraftFingerprint(selectedAsset) !== baseline;
  const blocker = useBlocker(
    useCallback(
      () => assetDraftFingerprint(currentSelection.current) !== savedFingerprint.current,
      [],
    ),
  );
  const setSelectedAsset = useCallback((asset: SelectedAsset) => {
    currentSelection.current = asset;
    savedFingerprint.current = assetDraftFingerprint(asset);
    setDraftValue(asset);
    setSavedAsset(asset);
    setBaseline(assetDraftFingerprint(asset));
  }, []);
  const setDraft = useCallback((asset: SelectedAsset) => {
    currentSelection.current = asset;
    setDraftValue(asset);
  }, []);
  const updateSelectedAsset = useCallback(
    (asset: SelectedAsset, preserveDraft = false) => {
      const current = currentSelection.current;
      if (preserveDraft && assetDraftFingerprint(current) !== savedFingerprint.current) return;
      if (asset && current?.type === asset.type && current.data.id === asset.data.id)
        setSelectedAsset(asset);
    },
    [setSelectedAsset],
  );
  const requestAction = (action: () => void) => {
    if (dirty) {
      setError("");
      setPending(() => action);
    } else action();
  };

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  // Execute guarded local actions only after the saved/discarded state has rendered.
  const [continueAction, setContinueAction] = useState<(() => void) | null>(null);
  useEffect(() => {
    if (!continueAction || dirty) return;
    continueAction();
    setContinueAction(null);
  }, [continueAction, dirty]);

  const cancel = () => {
    setPending(null);
    setError("");
    if (blocker.state === "blocked") blocker.reset();
  };
  const finish = async (shouldSave: boolean) => {
    setSaving(true);
    setError("");
    try {
      if (shouldSave) {
        const result = await save();
        if (!result) throw new Error("修改未保存，请重试");
      } else {
        setSelectedAsset(savedAsset);
      }
      if (blocker.state === "blocked") blocker.proceed();
      else if (pending) setContinueAction(() => pending);
      setPending(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };
  const dialog = (
    <Dialog
      open={Boolean(pending) || blocker.state === "blocked"}
      onOpenChange={(open) => {
        if (!open && !saving) cancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>资产有未保存的修改</DialogTitle>
        </DialogHeader>
        <p>请保存后继续，或放弃本次修改。</p>
        {error ? <p role="alert">{error}</p> : null}
        <Button disabled={saving} onClick={() => void finish(true)}>
          {saving ? "正在保存…" : "保存并继续"}
        </Button>
        <Button disabled={saving} variant="outline" onClick={() => void finish(false)}>
          放弃修改
        </Button>
        <Button disabled={saving} variant="ghost" onClick={cancel}>
          取消
        </Button>
      </DialogContent>
    </Dialog>
  );
  return {
    selectedAsset,
    setSelectedAsset,
    updateSelectedAsset,
    setDraft,
    requestAction,
    dirty,
    dialog,
  };
}
