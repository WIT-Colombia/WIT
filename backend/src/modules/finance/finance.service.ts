import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { AdminContext } from '../admin/admin-auth.service.js';
import { reconcileAwsBilling } from './aws-cost-explorer.js';

const defaultBudgets = [
  ['AWS', 150000], ['Google Maps', 20000], ['Resend', 10000], ['Reserva', 20000],
] as const;

function assertManage(context: AdminContext) {
  if (!context.permissions.includes('FINANCE_MANAGE')) throw new AppError(403, 'FINANCE_PERMISSION_DENIED', 'No tienes permisos para modificar Finanzas.');
}

export async function financeSummary(start: Date, end: Date) {
  const [consumptions, budgets, providers, lastSync] = await Promise.all([
    prisma.financialConsumption.findMany({ where: { periodStart: { gte: start }, periodEnd: { lte: end } }, include: { provider: true, service: true }, orderBy: { periodStart: 'asc' } }),
    prisma.financialBudget.findMany({ where: { active: true, periodStart: { lte: end }, periodEnd: { gte: start } }, include: { provider: true } }),
    prisma.financialProvider.findMany({ where: { active: true }, include: { services: true } }),
    prisma.financialSyncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 10, include: { provider: true } }),
  ]);
  const totalUsd = consumptions.reduce((sum, item) => sum + Number(item.amountUsd) - Number(item.creditsUsd), 0);
  const totalCop = consumptions.reduce((sum, item) => sum + Number(item.amountCop), 0);
  const awsLines = consumptions
    .filter(item => item.provider.name === 'AWS' && item.metadata && typeof item.metadata === 'object')
    .map(item => {
      const metadata = item.metadata as Record<string, unknown>;
      return {
        service: item.service?.name ?? 'AWS', date: item.periodStart.toISOString().slice(0, 10),
        unblendedUsd: Number(metadata.unblendedUsd ?? item.amountUsd),
        netUnblendedUsd: Number(metadata.netUnblendedUsd ?? item.amountUsd),
        metricDifferenceUsd: Number(metadata.metricDifferenceUsd ?? 0), currency: String(metadata.currency ?? 'USD'),
        provisional: metadata.provisional !== false,
      };
    });
  return { period: { start, end }, totals: { usd: totalUsd, cop: totalCop }, billing: reconcileAwsBilling(awsLines, awsLines.length ? new Date().toISOString() : null), budgets, providers, consumptions, lastSync };
}

export async function ensureDefaultBudgets() {
  for (const [name, amountCop] of defaultBudgets) {
    const existing = await prisma.financialBudget.findFirst({ where: { name, active: true } });
    if (!existing) await prisma.financialBudget.create({ data: { name, amountCop, periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1), periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0) } });
  }
}

export async function createManualConsumption(context: AdminContext, input: { providerId: string; serviceId?: string; externalId: string; periodStart: Date; periodEnd: Date; amountUsd: number; amountCop: number; creditsUsd?: number; }) {
  assertManage(context);
  const row = await prisma.financialConsumption.upsert({ where: { providerId_externalId_periodStart_periodEnd: { providerId: input.providerId, externalId: input.externalId, periodStart: input.periodStart, periodEnd: input.periodEnd } }, create: { ...input, creditsUsd: input.creditsUsd ?? 0, dataKind: 'MANUAL' }, update: { amountUsd: input.amountUsd, amountCop: input.amountCop, creditsUsd: input.creditsUsd ?? 0, serviceId: input.serviceId } });
  await prisma.financialAuditEntry.create({ data: { actorUserId: context.userId, entityType: 'FinancialConsumption', entityId: row.id, action: 'UPSERT_MANUAL_CONSUMPTION', afterState: row as any } });
  return row;
}

export function budgetThresholds(consumedCop: number, budgetCop: number) { return [50, 75, 90, 100].filter(threshold => consumedCop >= budgetCop * threshold / 100); }

