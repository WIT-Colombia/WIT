import { useEffect, useRef, useState, type PointerEvent as ChartPointerEvent } from 'react';
import { Icon } from '../components/Icon';
import type { AdminZoneInsights } from '../services/adminApiClient';

type Metric='registrations'|'cumulative';
const nf=(n:number)=>new Intl.NumberFormat('es-CO').format(n);
const label=(month:string)=>new Date(month+'-01T12:00:00Z').toLocaleDateString('es-CO',{
  month:'short',year:'2-digit',timeZone:'UTC',
});
export function ZoneGrowthChart({insights}:{insights:AdminZoneInsights}){
  const [period,setPeriod]=useState<'6m'|'12m'>('12m');
  const [metric,setMetric]=useState<Metric>('registrations');
  const [view,setView]=useState<'line'|'bars'|'table'>('line');
  const [selected,setSelected]=useState<number|null>(null);
  const [width,setWidth]=useState(810);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=root.current;if(!node||typeof ResizeObserver==='undefined')return;
    const obs=new ResizeObserver(entries=>setWidth(Math.max(320,Math.round(entries[0]?.contentRect.width??810))));
    obs.observe(node);return()=>obs.disconnect();
  },[]);
  const series=period==='6m'?insights.series.slice(-6):insights.series;
  useEffect(()=>setSelected(null),[metric,view,period,insights.zone.key]);
  const h=305,left=48,right=28,top=20,bottom=44,w=width-left-right,ph=h-top-bottom,base=top+ph;
  const values=series.map(p=>p[metric]),max=Math.max(1,...values);
  const power=10**Math.floor(Math.log10(max/4));
  const tick=Math.max(1,Math.ceil(max/4/power)*power),topY=tick*4;
  const x=(i:number)=>left+(series.length<2?w/2:i*w/(series.length-1));
  const y=(n:number)=>top+ph*(1-n/topY);
  const selectedPoint=selected==null?null:series[selected];
  const selectedX=selected==null?0:view==='bars'?left+(selected+.5)*w/series.length:x(selected);
  const move=(event:ChartPointerEvent<SVGSVGElement>)=>{
    const matrix=event.currentTarget.getScreenCTM();if(!matrix||!series.length)return;
    const pointer=event.currentTarget.createSVGPoint();pointer.x=event.clientX;pointer.y=event.clientY;
    const local=pointer.matrixTransform(matrix.inverse()).x;
    const ratio=Math.max(0,Math.min(1,(local-left)/w));
    setSelected(view==='bars'?Math.min(series.length-1,Math.floor(ratio*series.length)):
      Math.round(ratio*(series.length-1)));
  };
  const exportCsv=()=>{
    const csv='\ufeffMes;Nuevos negocios;Acumulado\r\n'+series.map(p=>[p.month,p.registrations,p.cumulative].join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='xamuko-crecimiento-zona.csv';a.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <section className="zone-insights">
    <header className="zone-insights__header"><div><h3>Evolución de {insights.zone.name}</h3>
      <p>Negocios creados por mes, incluidos los meses con cero registros.</p></div>
      <button className="secondary-button" type="button" onClick={exportCsv}><Icon name="download" size={16}/> CSV</button>
    </header>
    <div className="zone-insights__summary">
      <div><small>Negocios registrados</small><strong>{nf(insights.summary.registeredBusinesses)}</strong></div>
      <div><small>Listos para publicarse</small><strong>{nf(insights.summary.readyBusinesses)}</strong></div>
      <div><small>Usuarios que eligieron esta ubicación</small><strong>{nf(insights.summary.usersWithLocationPreference)}</strong></div>
    </div>
    <div className="zone-insights__controls">
      <label>Período <select value={period} onChange={e=>setPeriod(e.target.value as '6m'|'12m')}>
        <option value="6m">Últimos 6 meses</option><option value="12m">Últimos 12 meses</option></select></label>
      <label>Indicador <select value={metric} onChange={e=>setMetric(e.target.value as Metric)}>
        <option value="registrations">Nuevos negocios</option><option value="cumulative">Acumulados</option></select></label>
      <div className="zone-insights__switch" role="group" aria-label="Presentación">
        <button type="button" aria-pressed={view==='line'} className={view==='line'?'active':''} onClick={()=>setView('line')}>Línea</button>
        <button type="button" aria-pressed={view==='bars'} className={view==='bars'?'active':''} onClick={()=>setView('bars')}>Barras</button>
        <button type="button" aria-pressed={view==='table'} className={view==='table'?'active':''} onClick={()=>setView('table')}>Tabla</button>
      </div>
    </div>
    {view==='table'?<div className="zone-insights__table"><table><thead><tr><th>Mes</th><th>Nuevos</th><th>Acumulado</th></tr></thead>
      <tbody>{series.map(p=><tr key={p.month}><th scope="row">{label(p.month)}</th>
        <td>{nf(p.registrations)}</td><td>{nf(p.cumulative)}</td></tr>)}</tbody></table></div>:
    <div className="zone-insights__canvas" ref={root}>
      <svg viewBox={'0 0 '+width+' '+h} role="img" aria-label={'Evolución de negocios en '+insights.zone.name+
        ': '+series.map(p=>p.month+' '+p[metric]).join(', ')}
        onPointerMove={move} onPointerDown={move} onPointerLeave={()=>setSelected(null)}>
        <defs><linearGradient id="zone-area-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7257e8" stopOpacity=".23"/>
          <stop offset="100%" stopColor="#7257e8" stopOpacity=".02"/>
        </linearGradient></defs>
        {[0,1,2,3,4].map(i=><g key={i}>
          <line className="zone-chart-grid" x1={left} x2={width-right} y1={top+i*ph/4} y2={top+i*ph/4}/>
          <text className="zone-chart-axis" x={left-10} y={top+i*ph/4+4} textAnchor="end">{nf(topY-i*tick)}</text>
        </g>)}
        <rect x={left} y={top} width={w} height={ph} fill="transparent" pointerEvents="all"/>
        {view==='line'?<><path fill="url(#zone-area-gradient)" pointerEvents="none" d={'M '+x(0)+' '+base+
          ' L '+series.map((p,i)=>x(i)+' '+y(p[metric])).join(' L ')+
          ' L '+x(series.length-1)+' '+base+' Z'}/>
          <polyline className="zone-chart-line" points={series.map((p,i)=>x(i)+','+y(p[metric])).join(' ')} fill="none" pointerEvents="none"/>
          {series.map((p,i)=><circle key={p.month} cx={x(i)} cy={y(p[metric])}
            className="zone-chart-dot" r={selected===i?5:3}
            tabIndex={0} aria-label={p.month+' '+p[metric]} onFocus={()=>setSelected(i)}/>)}
        </>:series.map((p,i)=><rect key={p.month} x={left+(i+.5)*w/series.length-Math.min(42,w/series.length*.65)/2}
          y={y(p[metric])} width={Math.min(42,w/series.length*.65)}
          height={Math.max(1,base-y(p[metric]))} rx={5} fill="#7155de"
          tabIndex={0} aria-label={p.month+' '+p[metric]} onFocus={()=>setSelected(i)}/>)}
        {selectedPoint&&selected!==null&&<>
          <line className="zone-chart-guide" x1={selectedX} x2={selectedX} y1={top} y2={base} pointerEvents="none"/>
          <circle cx={selectedX} cy={y(selectedPoint[metric])} r="5" fill="#fff" stroke="#7155de" strokeWidth="2" pointerEvents="none"/>
          {(()=>{const bx=Math.max(left,Math.min(width-right-105,selectedX-50));
            const by=Math.max(0,y(selectedPoint[metric])-57);
            return <g pointerEvents="none"><rect x={bx} y={by} width="105" height="46" rx="8" fill="#1a2e59"/>
              <text x={bx+52} y={by+17} fontSize="11" fill="#cbd8fa" textAnchor="middle">{label(selectedPoint.month)}</text>
              <text x={bx+52} y={by+35} fontSize="16" fill="#fff" fontWeight="800" textAnchor="middle">{nf(selectedPoint[metric])}</text>
            </g>;})()}
        </>}
        {series.map((p,i)=><text key={p.month} className="zone-chart-axis"
          x={view==='bars'?left+(i+.5)*w/series.length:x(i)} y={h-17} textAnchor="middle">{label(p.month)}</text>)}
      </svg>
      <p className="zone-insights__caption">{selectedPoint?label(selectedPoint.month)+': '+nf(selectedPoint[metric]):
        'Consulta cada mes con la línea vertical. Los meses sin registros muestran 0.'}</p>
    </div>}
    <p className="zone-insights__definition"><Icon name="shield" size={16}/>{insights.definition}</p>
  </section>;
}
