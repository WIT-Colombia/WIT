import { Prisma, type RefundCaseStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { AdminContext } from '../admin/admin-auth.service.js';

export const refundCaseStatuses = ['OPEN', 'IN_REVIEW', 'NEEDS_INFORMATION', 'CLOSED'] as const;
export type RefundCaseFilter = typeof refundCaseStatuses[number] | '';

const trim = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const mandatory = (value: unknown, min: number, max: number, field: string) => {
  const text = trim(value);
  if (text.length < min || text.length > max)
    throw new AppError(400, 'REFUND_CASE_INVALID_INPUT', field + ' debe tener entre ' + min + ' y ' + max + ' caracteres.');
  return text;
};
const optional = (value: unknown, max: number, field: string) => {
  const text = trim(value);
  if (text.length > max) throw new AppError(400, 'REFUND_CASE_INVALID_INPUT', field + ' supera la longitud permitida.');
  return text || null;
};
function amount(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(text) || Number(text) <= 0)
    throw new AppError(400, 'REFUND_CASE_AMOUNT_INVALID',
      'El importe solicitado debe ser positivo y tener como máximo dos decimales.');
  return text;
}
const parseCalendarDay = (value:string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value+'T00:00:00.000Z');
  return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value?date:null;
};
export function normalizeRefundCaseFilters(input: { page?: number; status?: string; q?: string; from?:string; to?:string }) {
  const page = Number.isSafeInteger(input.page) ? Math.max(1, Math.min(100000, input.page!)) : 1;
  const status = trim(input.status).toUpperCase();
  const q = trim(input.q);
  const from=trim(input.from),to=trim(input.to);
  const fromDate=from?parseCalendarDay(from):null;
  const toDate=to?parseCalendarDay(to):null;
  if ((from&&!fromDate)||(to&&!toDate)||(fromDate&&toDate&&fromDate>toDate))
    throw new AppError(400,'REFUND_CASE_DATE_INVALID',
      'Selecciona fechas de radicación válidas y en orden (AAAA-MM-DD).');
  const endExclusive=toDate?new Date(toDate.valueOf()+86400000):null;
  if (q.length > 100) throw new AppError(400,'REFUND_CASE_SEARCH_TOO_LONG','La búsqueda no puede superar 100 caracteres.');
  if (status && !refundCaseStatuses.includes(status as RefundCaseStatus))
    throw new AppError(400,'REFUND_CASE_STATUS_INVALID','Estado de solicitud desconocido.');
  return { page, status: status as RefundCaseFilter, q, from,to,fromDate,endExclusive,pageSize: 12 };
}
export function refundCaseWhere(filters: ReturnType<typeof normalizeRefundCaseFilters>): Prisma.RefundCaseWhereInput {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.fromDate||filters.endExclusive ? {createdAt:{
      ...(filters.fromDate?{gte:filters.fromDate}:{}),
      ...(filters.endExclusive?{lt:filters.endExclusive}:{}),
    }}:{}),
    ...(filters.q ? { OR: [
      { subject: { contains: filters.q } },
      { externalReference: { contains: filters.q } },
      { contactEmail: { contains: filters.q } },
    ] } : {}),
  };
}
export function validateNewRefundCase(input: Record<string, unknown>) {
  const email = optional(input.contactEmail, 320, 'Correo de contacto');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AppError(400,'REFUND_CASE_EMAIL_INVALID','El correo de contacto no es válido.');
  return {
    subject: mandatory(input.subject, 8, 160, 'El asunto'),
    description: mandatory(input.description, 20, 2000, 'La descripción'),
    contactEmail: email,
    externalReference: optional(input.externalReference, 160, 'La referencia'),
    requestedAmountCop: amount(input.requestedAmountCop),
  };
}
export function validateRefundCaseDecision(input: Record<string, unknown>) {
  const status = trim(input.status).toUpperCase();
  if (!refundCaseStatuses.includes(status as RefundCaseStatus))
    throw new AppError(400,'REFUND_CASE_STATUS_INVALID','Estado de seguimiento desconocido.');
  return {
    status: status as RefundCaseStatus,
    reason: mandatory(input.reason, 12, 500, 'El motivo de la decisión'),
  };
}
function assertManage(context: AdminContext) {
  if (!context.permissions.includes('FINANCE_MANAGE'))
    throw new AppError(403,'FINANCE_PERMISSION_DENIED','No puedes modificar casos de reembolso.');
}
const caseSelect = {
  id:true,status:true,subject:true,description:true,contactEmail:true,
  externalReference:true,requestedAmountCop:true,decisionNote:true,
  createdById:true,lastReviewedById:true,closedAt:true,
  createdAt:true,updatedAt:true,
} satisfies Prisma.RefundCaseSelect;
function serialize(row: {
  requestedAmountCop: Prisma.Decimal | null;
  [key: string]: unknown;
}) {
  return { ...row, requestedAmountCop: row.requestedAmountCop?.toString() ?? null };
}

