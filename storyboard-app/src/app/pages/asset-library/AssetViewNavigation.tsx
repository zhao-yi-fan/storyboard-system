import { Plus } from "lucide-react";

import type { AssetRequirement } from "../../api";
import { Button } from "../../components/ui/button";
import { AssetBatchGenerateAction } from "./AssetBatchGenerateAction";
import styles from "./AssetLibrary.module.scss";

type Props = {
  prepare: boolean;
  chapterId?: number;
  items: AssetRequirement[];
  loading: boolean;
  busy: boolean;
  onView: (view: "prepare" | "all") => void;
  onImport: () => void;
  onCreate: () => void;
  onGenerate: () => Promise<void>;
};

export function AssetViewNavigation({
  prepare,
  chapterId,
  items,
  loading,
  busy,
  onView,
  onImport,
  onCreate,
  onGenerate,
}: Props) {
  return (
    <nav className={styles.viewNavigation} aria-label="资产视图">
      <div className={styles.viewTabs}>
        {(
          [
            { value: "prepare", label: "本集准备" },
            { value: "all", label: "全部资产" },
          ] as const
        ).map(({ value, label }) => (
          <Button
            key={value}
            size="sm"
            variant="ghost"
            aria-pressed={prepare === (value === "prepare")}
            className={prepare === (value === "prepare") ? styles.assetViewActive : undefined}
            onClick={() => onView(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className={styles.viewActions}>
        {prepare ? (
          <AssetBatchGenerateAction
            chapterId={chapterId}
            items={items}
            loading={loading}
            busy={busy}
            onGenerate={onGenerate}
          />
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={onImport}>
              从个人空间导入
            </Button>
            <Button size="sm" onClick={onCreate}>
              <Plus className={styles.createButtonIcon} />
              新建资产
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
