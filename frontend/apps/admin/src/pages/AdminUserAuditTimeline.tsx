import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { getAdminUserHistory, type AdminUserAuditEntry } from '../services/adminApiClient';

const title = (action: string) => ({
  ADMIN_USER_SUSPENDED: 'Suspensión administrativa de cuenta',
  ADMIN_USER_RESTORED: 'Reactivación de cuenta',
  ADMIN_USER_DEACTIVATED: 'Baja administrativa de cuenta',
  ADMIN_ROLE_ASSIGNED: 'Asignación de rol administrativo',
  ADMIN_ROLE_REVOKED: 'Revocación de rol administrativo',
} as Record<string, string>)[action] ?? action.replaceAll('_', ' ').toLocaleLowerCase('es-CO');

export function AdminUserAuditTimeline({ userId, revision }: { userId: string; revision: number }) {
  const [entries, setEntries] = useState<AdminUserAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void getAdminUserHistory(userId).then(value => { if (active) setEntries(value.history); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Historial no disponible'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, revision, retry]);
  return <section className="au-control-history au-info-card" aria-labelledby="au-control-history-title">
    <header className="au-panel-heading"><div><span className="au-eyebrow">TRAZABILIDAD</span><h2 id="au-control-history-title">Historial de actuaciones</h2>
      <p>Últimas 80 actuaciones registradas. Motivos, responsables y fechas sin alterar registros históricos.</p></div>
      <button type="button" className="au-outline-button" onClick={() => setRetry(n => n + 1)}><Icon name="refresh" size={16}/> Actualizar</button>
    </header>
    {loading ? <p className="au-control-history-message" role="status">Consultando el historial…</p>
      : error ? <p className="au-control-history-message" role="alert">{error}</p>
      : entries.length === 0 ? <p className="au-control-history-message">Todavía no hay actuaciones administrativas registradas.</p>
      : <ol>{entries.map(entry => <li key={entry.id}>
        <span className="au-control-history-icon"><Icon name="shield" size={18}/></span>
        <div><strong>{title(entry.action)}</strong><p>{entry.reason || entry.comment || 'Sin observaciones adicionales.'}</p>
          <small>{entry.actor?.displayName ?? 'Sistema'} · {new Date(entry.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</small></div>
      </li>)}</ol>}
  </section>;
}
