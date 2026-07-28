import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { authApi } from "../api";
import { clearAuthSession, getAuthSession, saveAuthSession } from "../lib/auth";
import styles from "./RouteGuards.module.scss";

const AUTH_STATUS = {
  CHECKING: "checking",
  AUTHENTICATED: "authenticated",
  GUEST: "guest",
} as const;

type AuthStatus = (typeof AUTH_STATUS)[keyof typeof AUTH_STATUS];

function AuthCheckingScreen() {
  return <div className={`dark ${styles.checkingScreen}`}>正在校验登录状态...</div>;
}

function useAuthStatus() {
  const [status, setStatus] = useState<AuthStatus>(AUTH_STATUS.CHECKING);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      try {
        const user = await authApi.getCurrentUser({ suppressToast: true });
        if (!active) return;
        saveAuthSession(user);
        setStatus(AUTH_STATUS.AUTHENTICATED);
      } catch {
        if (!active) return;
        clearAuthSession();
        setStatus(AUTH_STATUS.GUEST);
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

  if (status === AUTH_STATUS.CHECKING) {
    return <AuthCheckingScreen />;
  }

  if (status !== AUTH_STATUS.AUTHENTICATED) {
    const redirectTarget = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from: redirectTarget }} />;
  }

  return <Outlet />;
}

export function GuestOnlyRoute() {
  const location = useLocation();
  const status = useAuthStatus();

  if (status === AUTH_STATUS.CHECKING) {
    return <AuthCheckingScreen />;
  }

  if (status === AUTH_STATUS.AUTHENTICATED) {
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
