import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminPageHeading } from '../components/AdminPageHeading';
import { FinanceSectionNav } from '../components/FinanceSectionNav';
import { Icon } from '../components/Icon';
import { StatePanel } from '../components/common';
import { can, getSession } from '../services/adminService';
import {
  listRefundReviewCases, getRefundReviewCase, createRefundReviewCase, decideRefundReviewCase,
  type RefundReviewCase, type RefundReviewPage, type RefundReviewStatus, type RefundReviewAuditEntry,
} from '../services/adminApiClient';
import './AdminRefundsPage.css';

const number = (n: number) => n.toLocaleString('es-CO');
const money = new Intl.NumberFormat('es-CO', {style:'currency',currency:'COP',maximumFractionDigits:2});
const date = (value: string | null) => value
  ? new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Bogota'}).format(new Date(value))
  : 'No registrada';
const statusLabels: Record<RefundReviewStatus,string> = {
  OPEN:'Radicada',IN_REVIEW:'En revisión',NEEDS_INFORMATION:'Requiere información',CLOSED:'Cerrada',
};
const options: Array<{value: RefundReviewStatus | '';label:string}> = [
  {value:'',label:'Todos los estados'},
  {value:'OPEN',label:'Radicadas'},
  {value:'IN_REVIEW',label:'En revisión'},
  {value:'NEEDS_INFORMATION',label:'Requieren información'},
  {value:'CLOSED',label:'Cerradas'},
];
const csvCell = (value:string) => '"'+(/^\s*[=+\-@]/.test(value)?"'":'')+value.replaceAll('"','""')+'"';

function RefundModal({title,description,children,onClose,locked=false}:{
  title:string;description:string;children:ReactNode;onClose:()=>void;locked?:boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const cancel = useRef(onClose);
  const lockedRef = useRef(locked);
  cancel.current=onClose; lockedRef.current=locked;
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement ? document.activeElement:null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const handle=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!lockedRef.current){event.preventDefault();cancel.current();return;}
      if(event.key!=='Tab')return;
      const available=[...ref.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]',
      )??[]].filter(node=>node.getClientRects().length>0);
      if(!available.length)return;
      if(event.shiftKey&&document.activeElement===available[0]){
        event.preventDefault();available[available.length-1].focus();
      } else if(!event.shiftKey&&document.activeElement===available[available.length-1]){
        event.preventDefault();available[0].focus();
      }
    };
    document.addEventListener('keydown',handle);
    ref.current?.querySelector<HTMLElement>('[data-first-focus]')?.focus({preventScroll:true});
    return ()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',handle);
      previous?.focus({preventScroll:true});};
  },[]);
  return createPortal(<div className="arf-modal-backdrop" onMouseDown={event=>{
    if(event.target===event.currentTarget&&!locked)onClose();
  }}>
    <section ref={ref} role="dialog" aria-modal="true" aria-labelledby="arf-modal-title"
      aria-describedby="arf-modal-description" className="arf-modal">
      <header className="arf-modal-head"><span className="arf-modal-icon"><Icon name="file" size={25}/></span>
        <button type="button" data-first-focus aria-label="Cerrar ventana" disabled={locked}
          className="arf-close" onClick={onClose}><Icon name="close" size={18}/></button></header>
      <h2 id="arf-modal-title">{title}</h2>
      <p id="arf-modal-description" className="arf-modal-description">{description}</p>
      {children}
    </section>
  </div>,document.body);
}

