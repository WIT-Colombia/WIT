import { Icon } from '../components/Icon';
import type { AdminBusinessOverview } from '../services/adminApiClient';

const cards = [
  { key: 'total', label: 'Registrados', icon: 'store', tone: 'blue', hint: 'Excluye negocios eliminados' },
  { key: 'visible', label: 'Visibles', icon: 'eye', tone: 'green', hint: 'Publicados y visibles ahora' },
  { key: 'hidden', label: 'Ocultos por propietario', icon: 'eye-off', tone: 'neutral', hint: 'Pausados voluntariamente' },
  { key: 'adminHidden', label: 'Ocultos por Admin', icon: 'shield', tone: 'violet', hint: 'Medidas administrativas activas' },
  { key: 'suspended', label: 'Suspendidos', icon: 'lock', tone: 'red', hint: 'Restricción administrativa' },
  { key: 'expired', label: 'Vencidos', icon: 'clock', tone: 'amber', hint: 'Visibilidad vencida' },
  { key: 'verified', label: 'Verificados', icon: 'check', tone: 'green', hint: 'Verificación aprobada' },
  { key: 'pro', label: 'Business PRO', icon: 'crown', tone: 'violet', hint: 'Suscripción vigente' },
  { key: 'reported', label: 'Con reportes', icon: 'flag', tone: 'amber', hint: 'Al menos un reporte registrado' },
  { key: 'review', label: 'En revisión', icon: 'search', tone: 'blue', hint: 'Publicación pendiente de revisión' },
  { key: 'expiring', label: 'Por vencer', icon: 'calendar', tone: 'amber', hint: 'Dentro de 7 días; dato orientativo' },
  { key: 'deleted', label: 'Eliminados', icon: 'trash', tone: 'neutral', hint: 'Histórico de bajas lógicas' },
] as const;
const fmt = (n: number) => n.toLocaleString('es-CO');

export function AdminBusinessOperationsOverview({ data, loading, error, retry }: {
  data: AdminBusinessOverview | null; loading: boolean; error: string; retry: () => void;
}) {
  return <section className="ad-ops-overview" aria-labelledby="ad-ops-overview-title">
    <div className="ad-ops-section-heading">
      <div><span>CONTROL DE LA PLATAFORMA</span><h2 id="ad-ops-overview-title">Estado operativo de los negocios</h2>
        <p>Indicadores reales de la base de datos. Cada estado tiene un significado distinto.</p></div>
      <button type="button" onClick={retry} aria-label="Actualizar indicadores"><Icon name="refresh" size={17}/> Actualizar</button>
    </div>
    {error && <p className="ad-ops-overview-error" role="alert">No pudimos consultar el resumen: {error}</p>}
    <div className="ad-ops-kpi-grid">
      {cards.map(card => <article key={card.key} className={'ad-ops-kpi tone-' + card.tone}>
        <span className="ad-ops-kpi-heading"><i><Icon name={card.icon} size={20}/></i><span>{card.label}</span></span>
        <strong aria-busy={loading}>{loading ? '…' : data ? fmt(data[card.key]) : '—'}</strong>
        <small>{card.hint}</small>
      </article>)}
    </div>
    {data && <div className="ad-ops-distribution">
      <header><div><h3>Distribución de visibilidad</h3><p>Porcentaje sobre el total de negocios no eliminados</p></div><strong>{fmt(data.total)} negocios</strong></header>
      <div className="ad-ops-distribution-bars">
        {[
          { label: 'Visibles', value: data.visible, tone: 'visible' },
          { label: 'Ocultos voluntariamente', value: data.hidden, tone: 'owner-hidden' },
          { label: 'Ocultos por Admin', value: data.adminHidden, tone: 'admin-hidden' },
          { label: 'Suspendidos', value: data.suspended, tone: 'suspended' },
          { label: 'Vencidos', value: data.expired, tone: 'expired' },
        ].map(item => <div key={item.label} className="ad-ops-distribution-row">
          <span>{item.label}</span><div className="ad-ops-distribution-track" role="meter" aria-label={item.label}
            aria-valuenow={item.value} aria-valuemin={0} aria-valuemax={Math.max(1, data.total)}>
            <i className={item.tone} style={{ width: (data.total ? item.value / data.total * 100 : 0) + '%' }}/>
          </div><strong>{fmt(item.value)}</strong>
        </div>)}
      </div>
      <p>Los estados representan la situación actual, no registros de ventas ni ingresos. No se incluyen valores simulados.</p>
    </div>}
  </section>;
}
