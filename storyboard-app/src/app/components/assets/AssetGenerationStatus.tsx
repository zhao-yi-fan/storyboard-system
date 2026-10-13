export function AssetGenerationStatus({ status, error }: { status?: string; error?: string }) {
  if (status !== "generating" && status !== "failed") return null;
  return (
    <p
      style={{
        fontSize: 12,
        marginTop: 8,
        color: status === "failed" ? "var(--danger)" : "var(--brand-text)",
      }}
    >
      {status === "generating"
        ? "图片生成中…"
        : `图片生成失败${error ? `：${error}` : "，可在详情中重试"}`}
    </p>
  );
}
