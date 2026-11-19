import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

export const expenseTabs = ['CONSUMPTIONS','INVOICES','PAYMENTS','BUDGETS','PROVIDERS','ALERTS','AUDIT'] as const;
export type ExpenseTab = (typeof expenseTabs)[number];
const validDay = (raw: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(raw + 'T00:00:00.000Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === raw ? date : null;
};
/** Service and billing periods are calendar dates; payment and audit filters use UTC registration dates. */
export function normalizeExpenseReportFilters(input: {
  from?: string; to?: string; page?: number; kind?: string; q?: string; providerId?: string;
}, now = new Date()) {
  const startDefault = now.toISOString().slice(0, 7) + '-01';
  const endDefault = now.toISOString().slice(0, 10);
  const from = (input.from ?? startDefault).trim();
  const to = (input.to ?? endDefault).trim();
  const start = validDay(from), end = validDay(to);
  if (!start || !end || start > end || end.valueOf() - start.valueOf() > 366 * 86400000)
    throw new AppError(400, 'FINANCE_REPORT_PERIOD_INVALID',
      'Selecciona fechas válidas, en orden y dentro de un intervalo máximo de 367 días.');
  const endExclusive = new Date(end.valueOf() + 86400000);
  const q = (input.q ?? '').trim();
  if (q.length > 100) throw new AppError(400, 'FINANCE_REPORT_SEARCH_TOO_LONG',
    'La búsqueda no puede superar 100 caracteres.');
  const kind = (input.kind ?? 'CONSUMPTIONS').trim().toUpperCase();
  if (!expenseTabs.includes(kind as ExpenseTab))
    throw new AppError(400, 'FINANCE_REPORT_KIND_INVALID', 'Selecciona una sección de gastos disponible.');
  const providerId = (input.providerId ?? '').trim();
  if (providerId && !/^[0-9a-fA-F-]{36}$/.test(providerId))
    throw new AppError(400, 'FINANCE_REPORT_PROVIDER_INVALID', 'Proveedor no válido.');
  return {
    from, to, start, end, endExclusive,
    kind: kind as ExpenseTab, q, providerId,
    page: Number.isSafeInteger(input.page) ? Math.max(1, Math.min(100000, input.page!)) : 1,
    pageSize: 12,
  };
}
type Filters = ReturnType<typeof normalizeExpenseReportFilters>;
export const expenseReportWhere = (f: Filters) => ({
  consumptions: {
    periodStart: { gte: f.start, lt: f.endExclusive },
    ...(f.providerId ? {providerId:f.providerId} : {}),
    ...(f.q ? {OR: [
      {externalId:{contains:f.q}},{provider:{is:{name:{contains:f.q}}}},
      {service:{is:{name:{contains:f.q}}}},
    ]} : {}),
  } satisfies Prisma.FinancialConsumptionWhereInput,
  invoices: {
    periodStart: {gte:f.start,lt:f.endExclusive},
    ...(f.providerId?{providerId:f.providerId}:{}),
    ...(f.q?{OR:[{externalId:{contains:f.q}},{invoiceNumber:{contains:f.q}},
      {provider:{is:{name:{contains:f.q}}}}]}:{}),
  } satisfies Prisma.FinancialInvoiceWhereInput,
  payments: {
    createdAt:{gte:f.start,lt:f.endExclusive},
    ...(f.providerId?{invoice:{is:{providerId:f.providerId}}}:{}),
    ...(f.q?{OR:[{reference:{contains:f.q}},{invoice:{is:{
      OR:[{externalId:{contains:f.q}},{invoiceNumber:{contains:f.q}},
        {provider:{is:{name:{contains:f.q}}}}]}}}]}:{}),
  } satisfies Prisma.FinancialPaymentWhereInput,
  budgets: {
    periodStart:{lt:f.endExclusive},periodEnd:{gte:f.start},
    ...(f.providerId?{providerId:f.providerId}:{}),
    ...(f.q?{OR:[{name:{contains:f.q}},{provider:{is:{name:{contains:f.q}}}}]}:{}),
  } satisfies Prisma.FinancialBudgetWhereInput,
  providers: {
    ...(f.providerId?{id:f.providerId}:{}),
    ...(f.q?{name:{contains:f.q}}:{}),
  } satisfies Prisma.FinancialProviderWhereInput,
  alerts: {
    createdAt:{gte:f.start,lt:f.endExclusive},
    ...(f.q?{message:{contains:f.q}}:{}),
  } satisfies Prisma.FinancialAlertWhereInput,
  audit: {
    createdAt:{gte:f.start,lt:f.endExclusive},
    ...(f.q?{OR:[{action:{contains:f.q}},{entityType:{contains:f.q}},
      {reason:{contains:f.q}}]}:{}),
  } satisfies Prisma.FinancialAuditEntryWhereInput,
});

type GroupedConsumption = {
  providerId:string;periodStart:Date;dataKind:string;
  _sum:{amountCop:Prisma.Decimal|null;amountUsd:Prisma.Decimal|null;creditsUsd:Prisma.Decimal|null};
  _count:{_all:number};
};
/** Each database group may represent many rows. Count and sum the underlying
 * movements, not the number of aggregate groups, with precise decimal math. */
export function foldExpenseConsumption(
  groups:ReadonlyArray<GroupedConsumption>,providerNames:ReadonlyMap<string,string>,
) {
  let consumptionRecords=0;
  let grossCop=new Prisma.Decimal(0),grossUsd=new Prisma.Decimal(0),creditsUsd=new Prisma.Decimal(0);
  const providerAmounts=new Map<string,{name:string;amount:Prisma.Decimal;rows:number}>();
  const dailyAmounts=new Map<string,Prisma.Decimal>();
  const origins:Record<string,number>={REAL:0,ESTIMATED:0,PROJECTED:0,MANUAL:0};
  for(const item of groups){
    const amountCop=item._sum.amountCop??new Prisma.Decimal(0);
    const amountUsd=item._sum.amountUsd??new Prisma.Decimal(0);
    const creditUsd=item._sum.creditsUsd??new Prisma.Decimal(0);
    const rows=item._count._all;
    consumptionRecords+=rows;
    grossCop=grossCop.plus(amountCop);
    grossUsd=grossUsd.plus(amountUsd);
    creditsUsd=creditsUsd.plus(creditUsd);
    origins[item.dataKind]=(origins[item.dataKind]??0)+rows;
    const name=providerNames.get(item.providerId)??'Proveedor no identificado';
    const found=providerAmounts.get(item.providerId)??{name,amount:new Prisma.Decimal(0),rows:0};
    found.amount=found.amount.plus(amountCop);
    found.rows+=rows;
    providerAmounts.set(item.providerId,found);
    const day=item.periodStart.toISOString().slice(0,10);
    dailyAmounts.set(day,(dailyAmounts.get(day)??new Prisma.Decimal(0)).plus(amountCop));
  }
  return {consumptionRecords,grossCop,grossUsd,creditsUsd,origins,providerAmounts,dailyAmounts};
}

/** Read-only real financial overview. Does NOT equate consumption, invoices and outflows.
 * Aggregate by recorded periodStart; all daily gaps appear with an explicit real zero. */
export async function getExpenseOverview(input: {from?:string;to?:string}, now = new Date()) {
  const f = normalizeExpenseReportFilters({ ...input }, now);
  const w = expenseReportWhere(f);
  const [consumptions, invoiceSum, paidSum, paymentStatuses, budgets, providers, lastSync] = await Promise.all([
    // Aggregate in MySQL: dashboard memory grows by provider/day/origin groups,
    // not by the number of raw consumption movements in the selected period.
    prisma.financialConsumption.groupBy({
      where:w.consumptions,
      by:['providerId','periodStart','dataKind'],
      _sum:{amountCop:true,amountUsd:true,creditsUsd:true},
      _count:{_all:true},
    }),
    prisma.financialInvoice.aggregate({
      where:w.invoices,_count:{_all:true},_sum:{amountCop:true},
    }),
    prisma.financialPayment.aggregate({
      where:{...w.payments,status:'PAID'},_count:{_all:true},_sum:{amountCop:true},
    }),
    prisma.financialPayment.groupBy({
      where:w.payments,by:['status'],_count:{_all:true},
    }),
    prisma.financialBudget.findMany({
      where:w.budgets,select:{id:true,name:true,amountCop:true,active:true,
        periodStart:true,periodEnd:true,provider:{select:{name:true}}},
    }),
    prisma.financialProvider.findMany({
      select:{id:true,name:true,active:true},orderBy:{name:'asc'},
    }),
    prisma.financialSyncRun.findFirst({
      orderBy:{startedAt:'desc'},
      select:{status:true,startedAt:true,finishedAt:true,provider:{select:{name:true}}},
    }),
  ]);
  const providerNames = new Map(providers.map(provider => [provider.id, provider.name]));
  const {consumptionRecords,grossCop,grossUsd,creditsUsd,origins,providerAmounts,dailyAmounts}
    = foldExpenseConsumption(consumptions,providerNames);
  const span = Math.floor((f.end.valueOf()-f.start.valueOf())/86400000)+1;
  const bucketSize = span>120?'month':span>45?'week':'day';
  const buckets = new Map<string,Prisma.Decimal>();
  for (let i=0;i<span;i++) {
    const d=new Date(f.start.valueOf()+i*86400000);
    const key=bucketSize==='month'?d.toISOString().slice(0,7)
      :bucketSize==='week'?Math.floor(i/7).toString().padStart(2,'0')
      :d.toISOString().slice(0,10);
    buckets.set(key,(buckets.get(key)??new Prisma.Decimal(0)).plus(
      dailyAmounts.get(d.toISOString().slice(0,10))??new Prisma.Decimal(0)));
  }
  const timeline=Array.from(buckets.entries()).map(([key,amount],index)=>({
    label:bucketSize==='week'
      ?new Date(f.start.valueOf()+index*7*86400000).toISOString().slice(0,10)
      :key,
    amountCop:amount.toString(),
  }));
  const providerBreakdown=Array.from(providerAmounts.entries())
    .map(([id,p])=>({id,name:p.name,amountCop:p.amount.toString(),records:p.rows}))
    .sort((a,b)=>Number(b.amountCop)-Number(a.amountCop));
  return {
    scope:'TECHNOLOGY_VENDOR_EXPENSES' as const,
    currency:'COP' as const,
    period:{from:f.from,to:f.to,origin:'periodStart para consumos y facturas; createdAt para pagos'},
    totals:{
      consumptionCop:grossCop.toString(),consumptionUsd:grossUsd.toString(),
      creditsUsd:creditsUsd.toString(),netConsumptionUsd:grossUsd.minus(creditsUsd).toString(),
      consumptionRecords,
      invoicesCop:invoiceSum._sum.amountCop?.toString()??'0',
      invoiceRecords:invoiceSum._count._all,
      markedPaidCop:paidSum._sum.amountCop?.toString()??'0',
      markedPaidRecords:paidSum._count._all,
      pendingPaymentRecords:paymentStatuses.find(s=>s.status==='PENDING')?._count._all??0,
      activeBudgets:budgets.filter(b=>b.active).length,
      providers:providers.filter(p=>p.active).length,
    },
    originCounts:origins,
    providers:providers.filter(({active})=>active).map(({id,name})=>({id,name})),
    providerBreakdown,
    timeline:{unit:bucketSize,points:timeline},
    budgets:budgets.map(b=>({
      id:b.id,name:b.name,amountCop:b.amountCop.toString(),active:b.active,
      providerName:b.provider?.name??'General',periodStart:b.periodStart.toISOString().slice(0,10),
      periodEnd:b.periodEnd.toISOString().slice(0,10),
    })),
    lastSync:lastSync?{
      status:lastSync.status,providerName:lastSync.provider.name,
      startedAt:lastSync.startedAt.toISOString(),
      finishedAt:lastSync.finishedAt?.toISOString()??null,
    }:null,
    notes:[
      'Consumo COP es la suma registrada sin descontar créditos USD; no se convierte USD a COP con tasas implícitas.',
      'Consumo USD neto descuenta solo créditos registrados en USD; puede incluir registros reales, estimados, proyectados y manuales.',
      'Facturado COP procede de facturas de proveedores, no de ventas; puede cubrir los mismos consumos y no se debe sumar con ellos.',
      'Marcado PAID es un estado del registro de pagos; no prueba una conciliación bancaria.',
      'Los presupuestos tienen vigencias propias: no se suman indiscriminadamente ni se comparan como saldo disponible.',
      'Gráfica por fecha inicial de consumo, con cero explícito en días sin registros; el período no prorratea servicios ni certifica facturación DIAN.',
    ],
  };
}
type Ledger = { from?:string;to?:string;page?:number;kind?:string;q?:string;providerId?:string };
export async function listExpenseLedger(input: Ledger,now=new Date()) {
  const f=normalizeExpenseReportFilters(input,now), w=expenseReportWhere(f);
  const page={skip:(f.page-1)*f.pageSize,take:f.pageSize};
  let records:Array<Record<string,unknown>>=[],total=0;
  switch(f.kind) {
    case 'CONSUMPTIONS': {
      const [n,items]=await Promise.all([
        prisma.financialConsumption.count({where:w.consumptions}),
        prisma.financialConsumption.findMany({where:w.consumptions,...page,
          orderBy:[{periodStart:'desc'},{id:'desc'}],include:{provider:true,service:true}}),
      ]);
      total=n;
      records=items.map(x=>({
        id:x.id,kind:f.kind,name:x.service?.name??'Consumo general',
        detail:x.externalId,providerName:x.provider.name,providerId:x.providerId,
        amountCop:x.amountCop.toString(),amountUsd:x.amountUsd.toString(),
        creditsUsd:x.creditsUsd.toString(),status:x.dataKind,
        periodStart:x.periodStart.toISOString().slice(0,10),
        periodEnd:x.periodEnd.toISOString().slice(0,10),
        createdAt:x.createdAt.toISOString(),
        canEdit:x.dataKind==='MANUAL',region:x.region,
      }));
      break;
    }
    case 'INVOICES': {
      const [n,items]=await Promise.all([
        prisma.financialInvoice.count({where:w.invoices}),
        prisma.financialInvoice.findMany({where:w.invoices,...page,
          orderBy:[{periodStart:'desc'},{id:'desc'}],include:{provider:true}}),
      ]);
      total=n;
      records=items.map(x=>({
        id:x.id,kind:f.kind,name:x.invoiceNumber??x.externalId,detail:x.externalId,
        providerName:x.provider.name,providerId:x.providerId,
        amountCop:x.amountCop.toString(),amountUsd:x.amountUsd.toString(),status:x.dataKind,
        periodStart:x.periodStart.toISOString().slice(0,10),
        periodEnd:x.periodEnd.toISOString().slice(0,10),
        documentUrl:x.documentUrl,createdAt:x.createdAt.toISOString(),canEdit:true,
      }));
      break;
    }
    case 'PAYMENTS': {
      const [n,items]=await Promise.all([
        prisma.financialPayment.count({where:w.payments}),
        prisma.financialPayment.findMany({where:w.payments,...page,
          orderBy:[{createdAt:'desc'},{id:'desc'}],include:{invoice:{include:{provider:true}}}}),
      ]);
      total=n;
      records=items.map(x=>({
        id:x.id,kind:f.kind,name:x.invoice.invoiceNumber??x.invoice.externalId,
        detail:x.reference??'Sin referencia',providerName:x.invoice.provider.name,
        providerId:x.invoice.providerId,amountCop:x.amountCop.toString(),amountUsd:null,
        status:x.status,createdAt:x.createdAt.toISOString(),
        paidAt:x.paidAt?.toISOString()??null,reference:x.reference,canEdit:true,
      }));
      break;
    }
    case 'BUDGETS': {
      const [n,items]=await Promise.all([
        prisma.financialBudget.count({where:w.budgets}),
        prisma.financialBudget.findMany({where:w.budgets,...page,
          orderBy:[{periodStart:'desc'},{id:'desc'}],include:{provider:true}}),
      ]);
      total=n;
      records=items.map(x=>({
        id:x.id,kind:f.kind,name:x.name,detail:x.active?'Presupuesto activo':'Inactivo',
        providerName:x.provider?.name??'General',providerId:x.providerId,
        amountCop:x.amountCop.toString(),amountUsd:x.amountUsd?.toString()??null,
        status:x.active?'ACTIVE':'INACTIVE',periodStart:x.periodStart.toISOString().slice(0,10),
        periodEnd:x.periodEnd.toISOString().slice(0,10),createdAt:x.createdAt.toISOString(),
        canEdit:true,
      }));
      break;
    }
    case 'PROVIDERS': {
      const [n,items]=await Promise.all([
        prisma.financialProvider.count({where:w.providers}),
        prisma.financialProvider.findMany({where:w.providers,...page,
          orderBy:[{name:'asc'},{id:'asc'}]}),
      ]);
      total=n;
      records=items.map(x=>({
        id:x.id,kind:f.kind,name:x.name,detail:x.kind,providerName:x.name,
        providerId:x.id,amountCop:null,amountUsd:null,currency:x.currency,
        status:x.active?'ACTIVE':'INACTIVE',createdAt:x.createdAt.toISOString(),canEdit:true,
      }));
      break;
    }
    case 'ALERTS': {
      const [n,items]=await Promise.all([
        prisma.financialAlert.count({where:w.alerts}),
        prisma.financialAlert.findMany({where:w.alerts,...page,orderBy:[{createdAt:'desc'},{id:'desc'}]}),
      ]);
      total=n;
      records=items.map(x=>({
        id:x.id,kind:f.kind,name:x.message,detail:'Umbral '+x.threshold+'%',
        providerName:null,amountCop:null,amountUsd:null,
        status:x.acknowledgedAt?'ACKNOWLEDGED':'PENDING',createdAt:x.createdAt.toISOString(),
        acknowledgedAt:x.acknowledgedAt?.toISOString()??null,
        canEdit:!x.acknowledgedAt,
      }));
      break;
    }
    case 'AUDIT': {
      const [n,items]=await Promise.all([
        prisma.financialAuditEntry.count({where:w.audit}),
        prisma.financialAuditEntry.findMany({where:w.audit,...page,
          orderBy:[{createdAt:'desc'},{id:'desc'}]}),
      ]);
      total=n;
      records=items.map(x=>({
        id:x.id,kind:f.kind,name:x.action,detail:x.entityType,
        providerName:null,amountCop:null,amountUsd:null,status:x.entityType,
        createdAt:x.createdAt.toISOString(),reason:x.reason,
        actorUserId:x.actorUserId,canEdit:false,
      }));
      break;
    }
  }
  return {
    scope:'TECHNOLOGY_VENDOR_EXPENSES' as const,kind:f.kind,
    period:{from:f.from,to:f.to},records,
    pagination:{page:f.page,pageSize:f.pageSize,total,totalPages:Math.ceil(total/f.pageSize)},
    definition:'Consulta paginada de registros existentes; consumos y facturas por periodStart, pagos y auditoría por createdAt. Proveedores no tienen filtro temporal. Presupuestos se muestran si su vigencia intersecta el período.',
  };
}
