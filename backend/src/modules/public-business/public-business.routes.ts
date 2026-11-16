import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { optionalAuth } from '../../shared/middleware/optional-auth.js';
import { listPublicPromotionsController } from '../business/promotion.controller.js';
import {
  getPublicBusinessController,
  listPublicBusinessesController,
  listPublicNewArrivalsController,
  listPublicOffersController,
  listPublicPhotosController,
  listPublicProductsController,
  listPublicServicesController,
  publicPhotoContentController,
  searchPublicUniversalController,
  listPublicCategoriesController,
} from './public-business.controller.js';
import { listReviewsController } from '../reviews/review.controller.js';
import { nextPublicZoneLaunch, publicZoneStatus } from '../zones/zones.service.js';
import { subscribeToZoneAlert, confirmZoneAlert, unsubscribeZoneAlert, zoneAlertHtml } from '../zones/zones-alerts.service.js';

export const publicBusinessRouter = Router();
const publicReadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: env.nodeEnv === 'development' ? 300 : 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) => {
    response.setHeader('Retry-After', '60');
    response.status(429).json({ error: { code: 'PUBLIC_RATE_LIMITED', message: 'Demasiadas consultas. Intenta de nuevo en un momento.' } });
  },
});
publicBusinessRouter.use(publicReadRateLimit);
publicBusinessRouter.use(optionalAuth);
publicBusinessRouter.post('/zones/alerts',
  rateLimit({windowMs:60_000,limit:env.nodeEnv==='development'?60:6,
    standardHeaders:'draft-8',legacyHeaders:false}),async(req,res,next)=>{
  try{
    const {scope,code,email,consent}=req.body??{};
    if((scope!=='MUNICIPALITY'&&scope!=='DEPARTMENT')||typeof code!=='string'||
      !/^\\d{2}(\\d{3})?$/.test(code)||typeof email!=='string'||typeof consent!=='boolean')
      return res.status(400).json({error:{code:'ZONE_ALERT_INVALID_INPUT',message:'Revisa el correo y el consentimiento.'}});
    res.setHeader('Cache-Control','no-store');
    res.status(202).json(await subscribeToZoneAlert({scope,code,email,consent}));
  }catch(error){next(error);}
});
const alertConfirmPath='/zones/alerts/confirm';
const alertUnsubscribePath='/zones/alerts/unsubscribe';
publicBusinessRouter.get(alertConfirmPath,(req,res)=>{
  const token=String(req.query.token??'');
  res.setHeader('Cache-Control','no-store');
  if(!/^[a-f0-9]{64}$/.test(token))return res.status(400).type('html').send(zoneAlertHtml('Enlace no válido','Solicita un nuevo aviso desde XAMUKO.'));
  res.type('html').send(zoneAlertHtml('Confirma tu correo','Pulsa el botón para autorizar el aviso de apertura territorial.',{
    action:'/api/v1/public'+alertConfirmPath+'?token='+encodeURIComponent(token),label:'Confirmar aviso',
  }));
});
publicBusinessRouter.post(alertConfirmPath,async(req,res)=>{
  try{
    await confirmZoneAlert(String(req.query.token??''));
    res.setHeader('Cache-Control','no-store');
    res.type('html').send(zoneAlertHtml('Aviso confirmado','Te avisaremos una sola vez cuando XAMUKO habilite esa zona.'));
  }catch{res.status(400).type('html').send(zoneAlertHtml('Enlace no válido','El enlace ya se utilizó, venció o no existe.'));}
});
publicBusinessRouter.get(alertUnsubscribePath,(req,res)=>{
  const id=String(req.query.id??''),token=String(req.query.token??'');
  res.setHeader('Cache-Control','no-store');
  if(!/^[a-f0-9]{64}$/.test(token)||id.length!==36)return res.status(400).type('html').send(zoneAlertHtml('Enlace no válido','No fue posible confirmar la solicitud.'));
  res.type('html').send(zoneAlertHtml('Cancelar aviso','Dejarás de recibir notificaciones sobre esta apertura.',{
    action:'/api/v1/public'+alertUnsubscribePath+'?id='+encodeURIComponent(id)+'&token='+encodeURIComponent(token),label:'Cancelar suscripción',
  }));
});
publicBusinessRouter.post(alertUnsubscribePath,async(req,res)=>{
  try{
    await unsubscribeZoneAlert(String(req.query.id??''),String(req.query.token??''));
    res.type('html').send(zoneAlertHtml('Suscripción cancelada','No recibirás más avisos de esta apertura.'));
  }catch{res.status(400).type('html').send(zoneAlertHtml('Enlace no válido','No se pudo cancelar la suscripción.'));}
});
publicBusinessRouter.get('/zones/next-launch',async(_req,res,next)=>{
  try{res.setHeader('Cache-Control','no-store');res.json({next:await nextPublicZoneLaunch(),serverTime:new Date().toISOString()});}
  catch(error){next(error);}
});
publicBusinessRouter.get('/zones/status',async(req,res,next)=>{
  try{
    const city=String(req.query.city??'').trim(), region=String(req.query.region??'').trim();
    if(city.length<1||city.length>160||region.length>160) return res.status(400).json({error:{code:'ZONE_INVALID_QUERY',message:'Selecciona una ciudad válida.'}});
    res.setHeader('Cache-Control','no-store');
    res.json({zone:await publicZoneStatus({city,region:region||undefined}),serverTime:new Date().toISOString()});
  }catch(error){next(error);}
});
publicBusinessRouter.get('/businesses', listPublicBusinessesController);
publicBusinessRouter.get('/search', searchPublicUniversalController);
publicBusinessRouter.get('/categories', listPublicCategoriesController);
publicBusinessRouter.get('/new-arrivals', listPublicNewArrivalsController);
publicBusinessRouter.get('/businesses/:publicId/products', listPublicProductsController);
publicBusinessRouter.get('/businesses/:publicId/services', listPublicServicesController);
publicBusinessRouter.get('/businesses/:publicId/photos', listPublicPhotosController);
publicBusinessRouter.get('/businesses/:publicId/photos/:photoId/content', publicPhotoContentController);
publicBusinessRouter.get('/businesses/:publicId/offers', listPublicOffersController);
publicBusinessRouter.get('/businesses/:publicId/promotions', listPublicPromotionsController);
publicBusinessRouter.get('/businesses/:businessId/reviews', listReviewsController);
publicBusinessRouter.get('/businesses/:publicId', getPublicBusinessController);
