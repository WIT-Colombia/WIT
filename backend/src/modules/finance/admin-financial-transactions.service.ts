import { Prisma, type FinancialPaymentStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

export const financialPaymentStatuses = ['PENDING', 'PAID', 'CANCELLED'] as const;
export type AdminFinancialTransactionStatus = typeof financialPaymentStatuses[number];

const validDay = (raw: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(raw + 'T00:00:00.000Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0,10) === raw ? date : null;
};

/** Read-only filters over existing FinancialPayment rows (vendor outflows only). */
export function normalizeAdminFinancialTransactionsQuery(query: {
  page?: number; pageSize?: number; status?: string; q?: string; from?: string; to?: string;
}) {
  const page = Number.isSafeInteger(query.page) ? Math.min(100000, Math.max(1, query.page!)) : 1;
  const pageSize = Number.isSafeInteger(query.pageSize) ? Math.min(50, Math.max(1, query.pageSize!)) : 12;
  const q = (query.q ?? '').trim();
  const status = (query.status ?? '').trim().toUpperCase();
  const from = (query.from ?? '').trim();
  const to = (query.to ?? '').trim();
  if (q.length > 100) throw new AppError(400, 'FINANCIAL_TRANSACTION_SEARCH_TOO_LONG',
    'La búsqueda no puede superar 100 caracteres.');
  if (status && !financialPaymentStatuses.includes(status as AdminFinancialTransactionStatus))
    throw new AppError(400, 'FINANCIAL_TRANSACTION_STATUS_INVALID',
      'El estado de la transacción no está registrado en el sistema.');
  const fromDate = from ? validDay(from) : null;
  const toDate = to ? validDay(to) : null;
  if ((from && !fromDate) || (to && !toDate))
    throw new AppError(400, 'FINANCIAL_TRANSACTION_DATE_INVALID',
      'Selecciona fechas válidas con formato AAAA-MM-DD.');
  if (fromDate && toDate && fromDate > toDate)
    throw new AppError(400, 'FINANCIAL_TRANSACTION_DATE_ORDER_INVALID',
      'La fecha inicial no puede ser posterior a la final.');
  const endExclusive = toDate ? new Date(toDate.valueOf() + 86400000) : null;
  return {
    page, pageSize, q, status: status as AdminFinancialTransactionStatus | '',
    from, to, fromDate, endExclusive,
  };
}

export function adminFinancialTransactionsWhere(
  filters: ReturnType<typeof normalizeAdminFinancialTransactionsQuery>,
): Prisma.FinancialPaymentWhereInput {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.fromDate || filters.endExclusive ? {
      createdAt: {
        ...(filters.fromDate ? { gte: filters.fromDate } : {}),
        ...(filters.endExclusive ? { lt: filters.endExclusive } : {}),
      },
    } : {}),
    ...(filters.q ? {
      OR: [
        { reference: { contains: filters.q } },
        { invoice: { is: { invoiceNumber: { contains: filters.q } } } },
        { invoice: { is: { externalId: { contains: filters.q } } } },
        { invoice: { is: { provider: { is: { name: { contains: filters.q } } } } } },
      ],
    } : {}),
  };
}

/** Global metrics describe all persisted vendor payments; filters apply to table only.
 * "PAID" is recorded system status, not proof of bank settlement. */
export async function listAdminFinancialTransactions(query: {
  page?: number; pageSize?: number; status?: string; q?: string; from?: string; to?: string;
}) {
  const filters = normalizeAdminFinancialTransactionsQuery(query);
  const where = adminFinancialTransactionsWhere(filters);
  const [total, payments, summary] = await prisma.$transaction([
    prisma.financialPayment.count({ where }),
    prisma.financialPayment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      select: {
        id: true, status: true, amountCop: true, reference: true, createdAt: true, paidAt: true,
        invoice: {
          select: {
            id: true, externalId: true, invoiceNumber: true,
            amountCop: true, documentUrl: true,
            provider: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.financialPayment.groupBy({
      by: ['status'], _count: { _all: true }, _sum: { amountCop: true },
    }),
  ]);
  const metrics = Object.fromEntries(financialPaymentStatuses.map(status => {
    const item = summary.find(group => group.status === status);
    return [status, {
      count: item?._count._all ?? 0,
      amountCop: Number(item?._sum.amountCop ?? 0),
    }];
  })) as Record<AdminFinancialTransactionStatus, { count: number; amountCop: number }>;
  return {
    generatedAt: new Date().toISOString(),
    scope: 'VENDOR_PAYMENTS' as const,
    currency: 'COP' as const,
    totals: {
      records: summary.reduce((sum, item) => sum + item._count._all, 0),
      ...metrics,
    },
    transactions: payments.map(row => ({
      id: row.id,
      status: row.status,
      amountCop: row.amountCop.toString(),
      reference: row.reference,
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
      invoice: {
        id: row.invoice.id, invoiceNumber: row.invoice.invoiceNumber,
        externalId: row.invoice.externalId,
        amountCop: row.invoice.amountCop.toString(),
        documentUrl: row.invoice.documentUrl,
        provider: row.invoice.provider,
      },
    })),
    pagination: {
      page: filters.page, pageSize: filters.pageSize, total,
      totalPages: Math.ceil(total / filters.pageSize),
    },
    definition: 'Registro de pagos salientes a proveedores en COP. Los estados son PENDING, PAID y CANCELLED. El estado PAID es un dato administrativo y no confirma conciliación bancaria. No contiene ingresos ni cobros de clientes.',
  };
}
