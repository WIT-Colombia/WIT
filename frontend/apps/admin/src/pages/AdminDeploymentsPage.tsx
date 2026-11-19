import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {useSearchParams} from 'react-router-dom';
import {AdminPageHeading} from '../components/AdminPageHeading';
import {Icon} from '../components/Icon';
import {StatePanel} from '../components/common';
import {can,getSession} from '../services/adminService';
import {
  getTechnologyDeployments,getTechnologyServicesStatus,listTechnologyCases,
  type TechnologyCase,type TechnologyCasePage,type TechnologyDeployments,
  type TechnologyKind,type TechnologyServicesStatus,type TechnologyStatus,
} from '../services/adminApiClient';
import {
  TechnologyStatusBadge,TechnologyInfoBox,TechnologyCreateDialog,
  TechnologyCaseDialog,formatDate,number,downloadCsv,severityName,
} from './TechnologyShared';
import './TechnologyOperations.css';

function DeploymentFeed({data,loading,error,onReload}:{
  data:TechnologyDeployments|null;loading:boolean;error:string;onReload:()=>void;
}){
  const [kind,setKind]=useState<'ALL'|'CI'|'RELEASE'>('ALL');
  const [q,setQ]=useState('');
  const [page,setPage]=useState(1);
  const items=useMemo(()=>data?.items.filter(x=>
    (kind==='ALL'||kind===x.kind)&&
    (!q.trim()||[x.title,x.commit,x.branch??''].some(v=>v.toLowerCase().includes(q.toLowerCase().trim()))))??[],
  [data,kind,q]);
  const pages=Math.ceil(items.length/8);
  const displayed=items.slice((page-1)*8,page*8);
  const selectKind=(value:'ALL'|'CI'|'RELEASE')=>{setKind(value);setPage(1);};
  const exportCsv=()=>{
    downloadCsv('xamuko-github-actions-muestra.csv',
      ['Ejecución','Tipo','Rama','Commit','CI','Resultado CI','Trabajo de despliegue','Fecha','GitHub'],
      items.map(run=>[String(run.id),run.title,run.branch??'',run.commit,run.workflowStatus,
        run.workflowConclusion??'',run.deploymentStatus,run.createdAt,run.url]));
  };
  return <section className="ato-panel ato-deploy-panel" aria-labelledby="ato-deploy-heading">
    <header className="ato-panel-heading ato-deploy-head">
      <div><span className="ato-kicker">HISTORIAL DE CAMBIOS VERIFICABLE</span>
        <h2 id="ato-deploy-heading"><Icon name="layers" size={22}/> Ejecuciones de GitHub Actions</h2>
        <p>Validaciones, paquetes y despliegues identificados por número de ejecución y commit.</p></div>
      <div className="ato-panel-actions">
        <button type="button" className="ato-btn ato-btn-light" onClick={onReload}>
          <Icon name="refresh" size={16}/> Actualizar fuente</button>
        <button type="button" className="ato-btn ato-btn-light" onClick={exportCsv}
          disabled={!items.length||loading}><Icon name="download" size={15}/> CSV muestra</button>
      </div>
    </header>
    <div className="ato-deploy-filters">
      <div className="ato-filter-segments" role="group" aria-label="Filtrar ejecuciones">
        {([
          ['ALL','Todas'],['CI','Validaciones CI'],['RELEASE','Producción'],
        ] as const).map(([key,label])=><button type="button" key={key}
          aria-pressed={kind===key} onClick={()=>selectKind(key)}>{label}</button>)}
      </div>
      <label className="ato-search"><Icon name="search" size={16}/>
        <input aria-label="Buscar ejecuciones de GitHub" type="search" value={q}
          placeholder="Workflow, commit o rama…" maxLength={100}
          onChange={e=>{setQ(e.target.value);setPage(1);}}/></label>
    </div>
    {!data&&loading?<p className="ato-loading" role="status">Consultando GitHub Actions…</p>
    :error?<p className="ato-message-error" role="alert">{error}</p>
    :data&&!data.connected?<div className="ato-external-empty">
      <span><Icon name="lock" size={30}/></span><div>
        <strong>Historial externo sin conexión verificable</strong>
        <p>{data.limitation}</p>
        <a href={data.actionsUrl} target="_blank" rel="noopener noreferrer" className="ato-btn ato-btn-blue">
          Abrir GitHub Actions <Icon name="arrow" size={16}/></a></div>
      </div>
    :data?.connected&&!items.length?<div className="ato-empty">
      No hay ejecuciones que coincidan con este filtro dentro de la muestra consultada.</div>
    :data?.connected&&<div className="ato-deploy-results">
      <div className="ato-table-scroll"><table className="ato-table ato-deploy-table">
        <thead><tr><th>Ejecución</th><th>Rama / commit</th>
          <th>Resultado del workflow</th><th>Despliegue real</th><th>Registrada</th><th>Detalle</th></tr></thead>
        <tbody>{displayed.map(run=><tr key={run.id}>
          <td><strong>{run.title}</strong><small>#{run.runNumber} · {run.kind==='RELEASE'?'Producción':'CI / paquete'}</small></td>
          <td><strong>{run.branch??'Sin rama'}</strong><small>{run.commit}</small></td>
          <td><TechnologyStatusBadge value={run.workflowConclusion??run.workflowStatus}/></td>
          <td><TechnologyStatusBadge value={run.deploymentStatus}/></td>
          <td>{formatDate(run.createdAt)}</td>
          <td><a href={run.url} target="_blank" rel="noopener noreferrer" className="ato-table-link">
            Abrir ejecución <Icon name="arrow" size={15}/></a></td>
        </tr>)}</tbody></table></div>
      <div className="ato-mobile-deployments">{displayed.map(run=><article key={run.id}>
        <header><strong>{run.title}</strong><TechnologyStatusBadge value={run.deploymentStatus}/></header>
        <small>#{run.runNumber} · {run.branch??'Sin rama'} · {run.commit}</small>
        <dl><div><dt>Resultado CI</dt><dd>{run.workflowConclusion??run.workflowStatus}</dd></div>
          <div><dt>Registrado</dt><dd>{formatDate(run.createdAt)}</dd></div></dl>
        <a href={run.url} target="_blank" rel="noopener noreferrer">
          Abrir en GitHub <Icon name="arrow" size={15}/></a>
      </article>)}</div>
      {pages>1&&<nav className="ato-pagination" aria-label="Páginas de ejecuciones GitHub">
        <span>Página {page} de {pages} · {items.length} ejecuciones de la muestra</span>
        <div><button type="button" className="ato-btn ato-btn-light" disabled={page<=1}
          onClick={()=>setPage(p=>p-1)}>Anterior</button>
          <button type="button" className="ato-btn ato-btn-blue" disabled={page>=pages}
            onClick={()=>setPage(p=>p+1)}>Siguiente</button></div>
      </nav>}
    </div>}
    <p className="ato-panel-footnote"><Icon name="info" size={16}/>
      {data?.connected?
        'La tabla contiene solamente las últimas ejecuciones consultadas, no necesariamente todo el historial. El estado workflow=success no acredita por sí solo un despliegue.':
        'La página no presupone despliegues exitosos. GitHub requiere acceso de solo lectura configurado en el servidor cuando el repositorio es privado.'}
    </p>
  </section>;
}
export function AdminDeploymentsPage(){
  const admin=getSession();
  const [searchParams,setSearchParams]=useSearchParams();
  const read=admin?can(admin,'audit:read'):false;
  const manage=admin?(admin.realRole==='SUPER_ADMIN'||can(admin,'settings:write')):false;
  const [deployments,setDeployments]=useState<TechnologyDeployments|null>(null);
  const [status,setStatus]=useState<TechnologyServicesStatus|null>(null);
  const [cases,setCases]=useState<TechnologyCasePage|null>(null);
  const [deployLoading,setDeployLoading]=useState(read);
  const [caseLoading,setCaseLoading]=useState(read);
  const [deployError,setDeployError]=useState('');
  const [caseError,setCaseError]=useState('');
  const [notice,setNotice]=useState('');
  const [revision,setRevision]=useState(0);
  const [work,setWork]=useState<'MAINTENANCE'|'NEED'>(searchParams.get('work')==='NEED'?'NEED':'MAINTENANCE');
  const [q,setQ]=useState('');
  const [draft,setDraft]=useState('');
  const [filter,setFilter]=useState<TechnologyStatus|'ALL'>('ALL');
  const [page,setPage]=useState(1);
  const [creating,setCreating]=useState<TechnologyKind|null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  useEffect(()=>{
    if(!read)return;
    let active=true;setDeployLoading(true);setDeployError('');
    void getTechnologyDeployments().then(res=>{if(active)setDeployments(res);})
      .catch(cause=>{if(active){setDeployments(null);
        setDeployError(cause instanceof Error?cause.message:'No fue posible consultar GitHub.');}})
      .finally(()=>{if(active)setDeployLoading(false);});
    return ()=>{active=false;};
  },[read,revision]);
  useEffect(()=>{
    if(!read)return;
    let active=true;void getTechnologyServicesStatus().then(res=>{if(active)setStatus(res);})
      .catch(()=>{if(active)setStatus(null);});
    return ()=>{active=false;};
  },[read,revision]);
  useEffect(()=>{
    if(!read)return;
    let active=true;setCaseLoading(true);setCaseError('');
    void listTechnologyCases({kind:work,status:filter,q,page}).then(res=>{
      if(active)setCases(res);
    }).catch(cause=>{if(active){setCases(null);setCaseError(cause instanceof Error?cause.message:'No se pudo consultar el plan técnico.');}})
      .finally(()=>{if(active)setCaseLoading(false);});
    return ()=>{active=false;};
  },[read,revision,work,filter,q,page]);
  const changeWork=(kind:'MAINTENANCE'|'NEED')=>{
    setWork(kind);setPage(1);setQ('');setDraft('');setFilter('ALL');
    setSearchParams(kind==='NEED'?{work:'NEED'}:{},{replace:true});
  };
  const onComplete=(message:string)=>{
    setCreating(null);setSelected(null);setNotice(message);setRevision(v=>v+1);
  };
  if(!read)return <StatePanel kind="error" title="Acceso restringido"
    message="Se necesita AUDIT_READ para consultar despliegues y mantenimiento."/>;
  const counters=[
    {icon:'check',tone:'green',name:'Validaciones CI correctas',
      value:deployments?.connected&&deployments.summary?number(deployments.summary.ciPassed):'—',
      detail:'En la muestra verificada de GitHub'},
    {icon:'layers',tone:'blue',name:'Despliegues confirmados',
      value:deployments?.connected&&deployments.summary?number(deployments.summary.confirmedDeployments):'—',
      detail:'Solo jobs deploy finalizados correctamente'},
    {icon:'wrench',tone:'orange',name:'Mantenimientos previstos',
      value:status?.counts?number(status.counts.upcomingMaintenance):'—',
      detail:'Expedientes programados o en curso'},
    {icon:'file',tone:'violet',name:'Necesidades pendientes',
      value:status?.counts?number(status.counts.openNeeds):'—',
      detail:'Abiertas, en curso o bloqueadas'},
  ];
  return <main className="ato-page">
    <AdminPageHeading icon="layers" title="Operación tecnológica"
      description="Historial real de versiones, programación de mantenimiento y plan de mejoras técnicas."
      actions={<div className="ato-heading-actions">
        <button type="button" className="ato-btn ato-btn-light" onClick={()=>setRevision(v=>v+1)}>
          <Icon name="refresh" size={17}/> Actualizar</button>
        {manage&&<button type="button" className="ato-btn ato-btn-blue"
          onClick={()=>setCreating('MAINTENANCE')}>
          <Icon name="calendar" size={17}/> Programar mantenimiento</button>}
      </div>}/>
    {notice&&<div className="ato-success" role="status"><Icon name="check" size={18}/>{notice}</div>}
    <section className="ato-kpi-grid" aria-label="Indicadores de despliegues y mantenimiento">
      {counters.map(k=><article className={'ato-kpi ato-kpi-'+k.tone} key={k.name}>
        <span className="ato-kpi-icon"><Icon name={k.icon} size={25}/></span>
        <div><span>{k.name}</span><strong>{k.value}</strong><small>{k.detail}</small></div>
      </article>)}
    </section>
    <TechnologyInfoBox icon="shield">
      <strong>Control de cambios con evidencia</strong>
      <p>Las validaciones, paquetes y despliegues son procesos distintos. Solo un trabajo
        <b> deploy</b> confirmado en GitHub constituye evidencia de ejecución del workflow.
        Programar un mantenimiento o crear una necesidad no despliega ni modifica servidores.</p>
    </TechnologyInfoBox>
    <DeploymentFeed data={deployments} loading={deployLoading}
      error={deployError} onReload={()=>setRevision(x=>x+1)}/>
    <section className="ato-panel ato-work-panel" aria-labelledby="ato-work-heading">
      <header className="ato-panel-heading"><div>
        <span className="ato-kicker">PROGRAMACIÓN Y SEGUIMIENTO</span>
        <h2 id="ato-work-heading"><Icon name="wrench" size={21}/> Mantenimiento y necesidades</h2>
        <p>Expedientes de mantenimiento programado y mejoras técnicas con responsable y bitácora.</p>
      </div>{manage&&<div className="ato-panel-actions">
        <button className="ato-btn ato-btn-light" type="button" onClick={()=>setCreating('NEED')}>
          <Icon name="file" size={16}/> Nueva necesidad</button>
        <button className="ato-btn ato-btn-blue" type="button" onClick={()=>setCreating('MAINTENANCE')}>
          <Icon name="calendar" size={16}/> Programar mantenimiento</button>
      </div>}</header>
      <div className="ato-work-switch" role="group" aria-label="Tipo de trabajo tecnológico">
        <button type="button" aria-pressed={work==='MAINTENANCE'} onClick={()=>changeWork('MAINTENANCE')}>
          <Icon name="wrench" size={18}/> Mantenimientos</button>
        <button type="button" aria-pressed={work==='NEED'} onClick={()=>changeWork('NEED')}>
          <Icon name="file" size={18}/> Necesidades técnicas</button>
      </div>
      <form className="ato-work-filters" onSubmit={(e:FormEvent)=>{
        e.preventDefault();setPage(1);setQ(draft.trim());
      }}>
        <label className="ato-search"><Icon name="search" size={17}/>
          <input type="search" aria-label="Buscar expediente tecnológico"
            value={draft} maxLength={100} placeholder="Título, componente o descripción…"
            onChange={e=>setDraft(e.target.value)}/></label>
        <label className="ato-work-select"><span>Estado del expediente</span>
          <select value={filter} aria-label="Estado del expediente tecnológico"
            onChange={e=>{setFilter(e.target.value as TechnologyStatus|'ALL');setPage(1);}}>
            <option value="ALL">Todos los estados</option>
            {(work==='MAINTENANCE'?['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED']:
              ['OPEN','IN_PROGRESS','BLOCKED','COMPLETED','CANCELLED']).map(s=>
              <option key={s} value={s}>{({PLANNED:'Programado',IN_PROGRESS:'En curso',
                COMPLETED:'Finalizado',CANCELLED:'Cancelado',OPEN:'Abierto',
                BLOCKED:'Bloqueado'} as Record<string,string>)[s]}</option>)}
          </select></label>
        <div className="ato-filter-actions">
          <button type="button" className="ato-btn ato-btn-light" onClick={()=>{
            setDraft('');setQ('');setFilter('ALL');setPage(1);}}>Limpiar</button>
          <button type="submit" className="ato-btn ato-btn-blue"><Icon name="search" size={16}/> Buscar</button>
        </div>
      </form>
      <div className="ato-toolbar"><strong>{caseLoading?'Consultando expedientes…':cases?
        number(cases.pagination.total)+(cases.pagination.total===1?' registro':' registros'):
        'Registro de mantenimiento'}</strong>
        <span>Fuente: expedientes administrativos XAMUKO · permisos y auditoría</span>
      </div>
      {caseError&&<div className="ato-message-error" role="alert"><Icon name="shield" size={17}/>
        {caseError}<button type="button" className="ato-btn ato-btn-light"
          onClick={()=>setRevision(v=>v+1)}>Reintentar</button></div>}
      {caseLoading?<p className="ato-loading" role="status">Consultando programación y necesidades…</p>
      :!cases?.cases.length&&!caseError?<div className="ato-empty"><Icon name="file" size={25}/>
        <strong>No hay expedientes con estos criterios</strong>
        <p>Solo aparecerán solicitudes efectivamente registradas.</p></div>
      :cases?.cases.length?<div className="ato-work-list">{cases.cases.map((item:TechnologyCase)=>
        <button type="button" className="ato-work-item" key={item.id}
          onClick={()=>setSelected(item.id)}>
          <span className="ato-work-icon"><Icon name={item.kind==='MAINTENANCE'?'wrench':'file'} size={20}/></span>
          <span className="ato-work-primary"><strong>{item.title}</strong><small>
            {item.component??'Sin componente'} · {item.kind==='MAINTENANCE'?
              'Programado: '+formatDate(item.scheduledStartAt):
              'Radicada: '+formatDate(item.createdAt)}</small></span>
          <span className={'ato-severity ato-severity-'+item.severity.toLowerCase()}>
            Prioridad {severityName[item.severity]}</span>
          <TechnologyStatusBadge value={item.status}/>
          <Icon name="arrow" size={17}/>
        </button>)}</div>:null}
      {cases&&cases.pagination.totalPages>1&&<nav className="ato-pagination"
        aria-label="Páginas del plan tecnológico">
        <span>Página {page} de {cases.pagination.totalPages}</span>
        <div><button type="button" className="ato-btn ato-btn-light"
          disabled={page<=1||caseLoading} onClick={()=>setPage(v=>v-1)}>Anterior</button>
          <button type="button" className="ato-btn ato-btn-blue"
            disabled={page>=cases.pagination.totalPages||caseLoading}
            onClick={()=>setPage(v=>v+1)}>Siguiente</button></div>
      </nav>}
      <p className="ato-panel-footnote"><Icon name="info" size={16}/>
        Las ventanas programadas no representan interrupciones ocurridas. La bitácora registra
        altas, cambios de estado y notas con autor, fecha y justificación.</p>
    </section>
    {creating&&manage&&<TechnologyCreateDialog kind={creating}
      onClose={()=>setCreating(null)} onComplete={onComplete}/>}
    {selected&&<TechnologyCaseDialog id={selected} canManage={manage}
      onClose={()=>setSelected(null)} onComplete={onComplete}/>}
  </main>;
}
