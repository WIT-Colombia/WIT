import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  type BusinessAuthUser,
  type BusinessSessionState,
  getRememberedEmail,
  login,
  logout,
  getMe,
  register,
  restoreSession,
} from "./businessAuthService";

type BusinessAuthContextValue = {
  state: BusinessSessionState;
  user: BusinessAuthUser | null;
  signIn: (email: string, password: string, rememberMe: boolean) => Promise<BusinessAuthUser>;
  signUp: (name: string, email: string, password: string) => Promise<BusinessAuthUser>;
  signOut: () => Promise<void>;
  rememberedEmail: string;
  refresh: () => Promise<BusinessSessionState>;
};

const AuthContext = createContext<BusinessAuthContextValue | null>(null);

export function BusinessAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BusinessSessionState>({ status: "unchecked" });

  const refresh = useCallback(async () => {
    const next = await restoreSession();
    setState(next);
    return next;
  }, []);
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (state.status !== "authenticated") return;
    let active = true;
    const synchronize = () => {
      if (document.visibilityState !== "visible") return;
      void getMe().then((user) => {
        if (!active) return;
        setState((current) => {
          if (current.status !== "authenticated") return current;
          const unchanged = current.user.avatarUrl === user.avatarUrl
            && current.user.displayName === user.displayName
            && current.user.nickname === user.nickname
            && current.user.emailNormalized === user.emailNormalized;
          return unchanged ? current : { status: "authenticated", user };
        });
      }).catch(() => {});
    };
    const interval = window.setInterval(synchronize, 3000);
    window.addEventListener("focus", synchronize);
    document.addEventListener("visibilitychange", synchronize);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", synchronize); document.removeEventListener("visibilitychange", synchronize); };
  }, [state.status]);

  const value = useMemo<BusinessAuthContextValue>(() => ({
    state,
    user: state.status === "authenticated" ? state.user : null,
    signIn: async (email, password, rememberMe) => {
      const user = await login(email, password, rememberMe);
      setState({ status: "authenticated", user });
      return user;
    },
    signUp: (name, email, password) => register(name, email, password),
    signOut: async () => {
      await logout();
      setState({ status: "unauthenticated" });
    },
    rememberedEmail: getRememberedEmail(),
    refresh,
  }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useBusinessAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("BusinessAuthProvider no está disponible");
  return context;
}

export type BusinessAuthSubmitEvent = FormEvent<HTMLFormElement>;
