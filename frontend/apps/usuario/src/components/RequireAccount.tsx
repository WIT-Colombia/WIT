import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RequireAccount({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, status } = useAuth();
  if (status === "loading") return null;
  if (isAuthenticated) return children;
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  return <Navigate to={`/register?next=${encodeURIComponent(returnTo)}`} replace/>;
}
