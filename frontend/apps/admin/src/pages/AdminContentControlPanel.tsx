import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon';
import { getSession } from '../services/adminService';
import { getAdminContentCapabilities, listAdminCategories, moderateAdminContent,
  updateAdminContent, removeAdminContentPhoto, type AdminContentDetail, type AdminContentControlAction,
  type AdminContentChanges, type AdminCategoryRecord } from '../services/adminApiClient';

type Action = AdminContentControlAction | 'EDIT' | 'REMOVE_PHOTO';
const labels:Record<Action,string>={
  HIDE:'Ocultar publicación',REVIEW:'Enviar a revisión',RELEASE:'Levantar restricción',
  DELETE:'Eliminar publicación',RESTORE:'Recuperar publicación',
  EDIT:'Editar información',REMOVE_PHOTO:'Retirar fotografía',
};
const confirmations:Record<Exclude<Action,'EDIT'>,string>={
  HIDE:'OCULTAR',REVIEW:'REVISAR',RELEASE:'LEVANTAR',DELETE:'ELIMINAR',
  RESTORE:'RECUPERAR',REMOVE_PHOTO:'RETIRAR',
};
const descriptions:Record<Action,string>={
  HIDE:'Retira este contenido de las vistas públicas. Su propietario no podrá volver a publicarlo mientras la medida esté vigente.',
  REVIEW:'Aparta esta publicación del catálogo público hasta que la moderación administrativa termine.',
  RELEASE:'Levanta la medida administrativa y recupera el estado previo. Nunca publica un negocio inactivo.',
  DELETE:'Eliminación lógica: retira la publicación sin borrar su auditoría. Podrá recuperarse únicamente desde Admin.',
  RESTORE:'Recupera el registro eliminado, pero lo mantiene oculto hasta levantar su restricción.',
  EDIT:'Corrige la información registrada. Las modificaciones quedan documentadas y se notifican al negocio.',
  REMOVE_PHOTO:'Retira la fotografía seleccionada del catálogo. Esta acción no ofrece recuperación desde la interfaz.',
};
const initial=(offer:AdminContentDetail)=>({
  name:offer.name,description:offer.description??'',priceAmount:offer.priceAmount??'',
  currency:offer.currency??'',priceText:offer.priceText??'',negotiable:offer.negotiable,
  adultOnly:offer.adultOnly,categoryId:offer.categoryId??'',
});

