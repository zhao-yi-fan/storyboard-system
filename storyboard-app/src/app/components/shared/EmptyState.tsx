import { type LucideIcon,PackageOpen } from "lucide-react";
import type { ReactNode } from "react";

import styles from "./EmptyState.module.scss";

export function EmptyState({
  title,
  description,
  icon: Icon = PackageOpen,
  action,
  compact = false,
  error = false,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  compact?: boolean;
  error?: boolean;
}) {
  return (
    <div className={compact ? styles.compact : styles.state} role={error ? "alert" : undefined}>
      <div className={styles.graphic} aria-hidden="true">
        <Icon />
      </div>
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
