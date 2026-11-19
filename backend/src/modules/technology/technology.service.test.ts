import test from 'node:test';
import assert from 'node:assert/strict';
import {
  caseKinds,statesByKind,normalizeTechnologyCaseFilters,technologyCaseWhere,
  validateTechnologyCase,validateCaseTransition,buildRecordedIncidentTrend,
} from './technology.service.js';
import {classifyProductionJob} from './github-deployments.service.js';

test('three work types exist but only two navigation modules are needed',()=>{
  assert.deepEqual(caseKinds,['INCIDENT','MAINTENANCE','NEED']);
  assert.deepEqual(statesByKind.INCIDENT,['OPEN','IN_PROGRESS','RESOLVED']);
  assert.deepEqual(statesByKind.MAINTENANCE,['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED']);
  assert.deepEqual(statesByKind.NEED,['OPEN','IN_PROGRESS','BLOCKED','COMPLETED','CANCELLED']);
});
test('new cases require evidence, valid severity and a scheduled maintenance window',()=>{
  const incident=validateTechnologyCase({kind:'INCIDENT',title:'Servicio API lento',
    description:'Se registró una degradación observada con reporte de usuarios.',
    severity:'HIGH'});
  assert.equal(incident.status,'OPEN');
  assert.equal(incident.kind,'INCIDENT');
  assert.equal(incident.component,null);
  assert.throws(()=>validateTechnologyCase({kind:'MAINTENANCE',title:'Actualizar backend',
    description:'Se requiere una actualización controlada de dependencias.',
  }),(e:any)=>e.code==='TECH_MAINTENANCE_WINDOW_REQUIRED');
  assert.throws(()=>validateTechnologyCase({kind:'MAINTENANCE',title:'Actualizar backend',
    description:'Se requiere una actualización controlada de dependencias.',
    scheduledStartAt:'2026-11-19T17:00:00.000Z',
    scheduledEndAt:'2026-11-19T16:00:00.000Z',
  }),(e:any)=>e.code==='TECH_MAINTENANCE_WINDOW_INVALID');
  assert.equal(validateTechnologyCase({kind:'MAINTENANCE',title:'Actualizar backend',
    description:'Se requiere una actualización controlada de dependencias.',
    scheduledStartAt:'2026-11-19T16:00:00.000Z',
    scheduledEndAt:'2026-11-19T17:00:00.000Z',
  }).status,'PLANNED');
  assert.throws(()=>validateTechnologyCase({kind:'DEPLOY' as any,title:'Ajuste backend',
    description:'Se ejecuta un despliegue sin información verificable.'}),
    (e:any)=>e.code==='TECH_CASE_KIND_INVALID');
});
test('a reviewed transition requires a reason and forbids invented infrastructure status',()=>{
  assert.deepEqual(validateCaseTransition('INCIDENT','OPEN',{
    status:'RESOLVED',reason:'Se confirmó el restablecimiento tras la revisión.',
  }),{status:'RESOLVED',reason:'Se confirmó el restablecimiento tras la revisión.'});
  assert.throws(()=>validateCaseTransition('INCIDENT','OPEN',{
    status:'COMPLETED',reason:'Se confirmó el restablecimiento tras la revisión.',
  }),(e:any)=>e.code==='TECH_TRANSITION_INVALID');
  assert.throws(()=>validateCaseTransition('INCIDENT','OPEN',{
    status:'IN_PROGRESS',reason:'ok',
  }),(e:any)=>e.code==='TECH_CASE_INVALID_INPUT');
  assert.throws(()=>validateCaseTransition('NEED','BLOCKED',{
    status:'RESOLVED',reason:'No se cuenta con una evidencia comprobable.',
  }),(e:any)=>e.code==='TECH_TRANSITION_INVALID');
});
test('server-side filtering limits search and page sizes',()=>{
  const parsed=normalizeTechnologyCaseFilters({kind:'need',status:'open',q:'AWS',page:300000});
  assert.equal(parsed.page,100000);
  assert.equal(parsed.pageSize,12);
  assert.deepEqual(technologyCaseWhere(parsed),{
    kind:'NEED',status:'OPEN',OR:[
      {title:{contains:'AWS'}},{component:{contains:'AWS'}},{description:{contains:'AWS'}},
    ],
  });
  assert.throws(()=>normalizeTechnologyCaseFilters({q:'X'.repeat(101)}),
    (e:any)=>e.code==='TECH_CASE_SEARCH_TOO_LONG');
});
test('incident chart has explicit zero rows only for registered cases',()=>{
  const points=buildRecordedIncidentTrend([{day:'2026-11-18',count:2}],
    new Date('2026-11-19T18:00:00Z'),3);
  assert.deepEqual(points,[
    {date:'2026-11-17',count:0},{date:'2026-11-18',count:2},
    {date:'2026-11-19',count:0},
  ]);
});
test('production is confirmed only by the completed successful deploy job',()=>{
  assert.equal(classifyProductionJob([{name:'verify',status:'completed',conclusion:'success'},
    {name:'deploy',status:'completed',conclusion:'skipped'}]),'SKIPPED');
  assert.equal(classifyProductionJob([{name:'verify',status:'completed',conclusion:'success'}]),'UNVERIFIED');
  assert.equal(classifyProductionJob([{name:'deploy',status:'completed',conclusion:'success'}]),'CONFIRMED');
  assert.equal(classifyProductionJob([{name:'deploy',status:'in_progress',conclusion:null}]),'IN_PROGRESS');
  assert.equal(classifyProductionJob([{name:'deploy',status:'completed',conclusion:'failure'}]),'FAILED_OR_CANCELLED');
});
