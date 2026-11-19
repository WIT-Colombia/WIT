import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { AdminDialog } from '../components/AdminDialog';
import { Icon } from '../components/Icon';
import {
  createTechnologyCase, getTechnologyCase, transitionTechnologyCase, addTechnologyCaseNote,
  type TechnologyCase, type TechnologyEvent, type TechnologyKind,
  type TechnologySeverity, type TechnologyStatus,
} from '../services/adminApiClient';
import './TechnologyOperations.css';

export const kindName:Record<TechnologyKind,string>={
  INCIDENT:'Incidente',MAINTENANCE:'Mantenimiento',NEED:'Necesidad técnica',
};
export const severityName:Record<TechnologySeverity,string>={
  LOW:'Baja',MEDIUM:'Media',HIGH:'Alta',CRITICAL:'Crítica',
};
export const statusName:Record<TechnologyStatus,string>={
  OPEN:'Abierto',PLANNED:'Programado',IN_PROGRESS:'En curso',
  BLOCKED:'Bloqueado',RESOLVED:'Resuelto',COMPLETED:'Finalizado',CANCELLED:'Cancelado',
};
export const allowedTransitions:Record<TechnologyKind,Partial<Record<TechnologyStatus,TechnologyStatus[]>>>={
  INCIDENT:{OPEN:['IN_PROGRESS','RESOLVED'],IN_PROGRESS:['OPEN','RESOLVED'],RESOLVED:['OPEN']},
  MAINTENANCE:{PLANNED:['IN_PROGRESS','CANCELLED'],IN_PROGRESS:['COMPLETED','CANCELLED'],
    COMPLETED:['PLANNED'],CANCELLED:['PLANNED']},
  NEED:{OPEN:['IN_PROGRESS','BLOCKED','CANCELLED'],IN_PROGRESS:['BLOCKED','COMPLETED','CANCELLED'],
    BLOCKED:['IN_PROGRESS','CANCELLED'],COMPLETED:['OPEN'],CANCELLED:['OPEN']},
};
export const formatDate=(value:string|null|undefined)=>
  value?new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short',
    timeZone:'America/Bogota'}).format(new Date(value)):'No informado';
