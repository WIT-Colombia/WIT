import { Router } from 'express';
import { requireAdmin, adminFromRequest } from '../admin/admin-auth.service.js';
import { requireTrustedOrigin } from '../../shared/middleware/require-trusted-origin.js';
import {
  getTechnologyStatus, listTechnologyCases, technologyCaseDetail,
  createTechnologyCase, updateTechnologyCaseStatus, commentTechnologyCase,
} from './technology.service.js';
import { listTechnologyDeployments } from './github-deployments.service.js';

export const technologyRouter=Router();
technologyRouter.use((req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)
  ?next():requireTrustedOrigin(req,res,next));

technologyRouter.get('/status',requireAdmin('AUDIT_READ'),async(_req,res,next)=>{
  try{
    res.setHeader('Cache-Control','private, no-store');
    res.json(await getTechnologyStatus());
  }catch(error){next(error);}
});
technologyRouter.get('/deployments',requireAdmin('AUDIT_READ'),async(_req,res,next)=>{
  try{
    res.setHeader('Cache-Control','private, no-store');
    res.json(await listTechnologyDeployments());
  }catch(error){next(error);}
});
technologyRouter.get('/cases',requireAdmin('AUDIT_READ'),async(req,res,next)=>{
  try{
    res.setHeader('Cache-Control','private, no-store');
    res.json(await listTechnologyCases({
      kind:String(req.query.kind??''),status:String(req.query.status??''),
      q:String(req.query.q??''),page:Number(req.query.page??1),
    }));
  }catch(error){next(error);}
});
technologyRouter.get('/cases/:id',requireAdmin('AUDIT_READ'),async(req,res,next)=>{
  try{
    res.setHeader('Cache-Control','private, no-store');
    res.json(await technologyCaseDetail(String(req.params.id)));
  }catch(error){next(error);}
});
technologyRouter.post('/cases',requireAdmin('ADMINS_MANAGE'),async(req,res,next)=>{
  try{
    res.setHeader('Cache-Control','private, no-store');
    res.status(201).json(await createTechnologyCase(adminFromRequest(req),req.body??{}));
  }catch(error){next(error);}
});
technologyRouter.patch('/cases/:id/status',requireAdmin('ADMINS_MANAGE'),async(req,res,next)=>{
  try{
    res.setHeader('Cache-Control','private, no-store');
    res.json(await updateTechnologyCaseStatus(adminFromRequest(req),
      String(req.params.id),req.body??{}));
  }catch(error){next(error);}
});
technologyRouter.post('/cases/:id/notes',requireAdmin('ADMINS_MANAGE'),async(req,res,next)=>{
  try{
    res.setHeader('Cache-Control','private, no-store');
    res.status(201).json(await commentTechnologyCase(adminFromRequest(req),
      String(req.params.id),req.body??{}));
  }catch(error){next(error);}
});
