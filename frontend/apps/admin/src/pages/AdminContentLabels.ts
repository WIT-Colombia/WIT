import type { AdminOfferRecord } from '../services/adminApiClient';
export const offerKindLabel=(kind:string)=>kind==='PRODUCT'?'Producto':kind==='SERVICE'?'Servicio':'Tipo no identificado';
export const administrativeContentLabel=(status:string|undefined|null)=>({
  NONE:'Sin restricción',HIDDEN:'Ocultado por Admin',REVIEW:'En revisión administrativa',
  DELETED:'Eliminado por Admin',
} as Record<string,string>)[status??'UNKNOWN']??'Estado administrativo no disponible';
export const contentStatusLabel=(status:string,deletedAt?:string|null,administrativeStatus?:string)=>
  deletedAt?'Eliminado':administrativeStatus&&administrativeStatus!=='NONE'?administrativeContentLabel(administrativeStatus):({
  PUBLISHED:'Publicado',REVIEW:'En revisión',UNPUBLISHED:'No publicado',
} as Record<string,string>)[status]??'Estado no identificado';
export const reportStatusLabel=(status:string)=>({
  PENDING:'Pendiente',UNDER_REVIEW:'En revisión',RESOLVED:'Resuelto',REJECTED:'Rechazado',
} as Record<string,string>)[status]??'Estado no identificado';
export const reportReasonLabel=(reason:string)=>({
  UNAVAILABLE:'No disponible',WRONG_INFORMATION:'Información incorrecta',
  WRONG_IMAGE:'Imagen incorrecta',OTHER:'Otro motivo',
} as Record<string,string>)[reason]??'Motivo no identificado';
export const displayDate=(value:string|null)=>value
  ?new Intl.DateTimeFormat('es-CO',{dateStyle:'medium'}).format(new Date(value)):'No registrado';
export function offerPrice(offer:Pick<AdminOfferRecord,'priceAmount'|'currency'|'priceText'|'negotiable'>){
  if(offer.priceAmount!==null){
    const amount=Number(offer.priceAmount);
    if(Number.isFinite(amount)){
      const price=offer.currency&&/^[A-Z]{3}$/.test(offer.currency)
        ? new Intl.NumberFormat('es-CO',{style:'currency',currency:offer.currency,maximumFractionDigits:2}).format(amount)
        : new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(amount);
      return price+(offer.negotiable?' · Negociable':'');
    }
  }
  return offer.priceText?.trim()||(offer.negotiable?'Precio negociable':'Precio no registrado');
}
