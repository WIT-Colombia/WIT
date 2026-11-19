import { Prisma } from '../../generated/prisma/client.js';
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
  validateFinanceDates(input.periodStart, input.periodEnd);
  validAmount(input.amountCop); validAmount(input.amountUsd); validAmount(input.creditsUsd ?? 0);
  if (!input.externalId?.trim() || !input.providerId?.trim())
    throw new AppError(400, 'FINANCE_CONSUMPTION_INVALID', 'El proveedor y el identificador de consumo son obligatorios.');
  return prisma.$transaction(async tx => {
    const key = { providerId: input.providerId, externalId: input.externalId.trim(),
      periodStart: input.periodStart, periodEnd: input.periodEnd };
    const before = await tx.financialConsumption.findUnique({
      where: { providerId_externalId_periodStart_periodEnd: key },
    });
    if (before && before.dataKind !== 'MANUAL')
      throw new AppError(409, 'SYNCED_CONSUMPTION_IMMUTABLE',
        'Un registro sincronizado o estimado no puede ser sobrescrito mediante la carga manual.');
    const row = before
      ? await tx.financialConsumption.update({ where: { id: before.id },
          data: { amountUsd: input.amountUsd, amountCop: input.amountCop,
            creditsUsd: input.creditsUsd ?? 0, serviceId: input.serviceId } })
      : await tx.financialConsumption.create({ data: {
          ...input, externalId: key.externalId, creditsUsd: input.creditsUsd ?? 0, dataKind: 'MANUAL',
        } });
    await tx.financialAuditEntry.create({ data: {
      actorUserId: context.userId, entityType: 'FinancialConsumption', entityId: row.id,
      action: before ? 'UPDATE_MANUAL_CONSUMPTION' : 'CREATE_MANUAL_CONSUMPTION',
      reason: 'Registro administrativo manual; no altera costos sincronizados.',
      beforeState: before ? {
        amountCop: before.amountCop.toString(), amountUsd: before.amountUsd.toString(),
        creditsUsd: before.creditsUsd.toString(),
      } : undefined,
      afterState: {
        dataKind: row.dataKind, externalId: row.externalId,
        amountCop: row.amountCop.toString(), amountUsd: row.amountUsd.toString(),
        creditsUsd: row.creditsUsd.toString(),
      },
    } });
    return row;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export function budgetThresholds(consumedCop: number, budgetCop: number) { return [50, 75, 90, 100].filter(threshold => consumedCop >= budgetCop * threshold / 100); }

function validateFinanceDates(from: Date, to: Date) {
  if (!(from instanceof Date) || !(to instanceof Date) || !Number.isFinite(from.valueOf()) ||
      !Number.isFinite(to.valueOf()) || from > to)
    throw new AppError(400, 'FINANCE_PERIOD_INVALID', 'Las fechas financieras deben existir y estar en orden.');
}
export async function createProvider(context: AdminContext, input: { name: string; kind: 'AWS' | 'GOOGLE_MAPS' | 'RESEND' | 'OTHER'; currency?: string }) {
  assertManage(context);
  if (!input.name?.trim() || input.name.trim().length > 120 ||
      !['AWS','GOOGLE_MAPS','RESEND','OTHER'].includes(input.kind) ||
      !/^[A-Z]{3}$/.test(input.currency ?? 'USD'))
    throw new AppError(400, 'FINANCE_PROVIDER_INVALID', 'Nombre, tipo o moneda de proveedor no válidos.');
  return prisma.$transaction(async tx => {
    const row = await tx.financialProvider.create({
      data: { name: input.name.trim(), kind: input.kind, currency: input.currency ?? 'USD' },
    });
    await tx.financialAuditEntry.create({ data: {
      actorUserId: context.userId, entityType: 'FinancialProvider', entityId: row.id,
      action: 'CREATE', reason: 'Alta administrativa de proveedor tecnológico.',
      afterState: { name: row.name, kind: row.kind, currency: row.currency },
    } });
    return row;
  });
}
export async function createBudget(context: AdminContext, input: { name: string; amountCop: number; amountUsd?: number; periodStart: Date; periodEnd: Date; providerId?: string }) {
  assertManage(context);
  if (!input.name?.trim() || input.name.trim().length > 160)
    throw new AppError(400, 'FINANCE_BUDGET_NAME_INVALID', 'El nombre del presupuesto no es válido.');
  validateFinanceDates(input.periodStart, input.periodEnd);
  validAmount(input.amountCop);
  if (input.amountUsd !== undefined) validAmount(input.amountUsd);
  return prisma.$transaction(async tx => {
    const row = await tx.financialBudget.create({ data: { ...input, name: input.name.trim() } });
    await tx.financialAuditEntry.create({ data: {
      actorUserId: context.userId, entityType: 'FinancialBudget', entityId: row.id,
      action: 'CREATE', reason: 'Presupuesto administrativo, no saldo bancario disponible.',
      afterState: {
        name: row.name, amountCop: row.amountCop.toString(),
        amountUsd: row.amountUsd?.toString() ?? null,
        periodStart: row.periodStart.toISOString(), periodEnd: row.periodEnd.toISOString(),
      },
    } });
    return row;
  });
}
export async function createInvoice(context: AdminContext, input: { providerId: string; externalId: string; invoiceNumber?: string; periodStart: Date; periodEnd: Date; amountUsd: number; amountCop: number; documentUrl?: string }) {
  assertManage(context);
  validateFinanceDates(input.periodStart, input.periodEnd);
  validAmount(input.amountCop); validAmount(input.amountUsd);
  if (!input.providerId?.trim() || !input.externalId?.trim())
    throw new AppError(400, 'FINANCE_INVOICE_INVALID', 'Proveedor y referencia de factura obligatorios.');
  const documentUrl = input.documentUrl?.trim() ? validateReceiptUrl(input.documentUrl.trim()) : null;
  return prisma.$transaction(async tx => {
    const key = { providerId: input.providerId, externalId: input.externalId.trim() };
    const before = await tx.financialInvoice.findUnique({
      where: { providerId_externalId: key },
    });
    const row = before
      ? await tx.financialInvoice.update({ where: { id: before.id },
          data: { invoiceNumber: input.invoiceNumber, amountUsd: input.amountUsd,
            amountCop: input.amountCop, documentUrl } })
      : await tx.financialInvoice.create({
          data: { ...input, externalId: key.externalId, documentUrl, dataKind: 'MANUAL' },
        });
    await tx.financialAuditEntry.create({ data: {
      actorUserId: context.userId, entityType: 'FinancialInvoice', entityId: row.id,
      action: before ? 'UPDATE_MANUAL_INVOICE' : 'CREATE_MANUAL_INVOICE',
      reason: 'Registro manual de factura de proveedor; no equivale a una validación tributaria.',
      beforeState: before ? {
        amountCop: before.amountCop.toString(), amountUsd: before.amountUsd.toString(),
        documentUrl: before.documentUrl,
      } : undefined,
      afterState: {
        dataKind: row.dataKind, externalId: row.externalId, amountCop: row.amountCop.toString(),
        amountUsd: row.amountUsd.toString(), documentUrl: row.documentUrl,
      },
    } });
    return row;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
/** Shared capacity rule for newly recorded payments and corrections.
 * PENDING and PAID both reserve the invoice amount, CANCELLED reserves nothing.
 * No bank settlement is inferred from either administrative state. */
export function assertSupplierInvoiceCapacity(
  invoiceAmountCop: Prisma.Decimal,
  existing: Array<{ id?:string; amountCop: Prisma.Decimal; status:'PENDING'|'PAID'|'CANCELLED' }>,
  incoming: { id?:string; amountCop:number; status:'PENDING'|'PAID'|'CANCELLED' },
) {
  const allocated = existing
    .filter(payment => payment.id !== incoming.id && payment.status !== 'CANCELLED')
    .reduce((sum,payment) => sum.plus(payment.amountCop),new Prisma.Decimal(0));
  const incomingAmount = incoming.status === 'CANCELLED'
    ? new Prisma.Decimal(0) : new Prisma.Decimal(incoming.amountCop);
  if (allocated.plus(incomingAmount).greaterThan(invoiceAmountCop))
    throw new AppError(409,'PAYMENT_EXCEEDS_BALANCE',
      'El importe acumulado de los pagos registrados supera el valor de la factura.');
}
/** Only an administrative supplier-payment record. A PAID status does not certify bank settlement. */
export async function createPayment(context: AdminContext, input: { invoiceId: string; amountCop: number; status: 'PENDING' | 'PAID' | 'CANCELLED'; reference?: string }) {
  assertManage(context);
  validAmount(input.amountCop);
  if (!input.invoiceId?.trim() || !['PENDING','PAID','CANCELLED'].includes(input.status) ||
      (input.reference !== undefined && input.reference.length > 160))
    throw new AppError(400, 'FINANCE_PAYMENT_INVALID', 'Factura, estado o referencia de pago inválidos.');
  return prisma.$transaction(async tx => {
    const invoice = await tx.financialInvoice.findUnique({
      where: { id: input.invoiceId }, include: { payments: true },
    });
    if (!invoice) throw new AppError(404, 'INVOICE_NOT_FOUND', 'La factura de proveedor no existe.');
    assertSupplierInvoiceCapacity(invoice.amountCop, invoice.payments, input);
    const row = await tx.financialPayment.create({ data: {
      ...input, reference: input.reference?.trim() || null,
    } });
    await tx.financialAuditEntry.create({ data: {
      actorUserId: context.userId, entityType: 'FinancialPayment', entityId: row.id,
      action: 'CREATE', reason: 'Alta administrativa de movimiento; no es una conciliación bancaria.',
      afterState: {
        invoiceId: row.invoiceId, status: row.status,
        amountCop: row.amountCop.toString(), reference: row.reference,
      },
    } });
    return row;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export async function persistBudgetAlerts(budgetId: string, consumedCop: number, budgetCop: number) { const thresholds = budgetThresholds(consumedCop, budgetCop); const created = []; for (const threshold of thresholds) { const dedupeKey = `${budgetId}:${threshold}`; created.push(await prisma.financialAlert.upsert({ where: { dedupeKey }, create: { budgetId, dedupeKey, threshold, message: `El presupuesto alcanzó el ${threshold}%.` }, update: {} })); } return created; }
export async function listFinanceRecords(page = 1, pageSize = 50) { const safePage = Math.max(1, page); const safeSize = Math.min(100, Math.max(1, pageSize)); const [providers, budgets, consumptions, invoices, payments, alerts, totalConsumptions] = await Promise.all([prisma.financialProvider.findMany({ include: { services: true } }), prisma.financialBudget.findMany({ include: { provider: true }, orderBy: { periodStart: 'desc' } }), prisma.financialConsumption.findMany({ include: { provider: true, service: true }, orderBy: { periodStart: 'desc' }, skip: (safePage - 1) * safeSize, take: safeSize }), prisma.financialInvoice.findMany({ include: { provider: true, payments: true }, orderBy: { periodStart: 'desc' } }), prisma.financialPayment.findMany({ include: { invoice: true }, orderBy: { createdAt: 'desc' } }), prisma.financialAlert.findMany({ orderBy: { createdAt: 'desc' } }), prisma.financialConsumption.count()]); return { providers, budgets, consumptions, invoices, payments, alerts, pagination: { page: safePage, pageSize: safeSize, total: totalConsumptions, totalPages: Math.ceil(totalConsumptions / safeSize) } }; }
export async function acknowledgeAlert(context: AdminContext, id: string) {
  assertManage(context);
  return prisma.$transaction(async tx => {
    const before=await tx.financialAlert.findUnique({where:{id}});
    if(!before)throw new AppError(404,'FINANCIAL_ALERT_NOT_FOUND','Alerta no encontrada.');
    if(before.acknowledgedAt)return before;
    const alert=await tx.financialAlert.update({where:{id},data:{acknowledgedAt:new Date()}});
    await tx.financialAuditEntry.create({data:{
      actorUserId:context.userId,entityType:'FinancialAlert',entityId:id,
      action:'ACKNOWLEDGE',beforeState:{acknowledgedAt:null},
      afterState:{acknowledgedAt:alert.acknowledgedAt},
    }});
    return alert;
  });
}
function requireReason(reason: string) { if (!reason?.trim()) throw new AppError(400, 'FINANCE_REASON_REQUIRED', 'El motivo de la corrección es obligatorio.'); }
export function validateReceiptUrl(value: string) { try { const url = new URL(value); if (url.protocol !== 'https:') throw new Error(); return url.toString(); } catch { throw new AppError(400, 'INVALID_RECEIPT_URL', 'El comprobante debe ser una URL HTTPS válida.'); } }
export function reconcileFinancials(input: { consumptions: Array<{ amountCop: number; creditsCop?: number; invoiced?: number }>; invoices: Array<{ amountCop: number; payments: number[] }> }) { const accrued = input.consumptions.reduce((s, row) => s + row.amountCop - (row.creditsCop ?? 0), 0); const invoiced = input.invoices.reduce((s, row) => s + row.amountCop, 0); const paid = input.invoices.reduce((s, row) => s + row.payments.reduce((p, value) => p + value, 0), 0); return { accrued, invoiced, paid, pending: Math.max(0, invoiced - paid), unbilled: Math.max(0, accrued - invoiced) }; }
export async function updateManualConsumption(context: AdminContext, id: string,
  input: {amountCop:number;amountUsd:number;reason:string}) {
  assertManage(context);requireReason(input.reason);
  validAmount(input.amountCop);validAmount(input.amountUsd);
  return prisma.$transaction(async tx=>{
    const before=await tx.financialConsumption.findUnique({where:{id}});
    if(!before)throw new AppError(404,'CONSUMPTION_NOT_FOUND','Consumo no encontrado.');
    if(before.dataKind!=='MANUAL')
      throw new AppError(409,'SYNCED_CONSUMPTION_IMMUTABLE','Los consumos sincronizados no se corrigen como manuales.');
    const after=await tx.financialConsumption.update({where:{id},
      data:{amountCop:input.amountCop,amountUsd:input.amountUsd}});
    await tx.financialAuditEntry.create({data:{
      actorUserId:context.userId,entityType:'FinancialConsumption',entityId:id,action:'CORRECT',
      beforeState:{amountCop:before.amountCop,amountUsd:before.amountUsd},
      afterState:{amountCop:after.amountCop,amountUsd:after.amountUsd},reason:input.reason,
    }});
    return after;
  });
}
function validAmount(value: number) { if (!Number.isFinite(value) || value < 0) throw new AppError(400, 'INVALID_FINANCIAL_AMOUNT', 'El importe debe ser un número no negativo.'); }
async function financeAudit(context:AdminContext,entityType:string,entityId:string,
  beforeState:unknown,afterState:unknown,reason:string,tx:Prisma.TransactionClient) {
  requireReason(reason);
  return tx.financialAuditEntry.create({data:{
    actorUserId:context.userId,entityType,entityId,action:'CORRECT',
    beforeState:beforeState as Prisma.InputJsonValue,
    afterState:afterState as Prisma.InputJsonValue,reason:reason.trim(),
  }});
}
export async function updateProvider(context:AdminContext,id:string,
  input:{name:string;currency:string;reason:string}) {
  assertManage(context);requireReason(input.reason);
  if(!input.name?.trim()||input.name.trim().length>120||!/^[A-Z]{3}$/.test(input.currency))
    throw new AppError(400,'FINANCE_PROVIDER_INVALID','Nombre o moneda del proveedor inválidos.');
  return prisma.$transaction(async tx=>{
    const before=await tx.financialProvider.findUnique({where:{id}});
    if(!before)throw new AppError(404,'PROVIDER_NOT_FOUND','Proveedor no encontrado.');
    const after=await tx.financialProvider.update({where:{id},
      data:{name:input.name.trim(),currency:input.currency}});
    await financeAudit(context,'FinancialProvider',id,
      {name:before.name,currency:before.currency},{name:after.name,currency:after.currency},input.reason,tx);
    return after;
  });
}
export async function updateBudget(context:AdminContext,id:string,
  input:{name:string;amountCop:number;amountUsd?:number;reason:string}) {
  assertManage(context);requireReason(input.reason);
  validAmount(input.amountCop);
  if(input.amountUsd!==undefined)validAmount(input.amountUsd);
  if(!input.name?.trim()||input.name.trim().length>160)
    throw new AppError(400,'FINANCE_BUDGET_NAME_INVALID','Nombre de presupuesto inválido.');
  return prisma.$transaction(async tx=>{
    const before=await tx.financialBudget.findUnique({where:{id}});
    if(!before)throw new AppError(404,'BUDGET_NOT_FOUND','Presupuesto no encontrado.');
    const after=await tx.financialBudget.update({where:{id},
      data:{name:input.name.trim(),amountCop:input.amountCop,amountUsd:input.amountUsd}});
    await financeAudit(context,'FinancialBudget',id,
      {name:before.name,amountCop:before.amountCop,amountUsd:before.amountUsd},
      {name:after.name,amountCop:after.amountCop,amountUsd:after.amountUsd},input.reason,tx);
    return after;
  });
}
export async function updateInvoice(context:AdminContext,id:string,
  input:{amountCop:number;amountUsd:number;documentUrl?:string;reason:string}) {
  assertManage(context);requireReason(input.reason);
  validAmount(input.amountCop);validAmount(input.amountUsd);
  const documentUrl=input.documentUrl===undefined?undefined:
    input.documentUrl.trim()?validateReceiptUrl(input.documentUrl.trim()):null;
  return prisma.$transaction(async tx=>{
    const before=await tx.financialInvoice.findUnique({where:{id}});
    if(!before)throw new AppError(404,'INVOICE_NOT_FOUND','Factura no encontrada.');
    const after=await tx.financialInvoice.update({where:{id},
      data:{amountCop:input.amountCop,amountUsd:input.amountUsd,documentUrl}});
    await financeAudit(context,'FinancialInvoice',id,
      {amountCop:before.amountCop,amountUsd:before.amountUsd,documentUrl:before.documentUrl},
      {amountCop:after.amountCop,amountUsd:after.amountUsd,documentUrl:after.documentUrl},input.reason,tx);
    return after;
  });
}
export async function updatePayment(context:AdminContext,id:string,
  input:{amountCop:number;status:'PENDING'|'PAID'|'CANCELLED';reference?:string;reason:string}) {
  assertManage(context);requireReason(input.reason);validAmount(input.amountCop);
  if(!['PENDING','PAID','CANCELLED'].includes(input.status))
    throw new AppError(400,'FINANCE_PAYMENT_STATUS_INVALID','Estado de pago desconocido.');
  if(input.reference!==undefined&&input.reference.length>160)
    throw new AppError(400,'FINANCE_PAYMENT_REFERENCE_INVALID','La referencia de pago es demasiado extensa.');
  return prisma.$transaction(async tx=>{
    const before=await tx.financialPayment.findUnique({where:{id},include:{
      invoice:{include:{payments:true}},
    }});
    if(!before)throw new AppError(404,'PAYMENT_NOT_FOUND','Pago no encontrado.');
    assertSupplierInvoiceCapacity(before.invoice.amountCop, before.invoice.payments,
      { id, amountCop:input.amountCop, status:input.status });
    const after=await tx.financialPayment.update({where:{id},data:{
      amountCop:input.amountCop,status:input.status,reference:input.reference,
    }});
    await financeAudit(context,'FinancialPayment',id,{
      amountCop:before.amountCop,status:before.status,reference:before.reference,
    },{amountCop:after.amountCop,status:after.status,reference:after.reference},input.reason,tx);
    return after;
  });
}
export async function listFinancialAudit() { return prisma.financialAuditEntry.findMany({orderBy:{createdAt:'desc'},take:200}); }
