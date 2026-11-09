import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError } from "../services/httpClient";
import { getMe, login, logout, refreshSession, register, restoreSession, type AuthUser, type PendingRegistrationInfo } from "../services/authService";

type AuthContextValue = {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "anonymous";
  isAuthenticated: boolean;
  register: (name: string, email: string, password: string, referralCode?: string) => Promise<PendingRegistrationInfo>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  reloadUser: () => Promise<void>;
  restoreSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const restore = () => {
      refreshSession().then((currentUser) => {
        if (active) { setUser(currentUser); setStatus("authenticated"); }
      }).catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setUser(null); setStatus("anonymous");
        } else {
          // Preserve loading during network/5xx/429 failures; guards must wait.
          timer = setTimeout(restore, error instanceof ApiError && error.retryAfterSeconds ? error.retryAfterSeconds * 1000 : 5000);
        }
      });
    };
    restore();
    window.addEventListener("online", restore);
    return () => { active = false; clearTimeout(timer); window.removeEventListener("online", restore); };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    const update = () => { getMe().then((next) => { if (active) setUser((current) => current?.avatarUrl === next.avatarUrl && current.displayName === next.displayName && current.nickname === next.nickname ? current : next); }).catch(() => {}); };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") update(); };
    const interval = window.setInterval(refreshWhenVisible, 3000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", refreshWhenVisible); };
  }, [status]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    reloadUser: async () => { const next = await getMe(); setUser(next); setStatus("authenticated"); },
    restoreSession: async () => { const next = await restoreSession(); setUser(next); setStatus("authenticated"); },
    status,
    isAuthenticated: status === "authenticated",
    register: async (name, email, password, referralCode) => { const created = await register(name, { email, password }, referralCode); setUser(null); setStatus("anonymous"); return created; },
    login: async (email, password, rememberMe = true) => { setUser(await login({ email, password }, rememberMe)); setStatus("authenticated"); },
    logout: async () => { await logout(); setUser(null); setStatus("anonymous"); },
  }), [status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe utilizarse dentro de AuthProvider.");
  return value;
}
