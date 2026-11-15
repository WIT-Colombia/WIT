import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { StatePanel } from '../components/common';
import { getSession } from '../services/adminService';
import { getAdminContentDetail, moderateAdminContent, type AdminContentDetail } from '../services/adminApiClient';
import { AdminContentPhoto } from './AdminContentPhoto';
import { contentStatusLabel, displayDate, offerKindLabel, offerPrice, reportReasonLabel, reportStatusLabel } from './AdminContentLabels';
import './AdminContentRefresh.css';
const num=(n:number)=>new Intl.NumberFormat('es-CO').format(n);
type Action='HIDE'|'RESTORE';
function ModerationDialog({offer,action,onClose,onDone}:{offer:AdminContentDetail;action:Action;onClose:()=>void;onDone:(message:string)=>void}){
  const hide=action==='HIDE';
  const word=hide?'OCULTAR':'RESTAURAR';
  const [reason,setReason]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  const cancelRef=useRef<HTMLButtonElement>(null);
  const dialogRef=useRef<HTMLElement>(null);
  const closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{
    const previous=document.body.style.overflow;
    const before=document.activeElement instanceof HTMLElement?document.activeElement:null;
    document.body.style.overflow='hidden';cancelRef.current?.focus({preventScroll:true});
    const handler=(e:KeyboardEvent)=>{
      if(e.key==='Escape'&&!working){e.preventDefault();closeRef.current();}
      if(e.key==='Tab'){
        const nodes=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled])')??[])
          .filter(n=>n.getClientRects().length>0);
        if(!nodes.length)return;
        if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes[nodes.length-1].focus();}
        else if(!e.shiftKey&&document.activeElement===nodes[nodes.length-1]){e.preventDefault();nodes[0].focus();}
      }
    };
    document.addEventListener('keydown',handler);
    return()=>{document.removeEventListener('keydown',handler);document.body.style.overflow=previous;before?.focus({preventScroll:true});};
  },[working]);
  const submit=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    if(working||confirmation!==word||reason.trim().length<12)return;
    setWorking(true);setError('');
    try{const result=await moderateAdminContent(offer.id,action,reason.trim());onDone(result.message);}
    catch(cause){setError(cause instanceof Error?cause.message:'No se pudo registrar la decisión.');}
    finally{setWorking(false);}
  };
  return createPortal(<div className="ac-modal-backdrop" onMouseDown={e=>{if(!working&&e.target===e.currentTarget)onClose();}}>
    <section className="ac-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="ac-modal-title" aria-describedby="ac-modal-description">
      <div className="ac-modal-top"><span className={'ac-modal-icon '+(hide?'danger':'safe')}><Icon name={hide?'eye-off':'check'} size={26}/></span>
        <button type="button" aria-label="Cerrar ventana" className="ac-modal-close" disabled={working} onClick={onClose}><Icon name="close" size={19}/></button></div>
      <h2 id="ac-modal-title">{hide?'Ocultar publicación':'Restaurar publicación'}</h2>
      <p id="ac-modal-description">{hide
        ?'Esta publicación dejará de mostrarse. El producto o servicio permanecerá registrado y podrá consultarse desde Admin.'
        :'Esta publicación volverá a estar disponible siempre que el negocio esté activo y no haya modificado su estado posteriormente.'}
        {' '}La decisión se registrará en la auditoría administrativa.</p>
      <div className="ac-modal-offer"><span className="ac-icon"><Icon name={offer.kind==='PRODUCT'?'box':'settings'} size={20}/></span><div><strong>{offer.name}</strong><span>{offer.business.name} · {offerKindLabel(offer.kind)}</span></div></div>
      <form className="ac-modal-form" onSubmit={submit}>
        <label htmlFor="ac-moderation-reason">Motivo de la decisión (entre 12 y 500 caracteres)</label>
        <textarea id="ac-moderation-reason" rows={3} minLength={12} maxLength={500} required value={reason}
          onChange={e=>setReason(e.target.value)} placeholder="Describe los hechos y las razones de la medida." disabled={working}/>
        <label htmlFor="ac-moderation-confirm">Escribe <strong>{word}</strong> para confirmar</label>
        <input id="ac-moderation-confirm" value={confirmation} autoComplete="off" required
          onChange={e=>setConfirmation(e.target.value)} placeholder={word} disabled={working}/>
        {error&&<p role="alert" className="ac-modal-error">{error}</p>}
        <div className="ac-modal-actions"><button ref={cancelRef} className="ac-secondary" type="button" disabled={working} onClick={onClose}>Cancelar</button>
          <button className={hide?'ac-danger':'ac-primary'} type="submit" disabled={working||confirmation!==word||reason.trim().length<12}>
            <Icon name={hide?'eye-off':'check'} size={17}/>{working?'Registrando decisión…':hide?'Confirmar ocultación':'Confirmar restauración'}
          </button></div>
      </form>
    </section>
  </div>,document.body);
}
export function AdminContentDetailPage(){
  const id=useParams().id??'';
  const allowed=getSession()?.permissions?.includes('catalog:read')??false;
  const canModerate=getSession()?.permissions?.includes('content:moderate:write')??false;
  const [offer,setOffer]=useState<AdminContentDetail|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const [selected,setSelected]=useState<string|null>(null);
  const [action,setAction]=useState<Action|null>(null);
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    if(!allowed||!id)return;
    let active=true;setLoading(true);setError('');setOffer(null);
    getAdminContentDetail(id).then(result=>{
      if(!active)return;
      setOffer(result);setSelected(result.photos[0]?.id??null);
    }).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'No se pudo consultar la publicación.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[id,allowed,revision]);
  const close=useCallback(()=>setAction(null),[]);
  const done=useCallback((message:string)=>{setAction(null);setNotice(message);setRevision(v=>v+1);},[]);
  if(!allowed)return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso de catálogo para consultar publicaciones."/>;
  if(loading)return <StatePanel kind="loading" title="Consultando publicación" message="Cargando los datos y fotografías del contenido."/>;
  if(error||!offer)return <StatePanel kind="error" title="No se pudo abrir el contenido" message={error||'Publicación no disponible.'} retry={()=>setRevision(v=>v+1)}/>;
  const details=[
    ['Código interno',offer.internalCode],['Tipo',offerKindLabel(offer.kind)],['Categoría',offer.category],
    ['Precio',offerPrice(offer)],['Negociable',offer.negotiable?'Sí':'No'],['Publicación',contentStatusLabel(offer.publicationStatus,offer.deletedAt)],
    ['Activo en catálogo',offer.active?'Sí':'No'],['Contenido solo para adultos',offer.adultOnly?'Sí':'No'],
    ['Fecha de creación',displayDate(offer.createdAt)],['Última actualización',displayDate(offer.updatedAt)],
  ];
  return <div className="ac-page ac-detail-page">
    <Link to="/content" className="ac-back"><Icon name="arrow" size={17}/> Volver al directorio</Link>
    <header className="ac-detail-hero"><span className="ac-detail-mark"><Icon name={offer.kind==='PRODUCT'?'box':'settings'} size={30}/></span>
      <div><span className="ac-eyebrow">FICHA ADMINISTRATIVA · {offerKindLabel(offer.kind).toLocaleUpperCase('es-CO')}</span>
        <h1>{offer.name}</h1><p>{offer.business.name} · Código {offer.internalCode}</p>
        <div className="ac-detail-badges"><span className={'ac-kind '+offer.kind.toLowerCase()}>{offerKindLabel(offer.kind)}</span>
          <span className={'ac-status '+(offer.deletedAt?'deleted':offer.publicationStatus.toLowerCase())}>{contentStatusLabel(offer.publicationStatus,offer.deletedAt)}</span>
          {!offer.active&&<span className="ac-pill-muted">Inactivo</span>}</div></div>
      {canModerate&&<div className="ac-detail-actions">{offer.canHide&&<button className="ac-danger-outline" type="button" onClick={()=>setAction('HIDE')}><Icon name="eye-off" size={17}/> Ocultar publicación</button>}
        {offer.canRestore&&<button className="ac-secondary" type="button" onClick={()=>setAction('RESTORE')}><Icon name="check" size={17}/> Restaurar publicación</button>}</div>}
    </header>
    {notice&&<div className="ac-success" role="status"><Icon name="check" size={18}/>{notice}</div>}
    <div className="ac-detail-highlights"><article><span><Icon name="heart" size={18}/> Me gusta</span><strong>{num(offer.likes)}</strong></article>
      <article><span><Icon name="flag" size={18}/> Reportes</span><strong>{num(offer.reports)}</strong></article>
      <article><span><Icon name="image" size={18}/> Fotografías</span><strong>{num(offer.photos.length)}</strong></article>
      <article><span><Icon name="calendar" size={18}/> Registrado</span><strong>{displayDate(offer.createdAt)}</strong></article></div>
    <div className="ac-detail-layout">
      <section className="ac-card ac-gallery-card"><div className="ac-section-head"><span className="ac-section-icon"><Icon name="image" size={20}/></span>
        <div><h2>Galería del contenido</h2><p>Fotografías originales cargadas por el negocio.</p></div></div>
        <AdminContentPhoto photoId={selected} alt={offer.name} type={offer.kind} className="ac-detail-main-photo"/>
        {offer.photos.length>1&&<div className="ac-photo-thumbnails">{offer.photos.map((photo,i)=><button type="button" key={photo.id} className={selected===photo.id?'selected':''}
          onClick={()=>setSelected(photo.id)} aria-label={'Ver fotografía '+(i+1)} aria-pressed={selected===photo.id}>
          <AdminContentPhoto photoId={photo.id} alt={photo.altText??offer.name} type={offer.kind}/>
        </button>)}</div>}
        {!offer.photos.length&&<p className="ac-photo-notice">Este contenido no tiene fotografías registradas.</p>}
      </section>
      <section className="ac-card"><div className="ac-section-head"><span className="ac-section-icon"><Icon name="grid" size={20}/></span><div><h2>Información general</h2><p>Datos originales del catálogo de XAMUKO Business.</p></div></div>
        <dl className="ac-detail-fields">{details.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </section>
    </div>
    <section className="ac-card"><div className="ac-section-head"><span className="ac-section-icon"><Icon name="message" size={20}/></span><div><h2>Descripción de la publicación</h2><p>Contenido registrado por el negocio.</p></div></div>
      <p className="ac-description">{offer.description?.trim()||'No se registró una descripción.'}</p></section>
    <div className="ac-detail-layout">
      <section className="ac-card"><div className="ac-section-head"><span className="ac-section-icon"><Icon name="store" size={20}/></span><div><h2>Negocio vinculado</h2><p>Ubicación y estado del negocio propietario.</p></div></div>
        <div className="ac-related-business"><span className="ac-related-mark"><Icon name="store" size={24}/></span>
          <div><Link to={'/businesses/'+encodeURIComponent(offer.business.id)}><strong>{offer.business.name}</strong><Icon name="arrow" size={17}/></Link>
            <small>{offer.business.city??'Ciudad no registrada'}{offer.business.country?' · '+offer.business.country:''}</small>
            <span>{offer.business.publicationStatus==='PUBLISHED'?'Negocio publicado':offer.business.publicationStatus==='REVIEW'?'Negocio en revisión':'Negocio no publicado'}</span></div></div>
      </section>
      <section className="ac-card"><div className="ac-section-head"><span className="ac-section-icon"><Icon name="flag" size={20}/></span><div><h2>Reportes sobre el contenido</h2><p>Últimos reportes registrados.</p></div>
          <Link className="ac-secondary" to="/offer-reports">Gestionar reportes</Link></div>
        {offer.reportsRecent.length?<div className="ac-reports-list">{offer.reportsRecent.map(report=><article key={report.id}><div><strong>{reportReasonLabel(report.reason)}</strong>
          <span>{reportStatusLabel(report.status)}</span></div><small>{displayDate(report.createdAt)}</small>{report.description&&<p>{report.description}</p>}</article>)}</div>:
          <p className="ac-muted">No existen reportes registrados para esta publicación.</p>}
      </section>
    </div>
    <p className="ac-legal-note"><Icon name="shield" size={17}/>Las medidas administrativas requieren permiso de moderación y motivo escrito. Las decisiones se guardan en el registro de auditoría; ocultar contenido no lo elimina físicamente.</p>
    {action&&<ModerationDialog offer={offer} action={action} onClose={close} onDone={done}/>}
  </div>;
}
