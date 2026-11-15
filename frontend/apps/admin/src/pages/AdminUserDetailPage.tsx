import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { StatePanel } from '../components/common';
import { getSession } from '../services/adminService';
import { deactivateAdminUser, getAdminUserProfile, type AdminUserProfile, type AdminUserBusinessLink } from '../services/adminApiClient';
import { accountStatus } from './AdminUsersPage';
import './AdminUsersRefresh.css';

const dateTime = (value: string | null) => value
  ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(value))
  : 'Sin registro';
const number = (value: number) => value.toLocaleString('es-CO');
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase() || '?';
const roleLabel = (role: AdminUserBusinessLink['role']) => role === 'OWNER' ? 'Propietario' : role === 'COLLABORATOR' ? 'Colaborador' : 'Creador del registro';
const membershipLabel: Record<string,string> = {
  ACTIVE:'Vinculación activa',INVITED:'Invitación pendiente',SUSPENDED:'Vínculo suspendido',
  REJECTED:'Invitación rechazada',REVOKED:'Vínculo revocado',NO_MEMBERSHIP:'Sin membresía vigente',
};
function DeactivationDialog({ profile, onClose, onComplete }: {
  profile: AdminUserProfile;
  onClose: () => void;
  onComplete: (message:string)=>void;
}) {
  const [reason,setReason]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const cancelRef=useRef<HTMLButtonElement>(null);
  const dialogRef=useRef<HTMLElement>(null);
  const onCloseRef=useRef(onClose);
  onCloseRef.current=onClose;
  useEffect(()=>{
    const previousOverflow=document.body.style.overflow;
    const prior=document.activeElement instanceof HTMLElement?document.activeElement:null;
    document.body.style.overflow='hidden';
    cancelRef.current?.focus({preventScroll:true});
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!busy){event.preventDefault();onCloseRef.current();}
      if(event.key==='Tab'){
        const options=[...dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled)')??[]].filter(item=>item.getClientRects().length>0);
        if(!options.length)return;
        const first=options[0],last=options[options.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=previousOverflow;prior?.focus({preventScroll:true});};
  },[busy]);
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(busy||confirmation!=='ELIMINAR'||reason.trim().length<12)return;
    setBusy(true);setError('');
    try{const response=await deactivateAdminUser(profile.id,reason.trim(),confirmation);onComplete(response.message);}
    catch(cause){setError(cause instanceof Error?cause.message:'No fue posible registrar la baja.');}
    finally{setBusy(false);}
  };
  return createPortal(<div className="au-modal-backdrop" onMouseDown={event=>{if(!busy&&event.target===event.currentTarget)onClose();}}>
    <section ref={dialogRef} className="au-deletion-modal" role="dialog" aria-modal="true" aria-labelledby="au-delete-title" aria-describedby="au-delete-desc">
      <div className="au-modal-header"><span className="au-modal-warning-icon"><Icon name="trash" size={26}/></span>
        <button className="au-modal-close" type="button" aria-label="Cerrar confirmación" onClick={onClose} disabled={busy}><Icon name="close" size={20}/></button></div>
      <h2 id="au-delete-title">Confirmar eliminación de usuario</h2>
      <p id="au-delete-desc">Se realizará una <strong>baja administrativa de la cuenta</strong> de {profile.displayName}. Esta operación impide nuevos accesos, revoca sesiones y retira colaboraciones vigentes. No borra físicamente los registros ni sustituye un procedimiento de supresión de datos personales.</p>
      <div className="au-modal-person"><span className="au-avatar">{initials(profile.displayName)}</span><div><strong>{profile.displayName}</strong><small>{profile.emailNormalized??'Sin correo'}</small></div></div>
      <form onSubmit={submit} className="au-modal-form">
        <label htmlFor="au-delete-reason">Motivo obligatorio de la decisión (mínimo 12 caracteres)</label>
        <textarea id="au-delete-reason" value={reason} onChange={event=>setReason(event.target.value)}
          minLength={12} maxLength={500} rows={3} required placeholder="Describe la causa administrativa y las verificaciones realizadas." disabled={busy}/>
        <label htmlFor="au-delete-confirmation">Escribe <strong>ELIMINAR</strong> para confirmar</label>
        <input id="au-delete-confirmation" autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)} placeholder="ELIMINAR" disabled={busy} required/>
        {error&&<p className="au-modal-error" role="alert">{error}</p>}
        <div className="au-modal-actions"><button ref={cancelRef} className="au-outline-button" type="button" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="au-danger-button" type="submit" disabled={busy||confirmation!=='ELIMINAR'||reason.trim().length<12}>
            <Icon name="trash" size={16}/>{busy?'Procesando baja…':'Confirmar eliminación'}
          </button></div>
      </form>
    </section>
  </div>,document.body);
}

