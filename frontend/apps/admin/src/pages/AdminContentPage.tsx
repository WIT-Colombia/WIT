import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { StatePanel } from '../components/common';
import { getSession } from '../services/adminService';
import { getAdminContentInsights, getAdminContentCapabilities, listAdminOffers, type AdminContentInsights, type AdminOfferPage, type AdminOfferRecord } from '../services/adminApiClient';
import { AdminContentPhoto } from './AdminContentPhoto';
import { AdminContentAnalyticsPanel } from './AdminContentAnalyticsPanel';
import { AdminContentBulkDialog } from './AdminContentBulkDialog';
import { contentStatusLabel, displayDate, offerKindLabel, offerPrice } from './AdminContentLabels';
import './AdminContentRefresh.css';
import './AdminContentControl.css';
import './AdminContentPremium.css';
import { adminDirectoryPageSummary } from '../utils/adminDirectoryPagination';

function exportVisibleContent(rows:AdminOfferRecord[]){
  const safe=(value:string)=>'"'+((['=','+','-','@'].includes(value.trimStart()[0]??'')||value.charCodeAt(0)<32)?"'":'')+value.replaceAll('"','""')+'"';
  const headers=['Código','Nombre','Tipo','Negocio','Categoría','Precio','Estado','Me gusta','Vistas','Reportes','Actualización'];
  const lines=[headers,...rows.map(o=>[o.internalCode,o.name,offerKindLabel(o.kind),o.business.name,o.category,offerPrice(o),contentStatusLabel(o.publicationStatus,o.deletedAt,o.administrativeStatus),String(o.likes),String(o.views),String(o.reports),displayDate(o.updatedAt)])];
  const csv=String.fromCharCode(0xFEFF)+lines.map(row=>row.map(safe).join(';')).join(String.fromCharCode(13,10));
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='xamuko-contenido-pagina.csv';a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

const num=(value:number)=>Number.isFinite(value)?new Intl.NumberFormat('es-CO').format(value):'—';
function Status({offer}:{offer:Pick<AdminOfferRecord,'publicationStatus'|'deletedAt'|'administrativeStatus'>}){
  // The mobile SPA may update before the API deployment. Never dereference
  // an administrative state missing from an older server response.
  const adminStatus=typeof offer.administrativeStatus==='string'?offer.administrativeStatus:'UNKNOWN';
  const publication=typeof offer.publicationStatus==='string'?offer.publicationStatus:'UNKNOWN';
  const tone=offer.deletedAt?'deleted':adminStatus==='NONE'?publication.toLowerCase():adminStatus.toLowerCase();
  return <span className={'ac-status '+tone}>{contentStatusLabel(publication,offer.deletedAt,adminStatus)}</span>;
}
function ContentBadge({item}:{item:AdminOfferRecord}){
  return <div className="ac-badges"><span className={'ac-kind '+(item.kind??'unknown').toLowerCase()}>{offerKindLabel(item.kind)}</span>
    <Status offer={item}/>{!item.active&&!item.deletedAt&&<span className="ac-pill-muted">Inactivo</span>}
    {item.adultOnly&&<span className="ac-pill-age">Solo adultos</span>}</div>;
}
function useMobileCatalogLayout(){
  const matches=()=>typeof window!=='undefined' && typeof window.matchMedia==='function' &&
    window.matchMedia('(max-width: 900px)').matches;
  const [mobile,setMobile]=useState(matches);
  useEffect(()=>{
    if(typeof window.matchMedia!=='function')return;
    const query=window.matchMedia('(max-width: 900px)');
    const update=()=>setMobile(query.matches);
    update();
    if(typeof query.addEventListener==='function'){
      query.addEventListener('change',update);
      return()=>query.removeEventListener('change',update);
    }
    query.addListener(update);
    return()=>query.removeListener(update);
  },[]);
  return mobile;
}
export function AdminContentPage(){
  const mobile=useMobileCatalogLayout();
  const allowed=getSession()?.permissions?.includes('catalog:read')??false;
  const [params,setParams]=useSearchParams();
  const q=params.get('q')??'',kind=params.get('kind')??'',status=params.get('status')??'',
    city=params.get('city')??'',categoryId=params.get('categoryId')??'',
    businessId=params.get('businessId')??'',order=params.get('order')??'';
  const parsedPage=Number(params.get('page')??'1');
  const page=Number.isFinite(parsedPage)?Math.max(1,Math.min(100000,Math.floor(parsedPage))):1;
  const [search,setSearch]=useState(q);
  const [advanced,setAdvanced]=useState(false);
  const [period,setPeriod]=useState('30d');
  const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const [bulkAction,setBulkAction]=useState<'HIDE'|'REVIEW'|null>(null);
  const [bulkNotice,setBulkNotice]=useState('');
  const [bulkErrors,setBulkErrors]=useState<string[]>([]);
  const [canModerate,setCanModerate]=useState(false);
  const [directory,setDirectory]=useState<AdminOfferPage|null>(null);
  const [insights,setInsights]=useState<AdminContentInsights|null>(null);
  const [loading,setLoading]=useState(true);
  const [analyticsLoading,setAnalyticsLoading]=useState(true);
  const [error,setError]=useState('');
  const [analyticsError,setAnalyticsError]=useState('');
  const [revision,setRevision]=useState(0);
  const [analyticsRevision,setAnalyticsRevision]=useState(0);
  const filters={q,kind,status,city,categoryId,businessId,order};
  useEffect(()=>{let active=true;getAdminContentCapabilities().then(result=>{if(active)setCanModerate(result.canModerate);}).catch(()=>{if(active)setCanModerate(false);});return()=>{active=false;};},[]);
  useEffect(()=>{setSelectedIds([]);},[q,kind,status,city,categoryId,businessId,order,page]);
  useEffect(()=>setSearch(q),[q]);
  useEffect(()=>{
    if(!allowed)return;
    let active=true;setLoading(true);setError('');
    listAdminOffers({q,kind,status,city,categoryId,businessId,order,page}).then(result=>{if(active)setDirectory(result);})
      .catch(cause=>{if(active){setDirectory(null);setError(cause instanceof Error?cause.message:'No fue posible consultar el contenido.');}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[allowed,q,kind,status,city,categoryId,businessId,order,page,revision]);
  useEffect(()=>{
    if(!allowed)return;
    let active=true;setAnalyticsLoading(true);setAnalyticsError('');
    getAdminContentInsights({q,kind,status,city,categoryId,businessId,period}).then(result=>{if(active)setInsights(result);})
      .catch(cause=>{if(active){setInsights(null);setAnalyticsError(cause instanceof Error?cause.message:'No se pudo consultar la evolución.');}})
      .finally(()=>{if(active)setAnalyticsLoading(false);});
    return()=>{active=false;};
  },[allowed,q,kind,status,city,categoryId,businessId,period,analyticsRevision]);
  const apply=(key:'q'|'kind'|'status'|'city'|'categoryId'|'businessId'|'order',value:string)=>{
    const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);
    next.delete('page');setParams(next,{replace:true});
  };
  const go=(target:number)=>{
    const next=new URLSearchParams(params);
    if(target<=1)next.delete('page');else next.set('page',String(target));setParams(next);
  };
  const clear=()=>{setSearch('');setParams({},{replace:true});};
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();apply('q',search.trim());};
  const toggleSelection=(id:string)=>setSelectedIds(values=>values.includes(id)?values.filter(v=>v!==id):values.length<25?[...values,id]:values);
  const eligible=(directory?.offers??[]).filter(o=>!o.deletedAt);
  const allSelected=eligible.length>0&&eligible.every(o=>selectedIds.includes(o.id));
  const selectVisible=()=>setSelectedIds(allSelected?[]:eligible.slice(0,25).map(o=>o.id));
  const finishBulk=(result:{succeeded:number;failed:number;errors:string[]})=>{
    setBulkAction(null);setSelectedIds([]);setBulkErrors(result.errors);
    setBulkNotice(result.succeeded+' publicaciones procesadas; '+result.failed+' con errores.');
    setRevision(v=>v+1);setAnalyticsRevision(v=>v+1);
  };
  // Never display counters for a previous filter while a new API result is pending.
  const totals=analyticsLoading?null:insights?.totals;
  // Counters are returned by /admin/content-insights for the active filters.
  const kpis=totals?[
    {label:'Contenido del segmento',value:totals.total,icon:'box',tone:'violet',hint:'Según filtros activos',status:''},
    {label:'Publicados',value:totals.published,icon:'check',tone:'green',hint:'Estado de publicación',status:'PUBLISHED'},
    {label:'En revisión',value:totals.inReview,icon:'flag',tone:'amber',hint:'Revisión de publicación',status:'REVIEW'},
    {label:'Ocultos por Admin',value:totals.hidden,icon:'eye-off',tone:'rose',hint:'Restricción administrativa',status:'HIDDEN'},
  ]:[];
  if(!allowed)return <StatePanel kind="error" title="Acceso restringido" message="Necesitas permiso de catálogo para consultar el contenido."/>;
  return <div className="ac-page ac-premium">
    <header className="ac-premium-heading">
      <div className="ac-heading-identity"><span className="ac-heading-icon"><Icon name="box" size={27}/></span><div>
        <h1 id="ac-title">Contenido</h1><p>Productos y servicios registrados por los negocios de XAMUKO.</p>
      </div></div>
      <div className="ac-heading-actions"><a href="#ac-analytics-title" className="ac-secondary"><Icon name="chart" size={17}/> Estadísticas</a>
        <Link to="/offer-reports" className="ac-primary"><Icon name="flag" size={17}/> Revisar reportes</Link></div>
    </header>
    {totals&&<div className="ac-kpis" aria-label="Resumen real del catálogo">{kpis.map(k=><button key={k.label} type="button"
      className={'ac-kpi '+k.tone+(status===k.status?' is-selected':'')} aria-pressed={status===k.status}
      onClick={()=>apply('status',k.status)} title={'Filtrar: '+k.label}>
      <span className="ac-kpi-icon"><Icon name={k.icon} size={23}/></span>
      <span className="ac-kpi-content"><span>{k.label}</span><strong>{num(k.value)}</strong><small>{k.hint}</small></span>
    </button>)}</div>}
    {analyticsLoading&&!totals&&!analyticsError&&<p className="ac-data-pending" role="status">Consultando indicadores reales del catálogo…</p>}
    {analyticsError&&<p className="ac-warning" role="status">Los indicadores generales no están disponibles: {analyticsError}</p>}
    {bulkNotice&&<p className="ac-success" role="status">{bulkNotice}</p>}
    {bulkErrors.length>0&&<div className="ac-warning" role="alert"><strong>Registros sin procesar:</strong><ul>{bulkErrors.map(err=><li key={err}>{err}</li>)}</ul></div>}
    <section className="ac-directory" aria-labelledby="ac-directory-title">
      <div className="ac-directory-top">
        <div className="ac-kind-tabs" role="group" aria-label="Filtrar contenido por tipo">
          <button type="button" className={kind===''?'active':''} aria-pressed={kind===''} onClick={()=>apply('kind','')}>Todos</button>
          <button type="button" className={kind==='PRODUCT'?'active':''} aria-pressed={kind==='PRODUCT'} onClick={()=>apply('kind','PRODUCT')}><Icon name="box" size={17}/> Productos</button>
          <button type="button" className={kind==='SERVICE'?'active':''} aria-pressed={kind==='SERVICE'} onClick={()=>apply('kind','SERVICE')}><Icon name="settings" size={17}/> Servicios</button>
        </div>
        <button className="ac-secondary ac-export" type="button" disabled={!directory?.offers.length}
          onClick={()=>exportVisibleContent(directory?.offers??[])}><Icon name="download" size={16}/> Exportar página CSV</button>
      </div>
      <div className="ac-panel-head"><div><span className="ac-eyebrow">GESTIÓN DEL CATÁLOGO</span><h2 id="ac-directory-title">Directorio de contenido</h2>
        <p>Información original de cada negocio, sin registros de ejemplo.</p></div>
        <span className="ac-directory-helper"><Icon name="shield" size={16}/> Acciones sujetas a permisos y auditoría</span></div>
      <form className="ac-toolbar" onSubmit={submit}>
        <label className="ac-search" htmlFor="ac-query"><Icon name="search" size={18}/><input id="ac-query" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar publicación, código o negocio"/></label>
        <label className="ac-filter-label"><span>Estado</span><select aria-label="Filtrar por estado" value={status} onChange={e=>apply('status',e.target.value)}>
          <option value="">Vigentes</option><option value="PUBLISHED">Publicados</option><option value="REVIEW">En revisión</option><option value="UNPUBLISHED">No publicados</option><option value="HIDDEN">Ocultos por Admin</option><option value="ADMIN_REVIEW">Revisión administrativa</option><option value="INACTIVE">Inactivos</option><option value="DELETED">Eliminados</option></select></label>
        <label className="ac-filter-label"><span>Ordenar por</span><select aria-label="Ordenar publicaciones" value={order} onChange={e=>apply('order',e.target.value)}>
          <option value="">Actualizados recientemente</option><option value="created">Nuevos primero</option>
          <option value="oldest">Antiguos primero</option><option value="name">Nombre A–Z</option></select></label>
        <button className="ac-primary" type="submit"><Icon name="search" size={16}/> Buscar</button>
        <button className="ac-secondary" type="button" onClick={clear}><Icon name="refresh" size={16}/> Limpiar</button>
      </form>
      <div className="ac-more-filter-row"><span>{city||categoryId?'Filtros territoriales o de categoría aplicados':'Puedes afinar la búsqueda por ciudad y categoría.'}</span>
        <button type="button" className="ac-filter-link" onClick={()=>setAdvanced(v=>!v)} aria-expanded={advanced} aria-controls="ac-directory-extra"><Icon name="settings" size={16}/>{advanced?'Ocultar filtros':'Filtros avanzados'}<Icon name="chevron" size={15}/></button>
      </div>
      <div className="ac-extra-filters" id="ac-directory-extra" hidden={!advanced}>
        <label>Ciudad<select value={city} onChange={e=>apply('city',e.target.value)}><option value="">Todas las ciudades</option>{insights?.filters.cities.map(v=><option key={v.value} value={v.value}>{v.label}</option>)}</select></label>
        <label>Categoría<select value={categoryId} onChange={e=>apply('categoryId',e.target.value)}><option value="">Todas las categorías</option>{insights?.filters.categories.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <label>ID de negocio<input value={businessId} maxLength={64} placeholder="Filtrar un negocio"
          onChange={e=>apply('businessId',e.target.value.trim())}/></label>
      </div>
      <div className="ac-result-strip"><strong>{loading?'Consultando…':directory?num(directory.pagination.total)+(directory.pagination.total===1?' publicación':' publicaciones'):'Directorio'}</strong>
        <span>{!loading && directory ? adminDirectoryPageSummary(directory.pagination, directory.offers.length, 'publicaciones') : 'Accede a cada ficha para ver fotografías, precios y relaciones.'}</span></div>
      {canModerate&&directory&&directory.offers.length>0&&<div className="ac-bulk-toolbar" aria-label="Moderación múltiple">
        <button type="button" className="ac-secondary" onClick={selectVisible} aria-pressed={allSelected}>
          {allSelected?'Deseleccionar página':'Seleccionar página (máx. 25)'}</button>
        <strong>{selectedIds.length} seleccionados</strong>
        <button type="button" className="ac-danger-outline" disabled={!selectedIds.length}
          onClick={()=>setBulkAction('HIDE')}><Icon name="eye-off" size={16}/> Ocultar selección</button>
        <button type="button" className="ac-secondary" disabled={!selectedIds.length}
          onClick={()=>setBulkAction('REVIEW')}><Icon name="flag" size={16}/> Enviar a revisión</button>
      </div>}
      {loading?<StatePanel kind="loading" title="Consultando contenido" message="Cargando productos y servicios registrados."/>:
        error?<StatePanel kind="error" title="No se pudo cargar el contenido" message={error} retry={()=>setRevision(v=>v+1)}/>:
        directory&&(directory.offers.length===0?<StatePanel kind="empty" title="Sin resultados" message="Prueba otros filtros o consulta otro período."/>:<>
          {!mobile&&<div className="ac-table-scroll"><table className="ac-table"><thead><tr>{canModerate&&<th scope="col"><span className="sr-only">Seleccionar</span></th>}<th>Publicación</th><th>Negocio</th><th>Categoría</th><th>Precio</th><th>Estado</th><th>Actividad</th><th>Acciones</th></tr></thead>
            <tbody>{directory.offers.map(offer=><tr key={offer.id}>
              {canModerate&&<td><input type="checkbox" aria-label={'Seleccionar '+offer.name}
                checked={selectedIds.includes(offer.id)} disabled={Boolean(offer.deletedAt)}
                onChange={()=>toggleSelection(offer.id)}/></td>}
              <td><div className="ac-title-cell"><AdminContentPhoto photoId={offer.photoId} alt={offer.photoAlt??offer.name} type={offer.kind} thumbnail/><div><Link to={'/content/'+encodeURIComponent(offer.id)}><strong>{offer.name}</strong></Link><small>{offer.internalCode} · {offerKindLabel(offer.kind)}</small><small>Actualizado: {displayDate(offer.updatedAt)}</small></div></div></td>
              <td><Link className="ac-business-link" to={'/businesses/'+encodeURIComponent(offer.business.id)}>{offer.business.name}</Link><small className="ac-table-sub">{offer.business.city??'Ubicación no registrada'}</small></td>
              <td>{offer.category}</td><td className="ac-price">{offerPrice(offer)}</td>
              <td><Status offer={offer}/>{!offer.active&&!offer.deletedAt&&<span className="ac-table-sub">Inactivo</span>}</td>
              <td><div className="ac-activity-mini"><span title="Me gusta"><Icon name="heart" size={14}/>{num(offer.likes)}</span><span title="Vistas"><Icon name="eye" size={14}/>{num(offer.views)}</span><span title="Reportes"><Icon name="flag" size={14}/>{num(offer.reports)}</span></div></td>
              <td><Link className="ac-view" to={'/content/'+encodeURIComponent(offer.id)}>Ver detalle <Icon name="arrow" size={16}/></Link></td>
            </tr>)}</tbody></table></div>}
          {mobile&&<div className="ac-mobile-grid">{directory.offers.map(offer=><article className="ac-mobile-card" key={offer.id}>
            <Link className="ac-mobile-image" to={'/content/'+encodeURIComponent(offer.id)}><AdminContentPhoto photoId={offer.photoId} alt={offer.photoAlt??offer.name} type={offer.kind} thumbnail/></Link>
            <div className="ac-mobile-body">{canModerate&&<label className="ac-mobile-select"><input type="checkbox" checked={selectedIds.includes(offer.id)}
              disabled={Boolean(offer.deletedAt)} onChange={()=>toggleSelection(offer.id)}/> Seleccionar</label>}<ContentBadge item={offer}/><h3>{offer.name}</h3>
              <p>{offer.category} · <Link className="ac-mobile-business" to={'/businesses/'+encodeURIComponent(offer.business.id)}>{offer.business.name}</Link></p>
              <strong className="ac-mobile-price">{offerPrice(offer)}</strong>
              <div className="ac-activity-mini"><span title="Me gusta"><Icon name="heart" size={14}/>{num(offer.likes)}</span><span title="Vistas"><Icon name="eye" size={14}/>{num(offer.views)}</span><span title="Reportes"><Icon name="flag" size={14}/>{num(offer.reports)}</span></div>
              <div className="ac-mobile-foot"><span>Actualizado: {displayDate(offer.updatedAt)}</span><Link className="ac-view" to={'/content/'+encodeURIComponent(offer.id)}>Ver ficha <Icon name="arrow" size={16}/></Link></div></div>
          </article>)}</div>}
        </>)}
      {directory&&directory.pagination.totalPages>1&&<nav className="ac-pagination" aria-label="Páginas de contenido">
        <span>Página {page} de {directory.pagination.totalPages}</span><div><button type="button" className="ac-secondary" disabled={page<=1} onClick={()=>go(page-1)}>Anterior</button><button type="button" className="ac-primary" disabled={page>=directory.pagination.totalPages} onClick={()=>go(page+1)}>Siguiente <Icon name="arrow" size={16}/></button></div></nav>}
    </section>
    <AdminContentAnalyticsPanel data={insights} loading={analyticsLoading} error={analyticsError} period={period} onPeriod={setPeriod}
      filters={filters} onFilter={apply} onRetry={()=>setAnalyticsRevision(v=>v+1)}/>

    {bulkAction&&selectedIds.length>0&&<AdminContentBulkDialog ids={selectedIds} action={bulkAction}
      onClose={()=>setBulkAction(null)} onDone={finishBulk}/>}
  </div>;
}
