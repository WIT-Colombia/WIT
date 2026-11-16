import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { sendTransactionalEmail } from '../../shared/email/email-service.js';
import { effectiveStatus } from './zone-policy.service.js';

const publicOrigin=(env.nodeEnv==='production'?'https://api.xamuko.com':env.googleBackendUrl).replace(/\/+$/,'');
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const safe=(s:string)=>s.replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
})[ch]??ch);
const dateCO=(date:Date)=>date.toLocaleString('es-CO',{
  dateStyle:'long',timeStyle:'short',timeZone:'America/Bogota',
});

export async function subscribeZoneInterest(input:{zoneKey:string;email:string;consent:boolean}){
  if(!input.consent)throw new AppError(400,'ZONE_CONSENT_REQUIRED','Debes aceptar recibir el aviso de apertura.');
  const email=input.email.trim().toLowerCase();
  if(email.length>320||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AppError(400,'ZONE_EMAIL_INVALID','Ingresa una dirección de correo electrónico válida.');
  if(input.zoneKey.length>240)throw new AppError(400,'ZONE_INVALID','Territorio inválido.');
  const zone=await prisma.expansionZone.findUnique({where:{key:input.zoneKey}});
  if(!zone||effectiveStatus(zone)!=='SCHEDULED'||!zone.opensAt)
    throw new AppError(409,'ZONE_NOT_SCHEDULED','Esta zona no tiene una apertura futura programada.');
  const existing=await prisma.zoneOpeningInterest.findUnique({
    where:{zoneKey_emailNormalized:{zoneKey:input.zoneKey,emailNormalized:email}},
  });
  // Avoid spam to already confirmed recipients.
  if(existing?.confirmedAt)return {ok:true,message:'Si corresponde, tu suscripción está confirmada.'};
  if(existing && Date.now()-existing.updatedAt.getTime()<10*60*1000)
    return {ok:true,message:'Si solicitaste el aviso, revisa tu correo para confirmar.'};
  const token=randomBytes(32).toString('hex');
  const unsubscribeToken=randomBytes(32).toString('hex');
  const value=await prisma.zoneOpeningInterest.upsert({
    where:{zoneKey_emailNormalized:{zoneKey:zone.key,emailNormalized:email}},
    update:{confirmationHash:sha(token),consentAt:new Date(),unsubscribeToken},
    create:{zoneKey:zone.key,emailNormalized:email,confirmationHash:sha(token),
      consentAt:new Date(),unsubscribeToken},
  });
  const link=publicOrigin+'/api/v1/public/zones/confirm?token='+encodeURIComponent(token);
  const title=safe(zone.name);
  await sendTransactionalEmail({
    to:email,subject:'Confirma tu aviso de apertura en XAMUKO',
    text:'Solicitaste un aviso para cuando XAMUKO abra en '+zone.name+
      '. Confirma tu correo en el siguiente enlace: '+link+
      '\nSi no lo solicitaste, ignora este mensaje. El enlace caduca en 48 horas.',
    html:'<h1>Confirma tu aviso de XAMUKO</h1><p>¿Quieres saber cuándo abramos en <strong>'+
      title+'</strong>?</p><p><a href="'+safe(link)+'">Confirmar mi correo</a></p>'+
      '<p>Si no solicitaste este aviso, ignora el correo. El enlace caduca en 48 horas.</p>',
    eventType:'zone_opening_confirmation',idempotencyKey:'zone_confirm/'+value.id+'/'+sha(token),
  });
  return {ok:true,message:'Revisa tu correo y confirma tu suscripción para recibir el aviso.'};
}
export async function confirmZoneInterest(token:string){
  if(!/^[0-9a-f]{64}$/.test(token))throw new AppError(400,'ZONE_TOKEN_INVALID','El enlace no es válido.');
  const record=await prisma.zoneOpeningInterest.findFirst({where:{confirmationHash:sha(token)}});
  if(!record||Date.now()-record.updatedAt.getTime()>48*3600000)
    throw new AppError(410,'ZONE_TOKEN_EXPIRED','El enlace caducó. Solicita un nuevo aviso de apertura.');
  if(!record.confirmedAt)
    await prisma.zoneOpeningInterest.update({where:{id:record.id},data:{confirmedAt:new Date()}});
  return {title:'Suscripción confirmada',
    message:'Te avisaremos por correo cuando XAMUKO abra la zona que seleccionaste.'};
}
export async function unsubscribeZoneInterest(token:string){
  if(!/^[0-9a-f]{64}$/.test(token))
    throw new AppError(400,'ZONE_TOKEN_INVALID','El enlace no es válido.');
  await prisma.zoneOpeningInterest.deleteMany({where:{unsubscribeToken:token}});
  return {title:'Suscripción cancelada',
    message:'Ya no recibirás este aviso de apertura.'};
}
export function zoneEmailResultHtml(title:string,message:string){
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+safe(title)+' | XAMUKO</title></head>'+
    '<body style="background:#f6f7fd;color:#152c50;font-family:Arial,sans-serif;padding:36px 15px">'+
    '<main style="background:#fff;max-width:560px;margin:0 auto;padding:28px;border-radius:16px;box-shadow:0 8px 24px #2a3d6c14">'+
    '<h1>'+safe(title)+'</h1><p>'+safe(message)+'</p>'+
    '<a href="https://xamuko.com" style="display:inline-block;margin-top:15px;background:#7153df;color:#fff;padding:12px 17px;border-radius:9px;text-decoration:none">Ir a XAMUKO</a>'+
    '</main></body></html>';
}

let running=false;
/** Periodic idempotent delivery: no scheduled web request or active Admin session needed. */
export async function dispatchDueZoneOpenings(now=new Date()){
  if(running)return;
  running=true;
  try{
    const openZones=await prisma.expansionZone.findMany({where:{
      OR:[{status:'ACTIVE'},{status:'SCHEDULED',opensAt:{lte:now}}],
    },select:{key:true,name:true,opensAt:true}});
    const byKey=new Map(openZones.map(zone=>[zone.key,zone]));
    if(!byKey.size)return;
    const pending=await prisma.zoneOpeningInterest.findMany({
      where:{zoneKey:{in:[...byKey.keys()]},confirmedAt:{not:null},notifiedAt:null,
        OR:[{notificationLeaseAt:null},{notificationLeaseAt:{lt:new Date(now.getTime()-5*60000)}}]},
      orderBy:{createdAt:'asc'},take:30,
    });
    for(const interest of pending){
      const zone=byKey.get(interest.zoneKey);
      if(!zone)continue;
      const claimed=await prisma.zoneOpeningInterest.updateMany({
        where:{id:interest.id,notifiedAt:null,
          OR:[{notificationLeaseAt:null},{notificationLeaseAt:{lt:new Date(now.getTime()-5*60000)}}]},
        data:{notificationLeaseAt:now},
      });
      if(!claimed.count)continue;
      const link=publicOrigin+'/api/v1/public/zones/unsubscribe?token='+encodeURIComponent(interest.unsubscribeToken);
      try{
        await sendTransactionalEmail({
          to:interest.emailNormalized,subject:'¡XAMUKO ya está disponible en '+zone.name+'!',
          text:'¡Ya puedes explorar negocios locales en '+zone.name+' desde XAMUKO!'+
            (zone.opensAt?' Apertura: '+dateCO(zone.opensAt)+'.':'')+
            '\nExplora: https://xamuko.com\nCancelar avisos: '+link,
          html:'<h1>¡XAMUKO llegó a '+safe(zone.name)+'!</h1>'+
            '<p>Ya puedes explorar los negocios de esta zona.</p>'+
            '<p><a href="https://xamuko.com">Explorar XAMUKO</a></p>'+
            '<small><a href="'+safe(link)+'">Cancelar suscripción</a></small>',
          eventType:'zone_opening_notice',idempotencyKey:'zone_open/'+interest.id,
        });
        await prisma.zoneOpeningInterest.update({
          where:{id:interest.id},data:{notifiedAt:new Date(),notificationLeaseAt:null},
        });
      }catch(error){
        await prisma.zoneOpeningInterest.updateMany({
          where:{id:interest.id,notifiedAt:null},data:{notificationLeaseAt:null},
        });
        console.error('Error enviando aviso de apertura de zona:',error);
      }
    }
    // Retain only a short history after notification; minimize stored email addresses.
    await prisma.zoneOpeningInterest.deleteMany({
      where:{notifiedAt:{lt:new Date(now.getTime()-30*86400000)}},
    });
  }finally{running=false;}
}
export function startZoneOpeningNotificationScheduler(){
  const run=()=>{void dispatchDueZoneOpenings().catch(e=>console.error('Zona: envío de aperturas no disponible',e));};
  run();
  const timer=setInterval(run,60000);
  timer.unref();
  return()=>clearInterval(timer);
}
