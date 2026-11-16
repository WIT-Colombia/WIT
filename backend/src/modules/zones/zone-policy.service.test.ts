import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectiveStatus, isBusinessInActiveZone, isLocalityOpen,
  PALMIRA, resolveLocalityPolicy, zoneKey } from './zone-policy.service.js';

test('la cobertura inicial solo abre Palmira y la modalidad virtual es global',()=>{
  const palmira={location:{cityName:'Palmira',regionName:'Valle del Cauca',countryCode:'CO'},
    modalities:[{type:'PHYSICAL',status:'ACTIVE'}]};
  const cali={location:{cityName:'Cali',regionName:'Valle del Cauca',countryCode:'CO'},
    modalities:[{type:'PHYSICAL',status:'ACTIVE'}]};
  assert.equal(isBusinessInActiveZone(palmira,[PALMIRA]),true);
  assert.equal(isBusinessInActiveZone(cali,[PALMIRA]),false);
  assert.equal(isBusinessInActiveZone({...cali,modalities:[{type:'VIRTUAL',status:'ACTIVE'}]},[PALMIRA]),true);
  assert.equal(isBusinessInActiveZone({...cali,modalities:[{type:'VIRTUAL',status:'INACTIVE'}]},[PALMIRA]),false);
  assert.equal(isBusinessInActiveZone({modalities:[],location:null},[PALMIRA]),false);
});

test('un municipio prevalece sobre un departamento y un país abiertos',()=>{
  const zones=[
    { ...PALMIRA,id:'country',key:zoneKey('COUNTRY','Colombia'),level:'COUNTRY',name:'Colombia',department:null },
    { ...PALMIRA,id:'department',key:zoneKey('DEPARTMENT','Valle del Cauca'),level:'DEPARTMENT',name:'Valle del Cauca',department:null },
    { ...PALMIRA,id:'city',key:zoneKey('MUNICIPALITY','Cali','Valle del Cauca'),
      level:'MUNICIPALITY',name:'Cali',status:'PAUSED' },
  ];
  assert.equal(resolveLocalityPolicy({city:'Cali',department:'Valle del Cauca'},zones).status,'PAUSED');
  assert.equal(resolveLocalityPolicy({city:'Yumbo',department:'Valle del Cauca'},zones).status,'OPEN');
  assert.equal(resolveLocalityPolicy({city:'Bogotá',department:'Bogotá D.C.'},zones).status,'OPEN');
  assert.equal(resolveLocalityPolicy({city:'Quito',countryCode:'EC'},zones).status,'CLOSED');
});

test('la fecha programada se activa por tiempo de servidor sin cron ni administrador',()=>{
  const zone={status:'SCHEDULED',opensAt:new Date('2026-11-17T12:00:00Z')};
  assert.equal(effectiveStatus(zone,new Date('2026-11-17T11:59:59Z')),'SCHEDULED');
  assert.equal(effectiveStatus(zone,new Date('2026-11-17T12:00:00Z')),'OPEN');
  assert.equal(effectiveStatus({...zone,status:'PAUSED'},new Date('2026-11-18T12:00:00Z')),'PAUSED');
});

test('Cali y Santiago de Cali coinciden y Palmira no se abre en otro departamento',()=>{
  const city={...PALMIRA,id:'cali',key:zoneKey('MUNICIPALITY','Cali','Valle del Cauca'),
    level:'MUNICIPALITY',name:'Cali'};
  assert.equal(isLocalityOpen({cityName:'Santiago de Cali',regionName:'Valle del Cauca',countryCode:'CO'},[city]),true);
  assert.equal(isLocalityOpen({cityName:'Palmira',regionName:'Otro departamento',countryCode:'CO'},[PALMIRA]),false);
});
