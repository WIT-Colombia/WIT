import { Link, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "../../../usuario/src/context/AuthContext";
import { LocationProvider } from "../../../usuario/src/context/LocationContext";
import BusinessDetail from "../../../usuario/src/pages/BusinessDetail";
import { useBusinessStore } from "../services/businessStore";
import "./BusinessPublicPreviewPage.css";

/**
 * The actual public listing, embedded in Business as a read-only preview.
 * No user actions, external navigation or Business administration controls.
 */
export default function BusinessPublicPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const { businesses, businessesReady } = useBusinessStore();

  if (!businessesReady) return <p className="business-public-preview-status" role="status">Cargando negocio…</p>;
  if (!id || !businesses.some((business) => business.publicId === id)) {
    return <Navigate to="/inicio" replace />;
  }

  return <div className="business-public-preview">
    <div className="business-public-preview-navigation">
      <Link className="business-public-preview-back" to="/inicio">← Volver a Business</Link>
      <span className="business-public-preview-label">Vista pública · Solo lectura</span>
    </div>
    <AuthProvider>
      <LocationProvider>
        <BusinessDetail embeddedPreview />
      </LocationProvider>
    </AuthProvider>
  </div>;
}
