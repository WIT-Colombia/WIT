import { Icon } from '../components/Icon';
import type { AdminUserOverview } from '../services/adminApiClient';

const indicators = [
  { key: 'total', label: 'Cuentas registradas', icon: 'users', tone: 'blue', hint: 'Histórico, incluidas bajas lógicas' },
  { key: 'active', label: 'Activas', icon: 'check', tone: 'green', hint: 'Acceso a Usuarios y Business habilitado' },
  { key: 'suspended', label: 'Suspendidas', icon: 'lock', tone: 'amber', hint: 'Inicio de sesión bloqueado' },
  { key: 'deleted', label: 'Eliminadas', icon: 'trash', tone: 'neutral', hint: 'Bajas lógicas; datos históricos conservados' },
  { key: 'active30', label: 'Acceso últimos 30 días', icon: 'clock', tone: 'blue', hint: 'Cuentas activas con inicio de sesión reciente' },
  { key: 'dormant90', label: 'Sin acceder 90 días', icon: 'calendar', tone: 'amber', hint: 'Cuentas activas con acceso anterior a 90 días' },
  { key: 'neverLoggedIn', label: 'Sin acceso registrado', icon: 'eye-off', tone: 'neutral', hint: 'Cuentas activas sin fecha de acceso' },
  { key: 'emailVerified', label: 'Correo verificado', icon: 'shield', tone: 'green', hint: 'Identidad de correo con verificación confirmada' },
  { key: 'owners', label: 'Propietarios', icon: 'store', tone: 'violet', hint: 'Usuarios activos propietarios de negocios' },
  { key: 'collaborators', label: 'Colaboradores', icon: 'users', tone: 'blue', hint: 'Usuarios activos vinculados como colaboradores' },
  { key: 'googleUsers', label: 'Vinculados a Google', icon: 'globe', tone: 'blue', hint: 'Cuentas con identidad Google' },
  { key: 'adminCount', label: 'Administradores', icon: 'shield', tone: 'violet', hint: 'Cuentas con rol administrativo activo' },
] as const;

export function AdminUserOperationsOverview({ data, loading, error, retry }: {
  data: AdminUserOverview | null; loading: boolean; error: string; retry: () => void;
}) {
  return <section className="au-control-overview" aria-labelledby="au-control-overview-title">
    <header className="au-panel-heading"><div><span className="au-eyebrow">CENTRO DE CONTROL</span><h2 id="au-control-overview-title">Estado operativo de usuarios</h2>
      <p>Indicadores calculados desde la base de datos. Las métricas no disponibles se muestran con —, nunca como cero.</p></div>
      <button type="button" className="au-outline-button" onClick={retry}><Icon name="refresh" size={16}/> Actualizar</button>
    </header>
    {error && <p className="au-data-note" role="alert">No fue posible actualizar los indicadores: {error}</p>}
    <div className="au-control-kpis">
      {indicators.map(item => {
        const value = data?.[item.key];
        return <article key={item.key} className={'au-control-kpi '+item.tone}>
          <span className="au-control-kpi-heading"><i><Icon name={item.icon} size={20}/></i>{item.label}</span>
          <strong aria-busy={loading}>{loading && !data ? '…' : typeof value === 'number' ? value.toLocaleString('es-CO') : '—'}</strong>
          <small>{item.hint}</small>
        </article>;
      })}
    </div>
    <p className="au-control-overview-note"><Icon name="shield" size={15}/> Las métricas de actividad se basan en último inicio de sesión, no en navegación anónima ni sesiones activas.</p>
  </section>;
}
