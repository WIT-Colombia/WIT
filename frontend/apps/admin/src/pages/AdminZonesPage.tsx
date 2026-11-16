import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { Panel, StatePanel } from '../components/common';
import { getSession } from '../services/adminService';
import { getAdminZones, updateAdminZone, type ZoneEntry, type ZoneLaunchState,
  type ZoneRegistry, type ZoneScope } from '../services/adminApiClient';
import './AdminZonesPage.css';

type View = 'MUNICIPALITY'|'DEPARTMENT'|'AUDIT';
type Decision = {scope:ZoneScope;zone:ZoneEntry};
const labels:Record<ZoneLaunchState,string>={OPEN:'Activa',SCHEDULED:'Programada',PAUSED:'Pausada',CLOSED:'No disponible'};
const format=new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Bogota'});
const stamp=(date:string|null|undefined)=>date?format.format(new Date(date)):'Sin fecha';
const formatNumber=(n:number)=>new Intl.NumberFormat('es-CO').format(n);
const localBogota=(iso:string|null)=>{
  if(!iso)return '';
  const date=new Date(iso);
  if(!Number.isFinite(date.getTime()))return '';
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value??'';
  return get('year')+'-'+get('month')+'-'+get('day')+'T'+get('hour')+':'+get('minute');
};
const countdown=(value:string|null,time:number)=>{
  if(!value)return '';
  const ms=Math.max(0,new Date(value).getTime()-time);
  const s=Math.floor(ms/1000);
  const days=Math.floor(s/86400),hours=Math.floor(s%86400/3600),minutes=Math.floor(s%3600/60),seconds=s%60;
  return [days+'d',String(hours).padStart(2,'0')+'h',String(minutes).padStart(2,'0')+'m',String(seconds).padStart(2,'0')+'s'].join(' ');
};
const pad=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CO');
function LaunchDialog({value,records,close,save}:{value:Decision;records:ZoneRegistry['records'];
  close:()=>void;save:(state:ZoneLaunchState,date:string|null,reason:string)=>Promise<void>}){
  const previous=records.find(r=>r.scope===value.scope&&r.code===value.zone.code);
  const [state,setState]=useState<ZoneLaunchState>(previous?.state??value.zone.state);
  const [date,setDate]=useState(localBogota(previous?.opensAt??value.zone.opensAt));
  const [reason,setReason]=useState('');
  const [confirm,setConfirm]=useState('');
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!working)close();};
    document.addEventListener('keydown',onKey);
    const old=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=old;};
  },[close,working]);
  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    if(working||reason.trim().length<12||confirm!=='APLICAR')return;
    if(state==='SCHEDULED'&&(!date||!Number.isFinite(new Date(date+'-05:00').getTime())
      ||new Date(date+'-05:00')<=new Date())){setError('Selecciona una fecha y hora futuras de Colombia.');return;}
    setWorking(true);setError('');
    try{await save(state,state==='SCHEDULED'?new Date(date+'-05:00').toISOString():null,reason.trim());}
    catch(e){setError(e instanceof Error?e.message:'No se pudo actualizar la zona.');}
    finally{setWorking(false);}
  };
  return <div className="zone-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!working)close();}}>
    <section className="zone-dialog" role="dialog" aria-modal="true" aria-labelledby="zone-dialog-title">
      <div className="zone-dialog-top"><span><Icon name="globe" size={22}/></span>
        <button type="button" className="zone-dialog-close" onClick={close} disabled={working} aria-label="Cerrar"><Icon name="close" size={19}/></button></div>
      <span className="zone-eyebrow">CONTROL DE EXPANSIÓN · COLOMBIA</span>
      <h2 id="zone-dialog-title">Gestionar {value.zone.name}</h2>
      <p>Esta decisión afecta la visibilidad pública de los negocios físicos de la zona, nunca el registro de cuentas ni la visibilidad de la modalidad virtual.</p>
      <form onSubmit={submit}>
        <label>Estado territorial
          <select value={state} onChange={e=>setState(e.target.value as ZoneLaunchState)}>
            <option value="CLOSED">No disponible</option>
            <option value="SCHEDULED">Programar apertura</option>
            <option value="OPEN">Abrir inmediatamente</option>
            <option value="PAUSED">Pausar temporalmente</option>
          </select>
        </label>
        {state==='SCHEDULED'&&<label>Fecha y hora de apertura (Colombia, UTC−5)
          <input type="datetime-local" required value={date} onChange={e=>setDate(e.target.value)}/></label>}
        <label>Motivo administrativo
          <textarea required rows={4} minLength={12} maxLength={500} value={reason}
            onChange={e=>setReason(e.target.value)} placeholder="Explica la justificación, el plan o la decisión de expansión."/>
        </label>
        <label>Escribe <strong>APLICAR</strong> para confirmar
          <input required autoComplete="off" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
        {value.scope==='DEPARTMENT'&&<p className="zone-dialog-warning">La apertura departamental incluye todos sus municipios salvo las excepciones configuradas individualmente.</p>}
        {error&&<p className="zone-error" role="alert">{error}</p>}
        <footer><button className="secondary-button" type="button" onClick={close} disabled={working}>Cancelar</button>
          <button type="submit" className="primary" disabled={working||reason.trim().length<12||confirm!=='APLICAR'}>
            {working?'Guardando…':'Confirmar decisión'}</button></footer>
      </form>
    </section>
  </div>;
}
export function AdminZonesPage(){
  const allowed=getSession()?.role==='SUPER_ADMIN';
  const [data,setData]=useState<ZoneRegistry|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [view,setView]=useState<View>('MUNICIPALITY');
  const [query,setQuery]=useState('');
  const [department,setDepartment]=useState('');
  const [filter,setFilter]=useState('ALL');
  const [page,setPage]=useState(1);
  const [decision,setDecision]=useState<Decision|null>(null);
  const [notice,setNotice]=useState('');
  const [clock,setClock]=useState(()=>Date.now());
  useEffect(()=>{const t=window.setInterval(()=>setClock(Date.now()),1000);return()=>window.clearInterval(t);},[]);
  useEffect(()=>{
    if(!allowed){setLoading(false);return;}
    let active=true;setLoading(true);setError('');
    getAdminZones().then(result=>{if(active)setData(result);}).catch(e=>{
      if(active)setError(e instanceof Error?e.message:'No se pudo consultar Zonas.');
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[refresh,allowed]);
  const zones=useMemo(()=>view==='DEPARTMENT'?data?.departments??[]:data?.municipalities??[],[data,view]);
  const filtered=zones.filter(zone=>(filter==='ALL'||zone.state===filter)
    &&(view!=='MUNICIPALITY'||!department||zone.departmentCode===department)
    &&(!query.trim()||pad(zone.name+' '+(zone.context??'' )+' '+zone.code).includes(pad(query.trim()))));
  const pageCount=Math.max(1,Math.ceil(filtered.length/15));
  const currentPage=Math.min(page,pageCount);
  const visible=filtered.slice((currentPage-1)*15,currentPage*15);
  const leaderboard=useMemo(()=>[...(data?.municipalities??[])].sort((a,b)=>b.registered-a.registered).slice(0,7),[data]);
  const launch=data?.nextLaunch;
  const submit=async(state:ZoneLaunchState,date:string|null,reason:string)=>{
    if(!decision)return;
    await updateAdminZone({scope:decision.scope,code:decision.zone.code,state,opensAt:date,reason});
    setNotice('La decisión de '+decision.zone.name+' quedó registrada en auditoría y se refleja en la cobertura pública.');
    setDecision(null);setRefresh(n=>n+1);
  };
  if(!allowed)return <StatePanel kind="error" title="Acceso restringido" message="Solo el administrador principal puede gestionar aperturas territoriales."/>;
  if(loading&&!data)return <StatePanel kind="loading" title="Consultando zonas" message="Cargando la cobertura real de XAMUKO…"/>;
  if(error)return <StatePanel kind="error" title="No fue posible consultar Zonas" message={error} retry={()=>setRefresh(n=>n+1)}/>;
  if(!data)return <StatePanel kind="empty" title="Registro no disponible" message="El servicio no devolvió datos." />;
  const summary=data.summary;
  return <section className="zones-workspace" aria-labelledby="zones-title">
    <header className="admin-section-heading"><h1 id="zones-title">Zonas y expansión territorial</h1></header>
    <p className="zones-intro">Administra la apertura gradual de XAMUKO. El registro de usuarios y negocios es nacional; la exploración física sigue la cobertura habilitada. Los negocios virtuales activos permanecen visibles en toda Colombia.</p>
    <div className="zones-summary-grid">
      {[
        ['Municipios activos',summary.municipalitiesActive,'globe'],
        ['Programados',summary.municipalitiesScheduled,'clock'],
        ['Por abrir / pausados',summary.municipalitiesClosed,'lock'],
        ['Negocios registrados',summary.registered,'store'],
        ['Listos para publicar',summary.ready,'check'],
      ].map(([label,value,icon])=><article key={label} className="zones-kpi">
        <span className="zones-kpi-icon"><Icon name={String(icon)} size={19}/></span>
        <div><small>{label}</small><strong>{formatNumber(Number(value))}</strong></div></article>)}
    </div>
    {notice&&<p className="zones-success" role="status"><Icon name="check" size={17}/>{notice}</p>}
    {launch&&<section className="zones-next" aria-label="Siguiente lanzamiento">
      <div><span className="zone-eyebrow">PRÓXIMA APERTURA</span>
        <h2>{launch.name}</h2><p>Disponible desde {stamp(launch.opensAt)} (hora de Colombia)</p></div>
      <div className="zones-next-clock"><strong>{countdown(launch.opensAt,clock)||'Abriendo…'}</strong>
        <small>Cuenta regresiva sincronizada con la programación del servidor</small></div>
    </section>}
    <div className="zones-layout">
      <Panel title="Mapa operativo de cobertura" subtitle="Revisa y modifica municipios o departamentos; la herencia territorial se muestra en el estado.">
        <div className="zones-tabbar" role="group" aria-label="Vista de zonas">
          {([['MUNICIPALITY','Municipios'],['DEPARTMENT','Departamentos'],['AUDIT','Auditoría']] as const)
            .map(([kind,label])=><button key={kind} type="button" aria-pressed={view===kind}
              className={view===kind?'selected':''} onClick={()=>{setView(kind);setPage(1);setQuery('');setFilter('ALL');}}>{label}</button>)}
        </div>
        {view!=='AUDIT'&&<div className="zones-filters">
          <label>Buscar localidad<input type="search" value={query} placeholder="Buscar por nombre o código" onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label>
          {view==='MUNICIPALITY'&&<label>Departamento<select value={department} onChange={e=>{setDepartment(e.target.value);setPage(1);}}>
            <option value="">Todos los departamentos</option>{data.departments.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}</select></label>}
          <label>Disponibilidad<select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}>
            <option value="ALL">Todos los estados</option><option value="OPEN">Activa</option>
            <option value="SCHEDULED">Programada</option><option value="CLOSED">No disponible</option><option value="PAUSED">Pausada</option></select></label>
          <button type="button" className="secondary-button" onClick={()=>{setQuery('');setDepartment('');setFilter('ALL');setPage(1);}}>Limpiar</button>
        </div>}
        {view==='AUDIT'?<div className="zones-audit">{data.audit.length?data.audit.map(item=><article key={item.id}>
          <span className="zones-audit-icon"><Icon name="shield" size={18}/></span>
          <div><strong>{item.action.replaceAll('_',' ')}</strong><small>{stamp(item.createdAt)} · {item.actor?.displayName??'Sistema'}</small><p>{item.reason??'Sin motivo informado'}</p></div>
        </article>):<p className="zones-blank">Todavía no hay decisiones territoriales registradas.</p>}</div>:
        <><p className="zones-table-caption">{formatNumber(filtered.length)} de {formatNumber(zones.length)} zonas</p>
          {!visible.length?<p className="zones-blank">No existen zonas que coincidan con estos filtros.</p>:
          <div className="zones-table-wrap"><table className="zones-table"><thead><tr>
            <th>Zona</th><th>Estado</th><th>Negocios</th><th>Listos</th><th>Apertura</th><th>Gestión</th></tr></thead>
            <tbody>{visible.map(zone=><tr key={zone.code}>
              <td data-label="Zona"><strong>{zone.name}</strong><small>{zone.context??'Colombia'} · {zone.code}</small></td>
              <td data-label="Estado"><span className={'zones-state '+zone.state.toLowerCase()}>{labels[zone.state]}</span>
                {zone.source==='DEPARTMENT'&&<small>Heredada del departamento</small>}</td>
              <td data-label="Registrados">{zone.registered}</td><td data-label="Listos">{zone.ready}</td>
              <td data-label="Apertura">{zone.state==='SCHEDULED'?<><span>{stamp(zone.opensAt)}</span><small>{countdown(zone.opensAt,clock)}</small></>:'—'}</td>
              <td data-label="Gestión"><button type="button" className="secondary-button" onClick={()=>setDecision({scope:view as ZoneScope,zone})}><Icon name="settings" size={15}/> Gestionar</button></td>
            </tr>)}</tbody></table></div>}
          {pageCount>1&&<nav className="zones-pagination" aria-label="Paginación territorial"><span>Página {currentPage} de {pageCount}</span>
            <div><button type="button" className="secondary-button" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Anterior</button>
              <button type="button" className="secondary-button" disabled={currentPage>=pageCount} onClick={()=>setPage(currentPage+1)}>Siguiente</button></div></nav>}
        </>}
      </Panel>
      <aside className="zones-insights"><h2>Ciudades con más negocios registrados</h2>
        <p>Información de registros con municipio y departamento identificados. No representa búsquedas ni visitas.</p>
        <ol>{leaderboard.map(zone=><li key={zone.code}>
          <div><strong>{zone.name}</strong><span>{formatNumber(zone.registered)}</span></div>
          <div className="zones-insights-bar"><span style={{width:(leaderboard[0]?.registered?zone.registered/leaderboard[0].registered*100:0)+'%'}}/></div>
          <small>{zone.ready} listos · {labels[zone.state]}</small>
        </li>)}</ol>
        <div className="zones-rule"><Icon name="shield" size={18}/><p>La apertura se calcula por fecha del servidor (Colombia, UTC−5). Una excepción municipal prevalece sobre la apertura del departamento. Toda decisión requiere motivo y autorización de SUPER_ADMIN.</p></div>
      </aside>
    </div>
    {decision&&<LaunchDialog value={decision} records={data.records} close={()=>setDecision(null)} save={submit}/>}
  </section>;
}
