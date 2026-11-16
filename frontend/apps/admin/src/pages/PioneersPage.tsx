import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Panel, StatePanel } from '../components/common';
import { getSession } from '../services/adminService';
import { assignPioneer, listPioneers, reviewPioneerBrand, reviewPioneerClaim,
  type PioneerAssignment, type PioneerBrand, type PioneerRegistry } from '../services/adminApiClient';
import { PioneerAnalyticsPanel } from './PioneerAnalyticsPanel';
import { PioneerDecisionDialog, type PioneerDecision } from './PioneerDecisionDialog';
import './PioneersControl.css';

const number=(v:number)=>new Intl.NumberFormat('es-CO').format(v);
const pad=(n:number)=>'#'+String(n).padStart(3,'0');
const stamp=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('es-CO',{
  dateStyle:'medium',timeStyle:'short',timeZone:'America/Bogota',
}).format(new Date(value)):'—';
const verificationLabel:Record<string,string>={
  VERIFIED:'Verificada',PENDING:'Pendiente',UNVERIFIED:'Sin verificar',REJECTED:'Rechazada',
};
const actionLabel:Record<string,string>={
  PIONEER_ASSIGNED:'Reconocimiento asignado',
  BRAND_CLAIM_APPROVED:'Reclamación aprobada',BRAND_CLAIM_REJECTED:'Reclamación rechazada',
  BRAND_VERIFIED:'Marca verificada',BRAND_VERIFICATION_REJECTED:'Verificación rechazada',
};
type Tab='coupons'|'claims'|'brands'|'audit';
type Slot={number:number;assignment:PioneerAssignment|null;brand:PioneerBrand|null};
const csvEscape=(value:string)=>{
  const raw=String(value??'');
  const prefix=/^[\s]*[=+@-]/.test(raw)?"'":'';
  return '"'+(prefix+raw).replaceAll('"','""')+'"';
};
function exportSlots(slots:Slot[]){
  const rows=[['Cupón','Marca','Negocios asociados','Estado','Asignado por','Fecha'],
    ...slots.map(({number,assignment,brand})=>[
      pad(number),assignment?.brand.legalName??'',
      brand?.businesses.map(b=>b.name).join(' / ')??'',
      assignment?'Ocupado':'Disponible',
      assignment?.assignedBy?.displayName??'',
      assignment?stamp(assignment.assignedAt):'',
    ])];
  const csv='\ufeff'+rows.map(row=>row.map(csvEscape).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='xamuko-cupos-pioneros.csv';a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function useMobilePioneers(){
  const initial=()=>typeof window!=='undefined'&&typeof window.matchMedia==='function'
    &&window.matchMedia('(max-width: 800px)').matches;
  const [mobile,setMobile]=useState(initial);
  useEffect(()=>{
    if(typeof window.matchMedia!=='function')return;
    const q=window.matchMedia('(max-width: 800px)');
    const update=()=>setMobile(q.matches);
    update();
    if(typeof q.addEventListener==='function'){
      q.addEventListener('change',update);
      return()=>q.removeEventListener('change',update);
    }
    q.addListener(update);return()=>q.removeListener(update);
  },[]);
  return mobile;
}
function EligibilityChecks({brand}:{brand:PioneerBrand}){
  const checks=[
    {text:'Marca verificada',ok:brand.eligibility?.verified??false},
    {text:'Reclamación aprobada',ok:brand.eligibility?.approvedClaim??false},
    {text:'Negocio activo y visible',ok:brand.eligibility?.visibleBusiness??false},
    {text:'Sin cupo previo',ok:!brand.eligibility?.alreadyAssigned},
  ];
  return <ul className="pioneer-checks" aria-label="Condiciones de elegibilidad">
    {checks.map(item=><li key={item.text} className={item.ok?'ok':'missing'}>
      <Icon name={item.ok?'check':'close'} size={14}/>{item.text}</li>)}
  </ul>;
}
function BusinessLinks({brand,canViewBusinesses}:{brand:PioneerBrand|null;canViewBusinesses:boolean}){
  if(!brand?.businesses?.length)return <span className="pioneer-muted">Sin negocio vinculado</span>;
  return <div className="pioneer-business-list">{brand.businesses.map(b=>
    <span className="pioneer-business" key={b.id}><Icon name="store" size={16}/>
      {canViewBusinesses?<Link to={'/businesses/'+encodeURIComponent(b.id)}>{b.name}</Link>:b.name}
      {b.location?.cityName&&<small>{b.location.cityName}</small>}
    </span>)}</div>;
}
export function PioneersPage(){
  const permissions=getSession()?.permissions??[];
  const allowed=permissions.includes('PIONEER_MANAGE');
  const canViewBusinesses=permissions.includes('business:write');
  const mobile=useMobilePioneers();
  const [data,setData]=useState<PioneerRegistry|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [revision,setRevision]=useState(0);
  const [decision,setDecision]=useState<PioneerDecision|null>(null);
  const [notice,setNotice]=useState('');
  const [actionError,setActionError]=useState('');
  const [tab,setTab]=useState<Tab>('coupons');
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('ALL');
  const [city,setCity]=useState('');
  const [brandFilter,setBrandFilter]=useState('ALL');
  const [page,setPage]=useState(1);
  const [brandPage,setBrandPage]=useState(1);
  const [claimPage,setClaimPage]=useState(1);
  useEffect(()=>{
    if(!allowed){setLoading(false);return;}
    let active=true;
    setLoading(true);setError('');
    listPioneers().then(result=>{
      if(active)setData(result);
    }).catch(cause=>{
      if(active){setData(null);setError(cause instanceof Error?cause.message:'No fue posible consultar Negocios Pioneros.');}
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[allowed,revision]);
  const assignments=data?.assignments??[];
  const brands=data?.brands??[];
  const claims=data?.pendingClaims??[];
  const audit=data?.recentActions??[];
  const brandMap=useMemo(()=>new Map(brands.map(b=>[b.id,b])),[brands]);
  const slots=useMemo(()=>{
    const used=new Map(assignments.map(a=>[a.number,a]));
    return Array.from({length:Math.max(0,Math.min(20,data?.max??0))},(_,i)=>{
      const n=i+1;const assignment=used.get(n)??null;
      return {number:n,assignment,brand:assignment?brandMap.get(assignment.brand.id)??null:null};
    });
  },[assignments,brandMap,data?.max]);
  const searchable=(text:string)=>text.toLocaleLowerCase('es-CO').includes(query.trim().toLocaleLowerCase('es-CO'));
  const cities=useMemo(()=>[...new Set(brands.flatMap(b=>b.businesses.flatMap(x=>x.location?.cityName?[x.location.cityName]:[])))].sort((a,b)=>a.localeCompare(b,'es')),[brands]);
  const filteredSlots=slots.filter(s=>
    (filter==='ALL'||(filter==='OCCUPIED'?Boolean(s.assignment):!s.assignment)) &&
    (!city||s.brand?.businesses.some(b=>b.location?.cityName===city)) &&
    (!query.trim()||searchable([pad(s.number),String(s.number),s.assignment?.brand.legalName??'',
      ...(s.brand?.businesses.map(b=>b.name)??[])].join(' '))));
  const filteredClaims=claims.filter(c=>!query.trim()||searchable([
    c.business.name,c.brand?.legalName??'',c.claimant.displayName,c.evidenceType,
  ].join(' ')));
  const filteredBrands=brands.filter(brand=>{
    const state=brandFilter==='ALL'||(brandFilter==='ELIGIBLE'?brand.eligibleForPioneer:
      brandFilter==='ASSIGNED'?brand.eligibility?.alreadyAssigned:
      brand.verification===brandFilter);
    return state&&(!city||brand.businesses.some(b=>b.location?.cityName===city))&&
      (!query.trim()||searchable([brand.legalName,...brand.businesses.map(b=>b.name)].join(' ')));
  });
  const limited=(list:Slot[],index:number)=>list.slice((index-1)*10,index*10);
  const totalPages=Math.max(1,Math.ceil(filteredSlots.length/10));
  const claimPages=Math.max(1,Math.ceil(filteredClaims.length/10));
  const brandPages=Math.max(1,Math.ceil(filteredBrands.length/10));
  const currentPage=Math.min(page,totalPages);
  const currentClaimPage=Math.min(claimPage,claimPages);
  const currentBrandPage=Math.min(brandPage,brandPages);
  const usage=data?.max?Math.round(assignments.length/data.max*100):0;
  const changeTab=(next:Tab)=>{setTab(next);setQuery('');setFilter('ALL');setCity('');setBrandFilter('ALL');setPage(1);setBrandPage(1);setClaimPage(1);};
  const changeQuery=(v:string)=>{setQuery(v);setPage(1);setBrandPage(1);setClaimPage(1);};
  const doDecision=async(reason:string)=>{
    if(!decision)return;
    switch(decision.action){
      case 'CLAIM_APPROVE':await reviewPioneerClaim(decision.id,true,reason);break;
      case 'CLAIM_REJECT':await reviewPioneerClaim(decision.id,false,reason);break;
      case 'BRAND_VERIFY':await reviewPioneerBrand(decision.id,true,reason);break;
      case 'BRAND_REJECT':await reviewPioneerBrand(decision.id,false,reason);break;
      case 'ASSIGN':await assignPioneer(decision.id,reason);break;
    }
    setNotice('Decisión registrada correctamente. La información se actualizará desde el servidor.');
    setActionError('');setDecision(null);setRevision(v=>v+1);
  };
  const retry=()=>setRevision(v=>v+1);
  if(!allowed)return <StatePanel kind="error" title="Acceso restringido"
    message="Necesitas el permiso PIONEER_MANAGE para gestionar los reconocimientos."/>;
  return <section className="pioneers-workspace pioneer-control-page" aria-labelledby="pioneer-title">
    <header className="admin-section-heading"><h1 id="pioneer-title">Negocios Pioneros</h1></header>
    {loading&&!data?<StatePanel kind="loading" title="Cargando Pioneros" message="Consultando registros reales."/>:
      error?<StatePanel kind="error" title="No fue posible consultar Pioneros" message={error} retry={retry}/>:
      !data?<StatePanel kind="empty" title="Registro no disponible" message="No se recibió información del servidor."/>:<>
        <div className="pioneer-summary-grid">
          <article className="pioneer-summary-card"><span className="pioneer-summary-icon violet"><Icon name="ticket"/></span><div><small>Cupos totales</small><strong>{number(data.max)}</strong></div></article>
          <article className="pioneer-summary-card"><span className="pioneer-summary-icon green"><Icon name="check"/></span><div><small>Asignados</small><strong>{number(assignments.length)}</strong></div></article>
          <article className="pioneer-summary-card"><span className="pioneer-summary-icon blue"><Icon name="clock"/></span><div><small>Disponibles</small><strong>{number(data.available)}</strong></div></article>
          <article className="pioneer-summary-card pioneer-usage-card"><div className="pioneer-usage-top"><span className="pioneer-summary-icon violet"><Icon name="chart"/></span><div><small>Ocupación</small><strong>{usage}%</strong></div></div>
            <div className="pioneer-progress" role="progressbar" aria-label="Porcentaje de cupos ocupados" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usage}>
              <span style={{width:usage+'%'}}/></div></article>
          <article className="pioneer-summary-card pioneer-extra-kpi"><span className="pioneer-summary-icon blue"><Icon name="flag"/></span><div><small>Reclamaciones pendientes</small><strong>{number(claims.length)}</strong></div></article>
          <article className="pioneer-summary-card pioneer-extra-kpi"><span className="pioneer-summary-icon green"><Icon name="award"/></span><div><small>Marcas elegibles</small><strong>{number(brands.filter(b=>b.eligibleForPioneer).length)}</strong></div></article>
        </div>
        {notice&&<p role="status" className="pioneer-notice"><Icon name="check" size={17}/>{notice}</p>}
        {actionError&&<p role="alert" className="pioneer-error">{actionError}</p>}
        <PioneerAnalyticsPanel assignments={assignments}/>
        <div className="pioneer-tabs" role="group" aria-label="Secciones de Pioneros">
          {([['coupons','Cupos'],['claims','Reclamaciones'],['brands','Marcas'],['audit','Auditoría']] as const)
            .map(([key,label])=><button key={key} type="button" className={tab===key?'selected':''}
              aria-pressed={tab===key} onClick={()=>changeTab(key)}>
                {label}{key==='claims'&&claims.length>0&&<span className="pioneer-tab-count">{claims.length}</span>}
              </button>)}
        </div>
        {tab!=='audit'&&<div className="pioneer-directory-filters">
          <label className="pioneer-search"><Icon name="search" size={17}/>
            <input value={query} onChange={e=>changeQuery(e.target.value)}
              placeholder={tab==='coupons'?'Buscar por cupo, marca o negocio':tab==='claims'?'Buscar reclamación o negocio':'Buscar marca o negocio'}
              aria-label="Buscar en la sección"/></label>
          {tab==='coupons'&&<label>Estado<select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}>
            <option value="ALL">Todos los cupos</option><option value="OCCUPIED">Ocupados</option>
            <option value="AVAILABLE">Disponibles</option></select></label>}
          {tab==='brands'&&<label>Estado<select value={brandFilter} onChange={e=>{setBrandFilter(e.target.value);setBrandPage(1);}}>
            <option value="ALL">Todas las marcas</option><option value="ELIGIBLE">Elegibles</option>
            <option value="VERIFIED">Verificadas</option><option value="PENDING">Pendientes</option>
            <option value="UNVERIFIED">Sin verificar</option><option value="REJECTED">Rechazadas</option>
            <option value="ASSIGNED">Con cupo</option></select></label>}
          {tab!=='claims'&&<label>Ciudad<select value={city} onChange={e=>{setCity(e.target.value);setPage(1);setBrandPage(1);}}>
            <option value="">Todas las ciudades</option>{cities.map(name=><option key={name} value={name}>{name}</option>)}
          </select></label>}
          <button type="button" className="secondary-button" onClick={()=>{changeQuery('');setFilter('ALL');setCity('');setBrandFilter('ALL');}}>
            <Icon name="refresh" size={15}/> Limpiar</button>
        </div>}
        {tab==='coupons'&&<Panel className="pioneer-directory" title="Registro de cupos pioneros"
          subtitle="La numeración se asigna exclusivamente desde el servidor, sin reasignaciones automáticas."
          action={<button type="button" className="secondary-button" onClick={()=>exportSlots(filteredSlots)}><Icon name="download" size={16}/> CSV filtrado</button>}>
          <p className="pioneer-directory-count">{filteredSlots.length} de {slots.length} cupos</p>
          {!filteredSlots.length?<StatePanel kind="empty" title="Sin coincidencias" message="Modifica la búsqueda o los filtros."/>:
          mobile?<div className="pioneer-mobile-list">{limited(filteredSlots,currentPage).map(s=>
            <article key={s.number} className="pioneer-mobile-item">
              <div className="pioneer-mobile-head"><strong>{pad(s.number)}</strong>
                <span className={'pioneer-status '+(s.assignment?'occupied':'available')}>
                  <Icon name={s.assignment?'check':'clock'} size={14}/>{s.assignment?'Ocupado':'Disponible'}</span></div>
              {s.assignment?<><h3>{s.assignment.brand.legalName}</h3>
                <BusinessLinks brand={s.brand} canViewBusinesses={canViewBusinesses}/>
                <small>Asignado: {stamp(s.assignment.assignedAt)}</small>
                <small>Por: {s.assignment.assignedBy?.displayName??'No registrado'}</small></>:
                <p className="pioneer-muted">Sin asignar</p>}
            </article>)}</div>:
          <div className="pioneer-table-wrap"><table className="pioneer-table">
            <thead><tr><th scope="col">Cupón</th><th scope="col">Marca / negocios</th>
              <th scope="col">Estado</th><th scope="col">Fecha</th><th scope="col">Asignado por</th></tr></thead>
            <tbody>{limited(filteredSlots,currentPage).map(s=><tr key={s.number}>
              <td><strong className="pioneer-number"><Icon name="ticket" size={17}/>{pad(s.number)}</strong></td>
              <td>{s.assignment?<><strong>{s.assignment.brand.legalName}</strong><BusinessLinks brand={s.brand} canViewBusinesses={canViewBusinesses}/></>:'—'}</td>
              <td><span className={'pioneer-status '+(s.assignment?'occupied':'available')}>
                <Icon name={s.assignment?'check':'clock'} size={14}/>{s.assignment?'Ocupado':'Disponible'}</span></td>
              <td>{s.assignment?stamp(s.assignment.assignedAt):'—'}</td>
              <td>{s.assignment?.assignedBy?.displayName??'—'}</td>
            </tr>)}</tbody></table></div>}
          {totalPages>1&&<nav className="pioneer-pagination" aria-label="Páginas de cupos">
            <span>Página {currentPage} de {totalPages}</span><div>
              <button type="button" className="secondary-button" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Anterior</button>
              <button type="button" className="secondary-button" disabled={currentPage>=totalPages} onClick={()=>setPage(currentPage+1)}>Siguiente</button>
            </div></nav>}
        </Panel>}
        {tab==='claims'&&<Panel className="pioneer-directory" title="Reclamaciones por verificar"
          subtitle="Se incluyen solicitudes sin marca vinculada; la reclamación no implica un cupo.">
          <p className="pioneer-directory-count">{filteredClaims.length} pendientes</p>
          {!filteredClaims.length?<StatePanel kind="empty" title="Sin reclamaciones pendientes" message="No existen solicitudes que coincidan con la búsqueda."/>:
            <div className="pioneer-claim-list">{filteredClaims.slice((currentClaimPage-1)*10,currentClaimPage*10).map(claim=>
              <article className="pioneer-claim-card" key={claim.id}>
                <div className="pioneer-claim-heading"><div><span className="pioneer-eyebrow">RECLAMACIÓN PENDIENTE</span>
                  <h3>{claim.business.name}</h3><p>Solicitante: {claim.claimant.displayName}</p></div>
                  <time dateTime={claim.createdAt}>{stamp(claim.createdAt)}</time></div>
                <dl className="pioneer-claim-meta"><div><dt>Marca declarada</dt><dd>{claim.brand?.legalName??'Todavía no vinculada'}</dd></div>
                  <div><dt>Tipo de evidencia</dt><dd>{claim.evidenceType}</dd></div>
                  <div><dt>Estado del negocio</dt><dd>{claim.business.publicationStatus}</dd></div></dl>
                {claim.evidenceNote&&<p className="pioneer-claim-evidence"><strong>Nota de evidencia: </strong>{claim.evidenceNote}</p>}
                <div className="pioneer-claim-actions">
                  {canViewBusinesses&&<Link className="secondary-button" to={'/businesses/'+encodeURIComponent(claim.business.id)}>
                    <Icon name="eye" size={16}/> Ver negocio</Link>}
                  <button type="button" className="primary" onClick={()=>setDecision({
                    action:'CLAIM_APPROVE',id:claim.id,name:claim.business.name,detail:'Reclamación de '+claim.claimant.displayName,
                  })}>Aprobar reclamación</button>
                  <button type="button" className="danger-outline" onClick={()=>setDecision({
                    action:'CLAIM_REJECT',id:claim.id,name:claim.business.name,detail:'Reclamación de '+claim.claimant.displayName,
                  })}>Rechazar</button>
                </div>
              </article>)}</div>}
          {claimPages>1&&<nav className="pioneer-pagination"><span>Página {currentClaimPage} de {claimPages}</span><div>
            <button type="button" className="secondary-button" disabled={currentClaimPage===1} onClick={()=>setClaimPage(currentClaimPage-1)}>Anterior</button>
            <button type="button" className="secondary-button" disabled={currentClaimPage>=claimPages} onClick={()=>setClaimPage(currentClaimPage+1)}>Siguiente</button>
          </div></nav>}
        </Panel>}
        {tab==='brands'&&<Panel className="pioneer-directory" title="Marcas registradas"
          subtitle="Comprueba los requisitos antes de verificar y asignar el reconocimiento.">
          <p className="pioneer-directory-count">{filteredBrands.length} marcas</p>
          {!filteredBrands.length?<StatePanel kind="empty" title="Sin marcas" message="No se encontraron marcas con estos filtros."/>:
          <div className="pioneer-brand-grid">{filteredBrands.slice((currentBrandPage-1)*10,currentBrandPage*10).map(brand=>
            <article key={brand.id} className="pioneer-brand-card">
              <header><div><h3>{brand.legalName}</h3>
                <span className={'pioneer-verify-status '+brand.verification.toLowerCase()}>{verificationLabel[brand.verification]??'Estado desconocido'}</span>
              </div>{brand.eligibility?.alreadyAssigned&&<span className="pioneer-permanent"><Icon name="award" size={14}/> Pionero asignado</span>}</header>
              <BusinessLinks brand={brand} canViewBusinesses={canViewBusinesses}/>
              <EligibilityChecks brand={brand}/>
              <div className="pioneer-brand-actions">
                {brand.verification!=='VERIFIED'&&brand.eligibility?.approvedClaim&&
                  <button type="button" className="primary" onClick={()=>setDecision({
                    action:'BRAND_VERIFY',id:brand.id,name:brand.legalName,detail:'Verificación de identidad de marca',
                  })}>Verificar marca</button>}
                {brand.verification!=='REJECTED'&&!brand.eligibility?.alreadyAssigned&&
                  <button type="button" className="danger-outline" onClick={()=>setDecision({
                    action:'BRAND_REJECT',id:brand.id,name:brand.legalName,detail:'Rechazar verificación de marca',
                  })}>Rechazar verificación</button>}
                {brand.eligibleForPioneer&&data.available>0&&
                  <button type="button" className="primary pioneer-assign-button" onClick={()=>setDecision({
                    action:'ASSIGN',id:brand.id,name:brand.legalName,detail:'Reconocimiento único entre los 20 cupos Pioneros',
                  })}><Icon name="award" size={16}/> Asignar cupo Pionero</button>}
              </div>
              {brand.verification!=='VERIFIED'&&!brand.eligibility?.approvedClaim&&
                <p className="pioneer-muted">Para verificar esta marca debe aprobarse antes una reclamación válida.</p>}
            </article>)}</div>}
          {brandPages>1&&<nav className="pioneer-pagination"><span>Página {currentBrandPage} de {brandPages}</span><div>
            <button type="button" className="secondary-button" disabled={currentBrandPage===1} onClick={()=>setBrandPage(currentBrandPage-1)}>Anterior</button>
            <button type="button" className="secondary-button" disabled={currentBrandPage>=brandPages} onClick={()=>setBrandPage(currentBrandPage+1)}>Siguiente</button>
          </div></nav>}
        </Panel>}
        {tab==='audit'&&<Panel className="pioneer-directory" title="Últimas actuaciones administrativas"
          subtitle="Historial de decisiones registradas en la base de datos.">
          {!audit.length?<StatePanel kind="empty" title="Sin actuaciones registradas" message="Las acciones aparecerán aquí cuando se registren."/>:
          <ol className="pioneer-audit-list">{audit.map(a=><li key={a.id}>
            <span className="pioneer-audit-icon"><Icon name="shield" size={15}/></span>
            <div><div className="pioneer-audit-title"><strong>{actionLabel[a.action]??a.action}</strong>
              <time dateTime={a.createdAt}>{stamp(a.createdAt)}</time></div>
              <small>Administrador: {a.actor?.displayName??'Sistema'}</small>
              {a.reason&&<p>Motivo: {a.reason}</p>}
            </div>
          </li>)}</ol>}
        </Panel>}
        <p className="pioneer-footnote"><Icon name="shield" size={16}/>{data.definition}
          Las decisiones administrativas deben estar fundamentadas y se registran con su motivo.</p>
      </>}
    {decision&&<PioneerDecisionDialog decision={decision} onClose={()=>setDecision(null)} onSave={doDecision}/>}
  </section>;
}
