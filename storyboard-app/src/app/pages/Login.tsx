import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Film, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "../api";
import { saveAuthSession } from "../lib/auth";
import loginBgVideo from "../../imports/login_bg_video.mp4";
import styles from "./Login.module.scss";

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
    const queryTarget = new URLSearchParams(location.search).get("from") || "";
    const safeQueryTarget =
      queryTarget.startsWith("/") && !queryTarget.startsWith("//") ? queryTarget : "";
    return state?.from || safeQueryTarget || "/projects";
  }, [location.search, location.state]);

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
    <div className={styles.page}>
      <video
        src={loginBgVideo}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className={styles.backgroundVideo}
      />

      <div className={styles.tintOverlay} />
      <div className={styles.vignetteOverlay} />
      <div className={styles.rightOverlay} />
      <div className={styles.bottomOverlay} />
      <div className={styles.topOverlay} />
      <div className={styles.accentOverlay} />

      <div className={styles.desktopBrand}>
        <div className={styles.desktopBrandIcon}>
          <Film className={styles.filmIcon} />
        </div>
        <div>
          <div className={styles.desktopBrandTitle}>漫剧分镜系统</div>
          <div className={styles.desktopBrandSubtitle}>专业分镜创作工具</div>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.loginColumn}>
          <div className={styles.mobileBrand}>
            <div className={styles.mobileBrandIcon}>
              <Film className={styles.filmIcon} />
            </div>
            <div>
              <div className={styles.mobileBrandTitle}>漫剧分镜系统</div>
              <div className={styles.mobileBrandSubtitle}>专业分镜创作工具</div>
            </div>
          </div>

          <div className={styles.heading}>
            <h1 className={styles.headingTitle}>登录到分镜创作系统</h1>
            <p className={styles.headingSubtitle}>继续你的角色、场景、镜头与视频创作</p>
          </div>

          <div className={styles.cardStage}>
            <div
              className={styles.cardGlow}
              style={{
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
              className={styles.cardBorder}
              style={{
                background: wrapperBg,
                transition: isTracking ? "none" : "background 0.4s ease",
              }}
              onMouseMove={(event) => {
                const rect = cardWrapRef.current?.getBoundingClientRect();
                if (!rect) return;
                setCardMouse({ x: event.clientX - rect.left, y: event.clientY - rect.top });
              }}
            >
              <div className={styles.card}>
                <div className={styles.cardHighlight} />

                <form onSubmit={handleSubmit} className={styles.form}>
                  <div className={styles.field}>
                    <label className={styles.label}>账号（邮箱 / 手机号）</label>
                    <input
                      type="text"
                      value={account}
                      onChange={(event) => setAccount(event.target.value)}
                      placeholder="your@email.com"
                      autoComplete="username"
                      disabled={isLoading}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>密码</label>
                    <div className={styles.passwordField}>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        disabled={isLoading}
                        className={styles.passwordInput}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((value) => !value)}
                        className={styles.passwordToggle}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <label className={styles.keepLogin}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={keepLogin}
                      onClick={() => setKeepLogin((value) => !value)}
                      className={styles.keepLoginSwitch}
                      style={{
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
                        className={styles.keepLoginThumb}
                        style={{
                          transform: keepLogin ? "translateX(16px)" : "translateX(2px)",
                          boxShadow: keepLogin
                            ? "0 1px 4px rgba(0,0,0,0.4)"
                            : "0 1px 3px rgba(0,0,0,0.3)",
                          opacity: keepLogin ? 1 : 0.75,
                        }}
                      />
                    </button>
                    <span className={styles.keepLoginLabel}>保持登录状态</span>
                  </label>

                  {error ? (
                    <div className={styles.error}>
                      <span className={styles.errorDot} />
                      {error}
                    </div>
                  ) : null}

                  <button type="submit" disabled={isLoading} className={styles.submitButton}>
                    {isLoading ? (
                      <>
                        <Loader2 size={14} className={styles.loadingIcon} />
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
