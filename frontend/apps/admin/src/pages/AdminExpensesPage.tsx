import { useCallback, useEffect, useMemo, useState, type FormEvent, type PointerEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminPageHeading } from '../components/AdminPageHeading';
import { AdminDialog } from '../components/AdminDialog';
import { Icon } from '../components/Icon';
import { StatePanel } from '../components/common';
import { AwsFreeTierPanel } from '../components/AwsFreeTierPanel';
import { getSession, can } from '../services/adminService';
import {
  getExpenseReportOverview, listExpenseReportLedger, getAwsFreeTierUsage,
  updateFinanceProvider, updateFinanceBudget, updateFinanceConsumption, updateFinanceInvoice,
  updateFinancePayment, acknowledgeFinanceAlert,
  type ExpenseLedgerKind, type ExpenseLedgerRecord, type ExpenseReportOverview, type ExpenseLedgerPage,
  type FreeTierUsage,
} from '../services/adminApiClient';
import { financeXlsx } from '../utils/financeExport';
import './AdminExpensesPage.css';

const formatter = new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:2});
const dollar = new Intl.NumberFormat('es-CO',{style:'currency',currency:'USD',maximumFractionDigits:4});
const compact = new Intl.NumberFormat('es-CO',{notation:'compact',maximumFractionDigits:1});
const number = (n:number) => n.toLocaleString('es-CO');
const formatCop = (value:string|number|null|undefined) =>
  value===null||value===undefined ? '—' : formatter.format(Number(value));
const formatUsd = (value:string|number|null|undefined) =>
  value===null||value===undefined ? '—' : dollar.format(Number(value));
const dateTime = (value:string|null|undefined) => value
  ? new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Bogota'}).format(new Date(value))
  : 'No registrada';
const csvCell = (value:string) => '"'+(/^\s*[=+\-@]/.test(value)?"'":'')+value.replaceAll('"','""')+'"';
const validDay = (raw:string) => /^\d{4}-\d{2}-\d{2}$/.test(raw)&&
  !Number.isNaN(new Date(raw+'T00:00:00.000Z').getTime())&&
  new Date(raw+'T00:00:00.000Z').toISOString().slice(0,10)===raw;
