import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function useAccountGate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, status } = useAuth();
  return (action: () => void) => {
    if (status === "loading" || !isAuthenticated) {
      const returnTo = `${location.pathname}${location.search}${location.hash}`;
      navigate(`/register?next=${encodeURIComponent(returnTo)}`);
      return;
    }
    action();
  };
}
