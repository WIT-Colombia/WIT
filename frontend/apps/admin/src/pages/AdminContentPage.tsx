import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { StatePanel } from '../components/common';
import { getSession } from '../services/adminService';
import { getAdminContentInsights, listAdminOffers, type AdminContentInsights, type AdminOfferPage, type AdminOfferRecord } from '../services/adminApiClient';
import { AdminContentPhoto } from './AdminContentPhoto';
import { AdminContentAnalyticsPanel } from './AdminContentAnalyticsPanel';
import { contentStatusLabel, displayDate, offerKindLabel, offerPrice } from './AdminContentLabels';
import './AdminContentRefresh.css';

const num=(value:number)=>new Intl.NumberFormat('es-CO').format(value);
function Status({offer}:{offer:Pick<AdminOfferRecord,'publicationStatus'|'deletedAt'>}){
  return <span className={'ac-status '+(offer.deletedAt?'deleted':offer.publicationStatus.toLowerCase())}>{contentStatusLabel(offer.publicationStatus,offer.deletedAt)}</span>;
}
function ContentBadge({item}:{item:AdminOfferRecord}){
  return <div className="ac-badges"><span className={'ac-kind '+item.kind.toLowerCase()}>{offerKindLabel(item.kind)}</span>
    <Status offer={item}/>{!item.active&&!item.deletedAt&&<span className="ac-pill-muted">Inactivo</span>}
    {item.adultOnly&&<span className="ac-pill-age">Solo adultos</span>}</div>;
}
export function AdminContentPage(){
  const allowed=getSession()?.permissions?.includes('catalog:read')??false;
  const [params,setParams]=useSearchParams();
  const q=params.get('q')??'',kind=params.get('kind')??'',status=params.get('status')??'',
    city=params.get('city')??'',categoryId=params.get('categoryId')??'';
  const parsedPage=Number(params.get('page')??'1');
  const page=Number.isFinite(parsedPage)?Math.max(1,Math.min(100000,Math.floor(parsedPage))):1;
  const [search,setSearch]=useState(q);
  const [advanced,setAdvanced]=useState(false);
  const [period,setPeriod]=useState('12m');
  const [directory,setDirectory]=useState<AdminOfferPage|null>(null);
  const [insights,setInsights]=useState<AdminContentInsights|null>(null);
  const [loading,setLoading]=useState(true);
  const [analyticsLoading,setAnalyticsLoading]=useState(true);
  const [error,setError]=useState('');
  const [analyticsError,setAnalyticsError]=useState('');
  const [revision,setRevision]=useState(0);
  const [analyticsRevision,setAnalyticsRevision]=useState(0);
  const filters={q,kind,status,city,categoryId};
  useEffect(()=>setSearch(q),[q]);
  useEffect(()=>{
    if(!allowed)return;
    let active=true;setLoading(true);setError('');
    listAdminOffers({q,kind,status,city,categoryId,page}).then(result=>{if(active)setDirectory(result);})
      .catch(cause=>{if(active){setDirectory(null);setError(cause instanceof Error?cause.message:'No fue posible consultar el contenido.');}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[allowed,q,kind,status,city,categoryId,page,revision]);
  useEffect(()=>{
    if(!allowed)return;
    let active=true;setAnalyticsLoading(true);setAnalyticsError('');
    getAdminContentInsights({q,kind,status,city,categoryId,period}).then(result=>{if(active)setInsights(result);})
      .catch(cause=>{if(active){setInsights(null);setAnalyticsError(cause instanceof Error?cause.message:'No se pudo consultar la evolución.');}})
      .finally(()=>{if(active)setAnalyticsLoading(false);});
    return()=>{active=false;};
  },[allowed,q,kind,status,city,categoryId,period,analyticsRevision]);
  const apply=(key:'q'|'kind'|'status'|'city'|'categoryId',value:string)=>{
    const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);
    next.delete('page');setParams(next,{replace:true});
  };
  const go=(target:number)=>{
    const next=new URLSearchParams(params);
    if(target<=1)next.delete('page');else next.set('page',String(target));setParams(next);
  };
  const clear=()=>{setSearch('');setParams({},{replace:true});};
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();apply('q',search.trim());};
  const totals=insights?.totals;
  const kpis=totals?[
    {label:'Contenido del segmento',value:totals.total,icon:'box',tone:'blue',hint:'Según los filtros seleccionados'},
    {label:'Productos',value:totals.products,icon:'grid',tone:'violet',hint:'Artículos registrados'},
    {label:'Servicios',value:totals.services,icon:'settings',tone:'cyan',hint:'Servicios registrados'},
    {label:'Publicados',value:totals.published,icon:'check',tone:'green',hint:'Con estado de publicación vigente'},
  ]:[];
  if(!allowed)return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso de catálogo para consultar el contenido."/>;
  return <div className="ac-page">
    <header className="admin-section-heading"><h1 id="ac-title">Contenido</h1></header>
        {totals&&<div className="ac-kpis" aria-label="Resumen del catálogo">{kpis.map(k=><div key={k.label} className={'ac-kpi '+k.tone}><span className="ac-kpi-icon"><Icon name={k.icon} size={22}/></span>
      <div><span>{k.label}</span><strong>{num(k.value)}</strong><small>{k.hint}</small></div></div>)}</div>}
    {analyticsError&&<p className="ac-warning" role="status">Los indicadores generales no están disponibles: {analyticsError}</p>}
    <section className="ac-directory" aria-labelledby="ac-directory-title">
      <div className="ac-panel-head"><div><span className="ac-eyebrow">GESTIÓN DE PUBLICACIONES</span><h2 id="ac-directory-title">Directorio de contenido</h2><p>Productos y servicios de los negocios registrados en XAMUKO.</p></div>
        <Link to="/offer-reports" className="ac-secondary"><Icon name="flag" size={17}/> Revisar reportes</Link></div>
      <form className="ac-toolbar" onSubmit={submit}>
        <label className="ac-search" htmlFor="ac-query"><Icon name="search" size={18}/><input id="ac-query" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar publicación, código o negocio"/></label>
        <label className="ac-filter-label"><span>Tipo</span><select aria-label="Filtrar por tipo" value={kind} onChange={e=>apply('kind',e.target.value)}>
          <option value="">Productos y servicios</option><option value="PRODUCT">Productos</option><option value="SERVICE">Servicios</option></select></label>
        <label className="ac-filter-label"><span>Publicación</span><select aria-label="Filtrar por estado" value={status} onChange={e=>apply('status',e.target.value)}>
          <option value="">Vigentes</option><option value="PUBLISHED">Publicados</option><option value="REVIEW">En revisión</option><option value="UNPUBLISHED">No publicados</option><option value="DELETED">Eliminados</option></select></label>
        <button className="ac-primary" type="submit"><Icon name="search" size={16}/> Buscar</button>
        <button className="ac-secondary" type="button" onClick={clear}><Icon name="refresh" size={16}/> Limpiar</button>
      </form>
      <div className="ac-more-filter-row"><span>{city||categoryId?'Filtros territoriales o de categoría aplicados':'Puedes afinar la búsqueda por ciudad y categoría.'}</span>
        <button type="button" className="ac-filter-link" onClick={()=>setAdvanced(v=>!v)} aria-expanded={advanced} aria-controls="ac-directory-extra"><Icon name="settings" size={16}/>{advanced?'Ocultar filtros':'Filtros avanzados'}<Icon name="chevron" size={15}/></button>
      </div>
      <div className="ac-extra-filters" id="ac-directory-extra" hidden={!advanced}>
        <label>Ciudad<select value={city} onChange={e=>apply('city',e.target.value)}><option value="">Todas las ciudades</option>{insights?.filters.cities.map(v=><option key={v.value} value={v.value}>{v.label}</option>)}</select></label>
        <label>Categoría<select value={categoryId} onChange={e=>apply('categoryId',e.target.value)}><option value="">Todas las categorías</option>{insights?.filters.categories.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      </div>
      <div className="ac-result-strip"><strong>{loading?'Consultando…':directory?num(directory.pagination.total)+(directory.pagination.total===1?' publicación':' publicaciones'):'Directorio'}</strong>
        <span>Accede a cada ficha para ver fotografías, precios y relaciones.</span></div>
      {loading?<StatePanel kind="loading" title="Consultando contenido" message="Cargando productos y servicios registrados."/>:
        error?<StatePanel kind="error" title="No se pudo cargar el contenido" message={error} retry={()=>setRevision(v=>v+1)}/>:
        directory&&(directory.offers.length===0?<StatePanel kind="empty" title="Sin resultados" message="Prueba otros filtros o consulta otro período."/>:<>
          <div className="ac-table-scroll"><table className="ac-table"><thead><tr><th>Publicación</th><th>Negocio</th><th>Categoría</th><th>Precio</th><th>Estado</th><th>Actividad</th><th>Detalle</th></tr></thead>
            <tbody>{directory.offers.map(offer=><tr key={offer.id}>
              <td><div className="ac-title-cell"><AdminContentPhoto photoId={offer.photoId} alt={offer.photoAlt??offer.name} type={offer.kind}/><div><Link to={'/content/'+encodeURIComponent(offer.id)}><strong>{offer.name}</strong></Link><small>{offer.internalCode} · {offerKindLabel(offer.kind)}</small><small>Actualizado: {displayDate(offer.updatedAt)}</small></div></div></td>
              <td><Link className="ac-business-link" to={'/businesses/'+encodeURIComponent(offer.business.id)}>{offer.business.name}</Link><small className="ac-table-sub">{offer.business.city??'Ubicación no registrada'}</small></td>
              <td>{offer.category}</td><td className="ac-price">{offerPrice(offer)}</td>
              <td><Status offer={offer}/>{!offer.active&&!offer.deletedAt&&<span className="ac-table-sub">Inactivo</span>}</td>
              <td><div className="ac-activity-mini"><span><Icon name="heart" size={14}/>{num(offer.likes)}</span><span><Icon name="flag" size={14}/>{num(offer.reports)}</span></div></td>
              <td><Link className="ac-view" to={'/content/'+encodeURIComponent(offer.id)}>Ver detalle <Icon name="arrow" size={16}/></Link></td>
            </tr>)}</tbody></table></div>
          <div className="ac-mobile-grid">{directory.offers.map(offer=><article className="ac-mobile-card" key={offer.id}>
            <Link className="ac-mobile-image" to={'/content/'+encodeURIComponent(offer.id)}><AdminContentPhoto photoId={offer.photoId} alt={offer.photoAlt??offer.name} type={offer.kind}/></Link>
            <div className="ac-mobile-body"><ContentBadge item={offer}/><h3>{offer.name}</h3><p>{offer.category} · {offer.business.name}</p>
              <strong className="ac-mobile-price">{offerPrice(offer)}</strong><div className="ac-mobile-foot"><span>{offer.business.city??'Sin ubicación'}</span><Link className="ac-view" to={'/content/'+encodeURIComponent(offer.id)}>Explorar <Icon name="arrow" size={16}/></Link></div></div>
          </article>)}</div>
        </>)}
      {directory&&directory.pagination.totalPages>1&&<nav className="ac-pagination" aria-label="Páginas de contenido">
        <span>Página {page} de {directory.pagination.totalPages}</span><div><button type="button" className="ac-secondary" disabled={page<=1} onClick={()=>go(page-1)}>Anterior</button><button type="button" className="ac-primary" disabled={page>=directory.pagination.totalPages} onClick={()=>go(page+1)}>Siguiente <Icon name="arrow" size={16}/></button></div></nav>}
    </section>
    <AdminContentAnalyticsPanel data={insights} loading={analyticsLoading} error={analyticsError} period={period} onPeriod={setPeriod}
      filters={filters} onFilter={apply} onRetry={()=>setAnalyticsRevision(v=>v+1)}/>
  </div>;
}