export function AdminContentControlPanel({offer,selectedPhotoId,onDone}:{
  offer:AdminContentDetail;selectedPhotoId:string|null;onDone:(message:string)=>void;
}) {
  const session=getSession();
  const [cap,setCap]=useState({canModerate:false,canDelete:false});
  const [action,setAction]=useState<Action|null>(null);
  const [categories,setCategories]=useState<AdminCategoryRecord[]>([]);
  const [draft,setDraft]=useState(()=>initial(offer));
  const [reason,setReason]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const ref=useRef<HTMLElement>(null);
  const cancelRef=useRef<HTMLButtonElement>(null);
  const busyRef=useRef(false);busyRef.current=busy;
  useEffect(()=>{
    let mounted=true;
    getAdminContentCapabilities().then(result=>{if(mounted)setCap(result);})
      .catch(()=>{if(mounted)setCap({canModerate:false,canDelete:false});});
    return()=>{mounted=false;};
  },[]);
  useEffect(()=>{
    if(!action)return;
    let active=true;setDraft(initial(offer));setReason('');setConfirmation('');setError('');
    if(action==='EDIT') listAdminCategories().then(result=>{if(active)setCategories(result);})
      .catch(()=>{if(active)setCategories([]);});
    const prev=document.body.style.overflow;
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    document.body.style.overflow='hidden';
    cancelRef.current?.focus({preventScroll:true});
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!busyRef.current){event.preventDefault();setAction(null);}
      if(event.key!=='Tab')return;
      const nodes=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')??[])
        .filter(node=>node.getClientRects().length>0);
      if(!nodes.length)return;
      if(event.shiftKey&&document.activeElement===nodes[0]){event.preventDefault();nodes[nodes.length-1].focus();}
      else if(!event.shiftKey&&document.activeElement===nodes[nodes.length-1]){event.preventDefault();nodes[0].focus();}
    };
    document.addEventListener('keydown',keydown);
    return()=>{active=false;document.removeEventListener('keydown',keydown);document.body.style.overflow=prev;previousFocus?.focus({preventScroll:true});};
  },[action,offer.id]);
  if(!session?.permissions?.includes('content:moderate:write')||!cap.canModerate)return null;
  const open=(value:Action)=>setAction(value);
  const close=()=>{if(!busy)setAction(null);};
  const save=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!action||busy||reason.trim().length<12)return;
    if(action!=='EDIT'&&confirmation!==confirmations[action])return;
    setBusy(true);setError('');
    try{
      let message='';
      if(action==='EDIT'){
        const changes:AdminContentChanges={
          name:draft.name.trim(),description:draft.description.trim()||null,
          priceAmount:draft.priceAmount.trim()||null,
          currency:draft.currency.trim()||null,priceText:draft.priceText.trim()||null,
          negotiable:draft.negotiable,adultOnly:draft.adultOnly,
          categoryId:draft.categoryId||null,
        };
        message=(await updateAdminContent(offer.id,changes,reason.trim())).message;
      }else if(action==='REMOVE_PHOTO'){
        if(!selectedPhotoId)throw new Error('Selecciona una fotografía.');
        message=(await removeAdminContentPhoto(selectedPhotoId,reason.trim())).message;
      }else message=(await moderateAdminContent(offer.id,action,reason.trim())).message;
      setAction(null);onDone(message);
    }catch(cause){setError(cause instanceof Error?cause.message:'No se pudo registrar la decisión.');}
    finally{setBusy(false);}
  };
  const available:Action[]=[
    ...(offer.canHide?['HIDE' as const]:[]),
    ...(offer.canReview?['REVIEW' as const]:[]),
    ...(offer.canRelease?['RELEASE' as const]:[]),
    ...(!offer.deletedAt?['EDIT' as const]:[]),
    ...(cap.canDelete&&offer.canDelete?['DELETE' as const]:[]),
    ...(cap.canDelete&&offer.canRestore?['RESTORE' as const]:[]),
    ...(cap.canDelete&&selectedPhotoId&&!offer.deletedAt?['REMOVE_PHOTO' as const]:[]),
  ];
  return <section className="ac-card ac-control-panel" aria-labelledby="ac-control-title">
    <div className="ac-section-head"><span className="ac-section-icon"><Icon name="shield" size={20}/></span>
      <div><h2 id="ac-control-title">Control administrativo</h2><p>Medidas con motivo, confirmación, auditoría y aviso al negocio.</p></div></div>
    <div className="ac-control-actions">{available.map(a=><button type="button" key={a}
      className={a==='DELETE'||a==='HIDE'||a==='REMOVE_PHOTO'?'ac-danger-outline':'ac-secondary'}
      onClick={()=>open(a)}><Icon name={a==='HIDE'?'eye-off':a==='EDIT'?'settings':a==='REVIEW'?'flag':
        a==='DELETE'?'close':a==='REMOVE_PHOTO'?'image':a==='RESTORE'?'refresh':'check'} size={17}/>{labels[a]}</button>)}</div>
    <p className="ac-control-note">Eliminación lógica: se conservan la trazabilidad y los reportes. El negocio no puede anular una medida de Admin.</p>
    {action&&createPortal(<div className="ac-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
      <section className="ac-modal ac-control-modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="ac-action-title" aria-describedby="ac-action-desc">
        <div className="ac-modal-top"><span className={'ac-modal-icon '+(['DELETE','HIDE','REMOVE_PHOTO'].includes(action)?'danger':'safe')}>
          <Icon name={action==='EDIT'?'settings':'shield'} size={25}/></span>
          <button type="button" className="ac-modal-close" aria-label="Cerrar" onClick={close} disabled={busy}><Icon name="close" size={18}/></button></div>
        <h2 id="ac-action-title">{labels[action]}</h2><p id="ac-action-desc">{descriptions[action]}</p>
        <p className="ac-dialog-target"><strong>{offer.name}</strong> · {offer.business.name} · {offer.internalCode}</p>
        <form className="ac-modal-form" onSubmit={save}>
          {action==='EDIT'&&<div className="ac-edit-grid">
            <label>Nombre<input required minLength={2} maxLength={180} value={draft.name}
              onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/></label>
            <label>Categoría<select value={draft.categoryId} onChange={e=>setDraft(d=>({...d,categoryId:e.target.value}))}>
              <option value="">Sin categoría específica</option>
              {categories.filter(c=>c.active||c.id===draft.categoryId).map(c=><option key={c.id} value={c.id}>{c.translations.find(t=>t.locale==='es-CO')?.name??c.translations.find(t=>t.locale==='es')?.name??c.code}</option>)}
            </select></label>
            <label className="ac-edit-wide">Descripción<textarea rows={4} maxLength={5000} value={draft.description}
              onChange={e=>setDraft(d=>({...d,description:e.target.value}))}/></label>
            <label>Precio numérico<input inputMode="decimal" pattern="[0-9]{1,10}([.][0-9]{1,2})?" value={draft.priceAmount}
              onChange={e=>setDraft(d=>({...d,priceAmount:e.target.value}))} placeholder="0.00"/></label>
            <label>Moneda<input maxLength={3} pattern="[A-Z]{3}" value={draft.currency}
              onChange={e=>setDraft(d=>({...d,currency:e.target.value.toUpperCase()}))} placeholder="COP"/></label>
            <label className="ac-edit-wide">Texto alternativo del precio<input maxLength={180} value={draft.priceText}
              onChange={e=>setDraft(d=>({...d,priceText:e.target.value}))}/></label>
            <label className="ac-check"><input type="checkbox" checked={draft.negotiable}
              onChange={e=>setDraft(d=>({...d,negotiable:e.target.checked}))}/> Precio negociable</label>
            <label className="ac-check"><input type="checkbox" checked={draft.adultOnly}
              onChange={e=>setDraft(d=>({...d,adultOnly:e.target.checked}))}/> Solo para adultos</label>
          </div>}
          <label>Motivo obligatorio (12–500 caracteres)<textarea required rows={3} minLength={12} maxLength={500}
            value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describe los hechos, la evidencia y la finalidad de la decisión."/></label>
          {action!=='EDIT'&&<label>Escribe <strong>{confirmations[action]}</strong> para confirmar
            <input required autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)}
              placeholder={confirmations[action]}/></label>}
          {error&&<p role="alert" className="ac-modal-error">{error}</p>}
          <div className="ac-modal-actions"><button type="button" ref={cancelRef} className="ac-secondary"
            disabled={busy} onClick={close}>Cancelar</button><button type="submit" disabled={busy||reason.trim().length<12||
              (action!=='EDIT'&&confirmation!==confirmations[action])}
              className={['DELETE','HIDE','REMOVE_PHOTO'].includes(action)?'ac-danger':'ac-primary'}>
              {busy?'Guardando…':'Confirmar '+(action==='EDIT'?'cambios':'acción')}</button></div>
        </form>
      </section></div>,document.body)}
  </section>;
}