function NewRefundCase({onClose,onComplete}:{
  onClose:()=>void;onComplete:(message:string)=>void;
}){
  const [subject,setSubject]=useState('');
  const [email,setEmail]=useState('');
  const [reference,setReference]=useState('');
  const [amount,setAmount]=useState('');
  const [description,setDescription]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const valid=subject.trim().length>=8&&description.trim().length>=20&&
    (!email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))&&
    (!amount||(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(amount)&&Number(amount)>0));
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!valid||busy)return;
    setBusy(true);setError('');
    try{
      await createRefundReviewCase({
        subject:subject.trim(),description:description.trim(),
        contactEmail:email.trim(),externalReference:reference.trim(),
        requestedAmountCop:amount||null,
      });
      onComplete('Solicitud administrativa radicada. No se ha realizado ningún reembolso.');
    }catch(cause){setError(cause instanceof Error?cause.message:'No fue posible radicar la solicitud.');setBusy(false);}
  };
  return <RefundModal title="Registrar solicitud de reembolso"
    description="Crea un expediente de seguimiento. Este registro no cobra, aprueba ni devuelve dinero."
    onClose={onClose} locked={busy}>
    <form className="arf-form" onSubmit={event=>void submit(event)}>
      <label><span>Asunto de la solicitud *</span>
        <input aria-label="Asunto de la solicitud" value={subject} onChange={event=>setSubject(event.target.value)}
          minLength={8} maxLength={160} required disabled={busy} placeholder="Ej.: Solicitud de devolución de cargo reportado"/></label>
      <div className="arf-form-dual">
        <label><span>Correo de contacto (opcional)</span>
          <input aria-label="Correo de contacto" type="email" maxLength={320} disabled={busy}
            value={email} onChange={event=>setEmail(event.target.value)} placeholder="contacto@ejemplo.com"/></label>
        <label><span>Referencia reportada (opcional)</span>
          <input aria-label="Referencia reportada" maxLength={160} disabled={busy}
            value={reference} onChange={event=>setReference(event.target.value)} placeholder="Número de operación o soporte"/></label>
      </div>
      <label><span>Importe solicitado en COP (no verificado)</span>
        <input aria-label="Importe solicitado en COP" type="number" min="0.01" max="999999999999.99"
          step="0.01" disabled={busy} value={amount} onChange={event=>setAmount(event.target.value)}
          placeholder="Opcional"/></label>
      <label><span>Descripción y antecedentes *</span>
        <textarea aria-label="Descripción y antecedentes" value={description}
          onChange={event=>setDescription(event.target.value)} minLength={20} maxLength={2000}
          required disabled={busy} rows={5}
          placeholder="Indica qué solicita la persona y cuáles son las evidencias disponibles. No incluyas contraseñas ni datos bancarios completos."/></label>
      <p className="arf-modal-advice"><Icon name="shield" size={17}/>
        No registres números completos de tarjetas ni cuentas bancarias. Los importes declarados son solicitudes, no dinero devuelto.</p>
      {error&&<p role="alert" className="arf-form-error">{error}</p>}
      <div className="arf-modal-actions">
        <button type="button" className="arf-btn arf-btn-outline" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="submit" className="arf-btn arf-btn-primary" disabled={busy||!valid}>
          {busy?'Registrando…':'Registrar solicitud'}</button>
      </div>
    </form>
  </RefundModal>;
}

