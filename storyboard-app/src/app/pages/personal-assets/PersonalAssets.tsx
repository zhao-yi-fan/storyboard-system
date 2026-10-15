import { ArrowLeft, Image, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { assetWorkspaceApi, type PersonalAsset } from "../../api";
import { SignedImage } from "../../components/media/SignedMedia";
import { EmptyState } from "../../components/shared/EmptyState";
import { Button } from "../../components/ui/button";
import { ASSET_KIND } from "../../constants/domain";
import styles from "./PersonalAssets.module.scss";

const FILTERS = [
  { value: "", label: "全部" },
  { value: ASSET_KIND.CHARACTER, label: "角色" },
  { value: ASSET_KIND.SCENE, label: "场景" },
  { value: ASSET_KIND.PROP, label: "道具" },
] as const;

export default function PersonalAssets() {
  const navigate = useNavigate();
  const [kind, setKind] = useState("");
  const [items, setItems] = useState<PersonalAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void assetWorkspaceApi
      .getPersonalAssets(kind || undefined)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "个人空间加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, reload]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Button variant="ghost" size="icon" onClick={() => void navigate("/projects")}>
          <ArrowLeft className={styles.backIcon} />
        </Button>
        <div>
          <h1 className={styles.title}>个人空间</h1>
          <p className={styles.subtitle}>跨项目复用已确认资产</p>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.filters}>
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setKind(filter.value)}
              className={kind === filter.value ? styles.filterActive : styles.filter}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {loading ? (
          <div className={styles.loading}>
            <Loader2 className={styles.loadingIcon} />
          </div>
        ) : error ? (
          <EmptyState
            error
            title="个人空间加载失败"
            description={error}
            action={
              <Button variant="outline" onClick={() => setReload((value) => value + 1)}>
                重新加载
              </Button>
            }
          />
        ) : items.length ? (
          <div className={styles.grid}>
            {items.map((item) => (
              <article key={item.id} className={styles.card}>
                <div className={styles.preview}>
                  {(item.file_url ?? item.preview_url) ? (
                    <SignedImage
                      src={item.file_url ?? item.preview_url}
                      alt={item.name}
                      className={styles.image}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.imagePlaceholder}>
                      <Image className={styles.placeholderIcon} />
                    </div>
                  )}
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.assetKind}>
                    {FILTERS.find((filter) => filter.value === item.kind)?.label}
                  </div>
                  <h2 className={styles.assetName}>{item.name}</h2>
                  <p className={styles.assetDescription}>
                    {item.description ?? "来自已确认项目资产"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title={
              kind
                ? `还没有可复用的${FILTERS.find((filter) => filter.value === kind)?.label}资产`
                : "还没有可复用资产"
            }
            description="在项目资产的编辑面板中点击“保存到个人空间”，之后就可以在其他项目复用。"
          />
        )}
      </main>
    </div>
  );
}
