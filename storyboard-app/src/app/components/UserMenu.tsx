import { useMemo } from "react";
import { useNavigate } from "react-router";
import { LogOut, Settings2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "../api";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { clearAuthSession, getAuthSession } from "../lib/auth";

function getInitials(displayName: string) {
  return displayName.trim().slice(0, 1).toUpperCase() || "创";
}

export function UserMenu() {
  const navigate = useNavigate();
  const session = getAuthSession();

  const userInfo = useMemo(
    () => ({
      displayName: session?.display_name || "创作者",
      roleLabel: session?.role_label || "分镜工作室",
      initials: getInitials(session?.display_name || "创作者"),
    }),
    [session],
  );

  const handleAccountSettings = () => {
    toast.info("账号设置将在接入真实鉴权后开放");
  };

  const handleLogout = async () => {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 rounded-full border border-gray-800 bg-[#1a1a1a] px-2.5 text-left hover:border-purple-500/60 hover:bg-[#202020]"
        >
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7 border border-purple-500/30 bg-gradient-to-br from-purple-500/90 to-fuchsia-600/90">
              <AvatarFallback className="bg-transparent text-xs font-medium text-white">
                {userInfo.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm text-gray-100">{userInfo.displayName}</div>
              <div className="truncate text-[11px] text-gray-500">{userInfo.roleLabel}</div>
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 border-gray-800 bg-[#111111] p-2 text-gray-200 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      >
        <DropdownMenuLabel className="rounded-md bg-[#171717] px-3 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-purple-500/30 bg-gradient-to-br from-purple-500/90 to-fuchsia-600/90">
              <AvatarFallback className="bg-transparent text-sm font-medium text-white">
                {userInfo.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{userInfo.displayName}</div>
              <div className="truncate text-xs font-normal text-gray-500">{userInfo.roleLabel}</div>
            </div>
          </div>
          <Badge className="mt-3 border border-purple-500/20 bg-purple-500/12 text-purple-200">
            <Sparkles className="mr-1 h-3 w-3" />
            创作中
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-800" />
        <DropdownMenuItem
          className="rounded-md px-3 py-2 text-sm text-gray-200 focus:bg-[#1c1c1c] focus:text-white"
          onClick={handleAccountSettings}
        >
          <Settings2 className="h-4 w-4" />
          账号设置
        </DropdownMenuItem>
        <DropdownMenuItem
          className="rounded-md px-3 py-2 text-sm text-red-300 focus:bg-red-500/12 focus:text-red-200"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
