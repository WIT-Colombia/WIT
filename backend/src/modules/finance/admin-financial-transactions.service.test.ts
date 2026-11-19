import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adminFinancialTransactionsWhere,
  normalizeAdminFinancialTransactionsQuery,
} from './admin-financial-transactions.service.js';

test('usa únicamente los tres estados existentes de FinancialPayment', () => {
  assert.deepEqual(normalizeAdminFinancialTransactionsQuery({}), {
    page: 1, pageSize: 12, q: '', status: '', from: '', to: '',
    fromDate: null, endExclusive: null,
  });
  assert.equal(normalizeAdminFinancialTransactionsQuery({ status: 'paid' }).status, 'PAID');
  assert.equal(normalizeAdminFinancialTransactionsQuery({ status: 'pending' }).status, 'PENDING');
  assert.equal(normalizeAdminFinancialTransactionsQuery({ status: 'cancelled' }).status, 'CANCELLED');
  assert.throws(() => normalizeAdminFinancialTransactionsQuery({ status: 'REFUNDED' }),
    (err: any) => err.code === 'FINANCIAL_TRANSACTION_STATUS_INVALID');
});

test('limita paginación y tamaño de búsqueda', () => {
  const normalized = normalizeAdminFinancialTransactionsQuery({
    page: 999999, pageSize: 500, q: '  factura  ',
  });
  assert.equal(normalized.page, 100000);
  assert.equal(normalized.pageSize, 50);
  assert.equal(normalized.q, 'factura');
  assert.throws(() => normalizeAdminFinancialTransactionsQuery({ q: 'x'.repeat(101) }),
    (err: any) => err.code === 'FINANCIAL_TRANSACTION_SEARCH_TOO_LONG');
});

test('filtra desde fecha UTC inicial hasta límite exclusivo siguiente a fecha final', () => {
  const normalized = normalizeAdminFinancialTransactionsQuery({
    from: '2026-11-01', to: '2026-11-18', status: 'PAID',
  });
  assert.deepEqual(adminFinancialTransactionsWhere(normalized), {
    status: 'PAID', createdAt: {
      gte: new Date('2026-11-01T00:00:00.000Z'),
      lt: new Date('2026-11-19T00:00:00.000Z'),
    },
  });
  assert.throws(() => normalizeAdminFinancialTransactionsQuery({
    from: '2026-12-18', to: '2026-11-18',
  }), (err: any) => err.code === 'FINANCIAL_TRANSACTION_DATE_ORDER_INVALID');
  assert.throws(() => normalizeAdminFinancialTransactionsQuery({ from: '2026-02-30' }),
    (err: any) => err.code === 'FINANCIAL_TRANSACTION_DATE_INVALID');
});

test('busca referencia de pago y factura de proveedor, no ingresos inventados', () => {
  const where = adminFinancialTransactionsWhere(
    normalizeAdminFinancialTransactionsQuery({ q: 'AWS', status: 'PENDING' }),
  );
  assert.equal(where.status, 'PENDING');
  assert.deepEqual(where.OR, [
    { reference: { contains: 'AWS' } },
    { invoice: { is: { invoiceNumber: { contains: 'AWS' } } } },
    { invoice: { is: { externalId: { contains: 'AWS' } } } },
    { invoice: { is: { provider: { is: { name: { contains: 'AWS' } } } } } },
  ]);
  assert.deepEqual(adminFinancialTransactionsWhere(normalizeAdminFinancialTransactionsQuery({})), {});
});
