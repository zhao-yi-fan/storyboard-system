import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { authApi } from "../api";
import { clearAuthSession, getAuthSession, saveAuthSession } from "../lib/auth";

type AuthStatus = "checking" | "authenticated" | "guest";

function AuthCheckingScreen() {
  return (
    <div className="dark flex min-h-screen items-center justify-center bg-[#0a0a0a] text-sm text-gray-400">
      正在校验登录状态...
    </div>
  );
}

function useAuthStatus() {
  const [status, setStatus] = useState<AuthStatus>("checking");

  useEffect(() => {
    let active = true;

    const verify = async () => {
      try {
        const user = await authApi.getCurrentUser({ suppressToast: true });
        if (!active) return;
        saveAuthSession(user);
        setStatus("authenticated");
      } catch {
        if (!active) return;
        clearAuthSession();
        setStatus("guest");
      }
    };

    void verify();

    return () => {
      active = false;
    };
  }, []);

  return status;
}

export function RootRedirect() {
  const targetPath = getAuthSession() ? "/projects" : "/login";
  return <Navigate to={targetPath} replace />;
}

export function RequireAuthRoute() {
  const location = useLocation();
  const status = useAuthStatus();

  if (status === "checking") {
    return <AuthCheckingScreen />;
  }

  if (status !== "authenticated") {
    const redirectTarget = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from: redirectTarget }} />;
  }

  return <Outlet />;
}

export function GuestOnlyRoute() {
  const location = useLocation();
  const status = useAuthStatus();

  if (status === "checking") {
    return <AuthCheckingScreen />;
  }

  if (status === "authenticated") {
    const redirectTarget =
      typeof location.state === "object" &&
      location.state &&
      "from" in location.state &&
      typeof location.state.from === "string" &&
      location.state.from
        ? location.state.from
        : "/projects";
    return <Navigate to={redirectTarget} replace />;
  }

  return <Outlet />;
}
