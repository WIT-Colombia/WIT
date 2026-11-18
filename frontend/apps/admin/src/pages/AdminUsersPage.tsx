import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { StatePanel } from '../components/common';
import { getSession } from '../services/adminService';
import { getAdminUserOverview, getAdminUserCapabilities, getAdminUserAnalytics, listAdminUsers,
  type AdminUserPage, type AdminUserOverview, type AdminUserRecord, type AdminUserAnalytics,
  type AdminUserFilters, type AdminUserStatusAction } from '../services/adminApiClient';
import { AdminUserStatusDialog } from '../components/users/AdminUserStatusDialog';
import { AdminUserOperationsOverview } from './AdminUserOperationsOverview';
import { AdminUserHistoricalAnalytics } from './AdminUserHistoricalAnalytics';
import { getUserManagementAction } from '../utils/adminUserManagement';
import { AdminUserAnalyticsPanel } from './AdminUserAnalyticsPanel';
import './AdminUsersRefresh.css';
import './AdminUsersControl.css';
import './AdminUsersShowcase.css';
import { adminDirectoryPageSummary } from '../utils/adminDirectoryPagination';

const date = (value: string | null) => value
  ? new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  : 'Sin acceso registrado';
const number = (value: number) => value.toLocaleString('es-CO');
export const accountStatus: Record<string, string> = { ACTIVE: 'Activo', SUSPENDED: 'Suspendido', DELETED: 'Eliminado' };
const initials = (text: string) => text.split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('').toLocaleUpperCase('es-CO') || '?';
function exportCurrent(users: AdminUserRecord[]) {
  const safe = (value: string) => '"' + (/^[=+\-@\t\r\n]/.test(value) ? "'" : '') + value.replaceAll('"','""') + '"';
  const fields=['Nombre','Correo','Usuario','Estado','Negocios propietario','Negocios colaborador','Registro','Último acceso'];
  const csv=[fields,...users.map(u=>[u.displayName,u.emailNormalized??'',u.nickname??'',accountStatus[u.status],String(u.ownedBusinesses),String(u.collaboratingBusinesses),date(u.createdAt),date(u.lastLoginAt)])]
    .map(row=>row.map(safe).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='xamuko-usuarios-pagina.csv';a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function UserAvatar({ user }: { user: Pick<AdminUserRecord,'displayName'> }) {
  return <span className="au-avatar" aria-hidden="true">{initials(user.displayName)}</span>;
}
export function AdminUsersPage() {
  const session = getSession();
  const allowed = session?.permissions?.includes('settings:write') ?? false;
  const currentId = session?.id ?? '';
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const relation = params.get('relation') ?? '';
  const city = params.get('city') ?? '';
  const requestedPage = Number(params.get('page') ?? '1');
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(100000,Math.floor(requestedPage))) : 1;
  const [input, setInput] = useState(q);
  const [data, setData] = useState<AdminUserPage | null>(null);
  const [overview, setOverview] = useState<AdminUserOverview | null>(null);
  const [analytics, setAnalytics] = useState<AdminUserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [error, setError] = useState('');
  const [overviewError, setOverviewError] = useState('');
  const [revision, setRevision] = useState(0);
  const [featureReady, setFeatureReady] = useState(false);
  const [capabilityChecked, setCapabilityChecked] = useState(false);
  const [canManageStatus, setCanManageStatus] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<{ user: AdminUserRecord; action: AdminUserStatusAction } | null>(null);
  const [notice, setNotice] = useState('');
  const advanced: AdminUserFilters = {
    provider: params.get('provider') ?? '', emailVerified: params.get('emailVerified') ?? '',
    admin: params.get('admin') ?? '', activity: params.get('activity') ?? '',
    registeredFrom: params.get('registeredFrom') ?? '', registeredTo: params.get('registeredTo') ?? '',
    lastLoginFrom: params.get('lastLoginFrom') ?? '', lastLoginTo: params.get('lastLoginTo') ?? '',
    order: params.get('order') ?? '',
  };
  const filterKey = [...params.entries()].filter(([k])=>k!=='page').sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('&');
  const activeFilters = [...params.keys()].filter(key => key!=='page' && Boolean(params.get(key))).length;
  useEffect(()=>setInput(q),[q]);
  useEffect(()=>{
    if (!allowed) return;
    let active = true;
    void getAdminUserCapabilities().then(result => {
      if (active) { setFeatureReady(result.userManagement); setCanManageStatus(result.canManageStatus && session?.role === 'SUPER_ADMIN'); }
    }).catch(()=>{if(active){setFeatureReady(false);setCanManageStatus(false);}})
      .finally(()=>{if(active)setCapabilityChecked(true);});
    return ()=>{active=false;};
  },[allowed,session?.role]);
  useEffect(()=>{
    if (!allowed) return;
    let active = true;
    setLoading(true); setError('');
    void listAdminUsers({q,page,status,relation,...(overview?.cities ? {city} : {}),...(featureReady ? advanced : {})})
      .then(result=>{if(active)setData(result);})
      .catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'No pudimos consultar el directorio.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[allowed,q,page,status,relation,city,filterKey,featureReady,overview?.cities,revision]);
  useEffect(()=>{
    if (!allowed) return;
    let active = true;
    setOverviewLoading(true); setOverviewError('');
    void getAdminUserOverview().then(result=>{if(active)setOverview(result);})
      .catch(cause=>{if(active)setOverviewError(cause instanceof Error?cause.message:'No se pudieron consultar los indicadores.');})
      .finally(()=>{if(active)setOverviewLoading(false);});
    return ()=>{active=false;};
  },[allowed,revision]);
  useEffect(()=>{
    if(!allowed || !featureReady) {setAnalytics(null);return;}
    let active = true;
    void getAdminUserAnalytics('12m').then(result=>{if(active)setAnalytics(result);})
      .catch(()=>{if(active)setAnalytics(null);});
    return ()=>{active=false;};
  },[allowed,featureReady,revision]);
  const apply = (key: Exclude<keyof AdminUserFilters, 'page'>, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key,value); else next.delete(key);
    next.delete('page'); setParams(next,{replace:true});
  };
  const changePage = (target: number) => {
    const next = new URLSearchParams(params);
    if(target <= 1) next.delete('page'); else next.set('page',String(target));
    setParams(next);
  };
  const clear = () => {setInput('');setParams({},{replace:true});};
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {event.preventDefault();apply('q',input.trim());};
  const actionFor = (user: AdminUserRecord) => getUserManagementAction(user, canManageStatus, currentId);
  const manage = (user: AdminUserRecord) => {
    const action = actionFor(user);
    if (action) setStatusTarget({user,action});
  };
  const successful = (message: string) => {
    setStatusTarget(null); setNotice(message); setRevision(value=>value+1);
  };
  const setShortcut = (nextStatus: string, nextRelation: string) => {
    const next = new URLSearchParams(params);
    if (nextStatus) next.set('status', nextStatus); else next.delete('status');
    if (nextRelation) next.set('relation', nextRelation); else next.delete('relation');
    next.delete('page');
    setParams(next, { replace: true });
  };
  // Activity here is derived exclusively from the users on this page;
  // it is not represented as a platform-wide administrative audit.
  const recentActivity = (data?.users ?? []).flatMap(user => [
    { key: 'registered-' + user.id, kind: 'registered' as const, at: user.createdAt, user },
    ...(user.lastLoginAt ? [{ key: 'login-' + user.id, kind: 'login' as const, at: user.lastLoginAt, user }] : []),
  ]).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 4);
  if (!allowed) return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permisos de gestión administrativa para consultar usuarios."/>;
  return <div className="admin-users-page au-page">
    <header className="admin-section-heading au-showcase-hero">
      <span className="au-showcase-hero-icon"><Icon name="users" size={34}/></span>
      <div className="au-showcase-hero-copy"><h1 id="au-title">Usuarios</h1>
        <p>Esta sección centraliza la gestión de usuarios, la seguridad, la actividad y los estados de las cuentas.</p>
      </div>
    </header>
    {notice && <div className="au-success-notice" role="status"><Icon name="check" size={18}/>{notice}</div>}
    <AdminUserOperationsOverview data={overview} loading={overviewLoading} error={overviewError} retry={()=>setRevision(value=>value+1)}/>
    <section className="au-directory" aria-labelledby="au-directory-title">
      <div className="au-showcase-filters">
        <div className="au-showcase-filter-heading"><Icon name="filter" size={21}/><h2 id="au-directory-title">Filtros de búsqueda</h2></div>
      <form onSubmit={onSubmit} className="au-search-form">
        <label className="au-search-field" htmlFor="au-query"><Icon name="search" size={18}/>
          <input id="au-query" value={input} onChange={e=>setInput(e.target.value)}
            placeholder="Buscar por nombre, correo o ID" aria-label="Buscar usuarios"/></label>
        <label className="au-select-field"><span>Estado</span><select aria-label="Filtrar por estado" value={status} onChange={e=>apply('status',e.target.value)}>
          <option value="">Todos los estados</option><option value="ACTIVE">Activos</option><option value="SUSPENDED">Suspendidos</option><option value="DELETED">Eliminados</option>
        </select></label>
        <label className="au-select-field"><span>Tipo de cuenta</span><select aria-label="Filtrar por tipo de cuenta" value={relation} onChange={e=>apply('relation',e.target.value)}>
          <option value="">Todos</option><option value="ANY">Con negocio</option><option value="OWNER">Propietarios</option><option value="COLLABORATOR">Colaboradores</option><option value="NONE">Sin negocio vinculado</option>
        </select></label>
        <label className="au-select-field"><span>Ciudad</span><select aria-label="Filtrar por ciudad preferida" value={city} onChange={e=>apply('city',e.target.value)}
          disabled={!overview?.cities} title={!overview?.cities ? 'Disponible cuando se actualice el backend' : 'Filtra por la ciudad preferida indicada por cada usuario'}>
          <option value="">Todas</option>{overview?.cities?.map(cityName=><option value={cityName} key={cityName}>{cityName}</option>)}
        </select></label>
        <button className="au-outline-button au-showcase-clear" type="button" onClick={clear}><Icon name="refresh" size={16}/> Limpiar filtros</button>
        <button className="au-primary-button au-showcase-search" type="submit"><Icon name="search" size={17}/> Buscar</button>
      </form>
      <div className="au-control-filter-bar">
        <span><Icon name="search" size={16}/>{activeFilters ? activeFilters + ' filtro(s) activo(s)' : 'Todos los usuarios de la plataforma'}</span>
        <button type="button" disabled={!featureReady} onClick={()=>setAdvancedOpen(open=>!open)}
          aria-expanded={advancedOpen} aria-controls="au-control-filters"
          title={!featureReady ? 'Disponible cuando se actualice el backend' : undefined}>
          <Icon name="settings" size={16}/>{advancedOpen ? 'Ocultar filtros avanzados' : 'Filtros avanzados'}<Icon name="chevron" size={16}/>
        </button>
      </div>
      {capabilityChecked && !featureReady && <p className="au-control-backend-note"><Icon name="clock" size={16}/>
        Los filtros avanzados y las nuevas acciones estarán disponibles cuando actualicemos el backend. Las funciones actuales se mantienen.</p>}
      <div id="au-control-filters" className="au-control-filters" hidden={!advancedOpen}>
        <label>Proveedor de acceso<select aria-label="Proveedor de acceso" value={advanced.provider} onChange={e=>apply('provider',e.target.value)}>
          <option value="">Todos</option><option value="EMAIL">Correo</option><option value="GOOGLE">Google</option><option value="APPLE">Apple</option></select></label>
        <label>Correo verificado<select aria-label="Correo verificado" value={advanced.emailVerified} onChange={e=>apply('emailVerified',e.target.value)}>
          <option value="">Todos</option><option value="yes">Verificado</option><option value="no">Sin verificación EMAIL</option></select></label>
        <label>Rol administrativo<select aria-label="Rol administrativo" value={advanced.admin} onChange={e=>apply('admin',e.target.value)}>
          <option value="">Todos</option><option value="yes">Con rol activo</option><option value="no">Sin rol activo</option></select></label>
        <label>Actividad de acceso<select aria-label="Actividad de acceso" value={advanced.activity} onChange={e=>apply('activity',e.target.value)}>
          <option value="">Todas</option><option value="recent30">Últimos 30 días</option><option value="dormant90">Sin acceder hace 90 días</option>
          <option value="never">Sin acceso registrado</option></select></label>
        <label>Registro desde<input type="date" aria-label="Registro desde" value={advanced.registeredFrom} max={advanced.registeredTo||undefined} onChange={e=>apply('registeredFrom',e.target.value)}/></label>
        <label>Registro hasta<input type="date" aria-label="Registro hasta" value={advanced.registeredTo} min={advanced.registeredFrom||undefined} onChange={e=>apply('registeredTo',e.target.value)}/></label>
        <label>Acceso desde<input type="date" aria-label="Último acceso desde" value={advanced.lastLoginFrom} max={advanced.lastLoginTo||undefined} onChange={e=>apply('lastLoginFrom',e.target.value)}/></label>
        <label>Acceso hasta<input type="date" aria-label="Último acceso hasta" value={advanced.lastLoginTo} min={advanced.lastLoginFrom||undefined} onChange={e=>apply('lastLoginTo',e.target.value)}/></label>
        <label>Ordenar<select aria-label="Ordenar usuarios" value={advanced.order} onChange={e=>apply('order',e.target.value)}>
          <option value="">Más recientes</option><option value="oldest">Más antiguos</option>
          <option value="lastLogin">Último acceso</option><option value="name">Nombre A–Z</option></select></label>
      </div>
      </div>
      <div className="au-showcase-shortcuts" role="group" aria-label="Filtros rápidos">
        <button type="button" className={!status && !relation ? 'selected' : ''} aria-pressed={!status && !relation}
          onClick={()=>setShortcut('','')}><Icon name="filter" size={15}/> Todos {overview ? '('+number(overview.total)+')' : ''}</button>
        <button type="button" className={status==='ACTIVE' && !relation ? 'selected' : ''} aria-pressed={status==='ACTIVE' && !relation}
          onClick={()=>setShortcut('ACTIVE','')}><Icon name="check" size={15}/> Activos {overview ? '('+number(overview.active)+')' : ''}</button>
        <button type="button" className={status==='SUSPENDED' && !relation ? 'selected' : ''} aria-pressed={status==='SUSPENDED' && !relation}
          onClick={()=>setShortcut('SUSPENDED','')}><Icon name="lock" size={15}/> Suspendidos {overview ? '('+number(overview.suspended)+')' : ''}</button>
        <button type="button" className={!status && relation==='ANY' ? 'selected' : ''} aria-pressed={!status && relation==='ANY'}
          onClick={()=>setShortcut('','ANY')}><Icon name="store" size={15}/> Con negocio {overview?.withBusiness !== undefined ? '('+number(overview.withBusiness)+')' : ''}</button>
        <button type="button" className={!status && relation==='NONE' ? 'selected' : ''} aria-pressed={!status && relation==='NONE'}
          onClick={()=>setShortcut('','NONE')}><Icon name="users" size={15}/> Sin negocio</button>
      </div>
      <div className="au-showcase-directory-grid">
        <div className="au-showcase-list">
          <div className="au-result-count">
            <span>{loading?'Consultando registros…':data?number(data.pagination.total)+' '+(data.pagination.total===1?'usuario encontrado':'usuarios encontrados'):'Directorio'}</span>
            <div className="au-showcase-result-meta">
              <span>{!loading && data ? adminDirectoryPageSummary(data.pagination,data.users.length,'usuarios') : 'Datos reales de la plataforma'}</span>
              <button type="button" className="au-outline-button" onClick={()=>exportCurrent(data?.users??[])}
                disabled={loading || !data?.users.length} title="Exportar únicamente usuarios visibles en esta página">
                <Icon name="download" size={16}/> Exportar página
              </button>
            </div>
          </div>
      {loading?<StatePanel kind="loading" title="Consultando usuarios" message="Cargando registros reales de XAMUKO."/>:
        error?<StatePanel kind="error" title="No se pudo cargar el directorio" message={error} retry={()=>setRevision(n=>n+1)}/>:
        data && (data.users.length===0?<StatePanel kind="empty" title="No hay resultados" message="Modifica los filtros o prueba otra búsqueda."/>:<>
          <div className="au-table-scroll"><table className="au-table au-control-table au-showcase-table">
            <thead><tr><th>Usuario</th><th>Correo</th><th>Estado</th><th>Negocios vinculados</th><th>Último acceso</th><th>Acciones</th></tr></thead>
            <tbody>{data.users.map(user=><tr key={user.id}>
              <td><Link to={'/users/'+encodeURIComponent(user.id)} className="au-user-cell">
                <UserAvatar user={user}/><span><strong>{user.displayName}</strong><small>{user.publicId}</small>
                  {user.isAdmin&&<small className="au-showcase-admin-label">Administrador</small>}</span>
              </Link></td>
              <td className="au-showcase-email">{user.emailNormalized??'Sin correo registrado'}</td>
              <td><span className={'au-status '+user.status.toLowerCase()}>{accountStatus[user.status]}</span></td>
              <td><strong className="au-showcase-business-count">{user.ownedBusinesses+user.collaboratingBusinesses} vínculos</strong>
                <small className="au-showcase-business-caption">{user.ownedBusinesses} propietario(s) · {user.collaboratingBusinesses} colaborador(es)</small></td>
              <td>{date(user.lastLoginAt)}</td>
              <td><div className="au-control-actions">
                <Link className="au-detail-link" to={'/users/'+encodeURIComponent(user.id)}><Icon name="eye" size={16}/> Ver</Link>
                {actionFor(user)&&<button type="button" className={user.status==='ACTIVE'?'au-control-suspend':'au-control-restore'}
                  onClick={()=>manage(user)}><Icon name={user.status==='ACTIVE'?'lock':'check'} size={15}/>
                  {user.status==='ACTIVE'?'Suspender':'Reactivar'}</button>}
                <details className="au-showcase-more">
                  <summary>Más <Icon name="chevron" size={13}/></summary>
                  <div><span><b>Registro:</b> {date(user.createdAt)}</span>
                    <span><b>Identidad:</b> {user.authProviders?.join(', ') || 'Sin información'}</span>
                    <Link to={'/users/'+encodeURIComponent(user.id)}>Ver ficha completa</Link>
                  </div>
                </details>
              </div></td>
            </tr>)}</tbody>
          </table></div>
          <div className="au-mobile-users">{data.users.map(user=><article key={user.id} className="au-mobile-user-card">
            <div className="au-mobile-user-head"><UserAvatar user={user}/><div><strong>{user.displayName}</strong><small>{user.emailNormalized??'Sin correo registrado'}</small></div></div>
            <div className="au-mobile-tags"><span className={'au-status '+user.status.toLowerCase()}>{accountStatus[user.status]}</span>{user.isAdmin&&<span className="au-admin-mini">Administrador</span>}</div>
            <div className="au-mobile-user-facts"><span><Icon name="store" size={15}/>{user.ownedBusinesses} propietario(s)</span>
              <span><Icon name="users" size={15}/>{user.collaboratingBusinesses} colaboración(es)</span>
              <span><Icon name="calendar" size={15}/>Alta: {date(user.createdAt)}</span>
              <span><Icon name="clock" size={15}/>Último acceso: {date(user.lastLoginAt)}</span></div>
            <div className="au-control-mobile-actions"><Link to={'/users/'+encodeURIComponent(user.id)} className="au-detail-link">Ver ficha <Icon name="arrow" size={17}/></Link>
              {actionFor(user)&&<button type="button" className={user.status==='ACTIVE'?'au-control-suspend':'au-control-restore'}
                onClick={()=>manage(user)}><Icon name={user.status==='ACTIVE'?'lock':'check'} size={15}/>{user.status==='ACTIVE'?'Suspender':'Reactivar'}</button>}
            </div>
          </article>)}</div>
        </>)}
      {data&&data.pagination.totalPages>1&&<nav className="au-pagination" aria-label="Paginación del directorio">
        <span>Página {page} de {data.pagination.totalPages}</span><div>
          <button type="button" className="au-outline-button" disabled={page<=1} onClick={()=>changePage(page-1)}>Anterior</button>
          <button type="button" className="au-primary-button" disabled={page>=data.pagination.totalPages} onClick={()=>changePage(page+1)}>Siguiente <Icon name="arrow" size={16}/></button>
        </div>
      </nav>}
        </div>
        <aside className="au-showcase-recent" aria-labelledby="au-showcase-recent-title">
          <header><Icon name="up" size={21}/><h2 id="au-showcase-recent-title">Actividad reciente</h2></header>
          <p className="au-showcase-recent-description">Registros y accesos de los usuarios visibles en esta página.</p>
          {loading ? <p className="au-showcase-recent-empty">Consultando actividad…</p> :
            recentActivity.length ? <ol>{recentActivity.map(item=><li key={item.key}>
              <span className={'au-showcase-recent-icon '+item.kind}><Icon name={item.kind==='login'?'check':'users'} size={18}/></span>
              <div><strong>{item.kind==='login'?'Último acceso registrado':'Cuenta registrada'}</strong>
                <p><Link to={'/users/'+encodeURIComponent(item.user.id)}>{item.user.displayName}</Link></p>
                <time dateTime={item.at}>{new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.at))}</time>
              </div>
            </li>)}</ol> : <p className="au-showcase-recent-empty">No hay actividad disponible en esta página.</p>}
          <small className="au-showcase-recent-disclaimer">Este resumen no sustituye el historial de auditoría.</small>
        </aside>
      </div>
    </section>
    {analytics ? <AdminUserHistoricalAnalytics initial={analytics}/> : overview&&<AdminUserAnalyticsPanel data={overview}/>}
    {statusTarget&&<AdminUserStatusDialog user={statusTarget.user} action={statusTarget.action}
      onClose={()=>setStatusTarget(null)} onSuccess={successful}/>}
  </div>;
}
