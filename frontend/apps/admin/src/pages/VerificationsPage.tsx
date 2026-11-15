import { useCallback, useEffect, useMemo, useState } from 'react';
import { decideVerification, fetchVerificationDocument, listVerificationRequests, type AdminVerificationRequest } from '../services/adminApiClient';
import { Icon } from '../components/Icon';
import { SupportDecisionDialog } from '../components/SupportDecisionDialog';
import './VerificationsRefresh.css';

const date = (value: string) => new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));
const statusLabel: Record<string,string> = {
  PENDING:'Pendiente', INFORMATION:'Información requerida', APPROVED:'Aprobada', REJECTED:'Rechazada',
};
type Action = 'APPROVE' | 'REQUEST_INFORMATION' | 'REJECT';
const actionNames: Record<Action,{ title: string; word: string; description: string }> = {
  APPROVE: { title:'Aprobar verificación', word:'APROBAR', description:'Confirma que examinaste el documento original y el nombre comercial coincide. El negocio recibirá la decisión.' },
  REQUEST_INFORMATION: { title:'Solicitar información adicional', word:'SOLICITAR', description:'El negocio recibirá un aviso para adjuntar el documento corregido. Indica con precisión qué información falta.' },
  REJECT: { title:'Rechazar verificación', word:'RECHAZAR', description:'La solicitud será rechazada y quedará documentado el motivo de la decisión.' },
};

export function VerificationsPage() {
  const [items,setItems]=useState<AdminVerificationRequest[]>([]);
  const [selected,setSelected]=useState<AdminVerificationRequest|null>(null);
  const [filter,setFilter]=useState('ALL');
  const [query,setQuery]=useState('');
  const [nameConfirmed,setNameConfirmed]=useState(false);
  const [action,setAction]=useState<Action|null>(null);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [pdfUrl,setPdfUrl]=useState<string|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try {
      const response=await listVerificationRequests();
      setItems(response.requests);
      setSelected(current=>current?response.requests.find(r=>r.id===current.id)??null:null);
    }catch(cause){setError(cause instanceof Error?cause.message:'No se pudieron consultar las verificaciones.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    setNameConfirmed(false);
    setPdfUrl(null);
    if(!selected)return;
    let active=true;let objectUrl:string|null=null;
    void fetchVerificationDocument(selected.id).then(blob=>{
      objectUrl=URL.createObjectURL(blob);
      if(active)setPdfUrl(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch(()=>{if(active)setPdfUrl('unavailable');});
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[selected?.id]);
  const visible=useMemo(()=>items.filter(r=>(filter==='ALL'||r.status===filter) &&
    (!query.trim()||r.businessNameAtRequest.toLocaleLowerCase('es-CO').includes(query.trim().toLocaleLowerCase('es-CO')))),
    [items,filter,query]);
  const counts={
    pending:items.filter(r=>r.status==='PENDING').length,
    information:items.filter(r=>r.status==='INFORMATION').length,
  };
  const decide=async(reason:string)=>{
    if(!selected||!action||busy)return;
    setBusy(true);setError('');
    try{
      await decideVerification(selected.id,action,reason,nameConfirmed);
      setAction(null);setSelected(null);setNameConfirmed(false);
      setMessage('La decisión quedó registrada y se generó una notificación para el solicitante y los propietarios activos.');
      await load();
    }catch(cause){setError(cause instanceof Error?cause.message:'No fue posible aplicar la decisión.');throw cause;}
    finally{setBusy(false);}
  };
  return <section className="vr-page" aria-labelledby="vr-title">
    <header className="admin-section-heading"><h1 id="vr-title">Verificaciones</h1></header>
    <div className="vr-stats"><article><Icon name="shield" size={21}/><div><strong>{counts.pending}</strong><span>Pendientes de revisión</span></div></article>
      <article><Icon name="file" size={21}/><div><strong>{counts.information}</strong><span>Esperando información</span></div></article></div>
    <div className="vr-toolbar"><label>Buscar negocio<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Nombre comercial" /></label>
      <label>Estado<select value={filter} onChange={event=>setFilter(event.target.value)}><option value="ALL">Todos los abiertos</option><option value="PENDING">Pendientes</option><option value="INFORMATION">Información requerida</option></select></label>
      <button type="button" onClick={()=>void load()} disabled={loading}><Icon name="refresh" size={16}/> Actualizar</button></div>
    {message&&<p className="vr-success" role="status">{message}</p>}
    {error&&<p className="vr-error" role="alert">{error}</p>}
    {loading?<p className="vr-empty" role="status">Consultando solicitudes…</p>:visible.length===0?
      <div className="vr-empty"><Icon name="check" size={28}/><h2>Sin verificaciones pendientes</h2><p>No hay solicitudes que coincidan con estos filtros.</p></div>:
      <div className="vr-layout">
        <div className="vr-list">{visible.map(item=><article key={item.id} className={'vr-item'+(selected?.id===item.id?' selected':'')}>
          <div className="vr-item-top"><span className="vr-avatar"><Icon name="store" size={22}/></span>
            <div><strong>{item.businessNameAtRequest}</strong><small>{item.requester?.displayName??'Solicitante'} · {date(item.requestedAt)}</small></div>
            <span className={'vr-status '+item.status.toLowerCase()}>{statusLabel[item.status]??'Estado no identificado'}</span></div>
          <div className="vr-item-footer"><span>Documento: {item.documentType}</span>
            <button type="button" aria-expanded={selected?.id===item.id} onClick={()=>setSelected(current=>current?.id===item.id?null:item)}>
              {selected?.id===item.id?'Cerrar detalle':'Revisar solicitud'} <Icon name="arrow" size={16}/></button></div>
        </article>)}</div>
        {selected&&<section className="vr-detail" aria-label="Revisión documental">
          <header><div><h2>{selected.businessNameAtRequest}</h2><p>Solicitante: {selected.requester?.displayName??'Sin nombre registrado'}</p></div>
            <button type="button" aria-label="Cerrar ficha" onClick={()=>setSelected(null)}><Icon name="close" size={18}/></button></header>
          <div className="vr-document"><div><strong>Documento presentado</strong><span>{selected.documentType} · Revisión protegida</span></div>
            {pdfUrl==='unavailable'?<div className="vr-document-placeholder">El documento ya no está disponible. No apruebes una verificación sin comprobarlo.</div>:
              pdfUrl?<iframe title="Documento de verificación del negocio" src={pdfUrl}/>:
              <div className="vr-document-placeholder">Cargando documento…</div>}</div>
          <label className="vr-confirm"><input type="checkbox" checked={nameConfirmed} onChange={event=>setNameConfirmed(event.target.checked)}/>
            Confirmo que revisé el documento y que el nombre comercial coincide plenamente.</label>
          <div className="vr-actions">
            <button type="button" className="vr-approve" disabled={busy||!nameConfirmed||!pdfUrl||pdfUrl==='unavailable'}
              onClick={()=>setAction('APPROVE')}><Icon name="check" size={17}/> Aprobar verificación</button>
            <button type="button" disabled={busy} onClick={()=>setAction('REQUEST_INFORMATION')}>Solicitar información</button>
            <button type="button" className="vr-danger" disabled={busy} onClick={()=>setAction('REJECT')}>Rechazar</button>
          </div>
        </section>}
      </div>}
    {action&&selected&&<SupportDecisionDialog title={actionNames[action].title} description={actionNames[action].description}
      affected={selected.businessNameAtRequest} confirmWord={actionNames[action].word}
      onClose={()=>setAction(null)} onConfirm={decide}/>}
  </section>;
}
