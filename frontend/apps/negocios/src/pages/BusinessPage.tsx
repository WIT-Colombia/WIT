import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { useBusinessStore } from "../services/businessStore";
import type { BusinessDetails } from "../types/business";
import { businessApi, BusinessApiError } from "../services/businessApiClient";
import { formatCategoryName, toBusinessDetails } from "../services/realBusinessAdapter";
import { BusinessIndicatorRow } from "../components/layout/Sidebar";
import { useBusinessAuth } from "../services/businessAuthContext";
import { PersistedPhoto } from "../components/common/PersistedPhoto";

export function BusinessPage() {
  const navigate = useNavigate();
  const { business, businesses, setBusiness, setBusinesses } = useBusinessStore();
  const auth = useBusinessAuth();
  const { state: authState, refresh } = auth;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryAttempt, setRetryAttempt] = useState(0);
  useEffect(() => {
    if (authState.status !== "authenticated") return;
    let active = true;
    setLoading(true);
    setError("");
    const load = async (retryAfterRefresh: boolean) => {
      try {
        const { businesses: values } = await businessApi.list();
        if (!active) return;
        const next = values.map(toBusinessDetails);
        setBusinesses(next);
        if (next[0]) setBusiness(next[0]);
      } catch (cause) {
        if (!active) return;
        if (retryAfterRefresh && cause instanceof BusinessApiError && cause.status === 401) {
          const refreshed = await refresh();
          if (refreshed.status === "authenticated") {
            await load(false);
            return;
          }
          return;
        }
        setError(cause instanceof BusinessApiError && cause.status === 0
          ? "No pudimos conectar con XAMUKO. Comprueba tu conexión e intenta nuevamente."
          : cause instanceof BusinessApiError
            ? cause.message
            : "No se pudieron cargar tus negocios.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load(true);
    return () => { active = false; };
  }, [authState.status, refresh, retryAttempt, setBusiness, setBusinesses]);
  const selectBusiness = (item: BusinessDetails, index: number) => { setBusiness(item); navigate(`/mi-negocio/detalle/${index}`); };
  const listedBusinesses = businesses.map((item, index) => ({ item, index })).filter(({ item }) => item.deletionStatus !== "DELETED");
  return <><PageHeader eyebrow="" title="Mis negocios" description="Administra todos los negocios asociados a tu cuenta." /><section className="business-list-surface surface-card"><div className="card-heading"><div><h2>Tus negocios</h2><p>Selecciona uno para consultar toda su información o crea uno nuevo.</p></div><button className="action-button" type="button" onClick={() => navigate("/mis-negocios/nuevo")}>＋ Crear negocio</button></div>{loading && <p className="auth-status">Cargando tus negocios…</p>}{error && <div className="form-error" role="alert"><p>{error}</p><button className="outline-button" type="button" onClick={() => setRetryAttempt(value => value + 1)}>Reintentar</button></div>}{!loading && !error && <div className="business-list">{listedBusinesses.map(({ item, index }) => { const cover = item.coverImage || item.images?.[0] || ""; const publicAddress = item.locationVisibility === "PUBLIC" && item.address.trim(); return <article className={`business-list-item${item === business ? " active" : ""}`} key={item.id ?? `${item.name}-${index}`}><button type="button" className="business-list-select" onClick={() => selectBusiness(item, index)}><span className="business-list-icon">{cover ? <PersistedPhoto src={cover} alt="" /> : item.name.charAt(0).toUpperCase()}</span><span className="business-list-copy"><strong>{item.name}</strong>{item.sede?.trim() && <small className="business-list-sede">Sede {item.sede.trim()}</small>}<small>{formatCategoryName(item.category)} · {item.city || "Ciudad no registrada"}</small>{publicAddress ? <small className="business-list-address">{item.address}</small> : <small className="business-list-address">{item.locationVisibility === "PUBLIC" ? "Ubicación pendiente" : "Atención sin dirección pública"}</small>}<BusinessIndicatorRow business={item} /><em className="business-role-badge">{item.role}</em></span></button><div className="business-list-actions"><details className="business-list-menu"><summary>Opciones</summary><button className="business-duplicate-button" type="button" onClick={() => navigate(`/mis-negocios/nuevo?duplicar=${index}`)}>Duplicar negocio</button></details></div></article>; })}{listedBusinesses.length === 0 && <div className="business-empty-state"><h3>¡Comienza con tu primer negocio!</h3><p>Registra tu negocio en XAMUKO y empieza a conectar con personas que buscan tus productos o servicios.</p></div>}</div>}</section></>;
}
