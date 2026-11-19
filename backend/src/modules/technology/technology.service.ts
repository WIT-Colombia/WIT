import { prisma } from '../../config/prisma.js';
import { Prisma, type TechnologyCaseKind, type TechnologyCaseStatus,
  type TechnologyCaseSeverity } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { AdminContext } from '../admin/admin-auth.service.js';

export const caseKinds=['INCIDENT','MAINTENANCE','NEED'] as const;
export const caseSeverities=['LOW','MEDIUM','HIGH','CRITICAL'] as const;
export const caseStatuses=['OPEN','PLANNED','IN_PROGRESS','BLOCKED','RESOLVED','COMPLETED','CANCELLED'] as const;
export const statesByKind:Record<TechnologyCaseKind,readonly TechnologyCaseStatus[]>={
  INCIDENT:['OPEN','IN_PROGRESS','RESOLVED'],
  MAINTENANCE:['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'],
  NEED:['OPEN','IN_PROGRESS','BLOCKED','COMPLETED','CANCELLED'],
};
export const transitionRules:Record<TechnologyCaseKind,Partial<Record<TechnologyCaseStatus,readonly TechnologyCaseStatus[]>>>={
  INCIDENT:{OPEN:['IN_PROGRESS','RESOLVED'],IN_PROGRESS:['OPEN','RESOLVED'],RESOLVED:['OPEN']},
  MAINTENANCE:{PLANNED:['IN_PROGRESS','CANCELLED'],IN_PROGRESS:['COMPLETED','CANCELLED'],
    COMPLETED:['PLANNED'],CANCELLED:['PLANNED']},
  NEED:{OPEN:['IN_PROGRESS','BLOCKED','CANCELLED'],IN_PROGRESS:['BLOCKED','COMPLETED','CANCELLED'],
    BLOCKED:['IN_PROGRESS','CANCELLED'],COMPLETED:['OPEN'],CANCELLED:['OPEN']},
};
const string=(x:unknown)=>typeof x==='string'?x.trim():'';
const required=(x:unknown,min:number,max:number,label:string)=>{
  const value=string(x);
  if(value.length<min||value.length>max)
    throw new AppError(400,'TECH_CASE_INVALID_INPUT',label+' debe contener de '+min+' a '+max+' caracteres.');
  return value;
};
const optional=(x:unknown,max:number)=>{
  const v=string(x);
  if(v.length>max)throw new AppError(400,'TECH_CASE_INVALID_INPUT','El valor opcional supera el límite permitido.');
  return v||null;
};
const asDate=(raw:unknown)=>{
  if(raw===null||raw===undefined||raw==='')return null;
  if(typeof raw!=='string'||!/[zZ]$|[+-]\d\d:\d\d$/.test(raw))
    throw new AppError(400,'TECH_DATE_INVALID','La fecha debe contener zona horaria ISO 8601.');
  const value=new Date(raw);
  if(!Number.isFinite(value.valueOf()))
    throw new AppError(400,'TECH_DATE_INVALID','La fecha ingresada no es válida.');
  return value;
};
export function validateTechnologyCase(input:Record<string,unknown>) {
  const kind=string(input.kind).toUpperCase();
  if(!caseKinds.includes(kind as TechnologyCaseKind))
    throw new AppError(400,'TECH_CASE_KIND_INVALID','Selecciona incidente, mantenimiento o necesidad.');
  const severity=string(input.severity).toUpperCase()||'MEDIUM';
  if(!caseSeverities.includes(severity as TechnologyCaseSeverity))
    throw new AppError(400,'TECH_CASE_SEVERITY_INVALID','Severidad tecnológica desconocida.');
  const start=asDate(input.scheduledStartAt),end=asDate(input.scheduledEndAt);
  if((start||end)&&(kind!=='MAINTENANCE'||!start||!end||start>=end))
    throw new AppError(400,'TECH_MAINTENANCE_WINDOW_INVALID',
      'El mantenimiento debe registrar una ventana horaria de inicio y fin válida.');
  if(kind==='MAINTENANCE'&&(!start||!end))
    throw new AppError(400,'TECH_MAINTENANCE_WINDOW_REQUIRED',
      'Programa las fechas de inicio y finalización del mantenimiento.');
  return {
    kind:kind as TechnologyCaseKind,
    status:(kind==='MAINTENANCE'?'PLANNED':'OPEN') as TechnologyCaseStatus,
    severity:severity as TechnologyCaseSeverity,
    title:required(input.title,8,160,'El título'),
    description:required(input.description,20,2000,'La descripción'),
    component:optional(input.component,120),
    scheduledStartAt:start,scheduledEndAt:end,
  };
}
export function validateCaseTransition(kind:TechnologyCaseKind,from:TechnologyCaseStatus,
  input:Record<string,unknown>) {
  const status=string(input.status).toUpperCase() as TechnologyCaseStatus;
  if(!transitionRules[kind]?.[from]?.includes(status))
    throw new AppError(409,'TECH_TRANSITION_INVALID','Esa transición no está permitida para el expediente.');
  return {status,reason:required(input.reason,12,500,'La justificación')};
}
export function normalizeTechnologyCaseFilters(filters:{
  kind?:string;status?:string;q?:string;page?:number;
}) {
  const kind=string(filters.kind).toUpperCase();
  const status=string(filters.status).toUpperCase();
  const q=string(filters.q);
  if(kind&&!caseKinds.includes(kind as TechnologyCaseKind))
    throw new AppError(400,'TECH_CASE_KIND_INVALID','Tipo de expediente desconocido.');
  if(status&&!caseStatuses.includes(status as TechnologyCaseStatus))
    throw new AppError(400,'TECH_CASE_STATUS_INVALID','Estado no válido.');
  if(q.length>100)
    throw new AppError(400,'TECH_CASE_SEARCH_TOO_LONG','La búsqueda no puede superar 100 caracteres.');
  const page=Number.isSafeInteger(filters.page)?Math.max(1,Math.min(100000,filters.page!)):1;
  return {kind:kind as TechnologyCaseKind|'',status:status as TechnologyCaseStatus|'',
    q,page,pageSize:12};
}
export function technologyCaseWhere(f:ReturnType<typeof normalizeTechnologyCaseFilters>):
Prisma.TechnologyCaseWhereInput {
  return {
    ...(f.kind?{kind:f.kind}:{}),
    ...(f.status?{status:f.status}:{}),
    ...(f.q?{OR:[
      {title:{contains:f.q}},{component:{contains:f.q}},
      {description:{contains:f.q}},
    ]}:{}),
  };
}
const caseSelect={
  id:true,kind:true,status:true,severity:true,title:true,description:true,
  component:true,scheduledStartAt:true,scheduledEndAt:true,completedAt:true,
  createdAt:true,updatedAt:true,createdById:true,updatedById:true,
} satisfies Prisma.TechnologyCaseSelect;
const eventSelect={
  id:true,caseId:true,actorUserId:true,action:true,fromStatus:true,
  toStatus:true,reason:true,createdAt:true,
} satisfies Prisma.TechnologyCaseEventSelect;
export async function listTechnologyCases(filters:{
  kind?:string;status?:string;q?:string;page?:number;
}) {
  const parsed=normalizeTechnologyCaseFilters(filters);
  const where=technologyCaseWhere(parsed);
  const [total,items]=await prisma.$transaction([
    prisma.technologyCase.count({where}),
    prisma.technologyCase.findMany({where,select:caseSelect,
      orderBy:[{createdAt:'desc'},{id:'desc'}],
      skip:(parsed.page-1)*parsed.pageSize,take:parsed.pageSize}),
  ]);
  return {cases:items,pagination:{page:parsed.page,pageSize:parsed.pageSize,total,
    totalPages:Math.ceil(total/parsed.pageSize)},scope:'ADMIN_TECHNOLOGY_CASES' as const};
}
export async function technologyCaseDetail(id:string){
  const item=await prisma.technologyCase.findUnique({where:{id},select:caseSelect});
  if(!item)throw new AppError(404,'TECH_CASE_NOT_FOUND','El expediente no existe.');
  const history=await prisma.technologyCaseEvent.findMany({
    where:{caseId:id},select:eventSelect,orderBy:[{createdAt:'desc'},{id:'desc'}],take:100,
  });
  return {case:item,history};
}
function assertTechnologyManager(admin:AdminContext){
  if(admin.role!=='SUPER_ADMIN'&&!admin.permissions.includes('ADMINS_MANAGE'))
    throw new AppError(403,'TECH_MANAGE_DENIED',
      'Se requiere permiso de administración para registrar o modificar expedientes tecnológicos.');
}
export async function createTechnologyCase(admin:AdminContext,input:Record<string,unknown>){
  assertTechnologyManager(admin);
  const data=validateTechnologyCase(input);
  const item=await prisma.$transaction(async tx=>{
    const row=await tx.technologyCase.create({data:{...data,createdById:admin.userId},
      select:caseSelect});
    await tx.technologyCaseEvent.create({data:{
      caseId:row.id,actorUserId:admin.userId,action:'CREATED',toStatus:row.status,
      reason:'Radicación administrativa; no se ejecutaron cambios de infraestructura.',
    }});
    return row;
  });
  return {case:item};
}
export async function updateTechnologyCaseStatus(admin:AdminContext,id:string,
  input:Record<string,unknown>){
  assertTechnologyManager(admin);
  const result=await prisma.$transaction(async tx=>{
    const before=await tx.technologyCase.findUnique({where:{id},select:caseSelect});
    if(!before)throw new AppError(404,'TECH_CASE_NOT_FOUND','El expediente no existe.');
    const {status,reason}=validateCaseTransition(before.kind,before.status,input);
    const ended=['RESOLVED','COMPLETED','CANCELLED'].includes(status);
    const changed=await tx.technologyCase.updateMany({where:{id,status:before.status},
      data:{status,updatedById:admin.userId,completedAt:ended?new Date():null}});
    if(changed.count!==1)
      throw new AppError(409,'TECH_CASE_CONFLICT','Otro administrador modificó el expediente. Actualiza la vista.');
    await tx.technologyCaseEvent.create({data:{
      caseId:id,actorUserId:admin.userId,action:'STATUS_CHANGED',
      fromStatus:before.status,toStatus:status,reason,
    }});
    return tx.technologyCase.findUniqueOrThrow({where:{id},select:caseSelect});
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  return {case:result};
}
export async function commentTechnologyCase(admin:AdminContext,id:string,input:Record<string,unknown>){
  assertTechnologyManager(admin);
  const reason=required(input.reason,12,500,'La anotación');
  const result=await prisma.$transaction(async tx=>{
    const item=await tx.technologyCase.findUnique({where:{id},select:{id:true,status:true}});
    if(!item)throw new AppError(404,'TECH_CASE_NOT_FOUND','El expediente no existe.');
    const event=await tx.technologyCaseEvent.create({data:{
      caseId:id,actorUserId:admin.userId,action:'NOTE',
      fromStatus:item.status,toStatus:item.status,reason,
    },select:eventSelect});
    await tx.technologyCase.update({where:{id},data:{updatedById:admin.userId}});
    return event;
  });
  return {event:result};
}
export function isoDay(date:Date){return date.toISOString().slice(0,10);}
export function buildRecordedIncidentTrend(
  data:ReadonlyArray<{day:string;count:number}>,now:Date=new Date(),days=30,
) {
  const totals=new Map(data.map(x=>[x.day,x.count]));
  const base=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  return Array.from({length:days},(_,index)=>{
    const date=isoDay(new Date(base-(days-1-index)*86400000));
    return {date,count:totals.get(date)??0};
  });
}
/** Only this process and its database connection are actively checked.
 * AWS/S3/frontend external uptime is UNKNOWN without independent collectors. */
export async function getTechnologyStatus(now=new Date()){
  const checkedAt=now.toISOString();
  const started=performance.now();
  let dbOk=false,dbLatencyMs:number|null=null;
  try{
    await prisma.$queryRawUnsafe('SELECT 1');
    dbOk=true;
    dbLatencyMs=Math.round(performance.now()-started);
  }catch{/* Distinguish unavailable from a fabricated zero. */}
  const components=[
    {id:'api',name:'API (backend)',detail:'Respondió esta solicitud autenticada',
      status:'HEALTHY',source:'Respuesta HTTP actual',latencyMs:null,checkedAt},
    {id:'database',name:'Base de datos MySQL',detail:dbOk?'Consulta SELECT 1 confirmada':'Consulta de base de datos fallida',
      status:dbOk?'HEALTHY':'UNAVAILABLE',source:'Comprobación SQL actual',latencyMs:dbLatencyMs,checkedAt},
    {id:'frontend',name:'Plataforma web (frontend)',detail:'No existe sonda externa de disponibilidad web',
      status:'UNMONITORED',source:null,latencyMs:null,checkedAt:null},
    {id:'storage',name:'Almacenamiento de archivos',detail:'Sin sonda activa de almacenamiento S3',
      status:'UNMONITORED',source:null,latencyMs:null,checkedAt:null},
    {id:'aws',name:'Infraestructura AWS',detail:'Sin monitoreo de salud de infraestructura integrado',
      status:'UNMONITORED',source:null,latencyMs:null,checkedAt:null},
  ] as const;
  if(!dbOk)return {
    scope:'LIVE_PROBES_ONLY' as const,checkedAt,components,
    live:{checked:2,healthy:1,unavailable:1},uptime30Days:null,
    processUptimeSeconds:Math.floor(process.uptime()),
    caseDataAvailable:false,incidentTrend:[],incidents:[],upcomingMaintenance:[],
    recentEvents:[],counts:null,
    description:'API respondió, pero la base de datos no estuvo disponible. No se certifica disponibilidad histórica.',
  };
  const since=new Date(now.getTime()-30*86400000);
  const [grouped,incidents,maintenance,events,rawTrend,upcomingCount,incident30dCount]=await Promise.all([
    prisma.technologyCase.groupBy({by:['kind','status'],_count:{_all:true}}),
    prisma.technologyCase.findMany({where:{kind:'INCIDENT'},select:caseSelect,
      orderBy:[{createdAt:'desc'},{id:'desc'}],take:5}),
    prisma.technologyCase.findMany({
      where:{kind:'MAINTENANCE',status:{in:['PLANNED','IN_PROGRESS']},
        scheduledEndAt:{gte:now}},
      select:caseSelect,orderBy:{scheduledStartAt:'asc'},take:5,
    }),
    prisma.technologyCaseEvent.findMany({where:{createdAt:{gte:since}},select:{
      ...eventSelect,case:{select:{title:true,kind:true}},
    },orderBy:{createdAt:'desc'},take:8}),
    prisma.$queryRawUnsafe<Array<{day:string;total:bigint}>>(
      "SELECT DATE_FORMAT(createdAt,'%Y-%m-%d') AS day, COUNT(*) AS total FROM TechnologyCase WHERE kind = ? AND createdAt >= ? GROUP BY DATE_FORMAT(createdAt,'%Y-%m-%d') ORDER BY day ASC",
      'INCIDENT',since),
    prisma.technologyCase.count({where:{kind:'MAINTENANCE',
      status:{in:['PLANNED','IN_PROGRESS']},scheduledEndAt:{gte:now}}}),
    prisma.technologyCase.count({where:{kind:'INCIDENT',createdAt:{gte:since}}}),
  ]);
  const counts={
    registeredIncidents30d:incident30dCount,openIncidents:0,
    upcomingMaintenance:upcomingCount,openNeeds:0,
    totalIncidents:0,totalMaintenance:0,totalNeeds:0,
  };
  for(const record of grouped){
    const n=record._count._all;
    if(record.kind==='INCIDENT'){
      counts.totalIncidents+=n;
      if(['OPEN','IN_PROGRESS'].includes(record.status))counts.openIncidents+=n;
    }else if(record.kind==='MAINTENANCE')counts.totalMaintenance+=n;
    else {counts.totalNeeds+=n;if(['OPEN','IN_PROGRESS','BLOCKED'].includes(record.status))counts.openNeeds+=n;}
  }
  return {
    scope:'LIVE_PROBES_ONLY' as const,checkedAt,components,
    live:{checked:2,healthy:2,unavailable:0},
    uptime30Days:null,processUptimeSeconds:Math.floor(process.uptime()),
    caseDataAvailable:true,incidentTrend:buildRecordedIncidentTrend(rawTrend.map(t=>({
      day:t.day,count:Number(t.total)})),now),
    incidents,upcomingMaintenance:maintenance,recentEvents:events,counts,
    description:'Solo API y MySQL disponen de prueba actual. Los incidentes son expedientes reportados, no un SLA de disponibilidad.',
  };
}
