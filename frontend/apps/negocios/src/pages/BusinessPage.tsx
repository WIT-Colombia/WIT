import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { useBusinessStore } from "../services/businessStore";
import type { BusinessDetails } from "../types/business";
import { businessApi, BusinessApiError } from "../services/businessApiClient";
import { toBusinessDetails } from "../services/realBusinessAdapter";
import { useBusinessAuth } from "../services/businessAuthContext";

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
  return <><PageHeader eyebrow="" title="Mis negocios" description="Administra todos los negocios asociados a tu cuenta." /><section className="business-list-surface surface-card"><div className="card-heading"><div><h2>Tus negocios</h2><p>Selecciona uno para consultar toda su información o crea uno nuevo.</p></div><button className="action-button" type="button" onClick={() => navigate("/mis-negocios/nuevo")}>＋ Crear negocio</button></div>{loading && <p className="auth-status">Cargando tus negocios…</p>}{error && <div className="form-error" role="alert"><p>{error}</p><button className="outline-button" type="button" onClick={() => setRetryAttempt(value => value + 1)}>Reintentar</button></div>}{!loading && !error && <div className="business-list">{businesses.map((item, index) => <article className={`business-list-item${item === business ? " active" : ""}`} key={item.id ?? `${item.name}-${index}`}><button type="button" className="business-list-select" onClick={() => selectBusiness(item, index)}><span className="business-list-icon">{item.name.charAt(0).toUpperCase()}</span><span><strong>{item.name}</strong><small>{item.category} · {item.city}</small><em className="business-role-badge">{item.role}</em></span></button><div className="business-list-actions"><span className={`status-pill ${item.status === "Verificado" ? "" : "pending"}`}>{item.status === "Pendiente" ? "Verificación pendiente" : item.status}</span></div></article>)}{businesses.length === 0 && <div className="business-empty-state"><h3>¡Comienza con tu primer negocio!</h3><p>Registra tu negocio en XAMUKO y empieza a conectar con personas que buscan tus productos o servicios.</p></div>}</div>}</section></>;
}
