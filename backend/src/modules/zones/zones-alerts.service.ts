import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { sendTransactionalEmail } from '../../shared/email/email-service.js';
import { colombiaCatalog } from './colombia-catalog.js';
import { zoneState, type ZoneScope } from './zones.service.js';
import { dispatchRegisteredZoneLaunchAlerts } from './zones-user-alerts.service.js';

const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
const expireMs=48*60*60*1000;
const retryMs=5*60*1000;
const escapeHtml=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const apiHost=env.nodeEnv==='production'?'https://api.xamuko.com':env.googleBackendUrl;
function alertLocation(scope:ZoneScope,code:string){
  if(scope==='DEPARTMENT')return colombiaCatalog.departments.find(d=>d.code===code);
  return colombiaCatalog.municipalities.find(m=>m.id===code);
}
const makeLink=(suffix:string)=>new URL('/api/v1/public/zones/alerts/'+suffix,apiHost).toString();
function optoutToken(id:string){
  return createHmac('sha256',env.accessTokenSecret).update('xamuko-zone-alert-unsubscribe/'+id).digest('hex');
}
export async function subscribeToZoneAlert(input:{
  scope:ZoneScope; code:string; email:string; consent:boolean;
}){
  if(!input.consent)throw new AppError(400,'ZONE_ALERT_CONSENT_REQUIRED','Se necesita autorización voluntaria para recibir el aviso.');
  const email=input.email.trim().toLocaleLowerCase('en-US');
  if(email.length>320||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AppError(400,'ZONE_ALERT_INVALID_EMAIL','Escribe un correo válido.');
  const location=alertLocation(input.scope,input.code);
  if(!location)throw new AppError(400,'INVALID_ZONE','Selecciona una zona colombiana válida.');
  const [records,existing]=await Promise.all([
    prisma.zoneLaunch.findMany({select:{scope:true,code:true,state:true,opensAt:true}}),
    prisma.zoneLaunchAlert.findUnique({where:{scope_code_emailNormalized:{
      scope:input.scope,code:input.code,emailNormalized:email,
    }}}),
  ]);
  if(zoneState(input.scope,input.code,records).state==='OPEN')
    throw new AppError(409,'ZONE_ALREADY_OPEN','Esta zona ya está habilitada. Puedes explorarla ahora.');
  if(existing?.confirmedAt&&!existing.unsubscribedAt)return {ok:true};
  // Resist email flooding by retaining the last unexpired confirmation challenge.
  if(existing&&!existing.confirmedAt&&existing.confirmExpiresAt>new Date()&&!existing.unsubscribedAt)
    return {ok:true};
  const token=randomBytes(32).toString('hex');
  const tokenHash=hash(token);
  const expiresAt=new Date(Date.now()+expireMs);
  await prisma.zoneLaunchAlert.upsert({
    where:{scope_code_emailNormalized:{scope:input.scope,code:input.code,emailNormalized:email}},
    create:{scope:input.scope,code:input.code,emailNormalized:email,confirmTokenHash:tokenHash,confirmExpiresAt:expiresAt},
    update:{confirmedAt:null,notifiedAt:null,unsubscribedAt:null,confirmTokenHash:tokenHash,confirmExpiresAt:expiresAt,lastDispatchAttempt:null},
  });
  const title=location.name;
  const url=makeLink('confirm?token='+token);
  try{
    await sendTransactionalEmail({
      to:email,eventType:'zone_launch_confirm',idempotencyKey:'zone_launch_confirm/'+tokenHash,
      subject:'Confirma tu aviso de XAMUKO en '+title,
      text:'Solicitaste recibir un aviso cuando XAMUKO abra en '+title+'. Confirma tu correo: '+url+
        '\nEste enlace vence en 48 horas. Si no hiciste la solicitud, ignora este mensaje.',
      html:'<div style="font-family:Arial,sans-serif;max-width:580px;margin:auto;padding:28px;color:#263a5c">'+
        '<h1 style="font-size:23px;color:#5536b0">XAMUKO llegará a '+escapeHtml(title)+'</h1>'+
        '<p>Confirma que quieres recibir un único aviso cuando esté disponible la zona.</p>'+
        '<p><a style="background:#6d4ad0;color:white;padding:12px 18px;border-radius:9px;text-decoration:none" href="'+escapeHtml(url)+'">Confirmar aviso</a></p>'+
        '<p style="font-size:12px;color:#63728f">Enlace válido durante 48 horas. Si no lo pediste, ignora este correo.</p></div>',
    });
  }catch(error){
    await prisma.zoneLaunchAlert.updateMany({where:{confirmTokenHash:tokenHash},data:{confirmExpiresAt:new Date(0)}});
    throw error;
  }
  return {ok:true};
}
export async function confirmZoneAlert(token:string){
  if(!/^[a-f0-9]{64}$/.test(token))throw new AppError(400,'ZONE_ALERT_INVALID_TOKEN','El enlace no es válido.');
  const now=new Date(),tokenHash=hash(token);
  const candidate=await prisma.zoneLaunchAlert.findUnique({where:{confirmTokenHash:tokenHash}});
  if(!candidate||candidate.confirmedAt||candidate.unsubscribedAt||candidate.confirmExpiresAt<=now)
    throw new AppError(400,'ZONE_ALERT_INVALID_TOKEN','El enlace no es válido o ha vencido.');
  const change=await prisma.zoneLaunchAlert.updateMany({where:{
    id:candidate.id,confirmedAt:null,unsubscribedAt:null,confirmExpiresAt:{gt:now}},
    data:{confirmedAt:now},
  });
  if(change.count!==1)throw new AppError(409,'ZONE_ALERT_ALREADY_CONFIRMED','El enlace ya fue utilizado.');
  return {ok:true};
}
export async function unsubscribeZoneAlert(id:string,token:string){
  const expected=optoutToken(id);
  const a=Buffer.from(expected,'hex'),b=Buffer.from(token,'hex');
  if(!/^[a-f0-9]{64}$/.test(token)||a.length!==b.length||!timingSafeEqual(a,b))
    throw new AppError(400,'ZONE_ALERT_INVALID_TOKEN','El enlace de cancelación es inválido.');
  const result=await prisma.zoneLaunchAlert.updateMany({where:{id},data:{unsubscribedAt:new Date()}});
  if(!result.count)throw new AppError(404,'ZONE_ALERT_NOT_FOUND','La suscripción no existe.');
  return {ok:true};
}
export function zoneAlertHtml(title:string,message:string,form?:{action:string;label:string}){
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+escapeHtml(title)+' - XAMUKO</title></head><body style="margin:0;background:#f3f4fb;font-family:Arial,sans-serif;color:#283857">'+
    '<main style="max-width:550px;margin:10vh auto;padding:30px;background:white;border:1px solid #e2e5f5;border-radius:15px;text-align:center">'+
    '<h1 style="color:#6949c5">'+escapeHtml(title)+'</h1><p>'+escapeHtml(message)+'</p>'+
    (form?'<form action="'+escapeHtml(form.action)+'" method="post"><button style="border:0;border-radius:9px;background:#7248d6;color:#fff;padding:13px 18px;font-size:15px;cursor:pointer" type="submit">'+escapeHtml(form.label)+'</button></form>':'')+
    '<p><a href="https://xamuko.com" style="color:#6246b5">Volver a XAMUKO</a></p></main></body></html>';
}
export async function dispatchZoneLaunchAlerts(){
  const now=new Date();
  const [records,alerts]=await Promise.all([
    prisma.zoneLaunch.findMany({select:{scope:true,code:true,state:true,opensAt:true}}),
    prisma.zoneLaunchAlert.findMany({where:{
      confirmedAt:{not:null},notifiedAt:null,unsubscribedAt:null,
      OR:[{lastDispatchAttempt:null},{lastDispatchAttempt:{lt:new Date(now.getTime()-retryMs)}}],
    },orderBy:{createdAt:'asc'},take:60}),
  ]);
  let sent=0;
  for(const alert of alerts){
    if(zoneState(alert.scope,alert.code,records,now).state!=='OPEN')continue;
    const claimed=await prisma.zoneLaunchAlert.updateMany({where:{
      id:alert.id,notifiedAt:null,unsubscribedAt:null,
      OR:[{lastDispatchAttempt:null},{lastDispatchAttempt:{lt:new Date(now.getTime()-retryMs)}}],
    },data:{lastDispatchAttempt:now}});
    if(!claimed.count)continue;
    const title=alertLocation(alert.scope,alert.code)?.name??'tu ciudad';
    const optout=makeLink('unsubscribe?id='+encodeURIComponent(alert.id)+'&token='+optoutToken(alert.id));
    try{
      await sendTransactionalEmail({
        to:alert.emailNormalized,eventType:'zone_launch_open',idempotencyKey:'zone_launch_open/'+alert.id,
        subject:'¡XAMUKO ya está disponible en '+title+'!',
        text:'¡La espera terminó! XAMUKO ya permite explorar negocios físicos en '+title+
          '. Visítanos: https://user.xamuko.com/home'+
          '\nNo volveremos a enviarte avisos por esta apertura. Cancelar suscripción: '+optout,
        html:'<div style="font-family:Arial,sans-serif;max-width:580px;margin:auto;padding:28px;color:#263a5c">'+
          '<h1 style="font-size:25px;color:#5536b0">¡XAMUKO ya llegó a '+escapeHtml(title)+'!</h1>'+
          '<p>Ya puedes descubrir negocios físicos de esta zona y opciones virtuales para toda Colombia.</p>'+
          '<p><a href="https://user.xamuko.com/home" style="background:#704ad4;padding:12px 18px;border-radius:9px;color:#fff;text-decoration:none">Explorar XAMUKO</a></p>'+
          '<p style="font-size:12px;color:#7a859d">Te enviamos este mensaje porque lo autorizaste. '+
          '<a href="'+escapeHtml(optout)+'">Cancelar avisos</a></p></div>',
      });
      await prisma.zoneLaunchAlert.updateMany({where:{id:alert.id,notifiedAt:null},data:{notifiedAt:new Date()}});
      sent++;
    }catch(e){console.error('No se pudo entregar aviso de zona',{code:alert.code,id:alert.id});}
  }
  // Delete unconfirmed contact details 30 days after the last expiry.
  await prisma.zoneLaunchAlert.deleteMany({where:{confirmedAt:null,confirmExpiresAt:{lt:new Date(now.getTime()-30*86400000)}}});
  return {sent};
}
export function startZoneLaunchAlertScheduler(){
  let busy=false;
  const run=async()=>{
    if(busy)return;busy=true;
    try{await dispatchZoneLaunchAlerts();}
    catch(e){console.error('Error al revisar avisos de aperturas territoriales por correo',e instanceof Error?e.message:'error');}
    try{await dispatchRegisteredZoneLaunchAlerts();}
    catch(e){console.error('Error al revisar notificaciones de aperturas para usuarios',e instanceof Error?e.message:'error');}
    finally{busy=false;}
  };
  void run();
  const timer=setInterval(()=>void run(),60000);
  timer.unref();
  return ()=>clearInterval(timer);
}