const defaultDates = () => {
  const today = new Date().toISOString().slice(0,10);
  return { from:today.slice(0,7)+'-01', to:today };
};
const tabs:Array<{kind:ExpenseLedgerKind;label:string;icon:string;detail:string}> = [
  {kind:'CONSUMPTIONS',label:'Consumos',icon:'chart',detail:'Cargos, proyecciones y consumos'},
  {kind:'INVOICES',label:'Facturas',icon:'file',detail:'Documentos recibidos de proveedores'},
  {kind:'PAYMENTS',label:'Pagos',icon:'card',detail:'Movimientos salientes registrados'},
  {kind:'BUDGETS',label:'Presupuestos',icon:'layers',detail:'Asignaciones y vigencias'},
  {kind:'PROVIDERS',label:'Proveedores',icon:'server',detail:'Servicios tecnológicos'},
  {kind:'ALERTS',label:'Alertas',icon:'bell',detail:'Umbrales y revisiones'},
  {kind:'AUDIT',label:'Auditoría',icon:'shield',detail:'Cambios y motivos registrados'},
];
const statusNames:Record<string,string> = {
  REAL:'Real registrado',ESTIMATED:'Estimado',PROJECTED:'Proyectado',
  MANUAL:'Manual',PAID:'Pagado registrado',PENDING:'Pendiente',CANCELLED:'Cancelado',
  ACTIVE:'Activo',INACTIVE:'Inactivo',ACKNOWLEDGED:'Revisada',
  RUNNING:'En ejecución',SUCCEEDED:'Exitosa',FAILED:'Fallida',
};
const fieldNames:Record<string,string> = {
  name:'Nombre',currency:'Moneda',amountCop:'Importe en COP',
  amountUsd:'Importe en USD',documentUrl:'Enlace HTTPS de la factura',
  status:'Estado registrado',reference:'Referencia del pago',
};
const fieldsByKind:Partial<Record<ExpenseLedgerKind,string[]>> = {
  PROVIDERS:['name','currency'],BUDGETS:['name','amountCop','amountUsd'],
  CONSUMPTIONS:['amountCop','amountUsd'],INVOICES:['amountCop','amountUsd','documentUrl'],
  PAYMENTS:['amountCop','status','reference'],
};
function PeriodGraph({trend}: {trend:ExpenseReportOverview['timeline']}) {
  const points=trend.points;
  const [cursor,setCursor]=useState<number|null>(null);
  const values=useMemo(()=>points.map(p=>Number(p.amountCop)),[points]);
  const max=Math.max(0,...values);
  const ceiling=max>0?max*1.14:1;
  const width=940, left=58,right=915,top=20,bottom=202;
  const x=(i:number)=>left+(points.length===1?0.5:i/(Math.max(1,points.length-1)))*(right-left);
  const y=(v:number)=>bottom-Math.max(0,v)/ceiling*(bottom-top);
  const path=values.length?values.map((v,i)=>(i?'L':'M')+x(i).toFixed(2)+' '+y(v).toFixed(2)).join(' '):'';
  const area=values.length?path+' L'+x(values.length-1)+' '+bottom+' L'+x(0)+' '+bottom+' Z':'';
  const at=cursor===null?Math.max(0,points.length-1):Math.min(points.length-1,cursor);
  const move=(e:PointerEvent<SVGSVGElement>)=>{
    if(!points.length)return;
    const rectangle=e.currentTarget.getBoundingClientRect();
    const relative=(e.clientX-rectangle.left)/rectangle.width*width;
    const fraction=(relative-left)/(right-left);
    setCursor(Math.max(0,Math.min(points.length-1,Math.round(fraction*(points.length-1)))));
  };
  const ticks=values.length?Array.from(new Set([0,Math.floor((values.length-1)/4),
    Math.floor((values.length-1)/2),Math.floor(3*(values.length-1)/4),values.length-1])):[];
  return <div className="afc-graph-wrapper">
    <div className="afc-chart-active" role="status">
      <span>{points[at]?.label??'Sin datos'}</span>
      <strong>{points[at]?formatCop(points[at].amountCop):'—'}</strong>
      <small>{trend.unit==='day'?'Día de inicio del consumo':trend.unit==='week'?'Semana del período':'Mes de inicio del consumo'}</small>
    </div>
    {points.length ? <>
      <svg className="afc-graph" viewBox="0 0 940 245" role="img"
        aria-label="Gráfica de consumo registrado en COP por inicio de período; incluye ceros para fechas sin registros."
        onPointerMove={move} onPointerLeave={()=>setCursor(null)}>
        <defs><linearGradient id="afc-graph-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#935bce" stopOpacity=".24"/>
          <stop offset="100%" stopColor="#935bce" stopOpacity=".005"/></linearGradient></defs>
        {[0,.25,.5,.75,1].map(f=><g key={f}>
          <line x1={left} x2={right} y1={y(ceiling*f)} y2={y(ceiling*f)}
            stroke="#e9e3f1" strokeDasharray={f===0?'0':'5 6'}/>
          <text x={left-11} y={y(ceiling*f)+4} textAnchor="end" fill="#878091"
            fontSize="11">{compact.format(ceiling*f)}</text>
        </g>)}
        <path d={area} fill="url(#afc-graph-fill)"/>
        <path d={path} fill="none" stroke="#8551c6" strokeWidth="3"
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
        {values.length>0 && <>
          <line x1={x(at)} x2={x(at)} y1={top} y2={bottom}
            stroke="#7540b4" strokeDasharray="4 5" strokeWidth="1.5"/>
          <circle cx={x(at)} cy={y(values[at])} r="7" fill="#fff" stroke="#7b43bc" strokeWidth="3"/>
        </>}
        {ticks.map(i=><text key={i} x={x(i)} y="232" textAnchor={i===0?'start':i===points.length-1?'end':'middle'}
          fill="#7f788a" fontSize="11">{points[i].label.slice(5)}</text>)}
      </svg>
      <label className="afc-chart-keyboard">
        <span>Explorar fechas con teclado</span>
        <input type="range" min={0} max={Math.max(0,points.length-1)} value={at} step={1}
          aria-label="Explorar fecha de consumo"
          onChange={event=>setCursor(Number(event.target.value))}/>
      </label>
    </> : <p className="afc-chart-empty">No se pudieron obtener puntos de la serie.</p>}
  </div>;
}
function EditFinancialRecord({record,onClose,onUpdated}:{
  record:ExpenseLedgerRecord;onClose:()=>void;onUpdated:(message:string)=>void;
}){
  const fields=fieldsByKind[record.kind]??[];
  const [form,setForm]=useState<Record<string,string>>(
    Object.fromEntries([...fields,'reason'].map(key=>[key,key==='reason'?'':String(record[key as keyof ExpenseLedgerRecord]??'')])));
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const amountValid=fields.filter(x=>x.startsWith('amount')).every(key=>
    key==='amountUsd'&&record.kind==='BUDGETS'&&!form[key].trim() ? true :
      form[key].trim()!==''&&Number.isFinite(Number(form[key]))&&Number(form[key])>=0);
  const reasonValid=form.reason?.trim().length>=12&&form.reason.trim().length<=500;
  const validUrl=!form.documentUrl||/^https:\/\/[^\s/]+(?:\/.*)?$/i.test(form.documentUrl);
  const valid=reasonValid&&amountValid&&validUrl&&(!fields.includes('name')||form.name?.trim().length>=2)&&
    (!fields.includes('currency')||/^[A-Z]{3}$/.test(form.currency))&&
    (!fields.includes('status')||['PENDING','PAID','CANCELLED'].includes(form.status));
  const submit=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(!valid||busy)return;setBusy(true);setError('');
    const input:Record<string,unknown>={reason:form.reason.trim()};
    fields.forEach(key=>{input[key]=key.startsWith('amount')?
      form[key]?.trim()?Number(form[key]):undefined:form[key]?.trim()||'';});
    try{
      if(record.kind==='PROVIDERS')await updateFinanceProvider(record.id,input);
      if(record.kind==='BUDGETS')await updateFinanceBudget(record.id,input);
      if(record.kind==='CONSUMPTIONS')await updateFinanceConsumption(record.id,input);
      if(record.kind==='INVOICES')await updateFinanceInvoice(record.id,input);
      if(record.kind==='PAYMENTS')await updateFinancePayment(record.id,input);
      onUpdated('Corrección financiera registrada; consulta la pestaña Auditoría.');
    }catch(cause){setError(cause instanceof Error?cause.message:'No se pudo guardar la corrección.');setBusy(false);}
  };
  return <AdminDialog title={'Corregir '+record.name} contextLabel="FINANZAS · REGISTRO AUDITABLE"
    busy={busy} onClose={onClose}>
    <form className="afc-edit-form" onSubmit={e=>void submit(e)}>
      <p>La modificación afecta datos administrativos existentes y exige justificación.
        No realiza transferencias ni confirma pagos bancarios.</p>
      {fields.map(key=><label key={key}><span>{fieldNames[key]}</span>
        {key==='status'?<select aria-label={fieldNames[key]} value={form[key]??''} disabled={busy}
          onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}>
          <option value="PENDING">Pendiente</option><option value="PAID">Pagado registrado</option>
          <option value="CANCELLED">Cancelado</option>
        </select>:<input aria-label={fieldNames[key]}
          type={key.startsWith('amount')?'number':key==='documentUrl'?'url':'text'}
          min={key.startsWith('amount')?'0':undefined}
          step={key.startsWith('amount')?'0.01':undefined} maxLength={key==='documentUrl'?2048:160}
          required={key!=='documentUrl'&&!(key==='amountUsd'&&record.kind==='BUDGETS')}
          value={form[key]??''} disabled={busy} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}/>}
      </label>)}
      <label><span>Motivo de la corrección (12 a 500 caracteres)</span>
        <textarea aria-label="Motivo de la corrección" minLength={12} maxLength={500} required rows={4}
          value={form.reason??''} disabled={busy} onChange={e=>setForm(p=>({...p,reason:e.target.value}))}
          placeholder="Explica qué evidencia permite realizar este cambio."/></label>
      {error&&<p className="afc-error" role="alert">{error}</p>}
      <div className="afc-edit-actions">
        <button type="button" className="afc-btn afc-btn-outline" disabled={busy} onClick={onClose}>Cancelar</button>
        <button className="afc-btn afc-btn-main" type="submit" disabled={busy||!valid}>
          {busy?'Registrando…':'Guardar corrección'}</button>
      </div>
    </form>
  </AdminDialog>;
}