function RefundCaseDetail({id,canManage,onClose,onComplete}:{
  id:string;canManage:boolean;onClose:()=>void;onComplete:(message:string)=>void;
}){
  const [item,setItem]=useState<RefundReviewCase|null>(null);
  const [history,setHistory]=useState<RefundReviewAuditEntry[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [change,setChange]=useState<RefundReviewStatus|null>(null);
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    void getRefundReviewCase(id).then(result=>{if(active){setItem(result.case);setHistory(result.history);}})
      .catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'No se pudo cargar el expediente.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[id,refresh]);
  const decide=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!change||!item||busy||reason.trim().length<12||change===item.status)return;
    setBusy(true);setError('');
    try{
      await decideRefundReviewCase(item.id,{status:change,reason:reason.trim()});
      onComplete('Estado actualizado y registrado en la auditoría financiera. Ningún dinero fue transferido.');
    }catch(cause){setError(cause instanceof Error?cause.message:'No se pudo actualizar la solicitud.');setBusy(false);}
  };
  return <RefundModal title={item?.subject??'Expediente de reembolso'}
    description="Seguimiento administrativo documentado. Las decisiones no representan un desembolso."
    onClose={onClose} locked={busy}>
    {loading?<p className="arf-dialog-state" role="status">Consultando expediente y auditoría…</p>
    :!item?<div className="arf-dialog-state" role="alert"><p>{error||'El expediente no está disponible.'}</p>
      <button className="arf-btn arf-btn-outline" onClick={()=>setRefresh(v=>v+1)} type="button">Reintentar</button></div>
    :<>
      <div className="arf-case-status-bar"><span className={'arf-status '+item.status.toLowerCase()}>{statusLabels[item.status]}</span>
        <span>Radicada {date(item.createdAt)}</span></div>
      <dl className="arf-case-details">
        <div><dt>Referencia reportada</dt><dd>{item.externalReference??'No suministrada'}</dd></div>
        <div><dt>Contacto</dt><dd>{item.contactEmail??'No suministrado'}</dd></div>
        <div><dt>Importe solicitado (sin verificar)</dt><dd>{item.requestedAmountCop?money.format(Number(item.requestedAmountCop)):'No informado'}</dd></div>
        <div><dt>Última actualización</dt><dd>{date(item.updatedAt)}</dd></div>
        <div className="arf-detail-wide"><dt>Descripción de la solicitud</dt><dd>{item.description}</dd></div>
        {item.decisionNote&&<div className="arf-detail-wide"><dt>Última justificación administrativa</dt><dd>{item.decisionNote}</dd></div>}
      </dl>
      {canManage&&<form className="arf-form arf-decision-form" onSubmit={event=>void decide(event)}>
        <h3>Actualizar seguimiento</h3>
        <p>Solo cambia el estado del expediente. No aprueba pagos ni ejecuta devoluciones.</p>
        <label><span>Nuevo estado *</span><select aria-label="Nuevo estado de la solicitud"
          value={change??''} disabled={busy}
          onChange={event=>setChange(event.target.value as RefundReviewStatus||null)}>
          <option value="">Selecciona una decisión</option>
          {options.filter(option=>option.value&&option.value!==item.status).map(option=>
            <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <label><span>Motivo administrativo obligatorio (12 a 500 caracteres) *</span>
          <textarea aria-label="Motivo de cambio de estado" minLength={12} maxLength={500}
            value={reason} onChange={event=>setReason(event.target.value)}
            placeholder="Documenta qué se verificó y por qué se cambia el estado." rows={3} disabled={busy}/></label>
        {error&&<p role="alert" className="arf-form-error">{error}</p>}
        <button type="submit" className="arf-btn arf-btn-primary" disabled={busy||!change||reason.trim().length<12}>
          {busy?'Guardando…':'Registrar cambio de estado'}</button>
      </form>}
      <section className="arf-case-history" aria-label="Historial auditable del expediente">
        <h3>Historial administrativo</h3>
        {history.length===0?<p>Sin eventos de auditoría registrados.</p>:
          <ol>{history.map(event=><li key={event.id}><span className="arf-history-mark"><Icon name="check" size={14}/></span>
            <div><strong>{event.action==='REFUND_CASE_CREATED'?'Solicitud radicada':'Cambio de estado documentado'}</strong>
              <time>{date(event.createdAt)}</time>
              <p>{event.reason??'Sin detalle adicional.'}</p>
              <small>Responsable: {event.actorUserId??'No identificado'}</small></div>
          </li>)}</ol>}
      </section>
      <div className="arf-modal-actions"><button className="arf-btn arf-btn-outline" type="button" onClick={onClose} disabled={busy}>Cerrar expediente</button></div>
    </>}
  </RefundModal>;
}

export function AdminRefundsPage(){
  const admin=getSession();
  const canRead=admin?can(admin,'finance:read'):false;
  const canManage=admin?can(admin,'finance:manage'):false;
  const [params,setParams]=useSearchParams();
  const q=params.get('q')??'';
  const filter=params.get('status')??'';
  const status=options.some(item=>item.value===filter)?filter:'';
  const from=params.get('from')??'',to=params.get('to')??'';
  const rawPage=Number(params.get('page')??1);
  const page=Number.isFinite(rawPage)?Math.max(1,Math.min(100000,Math.floor(rawPage))):1;
  const [draft,setDraft]=useState(q);
  const [draftFrom,setDraftFrom]=useState(from);
  const [draftTo,setDraftTo]=useState(to);
  const [dateError,setDateError]=useState('');
  const [data,setData]=useState<RefundReviewPage|null>(null);
  const [loading,setLoading]=useState(canRead);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [creating,setCreating]=useState(false);
  const [selected,setSelected]=useState<string|null>(null);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{setDraft(q);setDraftFrom(from);setDraftTo(to);},[q,from,to]);
  useEffect(()=>{
    if(!canRead)return;
    let active=true;setLoading(true);setError('');
    void listRefundReviewCases({q,status,page,from,to}).then(response=>{if(active)setData(response);})
      .catch(cause=>{if(active){setData(null);setError(cause instanceof Error?cause.message:'No se pudo consultar el registro de reembolsos.');}})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[canRead,page,q,status,from,to,revision]);

  const updateFilters=(changes:{q?:string;status?:string;from?:string;to?:string;page?:number})=>{
    const next=new URLSearchParams(params);
    if(changes.q!==undefined){if(changes.q)next.set('q',changes.q);else next.delete('q');next.delete('page');}
    if(changes.status!==undefined){if(changes.status)next.set('status',changes.status);else next.delete('status');next.delete('page');}
    for(const key of ['from','to'] as const){
      if(changes[key]===undefined)continue;
      if(changes[key])next.set(key,changes[key]);else next.delete(key);
      next.delete('page');
    }
    if(changes.page!==undefined){if(changes.page>1)next.set('page',String(changes.page));else next.delete('page');}
    setParams(next,{replace:true});
  };
  const finish=(message:string)=>{
    setCreating(false);setSelected(null);setNotice(message);
    setRevision(value=>value+1);
  };
  const download=()=>{
    if(!data?.cases.length)return;
    const rows=[
      ['Caso','Asunto','Estado administrativo','Referencia reportada','Importe solicitado COP no verificado','Fecha de radicación'],
      ...data.cases.map(item=>[item.id,item.subject,statusLabels[item.status],item.externalReference??'',
        item.requestedAmountCop??'',date(item.createdAt)]),
    ];
    const blob=new Blob(['\ufeff'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='xamuko-solicitudes-reembolso-pagina.csv';link.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  if(!canRead)return <StatePanel kind="error" title="Acceso restringido"
    message="Se requiere FINANCE_READ para consultar solicitudes de reembolso."/>;
  const cards:Array<{key:RefundReviewStatus;icon:string;color:string;detail:string}>=[
    {key:'OPEN',icon:'file',color:'violet',detail:'Solicitudes radicadas'},
    {key:'IN_REVIEW',icon:'search',color:'blue',detail:'Revisión administrativa'},
    {key:'NEEDS_INFORMATION',icon:'clock',color:'amber',detail:'Esperando información'},
    {key:'CLOSED',icon:'check',color:'neutral',detail:'Cierre de expediente; no indica pago'},
  ];
  return <main className="arf-page">
    <AdminPageHeading icon="refresh" title="Reembolsos"
      description="Seguimiento de solicitudes, documentación y decisiones administrativas con trazabilidad."
      actions={<div className="arf-header-actions">
        <button className="arf-btn arf-btn-outline" type="button" onClick={()=>setRevision(v=>v+1)}>
          <Icon name="refresh" size={16}/> Actualizar</button>
        {canManage&&<button className="arf-btn arf-btn-primary" type="button" onClick={()=>setCreating(true)}>
          <Icon name="file" size={16}/> Nueva solicitud</button>}
      </div>}/>
    <FinanceSectionNav/>
    <section className="arf-scope" aria-label="Alcance del módulo de reembolsos">
      <span className="arf-scope-icon"><Icon name="shield" size={25}/></span>
      <div><strong>Gestión de solicitudes; sin devolución automática de dinero</strong>
        <p>Este módulo documenta reclamaciones para revisión. Aún no existe una pasarela de reembolsos,
          un registro de cobros entrantes ni confirmación de desembolsos. Un caso cerrado no equivale a un reembolso pagado.</p></div>
      <span className="arf-scope-tag">Sin pasarela conectada</span>
    </section>
    {notice&&<div role="status" className="arf-success"><Icon name="check" size={18}/>{notice}</div>}
    <section className="arf-kpis" aria-label="Indicadores de solicitudes reales">
      {cards.map(card=><button type="button" key={card.key} aria-pressed={status===card.key}
        className={'arf-kpi arf-kpi-'+card.color+(status===card.key?' selected':'')}
        onClick={()=>{setDraft('');setParams({status:card.key},{replace:true});}}>
        <span className="arf-kpi-icon"><Icon name={card.icon} size={23}/></span>
        <span className="arf-kpi-copy"><span>{statusLabels[card.key]}</span>
          <strong>{data?number(data.counts[card.key]):'—'}</strong><small>{card.detail}</small></span>
      </button>)}
    </section>
    <section className="arf-monitor" aria-labelledby="arf-monitor-title">
      <header className="arf-panel-header"><div><span className="arf-eyebrow">CONTROL FINANCIERO</span>
        <h2 id="arf-monitor-title">Ejecución de reembolsos</h2>
        <p>Estos indicadores necesitan comprobantes y conciliación de una fuente de pagos real.</p></div>
        <span className="arf-not-available"><Icon name="lock" size={15}/> No integrado</span></header>
      <div className="arf-financial-grid">
        <div><span>Reembolsos ejecutados y verificados</span><strong>—</strong><small>Sin registro de devoluciones bancarias o PSP</small></div>
        <div><span>Valor efectivamente reintegrado</span><strong>—</strong><small>Sin fuente de importe conciliado</small></div>
        <div><span>Tiempo de devolución financiera</span><strong>—</strong><small>Sin marcas de tiempo de pago verificadas</small></div>
      </div>
    </section>
    <section className="arf-directory" aria-labelledby="arf-directory-title">
      <header className="arf-panel-header"><div><span className="arf-eyebrow">EXPEDIENTES ADMINISTRATIVOS</span>
        <h2 id="arf-directory-title">Solicitudes y seguimiento</h2>
        <p>Consulta solicitudes registradas y sus decisiones. Los importes solicitados no son reembolsos confirmados.</p></div>
        <button type="button" className="arf-btn arf-btn-outline" disabled={loading||!data?.cases.length}
          onClick={download}><Icon name="download" size={16}/> Exportar página CSV</button></header>
      <form className="arf-filters" onSubmit={(event:FormEvent<HTMLFormElement>)=>{
        event.preventDefault();
        if(draftFrom&&draftTo&&draftFrom>draftTo){
          setDateError('La fecha inicial no puede ser posterior a la final.');return;
        }
        setDateError('');
        updateFilters({q:draft.trim(),from:draftFrom,to:draftTo});
      }}>
        <label className="arf-field"><span>Buscar expediente</span><span className="arf-search">
          <Icon name="search" size={17}/>
          <input type="search" aria-label="Buscar solicitudes de reembolso" placeholder="Asunto, referencia o contacto"
            value={draft} maxLength={100} onChange={event=>setDraft(event.target.value)}/></span></label>
        <label className="arf-field"><span>Estado de seguimiento</span><select aria-label="Estado de solicitud"
          value={status} onChange={event=>updateFilters({status:event.target.value})}>
          {options.map(opt=><option value={opt.value} key={opt.value}>{opt.label}</option>)}</select></label>
        <label className="arf-field"><span>Radicada desde · UTC</span>
          <input type="date" aria-label="Radicación desde" value={draftFrom}
            max={draftTo||undefined} onChange={event=>setDraftFrom(event.target.value)}/></label>
        <label className="arf-field"><span>Radicada hasta · UTC</span>
          <input type="date" aria-label="Radicación hasta" value={draftTo}
            min={draftFrom||undefined} onChange={event=>setDraftTo(event.target.value)}/></label>
        {dateError&&<p className="arf-date-error" role="alert">{dateError}</p>}
        <div className="arf-filter-actions">
          <button type="button" className="arf-btn arf-btn-outline" onClick={()=>{
            setDraft('');setDraftFrom('');setDraftTo('');setDateError('');
            setParams({}, {replace:true});}}>Limpiar</button>
          <button type="submit" className="arf-btn arf-btn-primary"><Icon name="search" size={16}/> Buscar</button>
        </div>
      </form>
      <div className="arf-countbar"><strong>{loading?'Consultando solicitudes…':data
        ?number(data.pagination.total)+(data.pagination.total===1?' expediente':' expedientes')
        :'Solicitudes de reembolso'}</strong>
        <span>Fuente: RefundCase · fechas de radicación UTC · indicadores históricos</span></div>
      {loading?<div className="arf-state" role="status">Consultando las solicitudes registradas…</div>
        :error?<div className="arf-error" role="alert"><Icon name="shield" size={22}/>
          <span>{error}. Esta sección requiere el backend y la migración de expedientes actualizados.</span>
          <button type="button" className="arf-btn arf-btn-outline" onClick={()=>setRevision(v=>v+1)}>Reintentar</button>
        </div>
        :!data?.cases.length?<div className="arf-empty"><Icon name="file" size={29}/>
          <strong>No hay solicitudes con estos criterios</strong>
          <p>Cuando se radiquen casos, aparecerán aquí. No se presume que existan reembolsos efectuados.</p>
          {canManage&&<button type="button" className="arf-btn arf-btn-primary" onClick={()=>setCreating(true)}>
            Registrar solicitud</button>}
        </div>:<>
          <div className="arf-table-wrap"><table className="arf-table"><thead><tr>
            <th>Asunto / referencia</th><th>Radicación</th><th>Estado</th>
            <th>Importe solicitado (no verificado)</th><th>Seguimiento</th>
          </tr></thead><tbody>{data.cases.map(item=><tr key={item.id}>
            <td><div className="arf-case-name"><span className="arf-case-avatar"><Icon name="file" size={19}/></span>
              <span><strong>{item.subject}</strong><small>{item.externalReference??'Sin referencia reportada'}</small></span></div></td>
            <td>{date(item.createdAt)}</td>
            <td><span className={'arf-status '+item.status.toLowerCase()}>{statusLabels[item.status]}</span></td>
            <td className="arf-amount">{item.requestedAmountCop?money.format(Number(item.requestedAmountCop)):'No informado'}</td>
            <td><button type="button" className="arf-open-case" onClick={()=>setSelected(item.id)}>
              <Icon name="eye" size={16}/> Ver expediente</button></td>
          </tr>)}</tbody></table></div>
          <div className="arf-case-cards">{data.cases.map(item=><article key={item.id}>
            <header><strong>{item.subject}</strong><span className={'arf-status '+item.status.toLowerCase()}>{statusLabels[item.status]}</span></header>
            <small>{item.externalReference??'Sin referencia reportada'}</small>
            <dl><div><dt>Radicada</dt><dd>{date(item.createdAt)}</dd></div>
              <div><dt>Importe solicitado · no verificado</dt><dd>{item.requestedAmountCop?money.format(Number(item.requestedAmountCop)):'No informado'}</dd></div></dl>
            <button type="button" className="arf-open-case" onClick={()=>setSelected(item.id)}>
              Ver expediente <Icon name="arrow" size={16}/></button>
          </article>)}</div>
        </>}
      {data&&data.pagination.totalPages>1&&<nav className="arf-pagination" aria-label="Páginas de solicitudes">
        <span>Página {page} de {data.pagination.totalPages}</span><div>
          <button type="button" className="arf-btn arf-btn-outline" disabled={loading||page<=1}
            onClick={()=>updateFilters({page:page-1})}>Anterior</button>
          <button type="button" className="arf-btn arf-btn-primary"
            disabled={loading||page>=data.pagination.totalPages}
            onClick={()=>updateFilters({page:page+1})}>Siguiente <Icon name="arrow" size={15}/></button></div></nav>}
      <p className="arf-directory-footer"><Icon name="shield" size={17}/>
        Los cuatro indicadores superiores cuentan expedientes administrativos, no operaciones bancarias.
        Exportar incluye únicamente la página consultada. Ninguna decisión ejecuta transferencias.</p>
    </section>
    <section className="arf-related" aria-label="Fuentes relacionadas">
      <article><span><Icon name="clock" size={22}/></span><div><h3>Transacciones</h3>
        <p>Movimientos existentes de pagos a proveedores. Una cancelación no es un reembolso.</p>
        <Link to="/transactions">Consultar transacciones <Icon name="arrow" size={16}/></Link></div></article>
      <article><span><Icon name="card" size={22}/></span><div><h3>Ingresos y facturación</h3>
        <p>Consulta qué fuentes comerciales están disponibles y cuáles necesitan integración.</p>
        <Link to="/billing">Ver control comercial <Icon name="arrow" size={16}/></Link></div></article>
      <article><span><Icon name="message" size={22}/></span><div><h3>Atención y soporte</h3>
        <p>Solicitudes de asistencia de usuarios y negocios, sin clasificarlas automáticamente como reembolsos.</p>
        <Link to="/support">Ir a soporte <Icon name="arrow" size={16}/></Link></div></article>
    </section>
    {creating&&canManage&&<NewRefundCase onClose={()=>setCreating(false)} onComplete={finish}/>}
    {selected&&<RefundCaseDetail id={selected} canManage={canManage} onClose={()=>setSelected(null)} onComplete={finish}/>}
  </main>;
}
