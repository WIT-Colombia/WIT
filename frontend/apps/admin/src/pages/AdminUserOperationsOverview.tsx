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

const totalValue = (value: number) => Math.max(1, value);
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
    {data && <div className="au-control-distribution">
      <div className="au-control-distribution-card">
        <header><h3>Estado actual de las cuentas</h3><p>Distribución por estado, sin duplicaciones</p></header>
        {(() => {
          const states = [
            {label:'Activas',value:data.active,color:'#225cf1',tone:'active'},
            {label:'Suspendidas',value:data.suspended,color:'#efad40',tone:'suspended'},
            {label:'Eliminadas',value:data.deleted,color:'#b3bfd1',tone:'deleted'},
          ];
          const total=Math.max(1,data.total);
          const circumference=2*Math.PI*57;
          let offset=0;
          return <div className="au-control-donut-layout">
            <svg className="au-control-donut" viewBox="0 0 160 160" role="img" aria-label={states.map(st=>st.label+': '+st.value).join('; ')}>
              <circle cx="80" cy="80" r="57" stroke="#edf1f8" strokeWidth="18" fill="none"/>
              {states.map(st=>{
                const len=st.value/total*circumference;
                const element=<circle key={st.label} cx="80" cy="80" r="57" fill="none"
                  stroke={st.color} strokeWidth="18" strokeDasharray={len+' '+(circumference-len)}
                  strokeDashoffset={-offset} transform="rotate(-90 80 80)"/>;
                offset+=len;
                return element;
              })}
              <text x="80" y="78" textAnchor="middle" fontSize="26" fontWeight="850" fill="#152a4b">{data.total.toLocaleString('es-CO')}</text>
              <text x="80" y="96" textAnchor="middle" fontSize="10" fill="#74849c">Cuentas</text>
            </svg>
            <div className="au-control-donut-legend">{states.map(st=><div key={st.label}>
              <span className={'au-control-dot '+st.tone}/><span>{st.label}</span>
              <strong>{st.value.toLocaleString('es-CO')}</strong><small>{(st.value/total*100).toLocaleString('es-CO',{maximumFractionDigits:1})}%</small>
            </div>)}</div>
          </div>;
        })()}
      </div>
      <div className="au-control-distribution-card">
        <header><h3>Vinculación con XAMUKO Business</h3><p>Usuarios únicos con vínculos activos</p></header>
        <div className="au-control-relationship-bars">
          {[
            {label:'Propietarios',value:data.owners,tone:'owners',icon:'store'},
            {label:'Colaboradores',value:data.collaborators,tone:'collaborators',icon:'users'},
            {label:'Administradores',value:data.adminCount,tone:'admins',icon:'shield'},
          ].map(group=><div key={group.label} className="au-control-relationship-row">
            <div><span><Icon name={group.icon} size={16}/>{group.label}</span><strong>{group.value.toLocaleString('es-CO')}</strong></div>
            <div className="au-control-relationship-track" role="meter" aria-valuemin={0} aria-valuemax={totalValue(data.total)} aria-valuenow={group.value} aria-label={group.label}>
              <i className={group.tone} style={{width:(data.total?Math.min(100,group.value/data.total*100):0)+'%'}}/>
            </div>
          </div>)}
        </div>
        <p>Estas categorías pueden coincidir: una misma cuenta puede administrar y colaborar en distintos negocios.</p>
      </div>
    </div>}
    <p className="au-control-overview-note"><Icon name="shield" size={15}/> Las métricas de actividad se basan en último inicio de sesión, no en navegación anónima ni sesiones activas.</p>
  </section>;
}
