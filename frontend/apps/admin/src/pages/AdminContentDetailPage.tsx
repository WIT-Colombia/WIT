import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { StatePanel } from '../components/common';
import { getSession } from '../services/adminService';
import { getAdminContentDetail, type AdminContentDetail } from '../services/adminApiClient';
import { AdminContentPhoto } from './AdminContentPhoto';
import { AdminContentControlPanel } from './AdminContentControlPanel';
import { AdminContentHistoryPanel } from './AdminContentHistoryPanel';
import { contentStatusLabel, displayDate, offerKindLabel, offerPrice, reportReasonLabel, reportStatusLabel, administrativeContentLabel } from './AdminContentLabels';
import './AdminContentRefresh.css';
import './AdminContentControl.css';
const num=(n:number)=>new Intl.NumberFormat('es-CO').format(n);
export function AdminContentDetailPage(){
  const id=useParams().id??'';
  const allowed=getSession()?.permissions?.includes('catalog:read')??false;
  const [offer,setOffer]=useState<AdminContentDetail|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const [selected,setSelected]=useState<string|null>(null);
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
  const done=(message:string)=>{setNotice(message);setRevision(v=>v+1);};
  if(!allowed)return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso de catálogo para consultar publicaciones."/>;
  if(loading)return <StatePanel kind="loading" title="Consultando publicación" message="Cargando los datos y fotografías del contenido."/>;
  if(error||!offer)return <StatePanel kind="error" title="No se pudo abrir el contenido" message={error||'Publicación no disponible.'} retry={()=>setRevision(v=>v+1)}/>;
  const details=[
    ['Código interno',offer.internalCode],['Tipo',offerKindLabel(offer.kind)],['Categoría',offer.category],
    ['Precio',offerPrice(offer)],['Negociable',offer.negotiable?'Sí':'No'],['Publicación',contentStatusLabel(offer.publicationStatus,offer.deletedAt,offer.administrativeStatus)],
    ['Activo en catálogo',offer.active?'Sí':'No'],['Contenido solo para adultos',offer.adultOnly?'Sí':'No'],
    ['Fecha de creación',displayDate(offer.createdAt)],['Última actualización',displayDate(offer.updatedAt)],
    ['Restricción de Admin',administrativeContentLabel(offer.administrativeStatus)],
  ];
  return <div className="ac-page ac-detail-page">
    <Link to="/content" className="ac-back"><Icon name="arrow" size={17}/> Volver al directorio</Link>
    <header className="ac-detail-hero"><span className="ac-detail-mark"><Icon name={offer.kind==='PRODUCT'?'box':'settings'} size={30}/></span>
      <div><span className="ac-eyebrow">FICHA ADMINISTRATIVA · {offerKindLabel(offer.kind).toLocaleUpperCase('es-CO')}</span>
        <h1>{offer.name}</h1><p>{offer.business.name} · Código {offer.internalCode}</p>
        <div className="ac-detail-badges"><span className={'ac-kind '+offer.kind.toLowerCase()}>{offerKindLabel(offer.kind)}</span>
          <span className={'ac-status '+(offer.deletedAt?'deleted':offer.publicationStatus.toLowerCase())}>{contentStatusLabel(offer.publicationStatus,offer.deletedAt)}</span>
          {!offer.active&&<span className="ac-pill-muted">Inactivo</span>}</div></div>
    </header>
    {notice&&<div className="ac-success" role="status"><Icon name="check" size={18}/>{notice}</div>}
    <div className="ac-detail-highlights"><article><span><Icon name="heart" size={18}/> Me gusta</span><strong>{num(offer.likes)}</strong></article>
      <article><span><Icon name="flag" size={18}/> Reportes</span><strong>{num(offer.reports)}</strong></article>
      <article><span><Icon name="image" size={18}/> Fotografías</span><strong>{num(offer.photos.length)}</strong></article>
      <article><span><Icon name="eye" size={18}/> Vistas</span><strong>{num(offer.views)}</strong></article></div>
    <AdminContentControlPanel offer={offer} selectedPhotoId={selected} onDone={done}/>
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
    <AdminContentHistoryPanel id={id} revision={revision}/>
  </div>;
}