export async function listRefundCases(filters: { page?: number; status?: string; q?: string;from?:string;to?:string }) {
  const parsed = normalizeRefundCaseFilters(filters);
  const where = refundCaseWhere(parsed);
  const [total, rows, grouped] = await prisma.$transaction([
    prisma.refundCase.count({where}),
    prisma.refundCase.findMany({
      where,select:caseSelect,orderBy:[{createdAt:'desc'},{id:'desc'}],
      skip:(parsed.page-1)*parsed.pageSize,take:parsed.pageSize,
    }),
    prisma.refundCase.groupBy({by:['status'],_count:{_all:true}}),
  ]);
  const counts = Object.fromEntries(refundCaseStatuses.map(status =>
    [status, grouped.find(row=>row.status===status)?._count._all ?? 0],
  )) as Record<RefundCaseStatus,number>;
  return {
    scope:'ADMIN_REFUND_REVIEW_ONLY' as const,
    payoutsIntegrated:false,
    verifiedRefunds:null, refundedAmountCop:null,
    counts:{total:grouped.reduce((sum,row)=>sum+row._count._all,0),...counts},
    cases:rows.map(serialize),
    pagination:{page:parsed.page,pageSize:parsed.pageSize,total,totalPages:Math.ceil(total/parsed.pageSize)},
    definition:'Los casos se crean y revisan manualmente. Los indicadores cuentan todos los expedientes; la tabla filtra por fecha de radicación UTC. Los montos solicitados no son obligaciones verificadas y ningún estado certifica devolución de dinero. No hay pasarela ni desembolso conectado.',
  };
}
export async function getRefundCase(id: string) {
  const row = await prisma.refundCase.findUnique({where:{id},select:caseSelect});
  if (!row) throw new AppError(404,'REFUND_CASE_NOT_FOUND','No existe esa solicitud.');
  const history = await prisma.financialAuditEntry.findMany({
    where:{entityType:'RefundCase',entityId:id},
    orderBy:[{createdAt:'desc'},{id:'desc'}],take:80,
    select:{id:true,actorUserId:true,action:true,reason:true,beforeState:true,afterState:true,createdAt:true},
  });
  return { case:serialize(row),history,payoutsIntegrated:false };
}
export async function createRefundCase(context:AdminContext,input:Record<string,unknown>) {
  assertManage(context);
  const parsed = validateNewRefundCase(input);
  const result = await prisma.$transaction(async tx=>{
    const row = await tx.refundCase.create({data:{
      ...parsed,createdById:context.userId,status:'OPEN',
    },select:caseSelect});
    await tx.financialAuditEntry.create({data:{
      actorUserId:context.userId,entityType:'RefundCase',entityId:row.id,
      action:'REFUND_CASE_CREATED',reason:'Radicación administrativa de solicitud; sin desembolso.',
      afterState:{status:'OPEN',subject:row.subject,reference:row.externalReference,
        requestedAmountCop:row.requestedAmountCop?.toString() ?? null},
    }});
    return row;
  });
  return {case:serialize(result),payoutsIntegrated:false};
}
export async function decideRefundCase(context:AdminContext,id:string,input:Record<string,unknown>) {
  assertManage(context);
  const parsed = validateRefundCaseDecision(input);
  const result = await prisma.$transaction(async tx=>{
    const before = await tx.refundCase.findUnique({where:{id},select:caseSelect});
    if (!before) throw new AppError(404,'REFUND_CASE_NOT_FOUND','No existe esa solicitud.');
    if (before.status === parsed.status)
      throw new AppError(409,'REFUND_CASE_UNCHANGED','Selecciona un estado distinto al actual.');
    const updated = await tx.refundCase.updateMany({
      where:{id,status:before.status},
      data:{status:parsed.status,lastReviewedById:context.userId,decisionNote:parsed.reason,
        closedAt:parsed.status==='CLOSED'?new Date():null},
    });
    if (updated.count !== 1)
      throw new AppError(409,'REFUND_CASE_CHANGED','Otro administrador modificó el expediente. Actualízalo antes de continuar.');
    await tx.financialAuditEntry.create({data:{
      actorUserId:context.userId,entityType:'RefundCase',entityId:id,
      action:'REFUND_CASE_STATUS_CHANGED',reason:parsed.reason,
      beforeState:{status:before.status},afterState:{status:parsed.status},
    }});
    return tx.refundCase.findUniqueOrThrow({where:{id},select:caseSelect});
  });
  return {case:serialize(result),payoutsIntegrated:false};
}
