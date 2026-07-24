import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Image, Loader2 } from "lucide-react";
import { assetWorkspaceApi, type PersonalAsset } from "../api";
import { Button } from "../components/ui/button";
import styles from "./PersonalAssets.module.scss";

const FILTERS = [
  { value: "", label: "全部" },
  { value: "character", label: "角色" },
  { value: "scene", label: "场景" },
  { value: "prop", label: "道具" },
] as const;

export default function PersonalAssets() {
  const navigate = useNavigate();
  const [kind, setKind] = useState("");
  const [items, setItems] = useState<PersonalAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    assetWorkspaceApi
      .getPersonalAssets(kind || undefined)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [kind]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
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
        ) : items.length ? (
          <div className={styles.grid}>
            {items.map((item) => (
              <article key={item.id} className={styles.card}>
                <div className={styles.preview}>
                  {item.file_url || item.preview_url ? (
                    <img
                      src={item.file_url || item.preview_url}
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
                    {item.description || "来自已确认项目资产"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Image className={styles.emptyIcon} />
            <p>还没有可复用资产</p>
            <p className={styles.emptyHint}>在项目资产确认页点击“保存复用”</p>
          </div>
        )}
      </main>
    </div>
  );
}
