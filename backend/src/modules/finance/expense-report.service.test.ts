import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeExpenseReportFilters,expenseReportWhere,expenseTabs} from './expense-report.service.js';

const now=new Date('2026-11-18T17:00:00.000Z');
test('período por defecto usa el mes real, ambos extremos inclusivos',()=>{
  const parsed=normalizeExpenseReportFilters({},now);
  assert.equal(parsed.from,'2026-11-01');
  assert.equal(parsed.to,'2026-11-18');
  assert.deepEqual(parsed.start,new Date('2026-11-01T00:00:00.000Z'));
  assert.deepEqual(parsed.endExclusive,new Date('2026-11-19T00:00:00.000Z'));
});
test('rechaza fechas inexistentes, intervalos invertidos y períodos excesivos',()=>{
  for(const input of [
    {from:'2026-02-30',to:'2026-03-31'},
    {from:'2026-12-01',to:'2026-11-18'},
    {from:'2020-01-01',to:'2026-11-18'},
    {from:'2026-11-18',to:'2026-11-99'},
  ])assert.throws(()=>normalizeExpenseReportFilters(input,now),
    (error:any)=>error.code==='FINANCE_REPORT_PERIOD_INVALID');
});
test('historial usa únicamente secciones reales, paginación y búsqueda limitadas',()=>{
  assert.deepEqual(expenseTabs,['CONSUMPTIONS','INVOICES','PAYMENTS',
    'BUDGETS','PROVIDERS','ALERTS','AUDIT']);
  assert.equal(normalizeExpenseReportFilters({kind:'invoices',page:999999},now).page,100000);
  assert.throws(()=>normalizeExpenseReportFilters({kind:'BANK_RECONCILIATION'},now),
    (error:any)=>error.code==='FINANCE_REPORT_KIND_INVALID');
  assert.throws(()=>normalizeExpenseReportFilters({q:'x'.repeat(101)},now),
    (error:any)=>error.code==='FINANCE_REPORT_SEARCH_TOO_LONG');
  assert.throws(()=>normalizeExpenseReportFilters({providerId:'abc'},now),
    (error:any)=>error.code==='FINANCE_REPORT_PROVIDER_INVALID');
});
test('consumos y facturas se filtran por inicio del período; pagos por fecha de registro',()=>{
  const providerId='12345678-1234-1234-1234-123456789abc';
  const f=normalizeExpenseReportFilters({from:'2026-11-01',to:'2026-11-18',q:'AWS',providerId},now);
  const w=expenseReportWhere(f);
  assert.deepEqual(w.consumptions.periodStart,{gte:new Date('2026-11-01T00:00:00.000Z'),
    lt:new Date('2026-11-19T00:00:00.000Z')});
  assert.deepEqual(w.invoices.periodStart,w.consumptions.periodStart);
  assert.deepEqual(w.payments.createdAt,w.consumptions.periodStart);
  assert.equal(w.consumptions.providerId,providerId);
  assert.equal(w.invoices.providerId,providerId);
  assert.deepEqual(w.payments.invoice,{is:{providerId}});
  assert.ok(Array.isArray(w.payments.OR),'la búsqueda de pagos incluye las referencias del proveedor');
});
test('presupuestos intersectan el rango; proveedores no se falsean con filtros de fechas',()=>{
  const f=normalizeExpenseReportFilters({from:'2026-11-01',to:'2026-11-18'},now);
  const w=expenseReportWhere(f);
  assert.deepEqual(w.budgets.periodStart,{lt:new Date('2026-11-19T00:00:00.000Z')});
  assert.deepEqual(w.budgets.periodEnd,{gte:new Date('2026-11-01T00:00:00.000Z')});
  assert.deepEqual(w.providers,{});
});