export const number=(value:number)=>value.toLocaleString('es-CO');
export const csvSafe=(value:string)=>'"'+(/^\s*[=+\-@]/.test(value)?"'":'')+value.replaceAll('"','""')+'"';
export function downloadCsv(filename:string,headers:string[],rows:string[][]) {
  const text='\ufeff'+[headers,...rows].map(line=>line.map(csvSafe).join(';')).join('\r\n');
  const blob=new Blob([text],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function TechnologyTabs(){
  return <nav className="ato-tabs" aria-label="Pestañas de Operación tecnológica">
    <NavLink to="/service-status" end
      className={({isActive})=>'ato-tab'+(isActive?' active':'')}>
      <Icon name="heart-pulse" size={21}/><span>Estado de servicios</span>
    </NavLink>
    <NavLink to="/deployments" end
      className={({isActive})=>'ato-tab'+(isActive?' active':'')}>
      <Icon name="layers" size={21}/><span>Despliegues y mantenimiento</span>
    </NavLink>
  </nav>;
}
export function TechnologyStatusBadge({value}: {value:string}){
  return <span className={'ato-status ato-status-'+value.toLowerCase().replace(/[^a-z_]/g,'')}>
    <span className="ato-status-dot"/>{statusName[value as TechnologyStatus]??
      ({HEALTHY:'Operativo ahora',UNAVAILABLE:'No disponible',UNMONITORED:'Sin monitoreo',
        CONFIRMED:'Desplegado',SKIPPED:'Sin despliegue',UNVERIFIED:'No verificado',
        FAILED_OR_CANCELLED:'Falló / cancelado',NOT_APPLICABLE:'Solo validación',
        success:'Correcto',failure:'Fallido',cancelled:'Cancelado',
        in_progress:'En curso',queued:'En cola'} as Record<string,string>)[value]??value}
  </span>;
}
export function TechnologyInfoBox({children,icon='info'}:{children:ReactNode;icon?:string}){
  return <div className="ato-explainer"><Icon name={icon} size={20}/><div>{children}</div></div>;
}
export function TechnologyCreateDialog({kind,onClose,onComplete}:{
  kind:TechnologyKind;onClose:()=>void;onComplete:(message:string)=>void;
}){
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [component,setComponent]=useState('');
  const [severity,setSeverity]=useState<TechnologySeverity>('MEDIUM');
  const [start,setStart]=useState('');
  const [end,setEnd]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const valid=title.trim().length>=8&&description.trim().length>=20&&
    (kind!=='MAINTENANCE'||(!!start&&!!end&&new Date(start)<new Date(end)));
  const save=async(e:FormEvent)=>{
    e.preventDefault();
    if(!valid||busy)return;
    setBusy(true);setError('');
    try{
      await createTechnologyCase({
        kind,title:title.trim(),description:description.trim(),component:component.trim(),severity,
        ...(kind==='MAINTENANCE'?{
          scheduledStartAt:new Date(start).toISOString(),
          scheduledEndAt:new Date(end).toISOString(),
        }:{}),
      });
      onComplete(kind==='INCIDENT'?'Incidente registrado con trazabilidad administrativa.':
        kind==='MAINTENANCE'?'Mantenimiento programado; no se han ejecutado cambios en AWS.':
        'Necesidad tecnológica registrada en el plan de trabajo.');
    }catch(cause){
      setError(cause instanceof Error?cause.message:'No fue posible registrar el expediente.');
      setBusy(false);
    }
  };
  return <AdminDialog title={'Registrar '+kindName[kind].toLowerCase()}
    onClose={onClose} busy={busy} wide contextLabel="XAMUKO · OPERACIÓN TECNOLÓGICA">
    <form className="ato-form" onSubmit={e=>void save(e)}>
      <p className="ato-form-intro">Registro administrativo. No modifica servidores,
        no inicia despliegues y no genera automáticamente alertas externas.</p>
      <label><span>Título *</span><input aria-label="Título del expediente" value={title}
        onChange={e=>setTitle(e.target.value)} maxLength={160} minLength={8}
        required disabled={busy} placeholder="Describe la actuación o incidencia"/></label>
      <div className="ato-form-pair">
        <label><span>Componente afectado (opcional)</span><input aria-label="Componente tecnológico"
          value={component} onChange={e=>setComponent(e.target.value)}
          maxLength={120} disabled={busy} placeholder="API, web, MySQL, AWS, almacenamiento…"/></label>
        <label><span>Prioridad</span><select aria-label="Prioridad del expediente"
          value={severity} disabled={busy}
          onChange={e=>setSeverity(e.target.value as TechnologySeverity)}>
          {(['LOW','MEDIUM','HIGH','CRITICAL'] as const).map(s=><option key={s} value={s}>{severityName[s]}</option>)}
        </select></label>
      </div>
      {kind==='MAINTENANCE'&&<div className="ato-form-pair">
        <label><span>Inicio programado · hora de tu dispositivo *</span>
          <input type="datetime-local" aria-label="Inicio del mantenimiento"
            value={start} required disabled={busy} onChange={e=>setStart(e.target.value)}/></label>
        <label><span>Final programado · hora de tu dispositivo *</span>
          <input type="datetime-local" aria-label="Fin del mantenimiento"
            value={end} min={start} required disabled={busy} onChange={e=>setEnd(e.target.value)}/></label>
      </div>}
      <label><span>Descripción y antecedentes *</span>
        <textarea aria-label="Descripción del expediente" value={description}
          onChange={e=>setDescription(e.target.value)} required minLength={20} maxLength={2000}
          rows={5} disabled={busy}
          placeholder="Impacto, evidencia, alcance y acciones previstas. No incluyas secretos ni credenciales."/></label>
      {error&&<p className="ato-form-error" role="alert">{error}</p>}
      <div className="ato-form-actions">
        <button className="ato-btn ato-btn-light" type="button" disabled={busy} onClick={onClose}>Cancelar</button>
        <button className="ato-btn ato-btn-blue" type="submit" disabled={busy||!valid}>
          <Icon name="check" size={17}/>{busy?'Registrando…':'Registrar expediente'}</button>
      </div>
    </form>
  </AdminDialog>;
}
export function TechnologyCaseDialog({id,onClose,onComplete,canManage}:{
  id:string;onClose:()=>void;onComplete:(message:string)=>void;canManage:boolean;
}){
  const [item,setItem]=useState<TechnologyCase|null>(null);
  const [history,setHistory]=useState<TechnologyEvent[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState<TechnologyStatus|''>('');
  const [reason,setReason]=useState('');
  const [note,setNote]=useState('');
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    void getTechnologyCase(id).then(res=>{
      if(active){setItem(res.case);setHistory(res.history);}
    }).catch(cause=>{
      if(active)setError(cause instanceof Error?cause.message:'No se pudo cargar el expediente.');
    }).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[id,revision]);
  const transitions=item?allowedTransitions[item.kind]?.[item.status]??[]:[];
  const update=async(e:FormEvent)=>{
    e.preventDefault();if(!status||!item||reason.trim().length<12||busy)return;
    setBusy(true);setError('');
    try{
      await transitionTechnologyCase(item.id,status,reason.trim());
      onComplete('Cambio de estado registrado con motivo y responsable en la auditoría del expediente.');
    }catch(cause){setBusy(false);setError(cause instanceof Error?cause.message:'No fue posible actualizar.');}
  };
  const addNote=async(e:FormEvent)=>{
    e.preventDefault();if(!item||note.trim().length<12||busy)return;
    setBusy(true);setError('');
    try{
      await addTechnologyCaseNote(item.id,note.trim());
      setNote('');setRevision(r=>r+1);
      setBusy(false);
    }catch(cause){setBusy(false);setError(cause instanceof Error?cause.message:'No fue posible agregar la anotación.');}
  };
  return <AdminDialog title={item?.title??'Expediente tecnológico'} onClose={onClose} busy={busy}
    wide contextLabel="XAMUKO · EXPEDIENTE AUDITABLE">
    {loading?<p className="ato-loading" role="status">Cargando expediente e historial…</p>
    :!item?<div className="ato-message-error" role="alert">{error||'El expediente no está disponible.'}
      <button type="button" className="ato-btn ato-btn-light" onClick={()=>setRevision(x=>x+1)}>Reintentar</button></div>
    :<div className="ato-detail">
      <div className="ato-detail-top"><TechnologyStatusBadge value={item.status}/>
        <span className={'ato-severity ato-severity-'+item.severity.toLowerCase()}>
          Prioridad {severityName[item.severity]}</span></div>
      <dl className="ato-detail-grid">
        <div><dt>Tipo</dt><dd>{kindName[item.kind]}</dd></div>
        <div><dt>Componente</dt><dd>{item.component??'Sin indicar'}</dd></div>
        <div><dt>Creado</dt><dd>{formatDate(item.createdAt)}</dd></div>
        <div><dt>Actualizado</dt><dd>{formatDate(item.updatedAt)}</dd></div>
        {item.scheduledStartAt&&<div><dt>Inicio previsto</dt><dd>{formatDate(item.scheduledStartAt)}</dd></div>}
        {item.scheduledEndAt&&<div><dt>Fin previsto</dt><dd>{formatDate(item.scheduledEndAt)}</dd></div>}
        <div className="ato-detail-wide"><dt>Descripción documentada</dt><dd>{item.description}</dd></div>
      </dl>
      {canManage&&<section className="ato-detail-manage">
        <h3>Gestión administrativa</h3>
        <p>Las acciones modifican únicamente el expediente, no la infraestructura.</p>
        {transitions.length>0&&<form className="ato-form" onSubmit={e=>void update(e)}>
          <label><span>Nuevo estado</span><select aria-label="Nuevo estado del expediente"
            value={status} disabled={busy} onChange={e=>setStatus(e.target.value as TechnologyStatus)}>
            <option value="">Selecciona una transición</option>
            {transitions.map(s=><option key={s} value={s}>{statusName[s]}</option>)}
          </select></label>
          <label><span>Motivo del cambio (12 a 500 caracteres)</span>
            <textarea aria-label="Motivo del estado" rows={3} maxLength={500} minLength={12}
              value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}
              placeholder="Indica la evidencia y justificación de la decisión."/></label>
          <button className="ato-btn ato-btn-blue" type="submit"
            disabled={busy||!status||reason.trim().length<12}>Registrar cambio</button>
        </form>}
        <form className="ato-form ato-note-form" onSubmit={e=>void addNote(e)}>
          <label><span>Agregar anotación a la bitácora</span>
            <textarea aria-label="Anotación técnica" rows={3} maxLength={500} minLength={12}
              value={note} onChange={e=>setNote(e.target.value)} disabled={busy}
              placeholder="Hallazgo, prueba, decisión o próximo paso; no incluyas credenciales."/></label>
          <button className="ato-btn ato-btn-light" type="submit" disabled={busy||note.trim().length<12}>
            <Icon name="file" size={16}/> Guardar anotación</button>
        </form>
      </section>}
      {error&&<p role="alert" className="ato-form-error">{error}</p>}
      <section className="ato-case-audit" aria-label="Historial del expediente">
        <h3>Bitácora y auditoría</h3>
        <ol>{history.map(event=><li key={event.id}>
          <span className="ato-audit-marker"><Icon name="check" size={15}/></span>
          <div><strong>{event.action==='CREATED'?'Expediente radicado':
            event.action==='NOTE'?'Anotación registrada':'Cambio de estado'}</strong>
            <small>{formatDate(event.createdAt)}</small>
            {event.action==='STATUS_CHANGED'&&<p>{event.fromStatus?statusName[event.fromStatus]:'—'} → {event.toStatus?statusName[event.toStatus]:'—'}</p>}
            <p>{event.reason}</p><small>Administrador: {event.actorUserId}</small>
          </div>
        </li>)}</ol>
      </section>
    </div>}
  </AdminDialog>;
}
