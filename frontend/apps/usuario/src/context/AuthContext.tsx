import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError } from "../services/httpClient";
import { getMe, login, logout, refreshSession, register, type AuthUser } from "../services/authService";

type AuthContextValue = {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "anonymous";
  isAuthenticated: boolean;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
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

  const value = useMemo<AuthContextValue>(() => ({
    user,
    status,
    isAuthenticated: status === "authenticated",
    register: async (name, email, password) => { setUser(await register(name, { email, password })); setStatus("authenticated"); },
    login: async (email, password) => { setUser(await login({ email, password })); setStatus("authenticated"); },
    logout: async () => { await logout(); setUser(null); setStatus("anonymous"); },
  }), [status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe utilizarse dentro de AuthProvider.");
  return value;
}
