import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releaseWhere, zoneState, type ZoneRecord } from './zones.service.js';

const start=new Date('2026-11-16T15:00:00Z');
test('Palmira is physically active by default; Cali and the rest of Colombia stay closed',()=>{
  assert.equal(zoneState('MUNICIPALITY','76520',[],start).state,'OPEN');
  assert.equal(zoneState('MUNICIPALITY','76001',[],start).state,'CLOSED');
  assert.equal(zoneState('DEPARTMENT','76',[],start).state,'CLOSED');
  const predicate=releaseWhere([],start);
  const text=JSON.stringify(predicate);
  assert.match(text,/"VIRTUAL"/);
  assert.match(text,/"Palmira"/);
  assert.doesNotMatch(text,/"Cali"/);
});
test('Scheduling is time-driven without a page open or a cron task',()=>{
  const planned:ZoneRecord[]=[{scope:'MUNICIPALITY',code:'76001',
    state:'SCHEDULED',opensAt:new Date('2026-12-01T13:30:00Z')}];
  assert.equal(zoneState('MUNICIPALITY','76001',planned,start).state,'SCHEDULED');
  assert.equal(zoneState('MUNICIPALITY','76001',planned,new Date('2026-12-01T13:30:00Z')).state,'OPEN');
  assert.equal(zoneState('MUNICIPALITY','76001',planned,start).opensAt,'2026-12-01T13:30:00.000Z');
});
test('Departments open their cities; a municipal exception overrides its parent',()=>{
  const changes:ZoneRecord[]=[
    {scope:'DEPARTMENT',code:'76',state:'OPEN',opensAt:null},
    {scope:'MUNICIPALITY',code:'76001',state:'PAUSED',opensAt:null},
  ];
  assert.equal(zoneState('MUNICIPALITY','76001',changes,start).state,'PAUSED');
  assert.equal(zoneState('MUNICIPALITY','76520',changes,start).state,'OPEN');
  assert.equal(zoneState('MUNICIPALITY','05001',changes,start).state,'CLOSED');
  const where=JSON.stringify(releaseWhere(changes,start));
  assert.match(where,/"Valle del Cauca"/);
  assert.match(where,/"NOT"/);
  assert.match(where,/"Cali"/);
  assert.match(where,/"VIRTUAL"/);
});
test('Pausing Palmira never hides businesses with an active virtual modality',()=>{
  const records:ZoneRecord[]=[
    {scope:'MUNICIPALITY',code:'76520',state:'PAUSED',opensAt:null},
  ];
  assert.equal(zoneState('MUNICIPALITY','76520',records,start).state,'PAUSED');
  const predicate=releaseWhere(records,start);
  const virtual=(predicate.OR as Array<Record<string,unknown>>)[0];
  assert.deepEqual(virtual,{modalities:{some:{type:'VIRTUAL',status:'ACTIVE'}}});
  assert.doesNotMatch(JSON.stringify(predicate),/"Palmira"/);
});
