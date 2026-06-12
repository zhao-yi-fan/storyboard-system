import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Film, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "../api";
import { saveAuthSession } from "../lib/auth";
import loginBgVideo from "../../imports/login_bg_video.mp4";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepLogin, setKeepLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [cardMouse, setCardMouse] = useState({ x: 0, y: 0 });
  const [cardHovered, setCardHovered] = useState(false);
  const [outerGlow, setOuterGlow] = useState({ x: 0, y: 0, alpha: 0 });
  const cardWrapRef = useRef<HTMLDivElement>(null);

  const redirectTarget = useMemo(() => {
    const state = location.state as { from?: string } | null;
    return state?.from || "/projects";
  }, [location.state]);

  useEffect(() => {
    const fadePx = 220;

    const onMove = (event: MouseEvent) => {
      const rect = cardWrapRef.current?.getBoundingClientRect();
      if (!rect) return;

      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      setCardHovered(inside);

      if (inside) {
        setOuterGlow({ x: 0, y: 0, alpha: 0 });
        return;
      }

      const closestX = Math.max(rect.left, Math.min(event.clientX, rect.right)) - rect.left;
      const closestY = Math.max(rect.top, Math.min(event.clientY, rect.bottom)) - rect.top;
      const dx = event.clientX - (closestX + rect.left);
      const dy = event.clientY - (closestY + rect.top);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const t = Math.max(0, 1 - distance / fadePx);

      setOuterGlow({ x: closestX, y: closestY, alpha: t * t });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const normalizedAccount = account.trim();
    const normalizedPassword = password.trim();
    if (!normalizedAccount || !normalizedPassword) {
      const message = "请输入账号和密码";
      setError(message);
      toast.error(message);
      return;
    }

    setIsLoading(true);
    try {
      const user = await authApi.login(
        { account: normalizedAccount, password: normalizedPassword },
        { suppressToast: true },
      );
      saveAuthSession(user);
      toast.success("登录成功");
      navigate(redirectTarget, { replace: true });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "登录失败";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const inputBase: React.CSSProperties = {
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.1)",
    transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
  };
  const inputFocus: React.CSSProperties = {
    background: "rgba(109,40,217,0.07)",
    border: "1px solid rgba(139,92,246,0.6)",
    boxShadow: "0 0 0 3px rgba(139,92,246,0.14), inset 0 1px 0 rgba(255,255,255,0.04)",
  };
  const inputHover: React.CSSProperties = {
    background: "rgba(255,255,255,0.075)",
    border: "1px solid rgba(255,255,255,0.16)",
  };

  const isTracking = cardHovered || outerGlow.alpha > 0.015;
  const wrapperBg = cardHovered
    ? `radial-gradient(260px circle at ${cardMouse.x}px ${cardMouse.y}px,
        rgba(168,85,247,0.65) 0%,
        rgba(139,92,246,0.28) 38%,
        rgba(255,255,255,0.07) 65%,
        rgba(255,255,255,0.04) 100%)`
    : outerGlow.alpha > 0.015
      ? (() => {
          const alpha = outerGlow.alpha;
          return `radial-gradient(72px circle at ${outerGlow.x}px ${outerGlow.y}px,
            rgba(230,215,255,${0.82 * alpha}) 0%,
            rgba(180,150,255,${0.55 * alpha}) 22%,
            rgba(139,92,246,${0.22 * alpha}) 50%,
            rgba(255,255,255,${0.04 * alpha}) 80%,
            rgba(255,255,255,0.05) 100%)`;
        })()
      : "rgba(255,255,255,0.07)";

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#060508] text-gray-100">
      <video
        src={loginBgVideo}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: "brightness(0.55) saturate(0.75)" }}
      />

      <div className="absolute inset-0" style={{ background: "rgba(4,3,8,0.42)" }} />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 110% 100% at 50% 50%, transparent 30%, rgba(4,3,8,0.55) 70%, rgba(4,3,8,0.82) 100%)" }}
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to right, transparent 40%, rgba(4,3,8,0.22) 65%, rgba(4,3,8,0.38) 100%)" }}
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(4,3,8,0.55) 0%, transparent 28%)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(4,3,8,0.45) 0%, transparent 16%)" }} />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 70% at 28% 50%, rgba(109,40,217,0.11) 0%, transparent 65%)" }}
      />

      <div className="absolute left-9 top-7 z-20 hidden select-none items-center gap-2.5 lg:flex">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
            boxShadow: "0 2px 12px rgba(168,85,247,0.35)",
          }}
        >
          <Film className="h-4 w-4 text-white" />
        </div>
        <div>
          <div
            className="text-sm font-medium leading-tight"
            style={{ color: "rgba(255,255,255,0.88)", textShadow: "0 1px 10px rgba(0,0,0,0.8)" }}
          >
            漫剧分镜系统
          </div>
          <div
            className="text-[11px] leading-tight"
            style={{ color: "rgba(255,255,255,0.32)", textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}
          >
            专业分镜创作工具
          </div>
        </div>
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center lg:justify-end">
        <div className="w-full max-w-sm px-8 py-10 lg:w-[400px] lg:max-w-none lg:px-10 xl:w-[420px] xl:px-14">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)" }}
            >
              <Film className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-medium">漫剧分镜系统</div>
              <div className="text-[11px] text-gray-500">专业分镜创作工具</div>
            </div>
          </div>

          <div className="mb-7">
            <h1
              className="mb-1.5 text-xl font-medium"
              style={{ color: "rgba(255,255,255,0.92)", textShadow: "0 1px 16px rgba(0,0,0,0.95)" }}
            >
              登录到分镜创作系统
            </h1>
            <p
              className="text-sm"
              style={{ color: "rgba(255,255,255,0.42)", textShadow: "0 1px 10px rgba(0,0,0,0.85)" }}
            >
              继续你的角色、场景、镜头与视频创作
            </p>
          </div>

          <div className="relative">
            <div
              className="pointer-events-none absolute"
              style={{
                inset: "-48px",
                borderRadius: "calc(1rem + 48px)",
                filter: "blur(32px)",
                opacity: isTracking ? 1 : 0,
                transition: isTracking ? "opacity 0.06s" : "opacity 0.55s ease",
                background: cardHovered
                  ? `radial-gradient(300px circle at ${cardMouse.x + 48}px ${cardMouse.y + 48}px,
                      rgba(139,92,246,0.2) 0%,
                      rgba(109,40,217,0.07) 48%,
                      transparent 72%)`
                  : outerGlow.alpha > 0.015
                    ? `radial-gradient(180px circle at ${outerGlow.x + 48}px ${outerGlow.y + 48}px,
                        rgba(139,92,246,${0.14 * outerGlow.alpha}) 0%,
                        rgba(109,40,217,${0.05 * outerGlow.alpha}) 52%,
                        transparent 78%)`
                    : "transparent",
              }}
            />

            <div
              ref={cardWrapRef}
              className="rounded-2xl"
              style={{
                padding: "1px",
                background: wrapperBg,
                transition: isTracking ? "none" : "background 0.4s ease",
                boxShadow: [
                  "0 2px 4px rgba(0,0,0,0.4)",
                  "0 12px 32px rgba(0,0,0,0.55)",
                  "0 40px 80px rgba(0,0,0,0.35)",
                ].join(", "),
              }}
              onMouseMove={(event) => {
                const rect = cardWrapRef.current?.getBoundingClientRect();
                if (!rect) return;
                setCardMouse({ x: event.clientX - rect.left, y: event.clientY - rect.top });
              }}
            >
              <div
                className="relative rounded-2xl p-6"
                style={{
                  background: "rgba(7,6,12,0.76)",
                  backdropFilter: "blur(24px) saturate(1.3)",
                  WebkitBackdropFilter: "blur(24px) saturate(1.3)",
                  boxShadow: [
                    "inset 0 1px 0 rgba(255,255,255,0.07)",
                    "inset 0 -1px 0 rgba(0,0,0,0.3)",
                  ].join(", "),
                }}
              >
                <div
                  className="pointer-events-none absolute left-0 right-0 top-0 h-px overflow-hidden rounded-t-2xl"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 5%, rgba(139,92,246,0.5) 35%, rgba(168,85,247,0.65) 50%, rgba(139,92,246,0.5) 65%, transparent 95%)",
                  }}
                />

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      className="text-xs tracking-wide"
                      style={{ color: "rgba(255,255,255,0.42)", letterSpacing: "0.04em" }}
                    >
                      账号（邮箱 / 手机号）
                    </label>
                    <input
                      type="text"
                      value={account}
                      onChange={(event) => setAccount(event.target.value)}
                      placeholder="your@email.com"
                      autoComplete="username"
                      disabled={isLoading}
                      className="h-10 w-full rounded-lg px-3 text-sm text-[rgba(255,255,255,0.9)] outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      style={inputBase}
                      onMouseEnter={(event) => {
                        if (document.activeElement !== event.currentTarget) {
                          Object.assign(event.currentTarget.style, inputHover);
                        }
                      }}
                      onMouseLeave={(event) => {
                        if (document.activeElement !== event.currentTarget) {
                          Object.assign(event.currentTarget.style, inputBase);
                        }
                      }}
                      onFocus={(event) => Object.assign(event.currentTarget.style, inputFocus)}
                      onBlur={(event) => Object.assign(event.currentTarget.style, inputBase)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      className="text-xs tracking-wide"
                      style={{ color: "rgba(255,255,255,0.42)", letterSpacing: "0.04em" }}
                    >
                      密码
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        disabled={isLoading}
                        className="h-10 w-full rounded-lg pl-3 pr-10 text-sm text-[rgba(255,255,255,0.9)] outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        style={inputBase}
                        onMouseEnter={(event) => {
                          if (document.activeElement !== event.currentTarget) {
                            Object.assign(event.currentTarget.style, inputHover);
                          }
                        }}
                        onMouseLeave={(event) => {
                          if (document.activeElement !== event.currentTarget) {
                            Object.assign(event.currentTarget.style, inputBase);
                          }
                        }}
                        onFocus={(event) => Object.assign(event.currentTarget.style, inputFocus)}
                        onBlur={(event) => Object.assign(event.currentTarget.style, inputBase)}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150"
                        style={{ color: "rgba(255,255,255,0.25)" }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.color = "rgba(255,255,255,0.65)";
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.color = "rgba(255,255,255,0.25)";
                        }}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <label className="group flex cursor-pointer items-center gap-2.5 pt-0.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={keepLogin}
                      onClick={() => setKeepLogin((value) => !value)}
                      className="relative flex-shrink-0 rounded-full outline-none transition-all duration-200"
                      style={{
                        width: 32,
                        height: 18,
                        background: keepLogin
                          ? "linear-gradient(135deg, #8b5cf6, #7c3aed)"
                          : "rgba(255,255,255,0.06)",
                        border: keepLogin
                          ? "1px solid rgba(139,92,246,0.55)"
                          : "1px solid rgba(255,255,255,0.1)",
                        boxShadow: keepLogin ? "0 0 8px rgba(139,92,246,0.3)" : "none",
                      }}
                    >
                      <span
                        className="absolute top-[2px] block rounded-full transition-transform duration-200"
                        style={{
                          width: 13,
                          height: 13,
                          background: "white",
                          left: 0,
                          transform: keepLogin ? "translateX(16px)" : "translateX(2px)",
                          boxShadow: keepLogin
                            ? "0 1px 4px rgba(0,0,0,0.4)"
                            : "0 1px 3px rgba(0,0,0,0.3)",
                          opacity: keepLogin ? 1 : 0.75,
                        }}
                      />
                    </button>
                    <span
                      className="select-none text-xs transition-colors duration-150"
                      style={{ color: "rgba(255,255,255,0.35)" }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.color = "rgba(255,255,255,0.55)";
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.color = "rgba(255,255,255,0.35)";
                      }}
                    >
                      保持登录状态
                    </span>
                  </label>

                  {error ? (
                    <div
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs"
                      style={{
                        color: "rgba(252,165,165,0.85)",
                        background: "rgba(239,68,68,0.07)",
                        border: "1px solid rgba(239,68,68,0.18)",
                      }}
                    >
                      <span
                        className="h-1 w-1 flex-shrink-0 rounded-full"
                        style={{ background: "rgba(252,165,165,0.7)" }}
                      />
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-white outline-none transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 45%, #6d28d9 100%)",
                      border: "1px solid rgba(139,92,246,0.45)",
                      letterSpacing: "0.025em",
                      boxShadow: [
                        "0 1px 0 rgba(255,255,255,0.1) inset",
                        "0 4px 16px rgba(109,40,217,0.35)",
                        "0 1px 3px rgba(0,0,0,0.3)",
                      ].join(", "),
                    }}
                    onMouseEnter={(event) => {
                      if (isLoading) return;
                      const element = event.currentTarget;
                      element.style.background = "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 45%, #7c3aed 100%)";
                      element.style.boxShadow = [
                        "0 1px 0 rgba(255,255,255,0.14) inset",
                        "0 6px 24px rgba(109,40,217,0.5)",
                        "0 1px 3px rgba(0,0,0,0.3)",
                      ].join(", ");
                      element.style.transform = "translateY(-0.5px)";
                    }}
                    onMouseLeave={(event) => {
                      const element = event.currentTarget;
                      element.style.background = "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 45%, #6d28d9 100%)";
                      element.style.boxShadow = [
                        "0 1px 0 rgba(255,255,255,0.1) inset",
                        "0 4px 16px rgba(109,40,217,0.35)",
                        "0 1px 3px rgba(0,0,0,0.3)",
                      ].join(", ");
                      element.style.transform = "translateY(0)";
                    }}
                    onMouseDown={(event) => {
                      const element = event.currentTarget;
                      element.style.transform = "translateY(0.5px)";
                      element.style.boxShadow = [
                        "0 1px 0 rgba(255,255,255,0.08) inset",
                        "0 2px 8px rgba(109,40,217,0.3)",
                        "0 1px 2px rgba(0,0,0,0.3)",
                      ].join(", ");
                    }}
                    onMouseUp={(event) => {
                      event.currentTarget.style.transform = "translateY(-0.5px)";
                    }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" style={{ opacity: 0.75 }} />
                        <span>验证中...</span>
                      </>
                    ) : (
                      "进入创作空间"
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
