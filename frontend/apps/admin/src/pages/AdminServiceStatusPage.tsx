import {useEffect,useState} from 'react';
import {AdminPageHeading} from '../components/AdminPageHeading';
import {Icon} from '../components/Icon';
import {StatePanel} from '../components/common';
import {can,getSession} from '../services/adminService';
import {getTechnologyServicesStatus,type TechnologyServicesStatus,type TechnologyCase} from '../services/adminApiClient';
import {
  TechnologyTabs,TechnologyStatusBadge,TechnologyInfoBox,TechnologyCreateDialog,
  TechnologyCaseDialog,formatDate,number,
} from './TechnologyShared';
import './TechnologyOperations.css';

const serviceIcons:Record<string,string>={
  api:'server',database:'database',frontend:'laptop',storage:'archive',aws:'layers',
};
function IncidentChart({data}: {data:TechnologyServicesStatus}){
  const counts=data.incidentTrend;
  const max=Math.max(1,...counts.map(c=>c.count));
  const reported=counts.reduce((sum,c)=>sum+c.count,0);
  return <section className="ato-panel ato-chart-panel" aria-labelledby="ato-incident-chart-title">
    <header className="ato-panel-heading">
      <div><span className="ato-kicker">REGISTRO HISTÓRICO</span>
        <h2 id="ato-incident-chart-title">Incidentes reportados</h2>
        <p>Últimos 30 días · expedientes creados, no porcentaje de disponibilidad.</p></div>
      <span className="ato-chip"><Icon name="calendar" size={15}/> 30 días</span>
    </header>
    {!data.caseDataAvailable?<div className="ato-chart-unavailable">
      <Icon name="info" size={22}/> No se pudo consultar la bitácora histórica.</div>:
    <div className="ato-incident-chart-wrap">
      <div className="ato-chart-summary">
        <span>Expedientes registrados</span>
        <strong>{number(reported)}</strong>
        <small>No representa caídas detectadas automáticamente.</small>
      </div>
      <div className="ato-incident-chart" role="img"
        aria-label={'Incidentes registrados por día durante 30 días: '+reported+' expedientes.'}>
        {counts.map(({date,count},index)=><div className="ato-incident-col"
          key={date} title={date+': '+count+' incidentes registrados'}>
          <span className="ato-bar-track"><span className={'ato-bar-fill'+(count?' has-data':'')}
            style={{height:(count?Math.max(9,count/max*100):2)+'%'}}/></span>
          {index%5===0||index===counts.length-1?<small>{date.slice(5)}</small>:<small aria-hidden="true"> </small>}
        </div>)}
      </div>
      <p className="ato-chart-footnote"><Icon name="info" size={15}/>
        Un día con cero indica que no se radicaron expedientes, no que se haya verificado disponibilidad del 100 %.</p>
    </div>}
  </section>;
}
function IncidentCard({item,onOpen}: {item:TechnologyCase;onOpen:(id:string)=>void}){
  return <button type="button" className="ato-incident-item" onClick={()=>onOpen(item.id)}>
    <span className={'ato-severity-icon ato-severity-icon-'+item.severity.toLowerCase()}>
      <Icon name="shield" size={18}/></span>
    <span><strong>{item.title}</strong><small>{item.component??'Componente sin indicar'} · {formatDate(item.createdAt)}</small></span>
    <TechnologyStatusBadge value={item.status}/><Icon name="arrow" size={16}/>
  </button>;
}
export function AdminServiceStatusPage(){
  const admin=getSession();
  const read=admin?can(admin,'audit:read'):false;
  const manage=admin?(admin.realRole==='SUPER_ADMIN'||can(admin,'settings:write')):false;
  const [data,setData]=useState<TechnologyServicesStatus|null>(null);
  const [loading,setLoading]=useState(read);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [revision,setRevision]=useState(0);
  const [create,setCreate]=useState(false);
  const [selected,setSelected]=useState<string|null>(null);
  useEffect(()=>{
    if(!read)return;
    let mounted=true;setLoading(true);setError('');
    void getTechnologyServicesStatus().then(result=>{if(mounted)setData(result);})
      .catch(cause=>{if(mounted){setData(null);setError(cause instanceof Error?cause.message:'No fue posible consultar los servicios.');}})
      .finally(()=>{if(mounted)setLoading(false);});
    return ()=>{mounted=false;};
  },[read,revision]);
  useEffect(()=>{
    if(!read)return;
    const refresh=()=>{if(document.visibilityState==='visible')setRevision(x=>x+1);};
    const interval=window.setInterval(refresh,60000);
    window.addEventListener('focus',refresh);
    return ()=>{window.clearInterval(interval);window.removeEventListener('focus',refresh);};
  },[read]);
  const completed=(message:string)=>{
    setCreate(false);setSelected(null);setNotice(message);setRevision(v=>v+1);
  };
  if(!read)return <StatePanel kind="error" title="Acceso restringido"
    message="Se necesita AUDIT_READ para consultar la operación tecnológica."/>;
  const cards=[
    {icon:'check',tone:'green',label:'Servicios comprobados',
      value:data?number(data.live.healthy)+' / '+number(data.live.checked):'—',
      sub:'API y MySQL · comprobación en esta solicitud'},
    {icon:'chart',tone:'blue',label:'Disponibilidad (30 días)',
      value:'—',sub:'Sin monitoreo continuo ni serie SLA'},
    {icon:'shield',tone:'violet',label:'Incidentes registrados (30 días)',
      value:typeof data?.counts?.registeredIncidents30d==='number'?
        number(data.counts.registeredIncidents30d):'—',
      sub:'Solicitudes administrativas, no caídas detectadas'},
    {icon:'wrench',tone:'orange',label:'Mantenimientos previstos',
      value:typeof data?.counts?.upcomingMaintenance==='number'?
        number(data.counts.upcomingMaintenance):'—',
      sub:'Ventanas programadas aún no concluidas'},
  ];
  return <main className="ato-page">
    <AdminPageHeading icon="heart-pulse" title="Operación tecnológica"
      description="Monitoreo, seguimiento de incidentes y mantenimiento de la infraestructura XAMUKO."
      actions={<div className="ato-heading-actions">
        <span className="ato-checked-at"><Icon name="clock" size={16}/>
    <TechnologyTabs />
          {data?'Comprobado: '+formatDate(data.checkedAt):'Sin comprobación reciente'}</span>
        <button type="button" className="ato-btn ato-btn-light"
          onClick={()=>setRevision(v=>v+1)}><Icon name="refresh" size={17}/> Actualizar</button>
        {manage&&<button type="button" className="ato-btn ato-btn-blue"
          onClick={()=>setCreate(true)}><Icon name="file" size={17}/> Registrar incidente</button>}
      </div>}/>
    {notice&&<div role="status" className="ato-success"><Icon name="check" size={18}/>{notice}</div>}
    {error&&<div className="ato-message-error" role="alert"><Icon name="shield" size={18}/>
      <span>{error}. Comprueba la actualización de la API y la migración tecnológica.</span>
      <button type="button" className="ato-btn ato-btn-light" onClick={()=>setRevision(v=>v+1)}>Reintentar</button>
    </div>}
    <section className="ato-kpi-grid" aria-label="Indicadores de operación tecnológica">
      {cards.map(card=><article key={card.label} className={'ato-kpi ato-kpi-'+card.tone}>
        <span className="ato-kpi-icon"><Icon name={card.icon} size={25}/></span>
        <div><span>{card.label}</span><strong aria-busy={loading}>{card.value}</strong><small>{card.sub}</small></div>
      </article>)}
    </section>
    <TechnologyInfoBox icon="shield">
      <strong>Estado actual comprobable, sin porcentajes inventados</strong>
      <p>La solicitud valida la disponibilidad puntual de la API y una consulta a MySQL.
        No existen aún sondas externas continuas para web, almacenamiento o AWS.
        El 99,98 % ilustrado en el diseño inicial era una referencia visual, no una medición real.</p>
    </TechnologyInfoBox>
    <section className="ato-status-layout" aria-label="Monitoreo e historial">
      <article className="ato-panel ato-services-panel">
        <header className="ato-panel-heading"><div>
          <span className="ato-kicker">COMPROBACIÓN EN TIEMPO REAL</span>
          <h2><Icon name="server" size={23}/> Estado de los servicios</h2>
          <p>La última comprobación distingue componentes verificados y no monitoreados.</p>
        </div><span className="ato-chip">5 componentes registrados</span></header>
        {loading&&!data?<p className="ato-loading" role="status">Consultando señales del backend…</p>
        :data?<div className="ato-services-scroll"><table className="ato-services-table">
          <thead><tr><th>Servicio</th><th>Estado</th><th>Latencia medida</th>
            <th>Disponibilidad 30 días</th><th>Fuente</th></tr></thead>
          <tbody>{data.components.map(service=><tr key={service.id}>
            <td><span className="ato-service-title">
              <span className="ato-service-icon"><Icon name={serviceIcons[service.id]??'server'} size={20}/></span>
              <span><strong>{service.name}</strong><small>{service.detail}</small></span>
            </span></td>
            <td><TechnologyStatusBadge value={service.status}/></td>
            <td className="ato-tabular">{service.latencyMs!==null?service.latencyMs+' ms':'—'}</td>
            <td className="ato-tabular">—</td>
            <td>{service.source??'No conectada'}</td>
          </tr>)}</tbody>
        </table></div>:<div className="ato-empty">Sin señales disponibles del backend.</div>}
        <p className="ato-panel-footnote"><Icon name="info" size={16}/>
          Las comprobaciones actuales no constituyen un acuerdo de nivel de servicio (SLA) ni un cálculo de uptime histórico.</p>
      </article>
      {data?<IncidentChart data={data}/>:<div className="ato-panel ato-chart-unavailable">Histórico no disponible.</div>}
    </section>
    <section className="ato-bottom-grid">
      <article className="ato-panel">
        <header className="ato-panel-heading"><div>
          <span className="ato-kicker">TRAZABILIDAD ADMINISTRATIVA</span>
          <h2><Icon name="shield" size={21}/> Incidentes recientes</h2>
          <p>Casos registrados manualmente; no se generan automáticamente desde la infraestructura.</p>
        </div></header>
        {data?.caseDataAvailable?
          data.incidents.length?<div className="ato-incident-list">{data.incidents.map(i=>
            <IncidentCard key={i.id} item={i} onOpen={setSelected}/>)}</div>
          :<div className="ato-positive-empty"><Icon name="check" size={23}/>
            <div><strong>No hay expedientes de incidentes registrados</strong>
              <p>Esto no certifica que no hayan ocurrido interrupciones.</p></div></div>:
          <p className="ato-empty">No fue posible consultar los expedientes de incidentes.</p>}
      </article>
      <article className="ato-panel">
        <header className="ato-panel-heading"><div>
          <span className="ato-kicker">PRÓXIMOS EVENTOS</span>
          <h2><Icon name="calendar" size={21}/> Mantenimientos y actividad</h2>
          <p>Planificación y últimas anotaciones documentadas en XAMUKO.</p>
        </div></header>
        {data?.upcomingMaintenance.length?<div className="ato-event-list">{data.upcomingMaintenance.slice(0,3).map(i=>
          <button type="button" className="ato-event-item" onClick={()=>setSelected(i.id)} key={i.id}>
            <span className="ato-event-symbol"><Icon name="wrench" size={17}/></span>
            <span><strong>{i.title}</strong><small>{formatDate(i.scheduledStartAt)} · {i.component??'Sin componente'}</small></span>
            <Icon name="arrow" size={14}/></button>)}</div>
        :<div className="ato-mini-empty">No hay mantenimientos futuros registrados.</div>}
        <div className="ato-panel-divider"/>
        {data?.recentEvents.length?<div className="ato-event-list">{data.recentEvents.slice(0,4).map(e=>
          <button type="button" className="ato-event-item" onClick={()=>setSelected(e.caseId)} key={e.id}>
            <span className="ato-event-symbol"><Icon name="file" size={16}/></span>
            <span><strong>{e.case?.title??'Expediente tecnológico'}</strong>
              <small>{formatDate(e.createdAt)} · {e.action==='NOTE'?'Nota':e.action==='CREATED'?'Creación':'Estado actualizado'}</small></span>
            <Icon name="arrow" size={14}/></button>)}</div>
        :<div className="ato-mini-empty">Sin novedades documentadas en los últimos 30 días.</div>}
      </article>
    </section>
    <div className="ato-context-links">
      <span><Icon name="shield" size={16}/> Fuente: comprobación autenticada y expedientes de MySQL</span>
    </div>
    {create&&manage&&<TechnologyCreateDialog kind="INCIDENT"
      onClose={()=>setCreate(false)} onComplete={completed}/>}
    {selected&&<TechnologyCaseDialog id={selected} canManage={manage}
      onClose={()=>setSelected(null)} onComplete={completed}/>}
  </main>;
}
