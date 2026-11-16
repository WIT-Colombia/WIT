import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon';
import { moderateAdminContentBulk } from '../services/adminApiClient';

export function AdminContentBulkDialog({ids,action,onClose,onDone}:{
  ids:string[];action:'HIDE'|'REVIEW';onClose:()=>void;
  onDone:(result:{succeeded:number;failed:number;errors:string[]})=>void;
}) {
  const [reason,setReason]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const modal=useRef<HTMLElement>(null);
  const busyRef=useRef(false);busyRef.current=busy;
  const word=action==='HIDE'?'OCULTAR':'REVISAR';
  useEffect(()=>{
    const before=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    modal.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
    const handle=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!busyRef.current){event.preventDefault();onClose();}
      if(event.key!=='Tab')return;
      const nodes=Array.from(modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')??[])
        .filter(n=>n.getClientRects().length>0);
      if(!nodes.length)return;
      if(event.shiftKey&&document.activeElement===nodes[0]){event.preventDefault();nodes[nodes.length-1].focus();}
      else if(!event.shiftKey&&document.activeElement===nodes[nodes.length-1]){event.preventDefault();nodes[0].focus();}
    };
    document.addEventListener('keydown',handle);
    return()=>{document.removeEventListener('keydown',handle);document.body.style.overflow=overflow;before?.focus({preventScroll:true});};
  },[onClose]);
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(busy||confirmation!==word||reason.trim().length<12)return;
    setBusy(true);setError('');
    try{
      const result=await moderateAdminContentBulk(ids,action,reason.trim());
      onDone({succeeded:result.succeeded,failed:result.failed,
        errors:result.results.filter(x=>!x.ok).map(x=>x.id+': '+x.message)});
    }catch(cause){setError(cause instanceof Error?cause.message:'No se pudieron procesar las publicaciones.');}
    finally{setBusy(false);}
  };
  return createPortal(<div className="ac-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
    <section ref={modal} className="ac-modal" role="dialog" aria-modal="true"
      aria-labelledby="ac-bulk-title" aria-describedby="ac-bulk-description">
      <div className="ac-modal-top"><span className="ac-modal-icon danger"><Icon name="shield" size={23}/></span>
        <button type="button" className="ac-modal-close" aria-label="Cerrar" disabled={busy} onClick={onClose}><Icon name="close" size={18}/></button></div>
      <h2 id="ac-bulk-title">{action==='HIDE'?'Ocultar':'Revisar'} {ids.length} publicaciones</h2>
      <p id="ac-bulk-description">La operación se registrará individualmente en la auditoría. Si algún registro cambió, se indicará el error sin ocultar los resultados de los demás.</p>
      <form className="ac-modal-form" onSubmit={submit}>
        <label>Motivo de la decisión (12–500 caracteres)<textarea rows={3} minLength={12} maxLength={500}
          required value={reason} onChange={e=>setReason(e.target.value)}/></label>
        <label>Escribe <strong>{word}</strong> para confirmar<input value={confirmation}
          autoComplete="off" onChange={e=>setConfirmation(e.target.value)} required/></label>
        {error&&<p role="alert" className="ac-modal-error">{error}</p>}
        <div className="ac-modal-actions"><button type="button" className="ac-secondary" disabled={busy}
          onClick={onClose}>Cancelar</button><button type="submit" className={action==='HIDE'?'ac-danger':'ac-primary'}
          disabled={busy||confirmation!==word||reason.trim().length<12}>{busy?'Procesando…':'Confirmar acción'}</button></div>
      </form>
    </section></div>,document.body);
}
