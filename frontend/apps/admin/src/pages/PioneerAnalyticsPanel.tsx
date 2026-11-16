import { useEffect, useMemo, useRef, useState, type PointerEvent as ChartPointerEvent } from 'react';
import { Icon } from '../components/Icon';
import type { PioneerAssignment } from '../services/adminApiClient';

type Period = '7d'|'30d'|'90d'|'6m'|'12m'|'all';
type Metric = 'new'|'cumulative';
type Shape = 'line'|'bars';
type Point = { key:string; date:string; new:number; cumulative:number };
const nf=(n:number)=>new Intl.NumberFormat('es-CO').format(n);
const localDate=(date:Date)=>new Date(date.getTime()-5*60*60*1000);
const isoMonth=(date:Date)=>date.toISOString().slice(0,7);
const isoDay=(date:Date)=>date.toISOString().slice(0,10);
const bucketLabel=(key:string,full:boolean)=>{
  const daily=key.length===10;
  const date=new Date((daily?key:key+'-01')+'T12:00:00Z');
  return date.toLocaleDateString('es-CO',daily?
    {day:'2-digit',month:'short',...(full?{year:'numeric' as const}:{}),timeZone:'UTC'}:
    {month:'short',year:full?'numeric':'2-digit',timeZone:'UTC'});
};
function buildSeries(assignments:PioneerAssignment[],period:Period):Point[]{
  const now=localDate(new Date()),today=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  const dayPeriod=period==='7d'||period==='30d'||period==='90d';
  const len=period==='7d'?7:period==='30d'?30:period==='90d'?90:0;
  const start=dayPeriod?new Date(today.getTime()-(len-1)*86400000):
    period==='all'?
      (assignments.length?new Date(Date.UTC(
        Math.min(...assignments.map(a=>localDate(new Date(a.assignedAt)).getUTCFullYear())),
        0,1)):new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1))) :
      new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-(period==='6m'?5:11),1));
  if(period==='all'&&assignments.length){
    const first=assignments.reduce((a,b)=>new Date(a.assignedAt)<new Date(b.assignedAt)?a:b);
    const local=localDate(new Date(first.assignedAt));
    start.setUTCFullYear(local.getUTCFullYear());start.setUTCMonth(local.getUTCMonth(),1);
  }
  const counts=new Map<string,number>();
  let before=0;
  const startKey=dayPeriod?isoDay(start):isoMonth(start);
  for(const item of assignments){
    const assigned=new Date(item.assignedAt);
    if(Number.isNaN(assigned.getTime()))continue;
    const local=localDate(assigned);
    const key=dayPeriod?isoDay(local):isoMonth(local);
    if(key<startKey)before++;
    else counts.set(key,(counts.get(key)??0)+1);
  }
  const points:Point[]=[];
  let running=before;
  const current=new Date(start);
  for(let i=0;i<1500&&current<=today;i++){
    const key=dayPeriod?isoDay(current):isoMonth(current);
    const added=counts.get(key)??0;
    running+=added;
    points.push({key,date:bucketLabel(key,false),new:added,cumulative:running});
    if(dayPeriod)current.setUTCDate(current.getUTCDate()+1);
    else current.setUTCMonth(current.getUTCMonth()+1);
  }
  return points;
}
function PioneerChart({points,metric,shape}:{points:Point[];metric:Metric;shape:Shape}){
  const root=useRef<HTMLDivElement>(null);
  const [width,setWidth]=useState(800);
  const [selected,setSelected]=useState<number|null>(null);
  useEffect(()=>{
    const node=root.current;
    if(!node||typeof ResizeObserver==='undefined')return;
    const observer=new ResizeObserver(entries=>{
      const next=Math.max(300,Math.round(entries[0]?.contentRect.width??800));
      setWidth(old=>old===next?old:next);
    });
    observer.observe(node);
    return()=>observer.disconnect();
  },[]);
  useEffect(()=>setSelected(null),[points,metric,shape]);
  const h=302,left=49,right=27,top=23,bottom=46,w=width-left-right,plotH=h-top-bottom,baseline=top+plotH;
  const values=points.map(p=>p[metric]);
  const max=Math.max(1,...values);
  const power=Math.pow(10,Math.floor(Math.log10(max/4)));
  const step=Math.max(1,Math.ceil(max/4/power)*power);
  const maxY=step*4;
  const x=(i:number)=>left+(points.length===1?w/2:i*w/(points.length-1));
  const y=(v:number)=>top+plotH*(1-v/maxY);
  const path=points.length>1?'M '+x(0)+' '+baseline+' L '+points.map((p,i)=>x(i)+' '+y(p[metric])).join(' L ')+' L '+x(points.length-1)+' '+baseline+' Z':'';
  const line=points.map((p,i)=>x(i)+','+y(p[metric])).join(' ');
  const barWidth=Math.min(43,(w/Math.max(1,points.length))*.7);
  const active=selected===null?null:points[selected];
  const cursorX=selected===null?0:shape==='bars'?left+(selected+.5)*w/points.length:x(selected);
  const labelsStep=Math.max(1,Math.ceil(points.length/Math.max(2,Math.floor(w/90))));
  const move=(event:ChartPointerEvent<SVGSVGElement>)=>{
    if(!points.length)return;
    const matrix=event.currentTarget.getScreenCTM();
    if(!matrix)return;
    const pointer=event.currentTarget.createSVGPoint();
    pointer.x=event.clientX;pointer.y=event.clientY;
    const local=pointer.matrixTransform(matrix.inverse()).x;
    const ratio=Math.max(0,Math.min(1,(local-left)/w));
    setSelected(shape==='bars'?Math.min(points.length-1,Math.floor(ratio*points.length)):
      Math.round(ratio*Math.max(0,points.length-1)));
  };
  return <div className="pioneer-chart-canvas" ref={root}>
    <svg viewBox={'0 0 '+width+' '+h} role="img" aria-label={'Evolución real de cupos Pioneros: '+points.map(p=>p.key+' '+nf(p[metric])).join(', ')}
      onPointerMove={move} onPointerDown={move} onPointerLeave={()=>setSelected(null)}>
      <defs><linearGradient id="pioneer-area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7455e8" stopOpacity=".28"/>
        <stop offset="100%" stopColor="#7455e8" stopOpacity=".015"/>
      </linearGradient><linearGradient id="pioneer-bars" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#3d64e7"/><stop offset="100%" stopColor="#8655ea"/>
      </linearGradient></defs>
      {[0,1,2,3,4].map(i=><g key={i}>
        <line className="pioneer-chart-gridline" x1={left} y1={top+i*plotH/4} x2={width-right} y2={top+i*plotH/4}/>
        <text className="pioneer-chart-axis" x={left-10} y={top+i*plotH/4+4} textAnchor="end">{nf(maxY-i*step)}</text></g>)}
      <rect x={left} y={top} width={w} height={plotH} fill="transparent" pointerEvents="all"/>
      {shape==='line'?<>{path&&<path d={path} fill="url(#pioneer-area)" pointerEvents="none"/>}
        <polyline points={line} className="pioneer-chart-line" fill="none" pointerEvents="none"/>
        {points.map((p,i)=><circle key={p.key} cx={x(i)} cy={y(p[metric])} r={selected===i?5:3.1}
          className="pioneer-chart-dot" aria-label={p.key+': '+p[metric]} tabIndex={0} onFocus={()=>setSelected(i)}/>)}
      </>:points.map((p,i)=><rect key={p.key} x={left+(i+.5)*w/points.length-barWidth/2}
        y={y(p[metric])} width={barWidth} height={Math.max(1,baseline-y(p[metric]))} rx={3}
        fill="url(#pioneer-bars)" aria-label={p.key+': '+p[metric]} tabIndex={0}
        onFocus={()=>setSelected(i)}/>)}
      {active&&selected!==null&&<>
        <line className="pioneer-chart-guide" x1={cursorX} x2={cursorX} y1={top} y2={baseline} pointerEvents="none"/>
        <line className="pioneer-chart-guide" x1={left} x2={width-right}
          y1={y(active[metric])} y2={y(active[metric])} opacity=".45" pointerEvents="none"/>
        <circle cx={cursorX} cy={y(active[metric])} r="5.8" fill="#fff" stroke="#6955e8" strokeWidth="2.4" pointerEvents="none"/>
        <g pointerEvents="none">{(()=>{const tx=Math.max(left,Math.min(width-right-124,cursorX-60));
          const ty=Math.max(3,y(active[metric])-62);
          return <><rect x={tx} y={ty} width="124" height="49" rx="9" fill="#192c50"/>
            <text x={tx+62} y={ty+18} fill="#c3d1ef" fontSize="11" textAnchor="middle">{bucketLabel(active.key,true)}</text>
            <text x={tx+62} y={ty+38} fill="#fff" fontSize="16" fontWeight="800" textAnchor="middle">{nf(active[metric])}</text></>;})()}</g>
      </>}
      {points.map((p,i)=>(i%labelsStep===0||i===points.length-1)&&
        <text key={p.key} className="pioneer-chart-axis" x={shape==='bars'?left+(i+.5)*w/points.length:x(i)}
          y={h-17} textAnchor="middle">{p.date}</text>)}
    </svg>
    <p className="pioneer-chart-caption" role="status">{active
      ? <><strong>{bucketLabel(active.key,true)}</strong> · {nf(active[metric])} {metric==='new'?'asignaciones':'reconocimientos acumulados'}</>
      : 'Consulta cada fecha con la línea vertical. Los períodos sin asignaciones se muestran con valor 0.'}</p>
  </div>;
}
function exportChart(points:Point[]){
  const csv='\ufeffFecha;Nuevas asignaciones;Acumulado\r\n'+points.map(p=>[p.key,p.new,p.cumulative].join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='xamuko-pioneros-evolucion.csv';a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function PioneerAnalyticsPanel({assignments}:{assignments:PioneerAssignment[]}){
  const [period,setPeriod]=useState<Period>('12m');
  const [metric,setMetric]=useState<Metric>('new');
  const [shape,setShape]=useState<Shape>('line');
  const [format,setFormat]=useState<'chart'|'table'>('chart');
  const points=useMemo(()=>buildSeries(assignments,period),[assignments,period]);
  const total=points.reduce((n,p)=>n+p.new,0);
  const peak=points.reduce<Point|null>((a,p)=>!a||p.new>a.new?p:a,null);
  return <section className="pioneer-analytics" aria-labelledby="pioneer-analytics-title">
    <header className="pioneer-section-heading"><div>
      <span className="pioneer-eyebrow">ESTADÍSTICAS · DATOS REALES</span>
      <h2 id="pioneer-analytics-title"><Icon name="chart" size={20}/> Evolución de Negocios Pioneros</h2>
      <p>Reconocimientos asignados por fecha, con consulta precisa y sin valores inventados.</p></div>
      <button className="secondary-button" type="button" onClick={()=>exportChart(points)}>
        <Icon name="download" size={16}/> Exportar gráfica</button>
    </header>
    <div className="pioneer-chart-controls">
      <label>Temporalidad <select value={period} onChange={e=>setPeriod(e.target.value as Period)}>
        <option value="7d">7 días</option><option value="30d">30 días</option><option value="90d">90 días</option>
        <option value="6m">6 meses</option><option value="12m">12 meses</option><option value="all">Todo el histórico</option>
      </select></label>
      <label>Indicador <select value={metric} onChange={e=>setMetric(e.target.value as Metric)}>
        <option value="new">Nuevas asignaciones</option><option value="cumulative">Acumulado de Pioneros</option>
      </select></label>
      <div className="pioneer-chart-switch" role="group" aria-label="Tipo de gráfica">
        <button type="button" className={shape==='line'?'selected':''} aria-pressed={shape==='line'}
          onClick={()=>setShape('line')}>Línea</button>
        <button type="button" className={shape==='bars'?'selected':''} aria-pressed={shape==='bars'}
          onClick={()=>setShape('bars')}>Barras</button>
      </div>
      <div className="pioneer-chart-switch" role="group" aria-label="Mostrar datos">
        <button type="button" className={format==='chart'?'selected':''} aria-pressed={format==='chart'}
          onClick={()=>setFormat('chart')}>Gráfica</button>
        <button type="button" className={format==='table'?'selected':''} aria-pressed={format==='table'}
          onClick={()=>setFormat('table')}>Tabla</button>
      </div>
    </div>
    {format==='chart'?<PioneerChart points={points} metric={metric} shape={shape}/>:
      <div className="pioneer-chart-table"><table><thead><tr>
        <th>Fecha</th><th>Nuevas asignaciones</th><th>Acumulado</th></tr></thead>
        <tbody>{points.map(p=><tr key={p.key}><th scope="row">{bucketLabel(p.key,true)}</th>
          <td>{nf(p.new)}</td><td>{nf(p.cumulative)}</td></tr>)}</tbody></table></div>}
    <div className="pioneer-chart-insights">
      <span><strong>{nf(total)}</strong> asignaciones en el período</span>
      <span><strong>{peak&&peak.new>0?bucketLabel(peak.key,true):'—'}</strong> período con más asignaciones</span>
    </div>
    <p className="pioneer-analytics-definition"><Icon name="shield" size={16}/>
      Fuente: fechas reales de la tabla PioneerAssignment. “Nuevas” cuenta cupos asignados
      durante cada período; “Acumulado” incluye los otorgados con anterioridad.
      Los ceros indican ausencia de nuevas asignaciones. Zona horaria: Colombia (UTC−5).</p>
  </section>;
}
