import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Eye, EyeOff, Film, Loader2, LockKeyhole, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "../api";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { saveAuthSession } from "../lib/auth";

const LOGIN_BG_VIDEO_URL = String(import.meta.env.VITE_LOGIN_BG_VIDEO_URL || "").trim();

type PointerState = {
  x: number;
  y: number;
  insideCard: boolean;
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pointer, setPointer] = useState<PointerState>({ x: 0, y: 0, insideCard: false });

  const redirectTarget = useMemo(() => {
    const state = location.state as { from?: string } | null;
    return state?.from || "/projects";
  }, [location.state]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const cardRect = cardRef.current?.getBoundingClientRect();
      const insideCard = cardRect
        ? event.clientX >= cardRect.left &&
          event.clientX <= cardRect.right &&
          event.clientY >= cardRect.top &&
          event.clientY <= cardRect.bottom
        : false;

      setPointer({
        x: event.clientX,
        y: event.clientY,
        insideCard,
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedAccount = account.trim();
    const normalizedPassword = password.trim();
    if (!normalizedAccount || !normalizedPassword) {
      const message = "请输入账号和密码";
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const user = await authApi.login(
        { account: normalizedAccount, password: normalizedPassword },
        { suppressToast: true },
      );
      saveAuthSession(user);
      navigate(redirectTarget, { replace: true });
      toast.success("登录成功");
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const glowStyle = pointer.insideCard
    ? undefined
    : {
        background: `radial-gradient(240px circle at ${pointer.x}px ${pointer.y}px, rgba(168,85,247,0.22), rgba(168,85,247,0.08) 34%, rgba(10,10,10,0) 72%)`,
      };

  return (
    <div className="dark relative min-h-screen overflow-hidden bg-[#050505] text-gray-100">
      {LOGIN_BG_VIDEO_URL ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={LOGIN_BG_VIDEO_URL}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),rgba(5,5,5,0)_28%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.2),rgba(5,5,5,0)_24%),linear-gradient(135deg,#09090b_0%,#050505_42%,#0f0f14_100%)]" />
      )}

      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(4,4,5,0.82)_0%,rgba(4,4,5,0.58)_35%,rgba(4,4,5,0.18)_72%,rgba(4,4,5,0.72)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03),rgba(255,255,255,0)_52%)]" />

      <div className="relative flex min-h-screen">
        <div className="hidden flex-1 xl:flex">
          <div className="flex w-full flex-col justify-between px-12 py-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 shadow-[0_14px_40px_rgba(168,85,247,0.38)]">
                <Film className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-base font-medium text-white">漫剧分镜系统</div>
                <div className="text-xs text-gray-400">Storyboard Creation Workspace</div>
              </div>
            </div>

            <div className="max-w-xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-purple-100/90 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" />
                影视级分镜创作工作流
              </div>
              <h1 className="text-5xl font-medium leading-tight text-white">
                把小说、镜头、角色和生成任务
                <span className="block bg-gradient-to-r from-white via-purple-100 to-fuchsia-200 bg-clip-text text-transparent">
                  收进同一个创作工作台
                </span>
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-gray-300">
                登录后继续管理项目、编辑镜头、生成首帧和视频，并保留完整的创作状态与资产引用关系。
              </p>
            </div>

            <div className="grid max-w-2xl grid-cols-3 gap-4 text-sm">
              {[
                ["小说解析", "章节、场景、分镜结构化整理"],
                ["镜头编辑", "角色、对白、风格和运镜集中维护"],
                ["生成任务", "首帧、视频、合成结果统一回看"],
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-white/8 bg-black/18 p-4 backdrop-blur-sm">
                  <div className="text-sm font-medium text-white">{title}</div>
                  <div className="mt-2 text-xs leading-6 text-gray-400">{description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center px-5 py-8 sm:px-8 lg:w-[560px] lg:px-10 xl:w-[640px] xl:px-12">
          <div className="relative w-full max-w-[460px]">
            <div className="pointer-events-none absolute -inset-10 rounded-[32px] blur-3xl" style={glowStyle} />
            <div
              ref={cardRef}
              className="relative overflow-hidden rounded-[28px] border border-white/12 bg-[rgba(13,13,16,0.78)] p-7 shadow-[0_28px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-8"
            >
              <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-white/8" />
              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-purple-300/70 to-transparent" />

              <div className="relative">
                <div className="mb-6 flex items-center gap-3 xl:hidden">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 shadow-[0_14px_40px_rgba(168,85,247,0.38)]">
                    <Film className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-base font-medium text-white">漫剧分镜系统</div>
                    <div className="text-xs text-gray-400">创作工作台登录</div>
                  </div>
                </div>

                <div className="mb-7">
                  <div className="text-2xl font-medium text-white">登录</div>
                  <p className="mt-2 text-sm leading-6 text-gray-400">
                    进入项目总览、工作台与资产库，继续你的分镜创作流程。
                  </p>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="space-y-2.5">
                    <Label htmlFor="account" className="text-sm text-gray-300">
                      账号
                    </Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      <Input
                        id="account"
                        value={account}
                        onChange={(event) => setAccount(event.target.value)}
                        placeholder="请输入账号或邮箱"
                        autoComplete="username"
                        className="h-12 border-white/10 bg-white/6 pl-10 text-sm text-white placeholder:text-gray-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="password" className="text-sm text-gray-300">
                      密码
                    </Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="请输入密码"
                        autoComplete="current-password"
                        className="h-12 border-white/10 bg-white/6 pl-10 pr-12 text-sm text-white placeholder:text-gray-500"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition hover:bg-white/6 hover:text-gray-200"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={showPassword ? "隐藏密码" : "显示密码"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-400">
                      <Checkbox
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                        className="border-white/12 data-[state=checked]:border-purple-500 data-[state=checked]:bg-purple-600"
                      />
                      保持登录
                    </label>
                    <span className="text-xs text-gray-500">{rememberMe ? "会话将通过服务端 Cookie 保持" : "当前版本固定保持服务端会话"}</span>
                  </div>

                  {errorMessage ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {errorMessage}
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-sm text-white shadow-[0_16px_50px_rgba(168,85,247,0.38)] hover:from-purple-500 hover:to-fuchsia-500"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        登录中...
                      </>
                    ) : (
                      "进入工作台"
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
