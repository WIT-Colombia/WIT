import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError } from "../services/httpClient";
import { getMe, login, logout, refreshSession, register, restoreSession, type AuthUser, type PendingRegistrationInfo } from "../services/authService";

type AuthContextValue = {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "anonymous";
  isAuthenticated: boolean;
  register: (name: string, email: string, password: string, referralCode?: string) => Promise<PendingRegistrationInfo>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  reloadUser: () => Promise<void>;
  completeVerification: (verifiedUser: AuthUser) => void;
  restoreSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  // Ignore a stale initial refresh after email verification has established a session.
  const verificationEpoch = useRef(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const restore = () => {
      const epoch = verificationEpoch.current;
      refreshSession().then((currentUser) => {
        if (active && epoch === verificationEpoch.current) { failures = 0; setUser(currentUser); setStatus("authenticated"); }
      }).catch((error: unknown) => {
        if (!active || epoch !== verificationEpoch.current) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setUser(null); setStatus("anonymous");
        } else {
          // Public routes must remain usable when session restoration is unavailable.
          // Keep retrying in the background so a previously authenticated user can recover.
          failures += 1;
          if (failures >= 2) { setUser(null); setStatus("anonymous"); }
          clearTimeout(timer);
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
    const interval = window.setInterval(refreshWhenVisible, 60000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", refreshWhenVisible); };
  }, [status]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    reloadUser: async () => { const next = await getMe(); setUser(next); setStatus("authenticated"); },
    completeVerification: (verifiedUser) => {
      verificationEpoch.current += 1;
      setUser(verifiedUser);
      setStatus("authenticated");
    },
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
