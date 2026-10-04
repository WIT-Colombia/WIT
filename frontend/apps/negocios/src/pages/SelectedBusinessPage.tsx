import { Navigate } from "react-router-dom";
import { useBusinessStore } from "../services/businessStore";

export function SelectedBusinessPage() {
  const { businesses, business } = useBusinessStore();
  const index = Math.max(0, businesses.findIndex(item => item.name === business.name));
  return <Navigate to={`/mi-negocio/detalle/${index}`} replace />;
}
