import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createManualConsumption, createProvider, createBudget, createInvoice, createPayment,
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
