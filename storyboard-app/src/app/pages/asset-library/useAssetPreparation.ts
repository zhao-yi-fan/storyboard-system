import { useCallback, useEffect, useRef, useState } from "react";

import { type AssetRequirement, assetWorkspaceApi, type Chapter, chapterApi } from "../../api";
import { isGenerating } from "./AssetPreparation.helpers";

export function useAssetPreparation(
  projectId: number,
  chapterParam: string | null,
  prepare: boolean,
) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chaptersLoaded, setChaptersLoaded] = useState(false);
  const [requirements, setRequirements] = useState<AssetRequirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState("");
  const requestSequence = useRef(0);
  const invalidateRequests = useCallback(() => {
    requestSequence.current++;
  }, []);
  const chapterId =
    prepare && chapterParam !== "all"
      ? (chapters.find((item) => item.id === Number(chapterParam))?.id ?? chapters[0]?.id)
      : undefined;

  useEffect(() => {
    let cancelled = false;
    setChaptersLoaded(false);
    if (!projectId) return;
    void chapterApi
      .getChaptersByProject(projectId)
      .then((items) => {
        if (!cancelled) {
          setChapters(items);
          setChaptersLoaded(true);
        }
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "集列表加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const refresh = useCallback(async () => {
    if (!projectId || !chaptersLoaded) return;
    const sequence = ++requestSequence.current;
    try {
      const items = await assetWorkspaceApi.getRequirements(projectId, chapterId);
      if (sequence === requestSequence.current) {
        setRequirements(items);
        setError("");
      }
    } catch (reason) {
      if (sequence === requestSequence.current)
        setError(reason instanceof Error ? reason.message : "资产需求加载失败");
    }
  }, [projectId, chaptersLoaded, chapterId]);

  const latestRefresh = useRef(refresh);
  useEffect(() => {
    latestRefresh.current = refresh;
  }, [refresh]);
  const refreshCurrent = useCallback(() => latestRefresh.current(), []);

  useEffect(() => {
    setRequirements([]);
    setLoading(true);
    let cancelled = false;
    void refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      invalidateRequests();
    };
  }, [refresh, invalidateRequests]);

  const generating = requirements.some(isGenerating);
  useEffect(() => {
    if (!generating && !batchBusy) return;
    const update = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(update, 3000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refresh, generating, batchBusy]);

  const generateMissing = async () => {
    setBatchBusy(true);
    setBatchError("");
    try {
      const result = await assetWorkspaceApi.generateRequirements(projectId, {
        chapter_id: chapterId,
        missing_only: true,
      });
      const failed = result.filter((item) => item.status === "failed");
      if (failed.length)
        setBatchError(`${failed.length} 项生成失败：${failed[0].error ?? "请查看条目错误并重试"}`);
    } catch (reason) {
      setBatchError(
        reason instanceof Error ? reason.message : "批量生成失败，请检查条目错误后重试",
      );
    } finally {
      setBatchBusy(false);
      await refreshCurrent();
    }
  };
  return {
    chapters,
    chaptersLoaded,
    chapterId,
    requirements,
    loading,
    error: error || batchError,
    refresh: refreshCurrent,
    batchBusy,
    generateMissing,
  };
}
