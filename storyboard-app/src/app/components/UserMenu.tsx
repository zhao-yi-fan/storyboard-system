import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { LogOut, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "../api";
import { clearAuthSession, getAuthSession } from "../lib/auth";
import styles from "./UserMenu.module.scss";

function getInitials(displayName: string) {
  return displayName.trim().slice(0, 1).toUpperCase() || "创";
}

type UserMenuProps = {
  placement?: "header" | "sidebar";
};

export function UserMenu({ placement = "header" }: UserMenuProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const session = getAuthSession();

  const userInfo = useMemo(
    () => ({
      name: session?.display_name || "创作者",
      role: session?.role_label || "分镜工作室",
      initials: getInitials(session?.display_name || "创作者"),
    }),
    [session],
  );

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    try {
      await authApi.logout({ suppressToast: true });
    } catch {
      // 服务端会话失效时仍然允许前端清理本地状态。
    } finally {
      clearAuthSession();
      navigate("/login", { replace: true });
      toast.success("已退出登录");
    }
  };

  return (
    <div ref={ref} className={styles.menu}>
      <button
        onClick={() => setOpen((value) => !value)}
        className={open ? styles.triggerOpen : styles.trigger}
      >
        <div className={styles.triggerAvatar}>
          <span className={styles.triggerInitials}>{userInfo.initials}</span>
        </div>
        <span className={styles.triggerName}>{userInfo.name}</span>
        <ChevronDown size={11} className={open ? styles.chevronOpen : styles.chevron} />
      </button>

      {open ? (
        <div className={placement === "sidebar" ? styles.popoverSidebar : styles.popoverHeader}>
          <div className={styles.profile}>
            <div className={styles.profileRow}>
              <div className={styles.profileAvatar}>
                <span className={styles.profileInitials}>{userInfo.initials}</span>
              </div>
              <div className={styles.profileText}>
                <div className={styles.profileName}>{userInfo.name}</div>
                <div className={styles.profileRole}>{userInfo.role}</div>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <MenuItem icon={<LogOut size={13} />} label="退出登录" onClick={handleLogout} subtle />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  subtle,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  subtle?: boolean;
}) {
  return (
    <button onClick={onClick} className={subtle ? styles.menuItemSubtle : styles.menuItem}>
      <span className={styles.menuItemIcon}>{icon}</span>
      {label}
    </button>
  );
}
