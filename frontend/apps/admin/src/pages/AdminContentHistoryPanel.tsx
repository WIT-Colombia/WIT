import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { getAdminContentHistory, type AdminContentHistoryRow } from '../services/adminApiClient';
import { displayDate } from './AdminContentLabels';

const actionLabel:Record<string,string>={
  ADMIN_CONTENT_HIDDEN:'Ocultado por Admin',ADMIN_CONTENT_REVIEWED:'Enviado a revisión',
  ADMIN_CONTENT_RELEASED:'Restricción levantada',ADMIN_CONTENT_DELETED:'Eliminado por Admin',
  ADMIN_CONTENT_RECOVERED:'Recuperado por Admin',ADMIN_CONTENT_UPDATED:'Información editada',
  ADMIN_CONTENT_PHOTO_REMOVED:'Fotografía retirada',OFFER_CREATED:'Creado por el negocio',
  OFFER_UPDATED:'Modificado por el negocio',OFFER_DELETED:'Eliminado por el negocio',
  OFFER_ADULT_CLASSIFICATION_CHANGED:'Clasificación de edad modificada',
};
export function AdminContentHistoryPanel({id,revision}:{id:string;revision:number}){
  const [rows,setRows]=useState<AdminContentHistoryRow[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [page,setPage]=useState(1);
  const [total,setTotal]=useState(0);
  const [moreLoading,setMoreLoading]=useState(false);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');setRows([]);setPage(1);setTotal(0);
    getAdminContentHistory(id,1).then(result=>{if(active){setRows(result.history);setTotal(result.total);}})
      .catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Historial no disponible.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[id,revision]);
  const more=async()=>{
    if(moreLoading||rows.length>=total)return;setMoreLoading(true);
    try{const result=await getAdminContentHistory(id,page+1);
      setRows(old=>[...old,...result.history]);setPage(result.page);setTotal(result.total);
    }catch(cause){setError(cause instanceof Error?cause.message:'No pudimos cargar más actuaciones.');}
    finally{setMoreLoading(false);}
  };
  return <section className="ac-card ac-history" aria-labelledby="ac-history-title">
    <div className="ac-section-head"><span className="ac-section-icon"><Icon name="clock" size={20}/></span>
      <div><h2 id="ac-history-title">Historial y trazabilidad</h2><p>Cambios de Admin y del negocio, conservados en la auditoría.</p></div></div>
    {loading?<p className="ac-muted">Consultando decisiones…</p>:
      error?<p role="alert" className="ac-modal-error">{error}</p>:
      !rows.length?<p className="ac-muted">Todavía no se registran actuaciones en este contenido.</p>:
      <><p className="ac-muted">{rows.length} de {total} actuaciones registradas</p><ol className="ac-history-list">{rows.map(row=><li key={row.id}>
        <span className="ac-history-node" aria-hidden="true"><Icon name="shield" size={15}/></span>
        <div><div className="ac-history-top"><strong>{actionLabel[row.action]??row.action}</strong>
          <time dateTime={row.createdAt}>{displayDate(row.createdAt)}</time></div>
          <small>{row.actor?.displayName??'Sistema'}</small>
          {row.reason&&<p>Motivo: {row.reason}</p>}
          {row.comment&&<p>Nota: {row.comment}</p>}
        </div></li>)}</ol>
        {rows.length<total&&<button type="button" disabled={moreLoading} className="ac-secondary ac-history-more"
          onClick={more}>{moreLoading?'Cargando…':'Cargar más actuaciones'}</button>}
      </>}
  </section>;
}
