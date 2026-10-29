import { Router } from 'express';
import { createAwsCostExplorerReader, syncAwsDailyCosts } from './aws-cost-explorer.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireAdmin, adminFromRequest } from '../admin/admin-auth.service.js';
import { financeSummary, createManualConsumption, createProvider, createBudget, createInvoice, createPayment, listFinanceRecords, acknowledgeAlert, updateManualConsumption, reconcileFinancials, updateProvider, updateBudget, updateInvoice, updatePayment, listFinancialAudit } from './finance.service.js';
import { createAwsFreeTierReader, fetchFreeTierUsage, type FreeTierUsage } from './aws-free-tier.js';

export const financeRouter = Router();
let awsSyncRunning = false;
financeRouter.use(requireAuth);
financeRouter.get('/summary', requireAdmin('FINANCE_READ'), async (req, res, next) => {
  try {
    const now = new Date();
    const start = req.query.start ? new Date(String(req.query.start)) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = req.query.end ? new Date(String(req.query.end)) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return res.status(400).json({ code: 'INVALID_PERIOD', message: 'El periodo financiero no es válido.' });
    res.json(await financeSummary(start, end));
  } catch (error) { next(error); }
});
financeRouter.get('/records', requireAdmin('FINANCE_READ'), async (req, res, next) => { try { res.json(await listFinanceRecords(Number(req.query.page) || 1, Number(req.query.pageSize) || 50)); } catch (error) { next(error); } });
financeRouter.get('/aws/free-tier', requireAdmin('FINANCE_READ'), async (req, res, next) => {
  try {
    // The reader is intentionally injected only when a future deployment wires
    // the official SDK with a temporary read-only role. Never fabricate usage.
    const reader = (req.app.locals.awsFreeTierReader as undefined | ((input: { Filter?: unknown }) => Promise<{ freeTierUsages?: Array<Record<string, unknown>> }>)) ?? (process.env.AWS_FREE_TIER_ENABLED === 'true' ? createAwsFreeTierReader() : undefined);
    if (!reader) return res.json({ available: false, reason: 'AWS_FREE_TIER_NOT_CONFIGURED', usages: [], lastUpdatedAt: null });
    const usages: FreeTierUsage[] = await fetchFreeTierUsage(reader, typeof req.query.service === 'string' ? req.query.service : undefined);
    res.json({ available: true, usages, lastUpdatedAt: new Date().toISOString() });
  } catch (error) { next(error); }
});

