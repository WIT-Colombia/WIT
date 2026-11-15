import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { SupportDecisionDialog } from '../components/SupportDecisionDialog';
import { listReviewReports, moderateReviewReport, type AdminReviewReport } from '../services/adminApiClient';
import { getSession } from '../services/adminService';
import './ReviewReportsRefresh.css';

type Decision = { report: AdminReviewReport; status: 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED'; reviewStatus?: 'HIDDEN' | 'PUBLISHED' | 'REMOVED'; label: string; word: string };
const statuses: Record<string,string> = {
  PENDING:'Pendiente', UNDER_REVIEW:'En revisión', RESOLVED:'Resuelto', REJECTED:'Rechazado',
};
const reasons: Record<string,string> = {
  OFFENSIVE:'Contenido ofensivo', SPAM:'Publicidad no deseada',
  FALSE_INFORMATION:'Información falsa', PERSONAL_DATA:'Datos personales', OTHER:'Otro motivo',
};
const date=(iso:string)=>new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));

export function ReviewReportsPage() {
  const [reports,setReports]=useState<AdminReviewReport[]>([]);
  const [status,setStatus]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [decision,setDecision]=useState<Decision|null>(null);
  const [busy,setBusy]=useState(false);
  const canModerate=getSession()?.permissions?.includes('content:moderate:write')??false;
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try {setReports((await listReviewReports(status)).reports);}
    catch(cause){setError(cause instanceof Error?cause.message:'No se pudieron consultar los reportes.');}
    finally{setLoading(false);}
  },[status]);
  useEffect(()=>{void load();},[load]);
  const pending=useMemo(()=>reports.filter(item=>item.status==='PENDING'||item.status==='UNDER_REVIEW').length,[reports]);
  const submit=async(reason:string)=>{
    if(!decision||busy)return;
    setBusy(true);setError('');
    try{
      await moderateReviewReport(decision.report.id,decision.status,decision.reviewStatus,reason);
      setDecision(null);
      setNotice('Decisión registrada. Se notificará al denunciante y, cuando cambie la publicación, al autor y a los propietarios del negocio.');
      await load();
    }catch(cause){setError(cause instanceof Error?cause.message:'No se pudo registrar la decisión.');throw cause;}
    finally{setBusy(false);}
  };
  const actions=(report:AdminReviewReport):Decision[]=>[
    {report,status:'UNDER_REVIEW',label:'Iniciar revisión',word:'REVISAR'},
    {report,status:'RESOLVED',reviewStatus:'HIDDEN',label:'Ocultar opinión',word:'OCULTAR'},
    {report,status:'RESOLVED',reviewStatus:'PUBLISHED',label:'Mantener o restaurar',word:'PUBLICAR'},
    {report,status:'RESOLVED',reviewStatus:'REMOVED',label:'Retirar opinión',word:'RETIRAR'},
    {report,status:'REJECTED',label:'Rechazar reporte',word:'RECHAZAR'},
  ];
  return <section className="rr-page" aria-labelledby="rr-title">
    <header className="admin-section-heading"><h1 id="rr-title">Reportes de comentarios</h1></header>
    <div className="rr-summary"><div><span className="rr-icon"><Icon name="flag" size={21}/></span><strong>{pending}</strong><span>Requieren atención</span></div>
      <div><span className="rr-icon"><Icon name="check" size={21}/></span><strong>{reports.length}</strong><span>Reportes mostrados</span></div></div>
    <div className="rr-toolbar"><label>Estado<select value={status} onChange={e=>setStatus(e.target.value)}>
      <option value="">Todos los estados</option><option value="PENDING">Pendientes</option><option value="UNDER_REVIEW">En revisión</option>
      <option value="RESOLVED">Resueltos</option><option value="REJECTED">Rechazados</option></select></label>
      <button type="button" onClick={()=>void load()} disabled={loading}><Icon name="refresh" size={16}/> Actualizar</button></div>
    {notice&&<p className="rr-success" role="status">{notice}</p>}
    {error&&<p className="rr-error" role="alert">{error}</p>}
    {loading?<p className="rr-empty" role="status">Consultando reportes…</p>:reports.length===0?
      <div className="rr-empty"><Icon name="check" size={27}/><h2>Sin reportes</h2><p>No existen opiniones reportadas con estos filtros.</p></div>:
      <div className="rr-list">{reports.map(report=><article className="rr-card" key={report.id}>
        <div className="rr-head"><span className="rr-card-icon"><Icon name="message" size={20}/></span>
          <div><h2>{report.review.business.name}</h2><small>{date(report.createdAt)} · Opinión de {report.review.user.displayName}</small></div>
          <span className={'rr-badge '+report.status.toLowerCase()}>{statuses[report.status]??'Estado no identificado'}</span></div>
        <div className="rr-comment"><div><span>Calificación</span><strong>{report.review.rating} ★</strong></div><p>{report.review.comment}</p></div>
        <dl><div><dt>Motivo</dt><dd>{reasons[report.reason]??'Otro motivo'}</dd></div>
          <div><dt>Reportado por</dt><dd>{report.reporter.displayName}</dd></div>
          {report.description&&<div className="rr-description"><dt>Detalles</dt><dd>{report.description}</dd></div>}</dl>
        {canModerate&& !['RESOLVED','REJECTED'].includes(report.status)&&
          <div className="rr-actions">{actions(report).filter(item=>item.status!=='UNDER_REVIEW'||report.status==='PENDING').map(item=>
            <button key={item.word} className={item.reviewStatus==='REMOVED'?'rr-danger':''}
              type="button" disabled={busy} onClick={()=>setDecision(item)}>{item.label}</button>)}</div>}
        {!canModerate&&<p className="rr-muted">La cuenta tiene permiso de consulta, pero no de moderación.</p>}
      </article>)}</div>}
    {decision&&<SupportDecisionDialog
      title={decision.label} description={decision.status==='UNDER_REVIEW'
        ?'Comienza la revisión del reporte sin modificar la opinión.'
        :decision.status==='REJECTED'?'Cierra el reporte sin modificar el estado de la opinión.'
        :'Se cerrará el reporte y se aplicará la medida seleccionada sobre la opinión.'}
      affected={decision.report.review.business.name} confirmWord={decision.word}
      onClose={()=>setDecision(null)} onConfirm={submit}/>}
  </section>;
}
