import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isUserAuthenticated } from "../services/userDataService";

export function RequireAccount({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (isUserAuthenticated()) return children;
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  return <Navigate to={`/register?next=${encodeURIComponent(returnTo)}`} replace/>;
}
