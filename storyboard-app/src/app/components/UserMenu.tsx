import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { LogOut, ChevronDown, Settings } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "../api";
import { clearAuthSession, getAuthSession } from "../lib/auth";

function getInitials(displayName: string) {
  return displayName.trim().slice(0, 1).toUpperCase() || "创";
}

export function UserMenu() {
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

  const handleAccountSettings = () => {
    setOpen(false);
    toast.info("账号设置将在接入真实鉴权后开放");
  };

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
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className={[
          "flex h-8 select-none items-center gap-2 rounded-md border pl-1.5 pr-2 text-left outline-none transition-colors duration-150",
          open
            ? "border-gray-700 bg-[#1a1a1a] text-gray-200"
            : "border-transparent bg-transparent text-gray-400 hover:border-gray-800 hover:bg-[#1a1a1a] hover:text-gray-200",
        ].join(" ")}
      >
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br from-purple-500 to-pink-600">
          <span className="text-white" style={{ fontSize: "10px", fontWeight: 600, lineHeight: 1 }}>
            {userInfo.initials}
          </span>
        </div>
        <span className="hidden max-w-[80px] truncate text-xs sm:block">{userInfo.name}</span>
        <ChevronDown
          size={11}
          className={`opacity-40 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-lg border border-gray-800 bg-[#141414]"
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)" }}
        >
          <div className="border-b border-gray-800/80 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-pink-600">
                <span className="text-white font-semibold" style={{ fontSize: "12px" }}>
                  {userInfo.initials}
                </span>
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium leading-tight text-gray-200">
                  {userInfo.name}
                </div>
                <div className="mt-0.5 truncate text-xs leading-tight text-gray-600">
                  {userInfo.role}
                </div>
              </div>
            </div>
          </div>

          <div className="p-1">
            <MenuItem icon={<Settings size={13} />} label="账号设置" onClick={handleAccountSettings} />
          </div>

          <div className="mx-1 border-t border-gray-800/80" />

          <div className="p-1">
            <MenuItem
              icon={<LogOut size={13} />}
              label="退出登录"
              onClick={handleLogout}
              subtle
            />
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
    <button
      onClick={onClick}
      className={[
        "w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors duration-100",
        "flex items-center gap-2.5",
        subtle
          ? "text-gray-500 hover:bg-[#1c1c1c] hover:text-gray-300"
          : "text-gray-400 hover:bg-[#1c1c1c] hover:text-gray-200",
      ].join(" ")}
    >
      <span className="flex-shrink-0 opacity-70">{icon}</span>
      {label}
    </button>
  );
}
