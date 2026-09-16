import { Plus } from "lucide-react";

import styles from "../Workspace.module.scss";

export function SceneInsertDivider({
  position,
  disabled,
  revealed = false,
  onInsert,
}: {
  position: number;
  disabled?: boolean;
  revealed?: boolean;
  onInsert: (position: number) => void;
}) {
  return (
    <div className={styles.insertDivider} aria-label={`在第 ${position} 个位置插入片段`}>
      <button
        type="button"
        disabled={disabled}
        className={revealed ? styles.insertButtonRevealed : styles.insertButton}
        onClick={() => onInsert(position)}
        title={`在片段 ${position} 插入新片段`}
      >
        <Plus className={styles.insertIcon} />
      </button>
      <span className={revealed ? styles.insertLineRevealed : styles.insertLine} />
    </div>
  );
}
