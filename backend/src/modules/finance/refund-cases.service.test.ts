import test from 'node:test';
import assert from 'node:assert/strict';
import {
  refundCaseStatuses, normalizeRefundCaseFilters, refundCaseWhere,
  validateNewRefundCase, validateRefundCaseDecision,
} from './refund-cases.service.js';

test('las solicitudes de reembolso solo tienen estados de seguimiento, nunca PAID ni REFUNDED',()=>{
  assert.deepEqual(refundCaseStatuses,['OPEN','IN_REVIEW','NEEDS_INFORMATION','CLOSED']);
  assert.deepEqual(normalizeRefundCaseFilters({}),{page:1,pageSize:12,status:'',q:'',from:'',to:'',fromDate:null,endExclusive:null});
  assert.equal(normalizeRefundCaseFilters({status:'in_review'}).status,'IN_REVIEW');
  assert.throws(()=>normalizeRefundCaseFilters({status:'REFUNDED'}),
    (e:any)=>e.code==='REFUND_CASE_STATUS_INVALID');
  assert.throws(()=>normalizeRefundCaseFilters({status:'APPROVED'}),
    (e:any)=>e.code==='REFUND_CASE_STATUS_INVALID');
});
test('filtra antes de paginar por asunto, referencia o correo; limita búsquedas',()=>{
  const f=normalizeRefundCaseFilters({page:101, status:'OPEN',q:'   AB123   '});
  assert.equal(f.page,101);
  assert.deepEqual(refundCaseWhere(f),{
    status:'OPEN',OR:[
      {subject:{contains:'AB123'}},{externalReference:{contains:'AB123'}},
      {contactEmail:{contains:'AB123'}},
    ],
  });
  assert.throws(()=>normalizeRefundCaseFilters({q:'x'.repeat(101)}),
    (e:any)=>e.code==='REFUND_CASE_SEARCH_TOO_LONG');
});
test('no permite expedientes sin datos mínimos ni solicita datos bancarios',()=>{
  const caseData=validateNewRefundCase({
    subject:'Solicitud de revisión de cobro',
    description:'El interesado solicita información sobre un cargo reportado.',
    contactEmail:'  prueba@example.com  ',externalReference:' REF-001 ',
    requestedAmountCop:'100000.25',
  });
  assert.equal(caseData.requestedAmountCop,'100000.25');
  assert.equal(caseData.externalReference,'REF-001');
  assert.equal(caseData.contactEmail,'prueba@example.com');
  assert.throws(()=>validateNewRefundCase({subject:'Corto',description:'x'}),
    (e:any)=>e.code==='REFUND_CASE_INVALID_INPUT');
  assert.throws(()=>validateNewRefundCase({subject:'Solicitud válida',description:'Descripción razonable para el caso de seguimiento',
    requestedAmountCop:'-100'}),(e:any)=>e.code==='REFUND_CASE_AMOUNT_INVALID');
  assert.throws(()=>validateNewRefundCase({subject:'Solicitud válida',description:'Descripción razonable para el caso de seguimiento',
    requestedAmountCop:'1e10'}),(e:any)=>e.code==='REFUND_CASE_AMOUNT_INVALID');
  assert.throws(()=>validateNewRefundCase({subject:'Solicitud válida',description:'Descripción razonable para el caso de seguimiento',
    contactEmail:'invalid-email'}),(e:any)=>e.code==='REFUND_CASE_EMAIL_INVALID');
});
test('las decisiones administrativas exigen motivo y jamás aceptan estado de pago realizado',()=>{
  assert.deepEqual(validateRefundCaseDecision({status:'closed',reason:'Cierre de expediente sin registro bancario.'}),{
    status:'CLOSED',reason:'Cierre de expediente sin registro bancario.',
  });
  assert.throws(()=>validateRefundCaseDecision({status:'CLOSED',reason:'Sí'}),
    (e:any)=>e.code==='REFUND_CASE_INVALID_INPUT');
  assert.throws(()=>validateRefundCaseDecision({status:'PAID',reason:'Se verificó con el banco externo.'}),
    (e:any)=>e.code==='REFUND_CASE_STATUS_INVALID');
});

test('filtro por radicación usa límites UTC inclusivos y rechaza fechas imposibles',()=>{
  const filters=normalizeRefundCaseFilters({status:'OPEN',from:'2026-11-01',to:'2026-11-18'});
  assert.deepEqual(refundCaseWhere(filters),{status:'OPEN',
    createdAt:{gte:new Date('2026-11-01T00:00:00.000Z'),lt:new Date('2026-11-19T00:00:00.000Z')}});
  assert.throws(()=>normalizeRefundCaseFilters({from:'2026-02-30'}),
    (e:any)=>e.code==='REFUND_CASE_DATE_INVALID');
  assert.throws(()=>normalizeRefundCaseFilters({from:'2026-11-20',to:'2026-11-01'}),
    (e:any)=>e.code==='REFUND_CASE_DATE_INVALID');
  assert.deepEqual(refundCaseWhere(normalizeRefundCaseFilters({})),{});
});
