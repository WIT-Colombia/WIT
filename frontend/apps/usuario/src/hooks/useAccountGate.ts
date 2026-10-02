import { useLocation, useNavigate } from "react-router-dom";
import { isUserAuthenticated } from "../services/userDataService";

export function useAccountGate() {
  const navigate = useNavigate();
  const location = useLocation();
  return (action: () => void) => {
    if (!isUserAuthenticated()) {
      const returnTo = `${location.pathname}${location.search}${location.hash}`;
      navigate(`/register?next=${encodeURIComponent(returnTo)}`);
      return;
    }
    action();
  };
}
