import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon';

export type PioneerDecision =
  | { action: 'CLAIM_APPROVE'|'CLAIM_REJECT'; id: string; name: string; detail: string }
  | { action: 'BRAND_VERIFY'|'BRAND_REJECT'|'ASSIGN'; id: string; name: string; detail: string };

const actions = {
  CLAIM_APPROVE: { title:'Aprobar reclamación', token:'APROBAR', danger:false,
    explanation:'Confirma la relación del reclamante con el negocio. No verifica la marca ni asigna automáticamente un cupo.' },
  CLAIM_REJECT: { title:'Rechazar reclamación', token:'RECHAZAR', danger:true,
    explanation:'Rechaza la solicitud sin borrar su expediente. La decisión quedará registrada en auditoría.' },
  BRAND_VERIFY: { title:'Verificar marca', token:'VERIFICAR', danger:false,
    explanation:'Confirma que la identidad de la marca está acreditada. La asignación del cupo requiere otra decisión.' },
  BRAND_REJECT: { title:'Rechazar verificación', token:'RECHAZAR', danger:true,
    explanation:'Registra que no pudo verificarse la identidad de la marca y notifica a los negocios relacionados.' },
  ASSIGN: { title:'Asignar reconocimiento Pionero', token:'ASIGNAR', danger:false,
    explanation:'La numeración se reserva exclusivamente desde el backend. El cupo es único y permanente: no hay acción de revocación.' },
} as const;

export function PioneerDecisionDialog({ decision, onClose, onSave }: {
  decision:PioneerDecision; onClose:()=>void; onSave:(reason:string)=>Promise<void>;
}){
  const config=actions[decision.action];
  const [reason,setReason]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const ref=useRef<HTMLElement>(null);
  const busyRef=useRef(false);busyRef.current=busy;
  useEffect(()=>{
    const prior=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!busyRef.current){event.preventDefault();onClose();}
      if(event.key!=='Tab')return;
      const elements=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')??[])
        .filter(n=>n.getClientRects().length>0);
      if(!elements.length)return;
      if(event.shiftKey&&document.activeElement===elements[0]){event.preventDefault();elements[elements.length-1].focus();}
      else if(!event.shiftKey&&document.activeElement===elements[elements.length-1]){event.preventDefault();elements[0].focus();}
    };
    document.addEventListener('keydown',onKey);
    return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=overflow;prior?.focus({preventScroll:true});};
  },[onClose]);
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(busy||reason.trim().length<12||confirm!==config.token)return;
    setBusy(true);setError('');
    try{await onSave(reason.trim());}
    catch(cause){setError(cause instanceof Error?cause.message:'La operación no se pudo completar.');}
    finally{setBusy(false);}
  };
  return createPortal(<div className="pioneer-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
    <section className="pioneer-modal" ref={ref} role="dialog" aria-modal="true"
      aria-labelledby="pioneer-dialog-title" aria-describedby="pioneer-dialog-help">
      <header><span className={'pioneer-modal-icon'+(config.danger?' danger':'')}><Icon name="shield" size={24}/></span>
        <button type="button" className="pioneer-modal-close" aria-label="Cerrar" disabled={busy} onClick={onClose}><Icon name="close" size={19}/></button></header>
      <h2 id="pioneer-dialog-title">{config.title}</h2>
      <p id="pioneer-dialog-help">{config.explanation}</p>
      <p className="pioneer-modal-subject"><strong>{decision.name}</strong><span>{decision.detail}</span></p>
      <form onSubmit={submit}>
        <label>Motivo de la decisión (12–500 caracteres)
          <textarea rows={4} required minLength={12} maxLength={500} value={reason}
            onChange={e=>setReason(e.target.value)} placeholder="Explica los hechos verificados y la razón de la decisión."/></label>
        <label>Escribe <strong>{config.token}</strong> para confirmar
          <input required autoComplete="off" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder={config.token}/></label>
        {error&&<p className="pioneer-decision-error" role="alert">{error}</p>}
        <footer><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancelar</button>
          <button type="submit" className={config.danger?'danger-outline':'primary'} disabled={busy||reason.trim().length<12||confirm!==config.token}>
            {busy?'Registrando…':config.title}</button></footer>
      </form>
    </section>
  </div>,document.body);
}