export async function createProvider(context: AdminContext, input: { name: string; kind: 'AWS' | 'GOOGLE_MAPS' | 'RESEND' | 'OTHER'; currency?: string }) { assertManage(context); return prisma.financialProvider.create({ data: { name: input.name.trim(), kind: input.kind, currency: input.currency ?? 'USD' } }); }
export async function createBudget(context: AdminContext, input: { name: string; amountCop: number; amountUsd?: number; periodStart: Date; periodEnd: Date; providerId?: string }) { assertManage(context); return prisma.financialBudget.create({ data: input }); }
export async function createInvoice(context: AdminContext, input: { providerId: string; externalId: string; invoiceNumber?: string; periodStart: Date; periodEnd: Date; amountUsd: number; amountCop: number; documentUrl?: string }) { assertManage(context); return prisma.financialInvoice.upsert({ where: { providerId_externalId: { providerId: input.providerId, externalId: input.externalId } }, create: { ...input, dataKind: 'REAL' }, update: { invoiceNumber: input.invoiceNumber, amountUsd: input.amountUsd, amountCop: input.amountCop, documentUrl: input.documentUrl } }); }
export async function createPayment(context: AdminContext, input: { invoiceId: string; amountCop: number; status: 'PENDING' | 'PAID' | 'CANCELLED'; reference?: string }) { assertManage(context); return prisma.financialPayment.create({ data: input }); }
export async function persistBudgetAlerts(budgetId: string, consumedCop: number, budgetCop: number) { const thresholds = budgetThresholds(consumedCop, budgetCop); const created = []; for (const threshold of thresholds) { const dedupeKey = `${budgetId}:${threshold}`; created.push(await prisma.financialAlert.upsert({ where: { dedupeKey }, create: { budgetId, dedupeKey, threshold, message: `El presupuesto alcanzó el ${threshold}%.` }, update: {} })); } return created; }
export async function listFinanceRecords(page = 1, pageSize = 50) { const safePage = Math.max(1, page); const safeSize = Math.min(100, Math.max(1, pageSize)); const [providers, budgets, consumptions, invoices, payments, alerts, totalConsumptions] = await Promise.all([prisma.financialProvider.findMany({ include: { services: true } }), prisma.financialBudget.findMany({ include: { provider: true }, orderBy: { periodStart: 'desc' } }), prisma.financialConsumption.findMany({ include: { provider: true, service: true }, orderBy: { periodStart: 'desc' }, skip: (safePage - 1) * safeSize, take: safeSize }), prisma.financialInvoice.findMany({ include: { provider: true, payments: true }, orderBy: { periodStart: 'desc' } }), prisma.financialPayment.findMany({ include: { invoice: true }, orderBy: { createdAt: 'desc' } }), prisma.financialAlert.findMany({ orderBy: { createdAt: 'desc' } }), prisma.financialConsumption.count()]); return { providers, budgets, consumptions, invoices, payments, alerts, pagination: { page: safePage, pageSize: safeSize, total: totalConsumptions, totalPages: Math.ceil(totalConsumptions / safeSize) } }; }
export async function acknowledgeAlert(context: AdminContext, id: string) { assertManage(context); const alert = await prisma.financialAlert.update({ where: { id }, data: { acknowledgedAt: new Date() } }); await prisma.financialAuditEntry.create({ data: { actorUserId: context.userId, entityType: 'FinancialAlert', entityId: id, action: 'ACKNOWLEDGE', afterState: { acknowledgedAt: alert.acknowledgedAt } } }); return alert; }
function requireReason(reason: string) { if (!reason?.trim()) throw new AppError(400, 'FINANCE_REASON_REQUIRED', 'El motivo de la corrección es obligatorio.'); }
export function validateReceiptUrl(value: string) { try { const url = new URL(value); if (url.protocol !== 'https:') throw new Error(); return url.toString(); } catch { throw new AppError(400, 'INVALID_RECEIPT_URL', 'El comprobante debe ser una URL HTTPS válida.'); } }
export function reconcileFinancials(input: { consumptions: Array<{ amountCop: number; creditsCop?: number; invoiced?: number }>; invoices: Array<{ amountCop: number; payments: number[] }> }) { const accrued = input.consumptions.reduce((s, row) => s + row.amountCop - (row.creditsCop ?? 0), 0); const invoiced = input.invoices.reduce((s, row) => s + row.amountCop, 0); const paid = input.invoices.reduce((s, row) => s + row.payments.reduce((p, value) => p + value, 0), 0); return { accrued, invoiced, paid, pending: Math.max(0, invoiced - paid), unbilled: Math.max(0, accrued - invoiced) }; }
export async function updateManualConsumption(context: AdminContext, id: string, input: { amountCop: number; amountUsd: number; reason: string }) { assertManage(context); requireReason(input.reason); const before = await prisma.financialConsumption.findUnique({ where: { id } }); if (!before) throw new AppError(404, 'CONSUMPTION_NOT_FOUND', 'Consumo no encontrado.'); if (before.dataKind !== 'MANUAL') throw new AppError(409, 'SYNCED_CONSUMPTION_IMMUTABLE', 'Los consumos sincronizados no se corrigen como manuales.'); const after = await prisma.financialConsumption.update({ where: { id }, data: { amountCop: input.amountCop, amountUsd: input.amountUsd } }); await prisma.financialAuditEntry.create({ data: { actorUserId: context.userId, entityType: 'FinancialConsumption', entityId: id, action: 'CORRECT', beforeState: { amountCop: before.amountCop, amountUsd: before.amountUsd }, afterState: { amountCop: after.amountCop, amountUsd: after.amountUsd }, reason: input.reason } }); return after; }
function validAmount(value: number) { if (!Number.isFinite(value) || value < 0) throw new AppError(400, 'INVALID_FINANCIAL_AMOUNT', 'El importe debe ser un número no negativo.'); }
async function financeAudit(context: AdminContext, entityType: string, entityId: string, beforeState: unknown, afterState: unknown, reason: string) { requireReason(reason); return prisma.financialAuditEntry.create({ data: { actorUserId: context.userId, entityType, entityId, action: 'CORRECT', beforeState: beforeState as any, afterState: afterState as any, reason } }); }
export async function updateProvider(context: AdminContext, id: string, input: { name: string; currency: string; reason: string }) { assertManage(context); const before=await prisma.financialProvider.findUnique({where:{id}}); if(!before)throw new AppError(404,'PROVIDER_NOT_FOUND','Proveedor no encontrado.'); const after=await prisma.financialProvider.update({where:{id},data:{name:input.name.trim(),currency:input.currency}}); await financeAudit(context,'FinancialProvider',id,before,after,input.reason); return after; }
export async function updateBudget(context: AdminContext, id: string, input: { name: string; amountCop: number; amountUsd?: number; reason: string }) { assertManage(context); validAmount(input.amountCop); if(input.amountUsd!==undefined)validAmount(input.amountUsd); const before=await prisma.financialBudget.findUnique({where:{id}}); if(!before)throw new AppError(404,'BUDGET_NOT_FOUND','Presupuesto no encontrado.'); const after=await prisma.financialBudget.update({where:{id},data:{name:input.name.trim(),amountCop:input.amountCop,amountUsd:input.amountUsd}}); await financeAudit(context,'FinancialBudget',id,before,after,input.reason); return after; }
export async function updateInvoice(context: AdminContext, id: string, input: { amountCop: number; amountUsd: number; documentUrl?: string; reason: string }) { assertManage(context); validAmount(input.amountCop); validAmount(input.amountUsd); const before=await prisma.financialInvoice.findUnique({where:{id},include:{payments:true}}); if(!before)throw new AppError(404,'INVOICE_NOT_FOUND','Factura no encontrada.'); const after=await prisma.financialInvoice.update({where:{id},data:{amountCop:input.amountCop,amountUsd:input.amountUsd,documentUrl:input.documentUrl}}); await financeAudit(context,'FinancialInvoice',id,before,after,input.reason); return after; }
export async function updatePayment(context: AdminContext, id: string, input: { amountCop: number; status: 'PENDING'|'PAID'|'CANCELLED'; reference?: string; reason: string }) { assertManage(context); validAmount(input.amountCop); const before=await prisma.financialPayment.findUnique({where:{id},include:{invoice:{include:{payments:true}}}}); if(!before)throw new AppError(404,'PAYMENT_NOT_FOUND','Pago no encontrado.'); const other=before.invoice.payments.filter(p=>p.id!==id&&p.status!=='CANCELLED').reduce((s,p)=>s+Number(p.amountCop),0); if(other+input.amountCop>Number(before.invoice.amountCop))throw new AppError(409,'PAYMENT_EXCEEDS_BALANCE','El pago supera el saldo permitido.'); const after=await prisma.financialPayment.update({where:{id},data:{amountCop:input.amountCop,status:input.status,reference:input.reference}}); await financeAudit(context,'FinancialPayment',id,before,after,input.reason); return after; }
export async function listFinancialAudit() { return prisma.financialAuditEntry.findMany({orderBy:{createdAt:'desc'},take:200}); }
