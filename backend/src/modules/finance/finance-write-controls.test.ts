import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '../../generated/prisma/client.js';
import {
  createManualConsumption, createProvider, createBudget, createInvoice, createPayment,
  assertSupplierInvoiceCapacity, assertInvoiceAmendmentCapacity,validAmount,
} from './finance.service.js';

const authorized = { userId: '11111111-1111-1111-1111-111111111111',
  permissions: ['FINANCE_READ','FINANCE_MANAGE'] } as any;
const readOnly = { userId: authorized.userId, permissions: ['FINANCE_READ'] } as any;
const goodDate = new Date('2026-11-18T00:00:00Z');

test('cualquier alta financiera exige FINANCE_MANAGE antes de tocar la base de datos',async()=>{
  await assert.rejects(createProvider(readOnly,{name:'AWS',kind:'AWS'}), (e:any)=>e.code==='FINANCE_PERMISSION_DENIED');
  await assert.rejects(createBudget(readOnly,{name:'AWS mensual',amountCop:150000,
    periodStart:goodDate,periodEnd:goodDate}), (e:any)=>e.code==='FINANCE_PERMISSION_DENIED');
  await assert.rejects(createInvoice(readOnly,{providerId:'a',externalId:'b',
    periodStart:goodDate,periodEnd:goodDate,amountCop:100,amountUsd:2}), (e:any)=>e.code==='FINANCE_PERMISSION_DENIED');
  await assert.rejects(createPayment(readOnly,{invoiceId:'a',amountCop:100,status:'PAID'}),
    (e:any)=>e.code==='FINANCE_PERMISSION_DENIED');
});
test('no se admiten montos negativos, estados ficticios o referencias demasiado largas',async()=>{
  await assert.rejects(createPayment(authorized,{invoiceId:'invoice',amountCop:-1,status:'PAID'}),
    (e:any)=>e.code==='INVALID_FINANCIAL_AMOUNT');
  await assert.rejects(createPayment(authorized,{invoiceId:'invoice',amountCop:100,
    status:'REFUNDED' as any}), (e:any)=>e.code==='FINANCE_PAYMENT_INVALID');
  await assert.rejects(createPayment(authorized,{invoiceId:'invoice',amountCop:100,
    status:'PENDING',reference:'X'.repeat(161)}), (e:any)=>e.code==='FINANCE_PAYMENT_INVALID');
  await assert.rejects(createProvider(authorized,{name:'Proveedor nuevo',kind:'INVALID' as any}),
    (e:any)=>e.code==='FINANCE_PROVIDER_INVALID');
  await assert.rejects(createManualConsumption(authorized,{
    providerId:'a',externalId:'b',periodStart:goodDate,periodEnd:goodDate,amountCop:-1,amountUsd:3,
  }), (e:any)=>e.code==='INVALID_FINANCIAL_AMOUNT');
});
test('presupuestos, facturas y consumos rechazan intervalos invertidos o no válidos',async()=>{
  const start=new Date('2026-11-20T00:00:00Z');
  await assert.rejects(createBudget(authorized,{name:'Presupuesto',amountCop:150000,
    periodStart:start,periodEnd:goodDate}), (e:any)=>e.code==='FINANCE_PERIOD_INVALID');
  await assert.rejects(createInvoice(authorized,{providerId:'a',externalId:'b',
    periodStart:new Date('invalid'),periodEnd:goodDate,amountCop:100,amountUsd:2}),
  (e:any)=>e.code==='FINANCE_PERIOD_INVALID');
  await assert.rejects(createManualConsumption(authorized,{providerId:'a',externalId:'b',
    periodStart:start,periodEnd:goodDate,amountCop:100,amountUsd:2}),
  (e:any)=>e.code==='FINANCE_PERIOD_INVALID');
});
test('las facturas manuales solo aceptan enlaces de soporte HTTPS',async()=>{
  await assert.rejects(createInvoice(authorized,{providerId:'a',externalId:'b',
    periodStart:goodDate,periodEnd:goodDate,amountCop:100,amountUsd:2,
    documentUrl:'javascript:alert(1)'}), (e:any)=>e.code==='INVALID_RECEIPT_URL');
});

test('la misma regla impide sobreasignar pagos nuevos y correcciones, sin contar cancelados',()=>{
  const dec=(n:string)=>new Prisma.Decimal(n);
  const invoice=dec('100000.00');
  const existing=[
    {id:'p-1',amountCop:dec('70000.00'),status:'PAID' as const},
    {id:'p-2',amountCop:dec('20000.00'),status:'PENDING' as const},
    {id:'cancelled',amountCop:dec('999999.00'),status:'CANCELLED' as const},
  ];
  assert.doesNotThrow(()=>assertSupplierInvoiceCapacity(invoice,existing,
    {amountCop:10000,status:'PENDING'}));
  assert.throws(()=>assertSupplierInvoiceCapacity(invoice,existing,
    {amountCop:10000.01,status:'PAID'}),(e:any)=>e.code==='PAYMENT_EXCEEDS_BALANCE');
  assert.doesNotThrow(()=>assertSupplierInvoiceCapacity(invoice,existing,
    {id:'p-1',amountCop:80000,status:'PAID'}));
  assert.throws(()=>assertSupplierInvoiceCapacity(invoice,existing,
    {id:'p-2',amountCop:40000,status:'PENDING'}),
    (e:any)=>e.code==='PAYMENT_EXCEEDS_BALANCE');
  assert.doesNotThrow(()=>assertSupplierInvoiceCapacity(invoice,existing,
    {amountCop:500000,status:'CANCELLED'}));
  assert.doesNotThrow(()=>assertSupplierInvoiceCapacity(invoice,existing,
    {id:'p-1',amountCop:70000,status:'CANCELLED'}));
});

test('COP conserva exactamente dos decimales; USD admite cuatro sin redondeos silenciosos',()=>{
  assert.doesNotThrow(()=>validAmount(10000.01));
  assert.doesNotThrow(()=>validAmount(0.0001,4));
  assert.throws(()=>validAmount(0.001),(e:any)=>e.code==='FINANCIAL_AMOUNT_PRECISION');
  assert.throws(()=>validAmount(0.00001,4),(e:any)=>e.code==='FINANCIAL_AMOUNT_PRECISION');
  assert.throws(()=>validAmount(1000000000000),(e:any)=>e.code==='FINANCIAL_AMOUNT_PRECISION');
  assert.throws(()=>validAmount(Number.POSITIVE_INFINITY),(e:any)=>e.code==='INVALID_FINANCIAL_AMOUNT');
});

test('no se reduce una factura por debajo de sus pagos PAID y PENDING, y se ignoran CANCELLED',()=>{
  const decimal=(value:string)=>new Prisma.Decimal(value);
  const allocations=[
    {status:'PAID' as const,amountCop:decimal('70000.01')},
    {status:'PENDING' as const,amountCop:decimal('20000.02')},
    {status:'CANCELLED' as const,amountCop:decimal('999999.99')},
  ];
  assert.doesNotThrow(()=>assertInvoiceAmendmentCapacity(90000.03,allocations));
  assert.throws(()=>assertInvoiceAmendmentCapacity(90000.02,allocations),
    (e:any)=>e.code==='INVOICE_BELOW_ALLOCATED_PAYMENTS');
  assert.doesNotThrow(()=>assertInvoiceAmendmentCapacity(0,[
    {status:'CANCELLED' as const,amountCop:decimal('1000.00')},
  ]));
});
