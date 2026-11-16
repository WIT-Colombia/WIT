import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { StatePanel } from '../components/common';
import { getSession } from '../services/adminService';
import { getAdminZones, getAdminZoneInsights, saveAdminZone,
  type AdminZoneLevel, type AdminZoneRecord, type AdminZoneStatus,
  type AdminZonesResponse, type AdminZoneInsights } from '../services/adminApiClient';
import { ZoneGrowthChart } from './ZoneGrowthChart';
import './AdminZonesPage.css';

type Draft={level:AdminZoneLevel;name:string;department:string;status:AdminZoneStatus;when:string;reason:string;confirmation:string};
const initialDraft=():Draft=>({level:'MUNICIPALITY',name:'',department:'',
  status:'CLOSED',when:'',reason:'',confirmation:''});
const fmt=(date:string)=>new Date(date).toLocaleString('es-CO',{
  dateStyle:'medium',timeStyle:'short',timeZone:'America/Bogota',
});
const n=(v:number)=>new Intl.NumberFormat('es-CO').format(v);
const levelName:Record<AdminZoneLevel,string>={MUNICIPALITY:'Municipio',DEPARTMENT:'Departamento',COUNTRY:'País'};
const stateName:Record<string,string>={OPEN:'Abierta',SCHEDULED:'Programada',CLOSED:'Cerrada',PAUSED:'Pausada'};
const localInput=(iso:string|null)=>iso?new Date(new Date(iso).getTime()-5*3600000).toISOString().slice(0,16):'';
function initialFromZone(zone:AdminZoneRecord):Draft{
  return {level:zone.level,name:zone.name,department:zone.department??'',
    status:zone.status,when:localInput(zone.opensAt),reason:'',confirmation:''};
}
function ZoneClock({date}:{date:string}){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const t=window.setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
  const seconds=Math.max(0,Math.floor((new Date(date).getTime()-now)/1000));
  return <span className="zone-admin-clock" aria-label="Cuenta regresiva para la zona">
    {Math.floor(seconds/86400)}d {String(Math.floor(seconds%86400/3600)).padStart(2,'0')}h&nbsp;
    {String(Math.floor(seconds%3600/60)).padStart(2,'0')}m&nbsp;
    {String(seconds%60).padStart(2,'0')}s
  </span>;
}
export function AdminZonesPage(){
  const session=getSession();
  const allowed=session?.permissions?.includes('business:write')??false;
  const canWrite=session?.realRole==='SUPER_ADMIN';
  const [data,setData]=useState<AdminZonesResponse|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const [selected,setSelected]=useState<string|null>(null);
  const [draft,setDraft]=useState<Draft>(initialDraft);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('ALL');
  const [panel,setPanel]=useState<'zones'|'audit'>('zones');
  const [busy,setBusy]=useState(false);
  const [actionError,setActionError]=useState('');
  const [notice,setNotice]=useState('');
  const [insights,setInsights]=useState<AdminZoneInsights|null>(null);
  const [insightsLoading,setInsightsLoading]=useState(false);
  const [insightsError,setInsightsError]=useState('');
  const [page,setPage]=useState(1);
  useEffect(()=>{
    if(!allowed){setLoading(false);return;}
    let active=true;
    setLoading(true);
    getAdminZones().then(result=>{if(active){setData(result);setError('');}})
      .catch(e=>{if(active){setError(e instanceof Error?e.message:'No fue posible consultar las zonas.');setData(null);}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[allowed,revision]);
  const selectedZone=data?.zones.find(z=>z.key===selected)??null;
  useEffect(()=>{
    if(!selected){setInsights(null);return;}
    let active=true;
    setInsights(null);setInsightsLoading(true);setInsightsError('');
    getAdminZoneInsights(selected).then(result=>{if(active)setInsights(result);})
      .catch(e=>{if(active)setInsightsError(e instanceof Error?e.message:'No se pudo consultar la evolución.');})
      .finally(()=>{if(active)setInsightsLoading(false);});
    return()=>{active=false;};
  },[selected,revision]);
  const rows=data?.zones??[];
  const filtered=useMemo(()=>rows.filter(zone=>
    (filter==='ALL'||zone.effectiveStatus===filter) &&
    (!search.trim()||[zone.name,zone.department??'',zone.key].join(' ')
      .toLocaleLowerCase('es-CO').includes(search.trim().toLocaleLowerCase('es-CO')))),
  [rows,filter,search]);
  const totalPages=Math.max(1,Math.ceil(filtered.length/12)),currentPage=Math.min(page,totalPages);
  const displayed=filtered.slice((currentPage-1)*12,currentPage*12);
  const select=(zone:AdminZoneRecord)=>{setSelected(zone.key);setDraft(initialFromZone(zone));setActionError('');setNotice('');};
  const create=()=>{setSelected(null);setDraft(initialDraft());setActionError('');setNotice('');};
  const setField=<K extends keyof Draft>(key:K,value:Draft[K])=>setDraft(d=>({...d,[key]:value,confirmation:''}));
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!canWrite||busy)return;
    const expected=draft.level==='COUNTRY'?'COLOMBIA':'CONFIRMAR';
    if(draft.confirmation!==expected){setActionError('Escribe '+expected+' para confirmar.');return;}
    if(draft.reason.trim().length<12){setActionError('Escribe un motivo administrativo de al menos 12 caracteres.');return;}
    if(draft.status==='SCHEDULED'&&!draft.when){setActionError('Selecciona una fecha y hora de apertura.');return;}
    const opensAt=draft.status==='SCHEDULED'?new Date(draft.when+':00-05:00').toISOString():null;
    setBusy(true);setActionError('');
    try{
      const result=await saveAdminZone({level:draft.level,
        name:draft.level==='COUNTRY'?'Colombia':draft.name.trim(),
        department:draft.level==='MUNICIPALITY'?draft.department.trim():undefined,
        status:draft.status,opensAt,reason:draft.reason.trim()});
      setSelected(result.zone.key);
      setDraft(initialFromZone(result.zone));
      setNotice('Configuración guardada y registrada en auditoría. La visibilidad pública se actualiza según la fecha del servidor.');
      setRevision(v=>v+1);
    }catch(e){setActionError(e instanceof Error?e.message:'No se pudo actualizar la zona.');}
    finally{setBusy(false);}
  }
  if(!allowed)return <StatePanel kind="error" title="Acceso restringido" message="Necesitas acceso a la gestión de negocios para consultar el despliegue territorial."/>;
  if(loading&&!data)return <StatePanel kind="loading" title="Consultando zonas" message="Obteniendo los estados reales de expansión."/>;
  if(error||!data)return <StatePanel kind="error" title="No se pudo cargar Zonas" message={error||'El servidor no proporcionó el registro.'} retry={()=>setRevision(v=>v+1)}/>;
  const upcoming=data.zones.filter(z=>z.effectiveStatus==='SCHEDULED'&&z.opensAt)
    .sort((a,b)=>new Date(a.opensAt!).getTime()-new Date(b.opensAt!).getTime())[0];
  return <section className="zone-admin-page">
    <header className="admin-section-heading"><h1>Zonas</h1></header>
    <div className="zone-admin-hero">
      <div><span className="zone-admin-eyebrow"><Icon name="globe" size={15}/> EXPANSIÓN TERRITORIAL</span>
        <h2>El crecimiento de XAMUKO, bajo tu control.</h2>
        <p>Los registros permanecen abiertos en toda Colombia. Solo los negocios físicos de zonas habilitadas se publican en la exploración. Los virtuales activos están disponibles en todo el país.</p>
      </div>
      <button type="button" className="secondary-button" onClick={()=>setRevision(v=>v+1)}><Icon name="refresh" size={16}/> Actualizar</button>
    </div>
    <div className="zone-admin-kpis" aria-label="Resumen de expansión">
      {([
        {label:'Zonas configuradas',value:data.overview.configured,icon:'globe'},
        {label:'Abiertas',value:data.overview.active,icon:'check'},
        {label:'Programadas',value:data.overview.scheduled,icon:'clock'},
        {label:'Pausadas',value:data.overview.paused,icon:'shield'},
      ] as const).map(kpi=><article key={kpi.label}>
        <span className="zone-admin-kpi-icon"><Icon name={kpi.icon} size={19}/></span>
        <div><small>{kpi.label}</small><strong>{n(kpi.value)}</strong></div>
      </article>)}
    </div>
    <section className="zone-admin-upcoming">
      <span className="zone-admin-upcoming-icon"><Icon name="calendar" size={20}/></span>
      {upcoming?<div><span className="zone-admin-eyebrow">PRÓXIMO LANZAMIENTO · VISIBLE EN LANDING</span>
        <strong>{upcoming.name}{upcoming.department?', '+upcoming.department:''}</strong>
        <small>Apertura {fmt(upcoming.opensAt!)} (hora Colombia)</small></div>:
      <div><span className="zone-admin-eyebrow">PRÓXIMO LANZAMIENTO</span>
        <strong>No hay aperturas programadas</strong><small>El Landing no mostrará un contador hasta que programes una fecha.</small></div>}
      {upcoming?.opensAt&&<ZoneClock date={upcoming.opensAt}/>}
    </section>
    <div className="zone-admin-nav" role="group" aria-label="Secciones de Zonas">
      <button type="button" className={panel==='zones'?'active':''} aria-pressed={panel==='zones'} onClick={()=>setPanel('zones')}>Cobertura y programación</button>
      <button type="button" className={panel==='audit'?'active':''} aria-pressed={panel==='audit'} onClick={()=>setPanel('audit')}>Historial de auditoría</button>
    </div>
    {panel==='zones'?<div className="zone-admin-layout">
      <section className="zone-admin-directory" aria-labelledby="zone-directory-title">
        <div className="zone-admin-panel-head"><div><h3 id="zone-directory-title">Territorios</h3>
          <p>Municipios, departamentos y cobertura nacional.</p></div>
          {canWrite&&<button type="button" className="primary" onClick={create}><Icon name="plus" size={16}/> Nueva zona</button>}
        </div>
        <div className="zone-admin-filters">
          <label><span>Buscar</span><input placeholder="Municipio o departamento" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label>
          <label><span>Estado</span><select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}>
            <option value="ALL">Todos</option><option value="OPEN">Abiertas</option><option value="SCHEDULED">Programadas</option>
            <option value="CLOSED">Cerradas</option><option value="PAUSED">Pausadas</option>
          </select></label>
        </div>
        <p className="zone-admin-count">{filtered.length} territorios configurados</p>
        {!displayed.length?<p className="zone-admin-empty">No hay zonas con estos filtros. Puedes registrar un nuevo municipio o departamento.</p>:
          <div className="zone-admin-list">{displayed.map(zone=><button type="button" key={zone.id}
            onClick={()=>select(zone)} className={'zone-admin-row'+(selected===zone.key?' selected':'')}>
            <span className="zone-admin-row-icon"><Icon name="map-pin" size={17}/></span>
            <span className="zone-admin-row-main"><strong>{zone.name}</strong>
              <small>{levelName[zone.level]}{zone.department?' · '+zone.department:''}</small>
              {zone.effectiveStatus==='SCHEDULED'&&zone.opensAt&&<small>{fmt(zone.opensAt)}</small>}</span>
            <span className={'zone-admin-state '+zone.effectiveStatus.toLowerCase()}>{stateName[zone.effectiveStatus]}</span>
          </button>)}</div>}
        {totalPages>1&&<div className="zone-admin-pagination"><span>Página {currentPage} de {totalPages}</span>
          <div><button type="button" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Anterior</button>
            <button type="button" disabled={currentPage===totalPages} onClick={()=>setPage(currentPage+1)}>Siguiente</button></div>
        </div>}
      </section>
      <section className="zone-admin-editor" aria-labelledby="zone-editor-title">
        <div className="zone-admin-panel-head"><div><h3 id="zone-editor-title">{selectedZone?'Administrar zona':'Configurar nueva zona'}</h3>
          <p>{selectedZone?'Edita apertura o fecha del territorio seleccionado.':'Registra un municipio, departamento o toda Colombia.'}</p>
        </div></div>
        {notice&&<p className="zone-admin-success" role="status">{notice}</p>}
        {actionError&&<p className="zone-admin-action-error" role="alert">{actionError}</p>}
        <form onSubmit={save} className="zone-admin-form">
          <label>Nivel territorial <select value={draft.level} disabled={!canWrite||!!selectedZone||busy}
            onChange={e=>{const level=e.target.value as AdminZoneLevel;setDraft(d=>({
              ...d,level,name:level==='COUNTRY'?'Colombia':'',department:'',confirmation:'',
            }));}}>
            <option value="MUNICIPALITY">Municipio</option><option value="DEPARTMENT">Departamento</option>
            <option value="COUNTRY">Colombia (nacional)</option></select></label>
          <label>{draft.level==='MUNICIPALITY'?'Municipio':draft.level==='DEPARTMENT'?'Departamento':'País'}
            <input required maxLength={160} value={draft.level==='COUNTRY'?'Colombia':draft.name}
              disabled={!canWrite||!!selectedZone||draft.level==='COUNTRY'||busy}
              placeholder={draft.level==='MUNICIPALITY'?'Ej. Cali':'Ej. Valle del Cauca'}
              onChange={e=>setField('name',e.target.value)}/></label>
          {draft.level==='MUNICIPALITY'&&<label>Departamento
            <input required maxLength={160} value={draft.department}
              disabled={!canWrite||!!selectedZone||busy} placeholder="Ej. Valle del Cauca"
              onChange={e=>setField('department',e.target.value)}/></label>}
          <label>Disponibilidad pública <select value={draft.status} disabled={!canWrite||busy}
            onChange={e=>setField('status',e.target.value as AdminZoneStatus)}>
            <option value="CLOSED">No disponible</option><option value="SCHEDULED">Programar apertura</option>
            <option value="ACTIVE">Abrir inmediatamente</option><option value="PAUSED">Pausar exploración</option>
          </select></label>
          {draft.status==='SCHEDULED'&&<label>Fecha y hora de apertura (Colombia)
            <input type="datetime-local" required value={draft.when} disabled={!canWrite||busy}
              onChange={e=>setField('when',e.target.value)}/><small>El backend habilitará la zona en esa fecha, aunque nadie tenga Admin abierto.</small></label>}
          {canWrite&&<><label>Motivo administrativo (12 a 500 caracteres)
            <textarea rows={3} minLength={12} maxLength={500} required value={draft.reason}
              placeholder="Indica por qué se abre, programa, cierra o pausa esta zona."
              disabled={busy} onChange={e=>setField('reason',e.target.value)}/></label>
            <label>Confirmación: escribe <b>{draft.level==='COUNTRY'?'COLOMBIA':'CONFIRMAR'}</b>
              <input required autoComplete="off" value={draft.confirmation} disabled={busy}
                onChange={e=>setDraft(d=>({...d,confirmation:e.target.value}))}/></label>
            <button className="primary zone-admin-save" type="submit" disabled={busy||draft.reason.trim().length<12||draft.confirmation!==(draft.level==='COUNTRY'?'COLOMBIA':'CONFIRMAR')}>
              <Icon name="shield" size={17}/>{busy?'Guardando…':'Guardar configuración territorial'}</button>
          </>}
        </form>
        {!canWrite&&<p className="zone-admin-readonly">Solo el administrador principal puede cambiar la cobertura de XAMUKO.</p>}
        {selectedZone&&<div className="zone-admin-effective">
          <strong>Estado efectivo: {stateName[selectedZone.effectiveStatus]}</strong>
          <p>La jerarquía es Municipio → Departamento → Colombia. Una configuración municipal prevalece sobre la del departamento, incluso para mantener una excepción cerrada.</p>
        </div>}
        {selectedZone&&(insightsLoading?<p className="zone-admin-loading">Consultando crecimiento territorial…</p>:
          insightsError?<p className="zone-admin-action-error" role="alert">{insightsError}</p>:
          insights?<ZoneGrowthChart insights={insights}/>:null)}
      </section>
    </div>:<section className="zone-admin-audit">
      <header><h3>Decisiones administrativas</h3><p>Últimas 80 actuaciones registradas con fecha, responsable y motivo.</p></header>
      {!data.audit.length?<p className="zone-admin-empty">Todavía no existen modificaciones administrativas registradas.</p>:
      <ol>{data.audit.map(a=><li key={a.id}><span className="zone-admin-audit-icon"><Icon name="shield" size={17}/></span>
        <div><strong>{a.action==='CREATED'?'Zona configurada':'Configuración actualizada'}</strong>
          <small>Territorio: {data.zones.find(z=>z.id===a.zoneId)?.name??a.zoneId} · {fmt(a.createdAt)}</small>
          <p>{a.reason}</p><small>Administrador: {a.actorUserId}</small>
        </div></li>)}</ol>}
    </section>}
    <p className="zone-admin-footnote"><Icon name="shield" size={17}/>{data.policy}</p>
  </section>;
}