export function AdminUserDetailPage() {
  const id=useParams().id??'';
  const allowed=getSession()?.permissions?.includes('settings:write')??false;
  const isSuperAdmin=getSession()?.role==='SUPER_ADMIN';
  const [profile,setProfile]=useState<AdminUserProfile|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [deleteOpen,setDeleteOpen]=useState(false);
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    if(!allowed||!id)return;
    let active=true;setLoading(true);setError('');
    getAdminUserProfile(id).then(result=>{if(active)setProfile(result);})
      .catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'No se pudo consultar el perfil.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[allowed,id,retry]);
  const close=useCallback(()=>setDeleteOpen(false),[]);
  const completed=useCallback((message:string)=>{
    setDeleteOpen(false);setNotice(message);setRetry(n=>n+1);
  },[]);
  if(!allowed)return <StatePanel kind="error" title="Acceso restringido" message="No tienes permisos de gestión administrativa."/>;
  if(loading)return <StatePanel kind="loading" title="Consultando usuario" message="Cargando datos, vínculos y estado de la cuenta."/>;
  if(error||!profile)return <StatePanel kind="error" title="No se pudo abrir la ficha" message={error||'Usuario no disponible.'} retry={()=>setRetry(n=>n+1)}/>;
  const owner=profile.businesses.filter(item=>item.role==='OWNER'&&item.membershipStatus==='ACTIVE');
  const collab=profile.businesses.filter(item=>item.role==='COLLABORATOR'&&item.membershipStatus==='ACTIVE');
  const other=profile.businesses.filter(item=>!(item.membershipStatus==='ACTIVE'&&(item.role==='OWNER'||item.role==='COLLABORATOR')));
  const activity=[
    {icon:'star',label:'Opiniones publicadas o registradas',value:profile.activity.reviews},
    {icon:'heart',label:'Negocios favoritos',value:profile.activity.favorites},
    {icon:'check',label:'Me gusta en el catálogo',value:profile.activity.offerLikes},
    {icon:'flag',label:'Reportes de negocios',value:profile.activity.reports},
    {icon:'shield',label:'Sesiones de usuario vigentes',value:profile.activity.sessions},
  ];
  const renderLink=(item:AdminUserBusinessLink)=><article key={item.id} className="au-business-link">
    <span className="au-business-icon"><Icon name="store" size={20}/></span>
    <div className="au-business-link-info"><Link to={'/businesses/'+encodeURIComponent(item.id)}><strong>{item.name}</strong><Icon name="arrow" size={15}/></Link>
      <small>{item.category}{item.city?' · '+item.city:''}</small>
      <div className="au-business-link-badges"><span className={'au-role '+item.role.toLowerCase()}>{roleLabel(item.role)}</span>
        <span className={'au-membership '+item.membershipStatus.toLowerCase()}>{membershipLabel[item.membershipStatus]??item.membershipStatus}</span>
        <span className="au-business-publication">{item.publicationStatus==='PUBLISHED'?'Publicado':item.publicationStatus==='REVIEW'?'En revisión':'No publicado'}</span></div></div>
  </article>;
  return <div className="au-page au-detail-page">
    <Link className="au-back" to="/users"><Icon name="arrow" size={17}/> Volver al directorio</Link>
    <header className="au-detail-hero"><div className="au-profile-avatar">{initials(profile.displayName)}</div>
      <div className="au-detail-heading"><span className="au-eyebrow">FICHA ADMINISTRATIVA · USUARIO</span><h1>{profile.displayName}</h1><p>{profile.emailNormalized??'Sin correo electrónico'}{profile.nickname?' · @'+profile.nickname:''}</p>
        <div className="au-profile-badges"><span className={'au-status '+profile.status.toLowerCase()}>{accountStatus[profile.status]}</span>
          {profile.administrativeRoles.map(role=><span className="au-admin-mini" key={role}>{role==='SUPER_ADMIN'?'Administrador principal':'Administrador'}</span>)}</div></div>
      <div className="au-detail-hero-actions">{profile.status!=='DELETED'&&isSuperAdmin&&<button type="button" className="au-danger-outline-button" onClick={()=>setDeleteOpen(true)} disabled={!profile.deletion.allowed} title={!profile.deletion.allowed?'Existen dependencias que impiden la baja. Revisa el panel de seguridad.':'Registrar baja administrativa'}><Icon name="trash" size={17}/> Eliminar usuario</button>}</div>
    </header>
    {notice&&<div className="au-success-notice" role="status"><Icon name="check" size={18}/>{notice}</div>}
    <div className="au-detail-facts">
      <article><span><Icon name="calendar" size={17}/> Fecha de registro</span><strong>{dateTime(profile.createdAt)}</strong></article>
      <article><span><Icon name="clock" size={17}/> Último acceso</span><strong>{dateTime(profile.lastLoginAt)}</strong></article>
      <article><span><Icon name="store" size={17}/> Negocios propietarios</span><strong>{number(owner.length)}</strong></article>
      <article><span><Icon name="users" size={17}/> Colaboraciones activas</span><strong>{number(collab.length)}</strong></article>
    </div>
    <div className="au-detail-sections">
      <section className="au-info-card" aria-labelledby="au-info-title"><header className="au-section-title"><span className="au-section-icon"><Icon name="users" size={20}/></span><div><h2 id="au-info-title">Información de la cuenta</h2><p>Datos registrados en XAMUKO.</p></div></header>
        <dl className="au-info-grid">
          <div><dt>Nombre completo</dt><dd>{profile.displayName}</dd></div><div><dt>Correo electrónico</dt><dd>{profile.emailNormalized??'No registrado'}</dd></div>
          <div><dt>Alias</dt><dd>{profile.nickname?'@'+profile.nickname:'No registrado'}</dd></div><div><dt>Idioma</dt><dd>{profile.locale}</dd></div>
          <div><dt>Identificador público</dt><dd className="au-code">{profile.publicId}</dd></div><div><dt>Última actualización</dt><dd>{dateTime(profile.updatedAt)}</dd></div>
          <div><dt>Ubicación preferida</dt><dd>{[profile.preferredLocationCity,profile.preferredLocationRegion,profile.preferredLocationCountry].filter(Boolean).join(', ')||'No registrada'}</dd></div>
          <div><dt>Identificador interno</dt><dd className="au-code">{profile.id}</dd></div>
        </dl></section>
      <section className="au-info-card" aria-labelledby="au-security-title"><header className="au-section-title"><span className="au-section-icon"><Icon name="shield" size={20}/></span><div><h2 id="au-security-title">Acceso y seguridad</h2><p>Proveedores de autenticación y restricciones.</p></div></header>
        <div className="au-auth-list">{profile.authProviders.length?profile.authProviders.map((provider,index)=><div className="au-auth-row" key={provider.provider+index}><span className="au-auth-icon"><Icon name={provider.provider==='EMAIL'?'message':'lock'} size={19}/></span><div><strong>{provider.provider==='EMAIL'?'Correo y contraseña':provider.provider==='GOOGLE'?'Google':provider.provider}</strong><small>Vinculado el {dateTime(provider.createdAt)}</small></div><span className={'au-status '+(provider.verifiedAt?'active':'suspended')}>{provider.verifiedAt?'Verificado':'No verificado'}</span></div>):<p>Sin proveedores vinculados.</p>}</div>
        <div className="au-security-meta"><div><span>Sesiones de usuario vigentes</span><strong>{number(profile.activity.sessions)}</strong></div><div><span>Roles administrativos activos</span><strong>{profile.administrativeRoles.length?profile.administrativeRoles.join(', '):'Ninguno'}</strong></div></div>
      </section>
    </div>
    <section className="au-info-card au-businesses-panel" aria-labelledby="au-user-businesses-title"><header className="au-section-title"><span className="au-section-icon"><Icon name="store" size={21}/></span><div><h2 id="au-user-businesses-title">Negocios vinculados</h2><p>Funciones y estados reales de membresía. Ser creador no equivale necesariamente a ser propietario actual.</p></div></header>
      <div className="au-business-group"><h3>Propietario <span>{owner.length}</span></h3>{owner.length?<div className="au-business-grid">{owner.map(renderLink)}</div>:<p className="au-empty-inline">No tiene negocios con rol de propietario activo.</p>}</div>
      <div className="au-business-group"><h3>Colaborador <span>{collab.length}</span></h3>{collab.length?<div className="au-business-grid">{collab.map(renderLink)}</div>:<p className="au-empty-inline">No tiene colaboraciones activas.</p>}</div>
      {!!other.length&&<div className="au-business-group"><h3>Otros vínculos e históricos <span>{other.length}</span></h3><div className="au-business-grid">{other.map(renderLink)}</div></div>}
      {!!profile.businessAccounts.length&&<div className="au-accounts"><h3>Cuentas de negocio creadas <span>{profile.businessAccounts.length}</span></h3>{profile.businessAccounts.map(account=><div key={account.id}><Icon name="box" size={17}/><strong>{account.name}</strong><span>{account.status}</span></div>)}</div>}
    </section>
    <section className="au-info-card" aria-labelledby="au-activity-title"><header className="au-section-title"><span className="au-section-icon"><Icon name="chart" size={21}/></span><div><h2 id="au-activity-title">Actividad registrada</h2><p>Conteos actuales de interacciones vinculadas con esta cuenta.</p></div></header>
      <div className="au-activity-grid">{activity.map(item=><article key={item.label}><span className="au-icon"><Icon name={item.icon} size={20}/></span><strong>{number(item.value)}</strong><span>{item.label}</span></article>)}</div>
    </section>
    <section className="au-info-card au-risk-card" aria-labelledby="au-deletion-title"><header className="au-section-title"><span className="au-section-icon"><Icon name="lock" size={21}/></span><div><h2 id="au-deletion-title">Protección de la cuenta</h2><p>Controles previos a una baja administrativa.</p></div></header>
      {profile.status==='DELETED'?<p className="au-risk-success">Esta cuenta ya está marcada como eliminada. Los registros históricos se conservan.</p>:
        profile.deletion.blockers.length?<div className="au-blockers"><strong>No se permite eliminar esta cuenta mientras existan dependencias:</strong><ul>{profile.deletion.blockers.map(item=><li key={item}>{item}</li>)}</ul></div>:
        <p className="au-risk-success">No se identificaron bloqueos por propiedad de negocios o roles administrativos activos. La eliminación requiere confirmación y motivo escrito.</p>}
      <p className="au-deletion-policy">La acción «Eliminar usuario» realiza una baja lógica: impide el acceso y revoca sesiones y colaboraciones. No implica borrar físicamente los datos ni resolver solicitudes de supresión de datos personales, que requieren su procedimiento correspondiente.</p>
    </section>
    {deleteOpen&&<DeactivationDialog profile={profile} onClose={close} onComplete={completed}/>}
  </div>;
}
