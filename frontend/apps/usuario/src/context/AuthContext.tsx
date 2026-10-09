import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError } from "../services/httpClient";
import { getMe, login, logout, refreshSession, register, restoreSession, type AuthUser } from "../services/authService";

type AuthContextValue = {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "anonymous";
  isAuthenticated: boolean;
  register: (name: string, email: string, password: string) => Promise<AuthUser>;
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
    refreshSession()
      .then(() => getMe())
      .then((currentUser) => { if (active) { setUser(currentUser); setStatus("authenticated"); } })
      .catch((error: unknown) => { if (active && error instanceof ApiError && error.status === 401) { setUser(null); setStatus("anonymous"); } else if (active) { setUser(null); setStatus("anonymous"); } })
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    const update = () => { getMe().then((next) => { if (active) setUser(next); }).catch(() => {}); };
    window.addEventListener("focus", update);
    return () => { active = false; window.removeEventListener("focus", update); };
  }, [status]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    reloadUser: async () => { const next = await getMe(); setUser(next); setStatus("authenticated"); },
    restoreSession: async () => { const next = await restoreSession(); setUser(next); setStatus("authenticated"); },
    status,
    isAuthenticated: status === "authenticated",
    register: async (name, email, password) => { const created = await register(name, { email, password }); setUser(null); setStatus("anonymous"); return created; },
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