export function AdminExpensesPage(){
  const admin=getSession(),mayRead=admin?can(admin,'finance:read'):false;
  const mayEdit=admin?can(admin,'finance:manage'):false;
  const [params,setParams]=useSearchParams();
  const initial=defaultDates();
  const from=params.get('from')??initial.from,to=params.get('to')??initial.to;
  const rawTab=params.get('tab')??'CONSUMPTIONS';
  const tab:ExpenseLedgerKind=tabs.some(t=>t.kind===rawTab)?rawTab as ExpenseLedgerKind:'CONSUMPTIONS';
  const query=params.get('q')??'',providerId=params.get('providerId')??'';
  const rawPage=Number(params.get('page')??1);
  const page=Number.isFinite(rawPage)?Math.max(1,Math.min(100000,Math.floor(rawPage))):1;
  const [draftFrom,setDraftFrom]=useState(from),[draftTo,setDraftTo]=useState(to);
  const [search,setSearch]=useState(query);
  const [overview,setOverview]=useState<ExpenseReportOverview|null>(null);
  const [ledger,setLedger]=useState<ExpenseLedgerPage|null>(null);
  const [overviewLoading,setOverviewLoading]=useState(mayRead),[ledgerLoading,setLedgerLoading]=useState(mayRead);
  const [overviewError,setOverviewError]=useState(''),[ledgerError,setLedgerError]=useState('');
  const [notice,setNotice]=useState(''),[periodError,setPeriodError]=useState('');
  const [revision,setRevision]=useState(0);
  const [editing,setEditing]=useState<ExpenseLedgerRecord|null>(null);
  const [alertBusy,setAlertBusy]=useState<string|null>(null);
  const [freeTier,setFreeTier]=useState<{
    state:'loading'|'available'|'empty'|'unconfigured'|'error';usages:FreeTierUsage[];
    updatedAt:string|null;error?:string;
  }>({state:'unconfigured',usages:[],updatedAt:null});
  const [showFreeTier,setShowFreeTier]=useState(false);
  useEffect(()=>{setDraftFrom(from);setDraftTo(to);setSearch(query);},[from,to,query]);
  const dateReady=validDay(from)&&validDay(to)&&from<=to&&
    new Date(to).getTime()-new Date(from).getTime()<=366*86400000;
  useEffect(()=>{
    if(!mayRead||!dateReady)return;
    let active=true;setOverviewLoading(true);setOverviewError('');
    void getExpenseReportOverview({from,to}).then(v=>{if(active)setOverview(v);})
      .catch(e=>{if(active){setOverview(null);
        setOverviewError(e instanceof Error?e.message:'No se pudo consultar el resumen financiero.');}})
      .finally(()=>{if(active)setOverviewLoading(false);});
    return ()=>{active=false;};
  },[mayRead,from,to,revision,dateReady]);
  useEffect(()=>{
    if(!mayRead||!dateReady)return;
    let active=true;setLedgerLoading(true);setLedgerError('');
    void listExpenseReportLedger({from,to,kind:tab,page,q:query,providerId})
      .then(v=>{if(active)setLedger(v);})
      .catch(e=>{if(active){setLedger(null);
        setLedgerError(e instanceof Error?e.message:'No se pudieron consultar los registros.');}})
      .finally(()=>{if(active)setLedgerLoading(false);});
    return ()=>{active=false;};
  },[mayRead,from,to,tab,page,query,providerId,revision,dateReady]);
  const loadFreeTier=useCallback(()=>{
    setFreeTier(prev=>({...prev,state:'loading',error:undefined}));
    void getAwsFreeTierUsage().then(r=>setFreeTier({
      state:r.available?r.usages.length?'available':'empty':'unconfigured',
      usages:r.usages,updatedAt:r.lastUpdatedAt,
    })).catch(e=>setFreeTier(prev=>({...prev,state:'error',
      error:e instanceof Error?e.message:'La lectura de Free Tier falló.'})));
  },[]);
  const toggleTier=()=>{
    if(!showFreeTier&&freeTier.state==='unconfigured'&&!freeTier.updatedAt)loadFreeTier();
    setShowFreeTier(v=>!v);
  };
  function change(values:{from?:string;to?:string;tab?:ExpenseLedgerKind;q?:string;providerId?:string;page?:number}){
    const p=new URLSearchParams(params);
    for(const key of ['from','to','tab','q','providerId'] as const){
      if(values[key]===undefined)continue;
      if(values[key])p.set(key,values[key]);else p.delete(key);
      p.delete('page');
    }
    if(values.page!==undefined){
      if(values.page>1)p.set('page',String(values.page));else p.delete('page');
    }
    setParams(p,{replace:true});
  }
  function applyDates(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const gap=new Date(draftTo+'T00:00:00Z').getTime()-new Date(draftFrom+'T00:00:00Z').getTime();
    if(!validDay(draftFrom)||!validDay(draftTo)||gap<0||gap>366*86400000){
      setPeriodError('Usa fechas válidas, en orden y con un máximo de 367 días de intervalo.');return;
    }
    setPeriodError('');change({from:draftFrom,to:draftTo,page:1});
  }
  function preset(days:number|null){
    const today=new Date().toISOString().slice(0,10);
    const start=days===null?today.slice(0,7)+'-01':
      new Date(Date.parse(today+'T00:00:00Z')-(days-1)*86400000).toISOString().slice(0,10);
    setDraftFrom(start);setDraftTo(today);setPeriodError('');
    change({from:start,to:today,page:1});
  }
  function csv(){
    if(!ledger?.records.length)return;
    const lines=[['ID','Sección','Nombre / documento','Proveedor','Detalle','Estado / origen',
      'Importe COP','Importe USD','Créditos USD','Inicio del período','Fin del período','Fecha registro (Colombia)'],
      ...ledger.records.map(r=>[r.id,r.kind,r.name,r.providerName??'',r.detail,
        r.status??'',r.amountCop??'',r.amountUsd??'',r.creditsUsd??'',r.periodStart??'',
        r.periodEnd??'',dateTime(r.createdAt)])];
    const blob=new Blob(['\ufeff'+lines.map(l=>l.map(csvCell).join(';')).join('\r\n')],
      {type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='xamuko-gastos-'+tab.toLowerCase()+'-pagina.csv';link.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function xlsx(){
    if(tab!=='CONSUMPTIONS'||!ledger?.records.length)return;
    const rows=ledger.records.map(r=>({
      provider:r.providerName??'',service:r.name,period:r.periodStart??'',
      kind:r.status??'',usd:Number(r.amountUsd??0)-Number(r.creditsUsd??0),
      cop:Number(r.amountCop??0),
    }));
    const bytes=financeXlsx(rows);
    const blob=new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='xamuko-consumos-pagina.xlsx';link.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const onUpdated=(message:string)=>{setEditing(null);setNotice(message);setRevision(v=>v+1);};
  const reviewAlert=async(r:ExpenseLedgerRecord)=>{
    setAlertBusy(r.id);
    try{
      await acknowledgeFinanceAlert(r.id);
      onUpdated('Alerta marcada como revisada y conservada en el registro financiero.');
    }catch(e){setLedgerError(e instanceof Error?e.message:'No fue posible revisar la alerta.');}
    finally{setAlertBusy(null);}
  };
  if(!mayRead)return <StatePanel kind="error" title="Acceso restringido"
    message="Necesitas FINANCE_READ para consultar Gastos y contabilidad."/>;
  const total=overview?.totals;
  const kpis=[
    {label:'Consumo registrado · COP',value:total?formatCop(total.consumptionCop):'—',
      icon:'chart',tone:'violet',note:'Importe bruto en COP; no aplica créditos USD'},
    {label:'Consumo neto · USD',value:total?formatUsd(total.netConsumptionUsd):'—',
      icon:'card',tone:'blue',note:'USD registrado menos créditos USD'},
    {label:'Facturas de proveedores · COP',value:total?formatCop(total.invoicesCop):'—',
      icon:'file',tone:'neutral',note:total?number(total.invoiceRecords)+' facturas en el período':'Documentos recibidos'},
    {label:'Pagos marcados PAID · COP',value:total?formatCop(total.markedPaidCop):'—',
      icon:'check',tone:'green',note:'Estado administrativo; sin conciliación bancaria'},
    {label:'Presupuestos activos',value:typeof total?.activeBudgets==='number'?number(total.activeBudgets):'—',
      icon:'layers',tone:'amber',note:'Vigencias que intersectan el período'},
    {label:'Proveedores activos',value:typeof total?.providers==='number'?number(total.providers):'—',
      icon:'server',tone:'violet',note:'Registrados en el sistema'},
  ];
  const isTabFilterable=tab!=='ALERTS'&&tab!=='AUDIT';
  const actions=mayEdit&&tab!=='AUDIT'&&
    <span className="afc-admin-access"><Icon name="shield" size={15}/> Ediciones autorizadas y auditadas</span>;
  return <main className="afc-page">
    <AdminPageHeading icon="chart" title="Gastos y contabilidad"
      description="Control financiero de proveedores tecnológicos, facturas, consumos y registros administrativos."
      actions={<div className="afc-header-actions">
        <Link className="afc-btn afc-btn-outline" to="/transactions"><Icon name="card" size={16}/> Transacciones</Link>
        <button type="button" className="afc-btn afc-btn-main" onClick={()=>{setRevision(v=>v+1);if(showFreeTier)loadFreeTier();}}>
          <Icon name="refresh" size={16}/> Actualizar</button>
      </div>}/>
    <section className="afc-scope-banner" aria-label="Alcance contable">
      <span className="afc-scope-icon"><Icon name="shield" size={24}/></span>
      <div><strong>Gastos tecnológicos · registros contables de apoyo</strong>
        <p>Consumo, facturas, presupuestos y pagos proceden de fuentes diferentes.
          No deben sumarse entre sí. Esta pantalla no sustituye los libros oficiales,
          comprobantes contables, conciliación bancaria ni facturación electrónica DIAN.</p>
      </div><span className="afc-scope-tag">Sin conciliación bancaria</span>
    </section>
    {notice&&<div className="afc-notice" role="status"><Icon name="check" size={17}/>{notice}</div>}
    <form className="afc-period-bar" onSubmit={applyDates}>
      <div className="afc-period-info"><span className="afc-eyebrow">INTERVALO DE CONSULTA</span>
        <strong>Período financiero</strong><small>Fechas UTC · inclusivas</small></div>
      <div className="afc-period-controls">
        <label><span>Desde</span><input type="date" aria-label="Período desde"
          value={draftFrom} max={draftTo||undefined} onChange={e=>setDraftFrom(e.target.value)}/></label>
        <label><span>Hasta</span><input type="date" aria-label="Período hasta"
          value={draftTo} min={draftFrom||undefined} onChange={e=>setDraftTo(e.target.value)}/></label>
        <button className="afc-btn afc-btn-main" type="submit">Aplicar período</button>
      </div>
      <div className="afc-presets" aria-label="Períodos rápidos">
        <button type="button" onClick={()=>preset(null)}>Mes actual</button>
        <button type="button" onClick={()=>preset(30)}>Últimos 30 días</button>
        <button type="button" onClick={()=>preset(90)}>Últimos 90 días</button>
      </div>
      {periodError&&<p className="afc-period-error" role="alert">{periodError}</p>}
    </form>
    {overviewError&&<div role="alert" className="afc-error"><Icon name="shield" size={20}/>
      <p>{overviewError}. Se necesita el backend actualizado.</p>
      <button type="button" className="afc-btn afc-btn-outline" onClick={()=>setRevision(v=>v+1)}>Reintentar</button>
    </div>}
    <section className="afc-kpis" aria-label="Indicadores financieros del período">
      {kpis.map(k=><article className={'afc-kpi afc-kpi-'+k.tone} key={k.label}>
        <span className="afc-kpi-icon"><Icon name={k.icon} size={23}/></span>
        <div><span>{k.label}</span><strong aria-busy={overviewLoading}>{k.value}</strong><small>{k.note}</small></div>
      </article>)}
    </section>
    <section className="afc-analytics" aria-label="Analítica de consumos tecnológicos">
      <article className="afc-trend-panel"><header className="afc-section-heading"><div>
        <span className="afc-eyebrow">CONSUMO REGISTRADO</span><h2>Evolución de los gastos</h2>
        <p>Importes COP por inicio del período de consumo; fechas sin registros aparecen como 0.</p>
      </div><span className="afc-head-pill">Serie {overview?.timeline.unit==='month'?'mensual':
        overview?.timeline.unit==='week'?'semanal':'diaria'}</span></header>
        {overview?<PeriodGraph trend={overview.timeline}/>:<p className="afc-chart-empty">{overviewLoading?'Consultando tendencia…':'Sin serie disponible.'}</p>}
        <p className="afc-chart-caption"><Icon name="info" size={15}/>
          Los cargos pueden ser reales, estimados, proyectados o manuales. No se prorratean períodos de servicio.</p>
      </article>
      <article className="afc-breakdown"><header className="afc-section-heading"><div>
        <span className="afc-eyebrow">DISTRIBUCIÓN POR PROVEEDOR</span><h2>¿Dónde se registra el gasto?</h2>
        <p>Participación en el consumo COP del período.</p></div></header>
        {overview?.providerBreakdown.length?<div className="afc-provider-bars">{overview.providerBreakdown.slice(0,6).map(p=>{
          const denominator=Math.max(0,Number(overview.totals.consumptionCop));
          const percent=denominator>0?Math.max(0,Number(p.amountCop)/denominator*100):0;
          return <div key={p.id} className="afc-provider-row">
            <div><strong>{p.name}</strong><span>{formatCop(p.amountCop)}</span></div>
            <div className="afc-progress"><span style={{width:Math.min(100,percent)+'%'}}/></div>
            <small>{percent.toLocaleString('es-CO',{maximumFractionDigits:1})}% · {number(p.records)} registros</small>
          </div>;
        })}</div>:<div className="afc-mini-empty">{overview?'No hay consumos por proveedor en este período.':'Consultando proveedores…'}</div>}
        {overview&&overview.providerBreakdown.length>6&&<p className="afc-extra-note">
          Se muestran los seis proveedores con mayor consumo registrado.</p>}
        <div className="afc-source-summary"><Icon name="info" size={17}/>
          <span><strong>{overview?number(overview.originCounts.REAL??0):'—'}</strong> reales ·
          <strong> {overview?number(overview.originCounts.MANUAL??0):'—'}</strong> manuales ·
          <strong> {overview?number((overview.originCounts.ESTIMATED??0)+(overview.originCounts.PROJECTED??0)):'—'}</strong> estimados/proyectados</span></div>
      </article>
    </section>
    <section className="afc-context-grid" aria-label="Presupuestos y sincronización">
      <article className="afc-context-panel">
        <header className="afc-section-heading"><div><span className="afc-eyebrow">PLANIFICACIÓN</span>
          <h2>Presupuestos vigentes en el intervalo</h2><p>Vigencias propias, no saldo financiero disponible.</p></div>
          <button type="button" className="afc-text-action" onClick={()=>change({tab:'BUDGETS',page:1,q:'',providerId:''})}>
            Ver todos <Icon name="arrow" size={15}/></button>
        </header>
        {overview?.budgets.length?<div className="afc-budget-list">{overview.budgets.slice(0,4).map(b=>
          <div key={b.id}><span><strong>{b.name}</strong><small>{b.providerName} · {b.periodStart} a {b.periodEnd}
            {!b.active?' · Inactivo':''}</small></span><b>{formatCop(b.amountCop)}</b></div>)}</div>:
          <p className="afc-mini-empty">{overview?'Sin presupuestos que intersecten el período.':'Consultando presupuestos…'}</p>}
        <p className="afc-context-footnote">No se calcula porcentaje consumido cuando las vigencias no son idénticas.</p>
      </article>
      <article className="afc-context-panel afc-sync-panel">
        <header className="afc-section-heading"><div><span className="afc-eyebrow">ORIGEN Y CONTROL</span>
          <h2>Sincronización y créditos</h2><p>Transparencia sobre los datos que integran el resumen.</p></div>
        </header>
        <div className="afc-sync-stat"><span>Créditos promocionales registrados · USD</span>
          <strong>{overview?formatUsd(overview.totals.creditsUsd):'—'}</strong></div>
        <div className="afc-sync-stat"><span>Última sincronización</span>
          <strong>{overview?.lastSync?statusNames[overview.lastSync.status]??overview.lastSync.status:'—'}</strong>
          <small>{overview?.lastSync?overview.lastSync.providerName+' · '+dateTime(overview.lastSync.startedAt):
            'No consta una sincronización registrada'}</small>
        </div>
        <button type="button" className="afc-free-toggle" onClick={toggleTier}
          aria-expanded={showFreeTier}><Icon name="server" size={17}/>
          {showFreeTier?'Ocultar consulta AWS Free Tier':'Consultar AWS Free Tier'}
          <Icon name="chevron" size={16}/></button>
        {showFreeTier&&<div className="afc-free-body"><AwsFreeTierPanel state={freeTier.state}
          usages={freeTier.usages} updatedAt={freeTier.updatedAt} error={freeTier.error}/>
          <button className="afc-btn afc-btn-outline" type="button" disabled={freeTier.state==='loading'}
            onClick={loadFreeTier}><Icon name="refresh" size={15}/> Actualizar AWS</button></div>}
      </article>
    </section>
    <section className="afc-ledger" aria-labelledby="afc-ledger-heading">
      <header className="afc-section-heading afc-ledger-heading"><div>
        <span className="afc-eyebrow">REGISTROS VERIFICABLES</span>
        <h2 id="afc-ledger-heading">Archivo financiero</h2>
        <p>Consulta datos existentes y sus estados; cualquier modificación exige permisos y deja auditoría.</p>
      </div>{actions}</header>
      <div className="afc-tabs" role="group" aria-label="Secciones del archivo financiero">
        {tabs.map(t=><button type="button" key={t.kind} title={t.detail}
          aria-pressed={tab===t.kind} onClick={()=>{setSearch('');change({tab:t.kind,q:'',providerId:'',page:1});}}>
          <Icon name={t.icon} size={17}/>{t.label}</button>)}
      </div>
      <form className="afc-filters" onSubmit={e=>{e.preventDefault();change({q:search.trim(),page:1});}}>
        <label className="afc-field afc-search-field"><span>Buscar en {tabs.find(t=>t.kind===tab)?.label.toLowerCase()}</span>
          <span className="afc-search"><Icon name="search" size={18}/>
            <input type="search" aria-label="Buscar registro financiero" maxLength={100}
              value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre, referencia o identificador…"/></span>
        </label>
        <label className="afc-field"><span>Proveedor</span>
          <select aria-label="Filtrar por proveedor" value={isTabFilterable?providerId:''}
            disabled={!isTabFilterable} onChange={e=>change({providerId:e.target.value,page:1})}>
            <option value="">Todos los proveedores</option>
            {overview?.providers.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="afc-filter-actions">
          <button type="button" className="afc-btn afc-btn-outline" onClick={()=>{
            setSearch('');change({q:'',providerId:'',page:1});}}>Limpiar</button>
          <button type="submit" className="afc-btn afc-btn-main"><Icon name="search" size={15}/> Buscar</button>
        </div>
      </form>
      <div className="afc-ledger-toolbar">
        <div><strong>{ledgerLoading?'Consultando registros…':ledger?
          number(ledger.pagination.total)+(ledger.pagination.total===1?' registro':' registros'):'Registros financieros'}</strong>
          <span>{tab==='PROVIDERS'?'Catálogo completo · sin filtro temporal':
            tab==='BUDGETS'?'Presupuestos con períodos de vigencia que intersectan el rango':
            tab==='PAYMENTS'||tab==='AUDIT'||tab==='ALERTS'?'Fecha de registro UTC dentro del período':
            'Fecha inicial del período contable consultado'}</span></div>
        <div className="afc-export-actions"><button className="afc-btn afc-btn-outline" type="button"
          disabled={ledgerLoading||!ledger?.records.length} onClick={csv}>
          <Icon name="download" size={16}/> CSV página</button>
          {tab==='CONSUMPTIONS'&&<button className="afc-btn afc-btn-outline" type="button"
            disabled={ledgerLoading||!ledger?.records.length} onClick={xlsx}>
            <Icon name="download" size={16}/> Excel página</button>}
        </div>
      </div>
      {ledgerError&&<div className="afc-error" role="alert"><Icon name="shield" size={19}/>
        <p>{ledgerError}. Este registro necesita la API financiera actualizada.</p>
        <button type="button" className="afc-btn afc-btn-outline" onClick={()=>setRevision(v=>v+1)}>Reintentar</button>
      </div>}
      {ledgerLoading?<div className="afc-data-message" role="status">Consultando el registro real de {tabs.find(t=>t.kind===tab)?.label.toLowerCase()}…</div>
      :!ledger?.records.length&&!ledgerError?<div className="afc-empty"><Icon name="database" size={28}/>
        <strong>Sin registros para esta consulta</strong>
        <p>No hay datos que coincidan con el período y los filtros seleccionados.</p>
        <button className="afc-btn afc-btn-outline" type="button" onClick={()=>{setSearch('');
          change({q:'',providerId:'',page:1});}}>Limpiar filtros</button>
      </div>:ledger?.records.length?<div className="afc-records">
        <div className="afc-table-scroll"><table className="afc-table"><thead><tr>
          <th>Registro</th><th>Proveedor / detalle</th><th>Fecha / vigencia</th>
          <th>Importe</th><th>Estado / origen</th><th>Acción</th>
        </tr></thead><tbody>{ledger.records.map(row=><tr key={row.id}>
          <td><strong>{row.name}</strong><small>{row.kind==='AUDIT'?row.detail:row.id.slice(0,8)}</small></td>
          <td><strong>{row.providerName??'—'}</strong><small>{row.detail}</small></td>
          <td>{row.periodStart?<><span>{row.periodStart}</span><small>Hasta {row.periodEnd}</small></>:
            dateTime(row.createdAt)}</td>
          <td className="afc-table-money">{formatCop(row.amountCop)}
            {row.amountUsd!==undefined&&row.amountUsd!==null&&<small>{formatUsd(row.amountUsd)}</small>}</td>
          <td><span className={'afc-status afc-status-'+(row.status??'unknown').toLowerCase()}>
            {statusNames[row.status??'']??row.status??'—'}</span></td>
          <td><div className="afc-row-actions">
            {row.kind==='INVOICES'&&row.documentUrl&&safeDocumentUrl(row.documentUrl)&&
              <a className="afc-inline-link" href={safeDocumentUrl(row.documentUrl)??'#'}
                target="_blank" rel="noopener noreferrer">Documento <Icon name="arrow" size={14}/></a>}
            {mayEdit&&row.canEdit&&row.kind==='ALERTS'?
              <button className="afc-row-button" type="button" disabled={alertBusy===row.id}
                onClick={()=>void reviewAlert(row)}>{alertBusy===row.id?'Guardando…':'Marcar revisada'}</button>:
            mayEdit&&row.canEdit&&fieldsByKind[row.kind]?
              <button className="afc-row-button" type="button" onClick={()=>setEditing(row)}>
                <Icon name="settings" size={14}/> Corregir</button>:
              <span className="afc-read-only">Solo lectura</span>}
          </div></td>
        </tr>)}</tbody></table></div>
        <div className="afc-record-cards">{ledger.records.map(row=><article key={row.id}>
          <header><strong>{row.name}</strong><span className={'afc-status afc-status-'+(row.status??'unknown').toLowerCase()}>
            {statusNames[row.status??'']??row.status??'—'}</span></header>
          <small>{row.providerName??row.detail}</small>
          <dl><div><dt>Importe COP</dt><dd>{formatCop(row.amountCop)}</dd></div>
            <div><dt>Importe USD</dt><dd>{formatUsd(row.amountUsd)}</dd></div>
            <div><dt>Inicio / registro</dt><dd>{row.periodStart??dateTime(row.createdAt)}</dd></div>
            <div><dt>Referencia</dt><dd>{row.detail}</dd></div></dl>
          <div className="afc-card-actions">
            {row.kind==='INVOICES'&&row.documentUrl&&safeDocumentUrl(row.documentUrl)&&
              <a href={safeDocumentUrl(row.documentUrl)??'#'} target="_blank" rel="noopener noreferrer">Abrir documento</a>}
            {mayEdit&&row.canEdit&&row.kind==='ALERTS'?
              <button type="button" disabled={alertBusy===row.id} onClick={()=>void reviewAlert(row)}>Marcar revisada</button>:
            mayEdit&&row.canEdit&&fieldsByKind[row.kind]?
              <button type="button" onClick={()=>setEditing(row)}>Corregir registro</button>:
              <span>Solo lectura</span>}
          </div>
        </article>)}</div>
      </div>:null}
      {ledger&&ledger.pagination.totalPages>1&&<nav className="afc-pagination" aria-label="Páginas del archivo financiero">
        <span>Página {page} de {ledger.pagination.totalPages}</span>
        <div><button type="button" className="afc-btn afc-btn-outline" disabled={page<=1||ledgerLoading}
          onClick={()=>change({page:page-1})}>Anterior</button>
          <button type="button" className="afc-btn afc-btn-main" disabled={page>=ledger.pagination.totalPages||ledgerLoading}
            onClick={()=>change({page:page+1})}>Siguiente <Icon name="arrow" size={15}/></button></div>
      </nav>}
      <p className="afc-ledger-footnote"><Icon name="info" size={16}/>
        {ledger?.definition??'Todos los registros proceden del backend de XAMUKO.'}
        Las exportaciones incluyen exclusivamente la página y los filtros visibles.</p>
    </section>
    <section className="afc-methodology" aria-label="Método de interpretación de datos">
      <header><Icon name="book-open" size={22}/><div><span className="afc-eyebrow">CRITERIOS DE INTERPRETACIÓN</span>
        <h2>Cómo interpretar estos datos</h2><p>Información para tomar decisiones sin mezclar conceptos contables.</p></div></header>
      <div>{(overview?.notes??[
        'Los consumos representan cargos registrados o estimaciones, no necesariamente facturas.',
        'Una factura de proveedor no equivale a un pago bancario confirmado.',
        'No se descuentan créditos USD de montos COP sin tasa de conversión explícita.',
      ]).map((note,i)=><p key={i}><Icon name="check" size={15}/>{note}</p>)}</div>
      <div className="afc-related">
        <Link to="/transactions">Consultar transacciones <Icon name="arrow" size={15}/></Link>
        <Link to="/billing">Ingresos y facturación <Icon name="arrow" size={15}/></Link>
        <Link to="/refunds">Solicitudes de reembolso <Icon name="arrow" size={15}/></Link>
      </div>
    </section>
    {editing&&mayEdit&&<EditFinancialRecord record={editing}
      onClose={()=>setEditing(null)} onUpdated={onUpdated}/>}
  </main>;
}
function safeDocumentUrl(value:string):string|null{
  try{
    const url=new URL(value);return url.protocol==='https:'?url.href:null;
  }catch{return null;}
}
