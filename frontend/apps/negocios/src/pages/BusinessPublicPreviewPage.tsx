import { useEffect } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { getPublicBusinessPreviewUrl } from "../config/publicApp";
import { useBusinessStore } from "../services/businessStore";

/**
 * Compatibility route: legacy Business links must also open the real public
 * Usuarios page, avoiding Business CSS inheritance and duplicate layouts.
 */
export default function BusinessPublicPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { businesses, businessesReady } = useBusinessStore();
  const business = businesses.find((item) => item.publicId === id);
  const previousPath = searchParams.get("returnTo") ?? "";
  const safeReturnPath = /^\/mi-negocio\/detalle\/\d+$/.test(previousPath) ? previousPath : "/inicio";
  const previewUrl = business && typeof window !== "undefined"
    ? getPublicBusinessPreviewUrl(business.publicId, new URL(safeReturnPath, window.location.origin).toString())
    : null;

  useEffect(() => {
    if (previewUrl) window.location.replace(previewUrl);
  }, [previewUrl]);

  if (!businessesReady) return <p role="status">Cargando negocio…</p>;
  if (!business) return <Navigate to="/inicio" replace />;

  return <main className="business-public-preview-redirect" role="status">
    <p>Abriendo la ficha pública en modo de solo lectura…</p>
    {previewUrl ? <a href={previewUrl}>Continuar a la ficha</a> : <Link to="/inicio">Volver a Business</Link>}
  </main>;
}
