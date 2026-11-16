import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { StatePanel } from '../components/common';
import { getSession } from '../services/adminService';
import { getAdminUserOverview, listAdminUsers, type AdminUserPage, type AdminUserOverview, type AdminUserRecord } from '../services/adminApiClient';
import { AdminUserAnalyticsPanel } from './AdminUserAnalyticsPanel';
import './AdminUsersRefresh.css';
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
  const allowed = getSession()?.permissions?.includes('settings:write') ?? false;
  const canDelete = getSession()?.role === 'SUPER_ADMIN';
  const [params,setParams]=useSearchParams();
  const q=params.get('q')??'';
  const status=params.get('status')??'';
  const relation=params.get('relation')??'';
  const requestedPage=Number(params.get('page')??'1');
  const page=Number.isFinite(requestedPage)?Math.max(1,Math.min(100000,Math.floor(requestedPage))):1;
  const [input,setInput]=useState(q);
  const [data,setData]=useState<AdminUserPage|null>(null);
  const [overview,setOverview]=useState<AdminUserOverview|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [overviewError,setOverviewError]=useState('');
  const [revision,setRevision]=useState(0);
  useEffect(()=>setInput(q),[q]);
  useEffect(()=>{
    if(!allowed)return;
    let active=true;setLoading(true);setError('');
    listAdminUsers({q,page,status,relation}).then(result=>{if(active)setData(result);})
      .catch(err=>{if(active)setError(err instanceof Error?err.message:'No se pudieron consultar los usuarios.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[allowed,q,page,status,relation,revision]);
  useEffect(()=>{
    if(!allowed)return;
    let active=true;setOverviewError('');
    getAdminUserOverview().then(result=>{if(active)setOverview(result);})
      .catch(err=>{if(active)setOverviewError(err instanceof Error?err.message:'No se pudieron consultar las estadísticas.');});
    return()=>{active=false;};
  },[allowed,revision]);
  const apply=(key:'q'|'status'|'relation',value:string)=>{
    const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);
    next.delete('page');setParams(next,{replace:true});
  };
  const goTo=(target:number)=>{
    const next=new URLSearchParams(params);if(target<=1)next.delete('page');else next.set('page',String(target));setParams(next);
  };
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();apply('q',input.trim());};
  const clear=()=>{setInput('');setParams({},{replace:true});};
  const metrics=overview?[
    {label:'Usuarios registrados',value:overview.total,icon:'users',tone:'blue',hint:'Total histórico de cuentas'},
    {label:'Cuentas activas',value:overview.active,icon:'check',tone:'green',hint:'Con acceso habilitado'},
    {label:'Suspendidas',value:overview.suspended,icon:'clock',tone:'amber',hint:'Acceso temporalmente restringido'},
    {label:'Eliminadas',value:overview.deleted,icon:'archive',tone:'violet',hint:'Baja administrativa registrada'},
  ]:[];
  if(!allowed)return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permisos de gestión administrativa para consultar usuarios."/>;
  return <div className="admin-users-page au-page">
    <header className="admin-section-heading"><h1 id="au-title">Usuarios</h1></header>
        {overview && <div className="au-overview" aria-label="Indicadores de usuarios">{metrics.map(m=><div key={m.label} className={'au-kpi '+m.tone}><span className="au-kpi-icon"><Icon name={m.icon} size={22}/></span><div><span>{m.label}</span><strong>{number(m.value)}</strong><small>{m.hint}</small></div></div>)}</div>}
    {overviewError && <p className="au-data-note" role="status">Las estadísticas generales no están disponibles: {overviewError}</p>}
    <section className="au-directory" aria-labelledby="au-directory-title">
      <div className="au-panel-heading"><div><span className="au-eyebrow">GESTIÓN DE CUENTAS</span><h2 id="au-directory-title">Directorio de usuarios</h2>
        <p>Consulta el estado de cada cuenta, sus relaciones y sus últimos accesos.</p></div>
        <button type="button" className="au-outline-button" onClick={()=>exportCurrent(data?.users??[])} disabled={loading||!data?.users.length} title="Exportar únicamente los usuarios de esta página"><Icon name="download" size={16}/> Exportar página</button>
      </div>
      <form onSubmit={submit} className="au-search-form"><label className="au-search-field" htmlFor="au-query"><Icon name="search" size={18}/>
          <input id="au-query" value={input} onChange={e=>setInput(e.target.value)} placeholder="Buscar nombre, correo o alias" aria-label="Buscar usuarios"/></label>
        <label className="au-select-field"><span>Estado</span><select aria-label="Filtrar por estado" value={status} onChange={e=>apply('status',e.target.value)}>
          <option value="">Todos los estados</option><option value="ACTIVE">Activos</option><option value="SUSPENDED">Suspendidos</option><option value="DELETED">Eliminados</option>
        </select></label>
        <label className="au-select-field"><span>Vinculación</span><select aria-label="Filtrar por vinculación" value={relation} onChange={e=>apply('relation',e.target.value)}>
          <option value="">Todas las relaciones</option><option value="OWNER">Propietarios</option><option value="COLLABORATOR">Colaboradores</option><option value="NONE">Sin vinculación activa</option>
        </select></label>
        <button className="au-primary-button" type="submit"><Icon name="search" size={17}/> Buscar</button>
        <button className="au-outline-button" type="button" onClick={clear}><Icon name="refresh" size={16}/> Limpiar</button>
      </form>
      <div className="au-result-count"><span>{loading?'Consultando registros…':data?number(data.pagination.total)+' '+(data.pagination.total===1?'usuario encontrado':'usuarios encontrados'):'Directorio'}</span><span>{!loading && data ? adminDirectoryPageSummary(data.pagination, data.users.length, 'usuarios') + ' · Exportación: solo página visible' : 'La exportación corresponde únicamente a la página visible.'}</span></div>
      {loading?<StatePanel kind="loading" title="Consultando usuarios" message="Cargando registros reales de la plataforma."/>:
        error?<StatePanel kind="error" title="No se pudo cargar el directorio" message={error} retry={()=>setRevision(n=>n+1)}/>:
        data&& (data.users.length===0 ? <StatePanel kind="empty" title="No hay resultados" message="Modifica los filtros o prueba otra búsqueda."/>:
        <>
          <div className="au-table-scroll"><table className="au-table"><thead><tr><th>Usuario</th><th>Estado</th><th>Negocios vinculados</th><th>Registro</th><th>Último acceso</th><th>Detalle</th></tr></thead>
            <tbody>{data.users.map(user=><tr key={user.id}><td><Link to={'/users/'+encodeURIComponent(user.id)} className="au-user-cell"><UserAvatar user={user}/><span><strong>{user.displayName}</strong><small>{user.emailNormalized??'Sin correo registrado'}</small>{user.nickname&&<small>@{user.nickname}</small>}</span></Link></td>
              <td><span className={'au-status '+user.status.toLowerCase()}>{accountStatus[user.status]}</span>{user.isAdmin&&<span className="au-admin-mini">Administrador</span>}</td>
              <td><span className="au-link-count"><Icon name="store" size={15}/> {user.ownedBusinesses} propietario(s)</span><span className="au-link-count"><Icon name="users" size={15}/> {user.collaboratingBusinesses} colaboración(es)</span></td>
              <td>{date(user.createdAt)}</td><td>{date(user.lastLoginAt)}</td>
              <td><Link className="au-detail-link" to={'/users/'+encodeURIComponent(user.id)}>{canDelete && user.status !== "DELETED" ? "Gestionar / eliminar" : "Ver ficha"} <Icon name="arrow" size={16}/></Link></td></tr>)}</tbody>
          </table></div>
          <div className="au-mobile-users">{data.users.map(user=><article key={user.id} className="au-mobile-user-card"><div className="au-mobile-user-head"><UserAvatar user={user}/><div><strong>{user.displayName}</strong><small>{user.emailNormalized??'Sin correo registrado'}</small></div></div>
            <div className="au-mobile-tags"><span className={'au-status '+user.status.toLowerCase()}>{accountStatus[user.status]}</span>{user.isAdmin&&<span className="au-admin-mini">Administrador</span>}</div>
            <div className="au-mobile-user-facts"><span><Icon name="store" size={15}/> {user.ownedBusinesses} propietario(s)</span><span><Icon name="users" size={15}/> {user.collaboratingBusinesses} colaboración(es)</span><span><Icon name="calendar" size={15}/> Alta: {date(user.createdAt)}</span></div>
            <Link to={'/users/'+encodeURIComponent(user.id)} className="au-detail-link">{canDelete && user.status !== "DELETED" ? "Gestionar / eliminar" : "Explorar usuario"} <Icon name="arrow" size={17}/></Link></article>)}</div>
        </>)}
      {data&&data.pagination.totalPages>1&&<nav className="au-pagination" aria-label="Paginación del directorio">
        <span>Página {page} de {data.pagination.totalPages}</span><div><button type="button" className="au-outline-button" disabled={page<=1} onClick={()=>goTo(page-1)}>Anterior</button>
          <button type="button" className="au-primary-button" disabled={page>=data.pagination.totalPages} onClick={()=>goTo(page+1)}>Siguiente <Icon name="arrow" size={16}/></button></div></nav>}
    </section>
    {overview&&<AdminUserAnalyticsPanel data={overview}/>}
  </div>;
}
