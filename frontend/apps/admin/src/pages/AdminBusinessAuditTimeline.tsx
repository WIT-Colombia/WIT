import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { getAdminBusinessHistory, type AdminBusinessAuditEntry } from '../services/adminApiClient';

const readable = (action: string) => ({
  ADMIN_BUSINESS_HIDE: 'Ocultamiento administrativo',
  ADMIN_BUSINESS_SUSPEND: 'Suspensión administrativa',
  ADMIN_BUSINESS_RESTORE: 'Levantamiento de restricción',
  ADMIN_BUSINESS_DELETED: 'Eliminación administrativa',
  BUSINESS_PUBLISHED: 'Publicación del establecimiento',
  BUSINESS_CREATED: 'Creación del negocio',
  BUSINESS_VISIBILITY_EXPIRED: 'Visibilidad vencida',
} as Record<string, string>)[action] ?? action.replaceAll('_', ' ').toLocaleLowerCase('es-CO');

export function AdminBusinessAuditTimeline({ businessId, revision }: { businessId: string; revision: number }) {
  const [entries, setEntries] = useState<AdminBusinessAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void getAdminBusinessHistory(businessId).then(result => { if (active) setEntries(result.history); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No disponible'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId, revision, retry]);
  return <section className="ad-ops-audit" aria-labelledby="ad-ops-audit-title">
    <div className="ad-ops-section-heading"><div><span>TRAZABILIDAD</span><h2 id="ad-ops-audit-title">Historial administrativo</h2>
      <p>Últimas 60 actuaciones persistidas. El registro no se altera al cambiar de pantalla.</p></div>
      <button type="button" onClick={() => setRetry(x => x + 1)}><Icon name="refresh" size={17}/> Actualizar</button>
    </div>
    {loading ? <p role="status">Consultando historial…</p>
      : error ? <p role="alert">No pudimos consultar la auditoría: {error}</p>
      : entries.length === 0 ? <p>No hay actuaciones administrativas registradas todavía.</p>
      : <ol className="ad-ops-audit-list">{entries.map(entry => <li key={entry.id}>
        <span className="ad-ops-audit-marker"><Icon name="shield" size={16}/></span>
        <div><strong>{readable(entry.action)}</strong><p>{entry.reason || entry.comment || 'Evento registrado sin observación adicional.'}</p>
          <small>{entry.actor?.displayName ?? 'Sistema'} · {new Date(entry.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</small></div>
      </li>)}</ol>}
  </section>;
}