financeRouter.post('/consumptions/manual', requireAdmin('FINANCE_MANAGE'), async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const required = ['providerId', 'externalId', 'periodStart', 'periodEnd', 'amountUsd', 'amountCop'];
    if (required.some(key => body[key] === undefined || body[key] === null || body[key] === '')) return res.status(400).json({ code: 'INVALID_CONSUMPTION', message: 'Faltan datos del consumo.' });
    const row = await createManualConsumption(adminFromRequest(req), { ...body, periodStart: new Date(body.periodStart), periodEnd: new Date(body.periodEnd), amountUsd: Number(body.amountUsd), amountCop: Number(body.amountCop), creditsUsd: body.creditsUsd === undefined ? 0 : Number(body.creditsUsd) });
    res.status(201).json({ consumption: row });
  } catch (error) { next(error); }
});
financeRouter.post('/providers', requireAdmin('FINANCE_MANAGE'), async (req, res, next) => { try { res.status(201).json({ provider: await createProvider(adminFromRequest(req), req.body) }); } catch (error) { next(error); } });
financeRouter.post('/budgets', requireAdmin('FINANCE_MANAGE'), async (req, res, next) => { try { const body = req.body ?? {}; res.status(201).json({ budget: await createBudget(adminFromRequest(req), { ...body, amountCop: Number(body.amountCop), amountUsd: body.amountUsd === undefined ? undefined : Number(body.amountUsd), periodStart: new Date(body.periodStart), periodEnd: new Date(body.periodEnd) }) }); } catch (error) { next(error); } });
financeRouter.post('/invoices', requireAdmin('FINANCE_MANAGE'), async (req, res, next) => { try { const body = req.body ?? {}; res.status(201).json({ invoice: await createInvoice(adminFromRequest(req), { ...body, periodStart: new Date(body.periodStart), periodEnd: new Date(body.periodEnd), amountUsd: Number(body.amountUsd), amountCop: Number(body.amountCop) }) }); } catch (error) { next(error); } });
financeRouter.post('/payments', requireAdmin('FINANCE_MANAGE'), async (req, res, next) => { try { res.status(201).json({ payment: await createPayment(adminFromRequest(req), { ...req.body, amountCop: Number(req.body.amountCop) }) }); } catch (error) { next(error); } });
financeRouter.patch('/alerts/:id/acknowledge', requireAdmin('FINANCE_MANAGE'), async (req, res, next) => { try { res.json({ alert: await acknowledgeAlert(adminFromRequest(req), req.params.id) }); } catch (error) { next(error); } });
financeRouter.patch('/consumptions/:id', requireAdmin('FINANCE_MANAGE'), async (req, res, next) => { try { res.json({ consumption: await updateManualConsumption(adminFromRequest(req), req.params.id, { amountCop: Number(req.body.amountCop), amountUsd: Number(req.body.amountUsd), reason: String(req.body.reason ?? '') }) }); } catch (error) { next(error); } });
financeRouter.post('/reconcile', requireAdmin('FINANCE_READ'), async (req, res, next) => { try { res.json(reconcileFinancials(req.body)); } catch (error) { next(error); } });
financeRouter.get('/audit', requireAdmin('FINANCE_READ'), async (_req,res,next)=>{try{res.json({entries:await listFinancialAudit()});}catch(error){next(error);}});
financeRouter.post('/sync/aws', requireAdmin('FINANCE_MANAGE'), async (req,res,next)=>{if(awsSyncRunning)return res.status(409).json({code:'AWS_SYNC_IN_PROGRESS',message:'Ya existe una sincronización AWS en curso.'});awsSyncRunning=true;try{const end=new Date(req.body?.end ?? new Date());const start=new Date(req.body?.start ?? new Date(end.getTime()-86400000));const copPerUsd=Number(req.body?.copPerUsd);if(Number.isNaN(start.valueOf())||Number.isNaN(end.valueOf()))return res.status(400).json({code:'INVALID_PERIOD',message:'El periodo financiero no es válido.'});if(!Number.isFinite(copPerUsd)||copPerUsd<=0)return res.status(400).json({code:'INVALID_EXCHANGE_RATE',message:'La tasa COP/USD debe ser positiva.'});res.json(await syncAwsDailyCosts(createAwsCostExplorerReader(),start,end,copPerUsd));}catch(error){next(error);}finally{awsSyncRunning=false;}});
financeRouter.patch('/providers/:id', requireAdmin('FINANCE_MANAGE'), async(req,res,next)=>{try{res.json({provider:await updateProvider(adminFromRequest(req),req.params.id,req.body)});}catch(error){next(error);}});
financeRouter.patch('/budgets/:id', requireAdmin('FINANCE_MANAGE'), async(req,res,next)=>{try{res.json({budget:await updateBudget(adminFromRequest(req),req.params.id,{...req.body,amountCop:Number(req.body.amountCop),amountUsd:req.body.amountUsd===undefined?undefined:Number(req.body.amountUsd)})});}catch(error){next(error);}});
financeRouter.patch('/invoices/:id', requireAdmin('FINANCE_MANAGE'), async(req,res,next)=>{try{res.json({invoice:await updateInvoice(adminFromRequest(req),req.params.id,{...req.body,amountCop:Number(req.body.amountCop),amountUsd:Number(req.body.amountUsd)})});}catch(error){next(error);}});
financeRouter.patch('/payments/:id', requireAdmin('FINANCE_MANAGE'), async(req,res,next)=>{try{res.json({payment:await updatePayment(adminFromRequest(req),req.params.id,{...req.body,amountCop:Number(req.body.amountCop)})});}catch(error){next(error);}});
