import { useEffect, useMemo, useRef, useState, type PointerEvent as ChartPointerEvent } from 'react';
import { Icon } from '../components/Icon';
import type { AdminContentFilters, AdminContentInsights } from '../services/adminApiClient';
const num = (n:number) => new Intl.NumberFormat('es-CO').format(n);
const month = (m:string) => new Date(m+'-01T12:00:00Z').toLocaleDateString('es-CO',{month:'short',year:'2-digit',timeZone:'UTC'});
type Series = 'total'|'products'|'services';
type ChartMode='line'|'bars';
type Entry={label:string;value:number};
function Timeline({points,mode}:{points:Entry[];mode:ChartMode}){
  const ref=useRef<HTMLDivElement>(null);
  const [width,setWidth]=useState(780);
  const [active,setActive]=useState<number|null>(null);
  useEffect(()=>{
    const node=ref.current;if(!node)return;
    const resize=new ResizeObserver(entries=>{const v=Math.max(315,Math.round(entries[0]?.contentRect.width??780));setWidth(a=>a===v?a:v);});
    resize.observe(node);return()=>resize.disconnect();
  },[]);
  useEffect(()=>setActive(null),[points,mode]);
  const height=300,left=51,right=33,top=24,bottom=46,w=width-left-right,h=height-top-bottom,baseline=top+h;
  const max=Math.max(1,...points.map(p=>p.value)),scale=Math.pow(10,Math.floor(Math.log10(max/4))),step=Math.max(1,Math.ceil(max/4/scale)*scale),ceiling=step*4;
  const x=(i:number)=>left+(points.length===1?w/2:i*w/Math.max(1,points.length-1));
  const y=(v:number)=>top+h*(1-v/ceiling);
  const coords=points.map((p,i)=>x(i)+','+y(p.value)).join(' ');
  const fill=points.length>1?'M '+x(0)+' '+baseline+' L '+points.map((p,i)=>x(i)+' '+y(p.value)).join(' L ')+' L '+x(points.length-1)+' '+baseline+' Z':'';
  const barWidth=Math.min(45,w/Math.max(1,points.length)*.68);
  const selected=active===null?null:points[active];
  const selX=active===null?0:mode==='bars'?left+(active+.5)*w/points.length:x(active);
  const labelStep=Math.max(1,Math.ceil(points.length/Math.max(2,Math.floor(w/88))));
  const move=(event:ChartPointerEvent<SVGSVGElement>)=>{
    const matrix=event.currentTarget.getScreenCTM();if(!matrix)return;
    const pointer=event.currentTarget.createSVGPoint();pointer.x=event.clientX;pointer.y=event.clientY;
    const xx=pointer.matrixTransform(matrix.inverse()).x;
    const ratio=Math.max(0,Math.min(1,(xx-left)/w));
    setActive(mode==='bars'?Math.min(points.length-1,Math.floor(ratio*points.length)):Math.round(ratio*Math.max(0,points.length-1)));
  };
  return <div className="ac-chart-canvas" ref={ref}>
    <svg viewBox={'0 0 '+width+' '+height} role="group" aria-label={'Evolución mensual: '+points.map(p=>p.label+' '+num(p.value)).join(', ')}
      onPointerMove={move} onPointerDown={move} onPointerLeave={()=>setActive(null)}>
      <defs>
        <linearGradient id="ac-timeline-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#225cf1" stopOpacity=".22"/><stop offset="100%" stopColor="#225cf1" stopOpacity=".01"/></linearGradient>
        <linearGradient id="ac-timeline-bars" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#225cf1"/><stop offset="100%" stopColor="#743fff"/></linearGradient>
      </defs>
      {[0,1,2,3,4].map(t=><g key={t}><line className="ac-gridline" x1={left} x2={width-right} y1={top+t*h/4} y2={top+t*h/4}/>
        <text className="ac-chart-axis" x={left-11} y={top+t*h/4+4} textAnchor="end">{num(ceiling-t*step)}</text></g>)}
      <rect x={left} y={top} width={w} height={h} fill="transparent" pointerEvents="all"/>
      {mode==='line'?<>
        {fill&&<path d={fill} fill="url(#ac-timeline-fill)" pointerEvents="none"/>}
        <polyline className="ac-line" points={coords} fill="none" pointerEvents="none"/>
        {points.map((p,i)=><circle key={i} cx={x(i)} cy={y(p.value)} r={i===active?5:3}
          className="ac-plot-point" tabIndex={0} aria-label={p.label+': '+num(p.value)} onFocus={()=>setActive(i)}/>)}
      </>:points.map((p,i)=><rect key={i} x={left+(i+.5)*w/points.length-barWidth/2} y={y(p.value)}
        width={barWidth} height={Math.max(1,baseline-y(p.value))} rx="5"
        fill="url(#ac-timeline-bars)" tabIndex={0} aria-label={p.label+': '+num(p.value)} onFocus={()=>setActive(i)}/>)}
      {selected&&active!==null&&<>
        <line className="ac-chart-guide" x1={selX} x2={selX} y1={y(selected.value)} y2={baseline} pointerEvents="none"/>
        <circle cx={selX} cy={y(selected.value)} r="6" fill="#fff" stroke="#225cf1" strokeWidth="2.6" pointerEvents="none"/>
        {(()=>{const tx=Math.max(left,Math.min(width-right-80,selX-40)),ty=Math.max(2,y(selected.value)-44);return <g pointerEvents="none">
          <rect x={tx} y={ty} width="80" height="33" rx="9" fill="#182e54"/>
          <text x={tx+40} y={ty+22} textAnchor="middle" fill="#fff" fontWeight="800" fontSize="14">{num(selected.value)}</text>
        </g>;})()}
      </>}
      {points.map((p,i)=>(i%labelStep===0||i===points.length-1)&&<text key={i} className="ac-chart-axis"
        x={mode==='bars'?left+(i+.5)*w/points.length:x(i)} y={height-17} textAnchor="middle">{p.label}</text>)}
    </svg>
    <p className="ac-chart-hint">{selected?<><strong>{num(selected.value)}</strong> registros</>:'Mueve el cursor o desliza el dedo para consultar los valores.'}</p>
  </div>;
}
function exportCSV(points:Entry[],label:string){
  const csv=['Período;'+label,...points.map(p=>p.label+';'+p.value)].join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='xamuko-evolucion-contenido.csv';link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function AdminContentAnalyticsPanel({data,loading,error,period,onPeriod,filters,onFilter,onRetry}:{
  data:AdminContentInsights|null;loading:boolean;error:string;
  period:string;onPeriod:(period:string)=>void;
  filters:AdminContentFilters;onFilter:(key:'city'|'categoryId'|'status'|'kind',value:string)=>void;
  onRetry:()=>void;
}){
  const [open,setOpen]=useState(false);
  const [series,setSeries]=useState<Series>('total');
  const [mode,setMode]=useState<ChartMode>('line');
  const [view,setView]=useState<'chart'|'table'>('chart');
  const chartRef=useRef<HTMLDivElement>(null);
  const points=useMemo(()=>data?.series.map(m=>({label:month(m.month),value:m[series]}))??[],[data,series]);
  const activeFilters=[filters.kind,filters.status,filters.city,filters.categoryId].filter(Boolean).length;
  const show=()=>{setOpen(false);window.requestAnimationFrame(()=>chartRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));};
  return <section className="ac-analytics" aria-labelledby="ac-analytics-title">
    <header className="ac-panel-head ac-analytics-heading"><div><span className="ac-eyebrow">INTELIGENCIA DE CONTENIDO</span><h2 id="ac-analytics-title">Evolución del catálogo</h2>
      <p>Compara productos y servicios por período, ciudad, categoría y estado de publicación.</p></div>
      <button type="button" className="ac-secondary" disabled={!points.length} onClick={()=>exportCSV(points,series==='products'?'Productos':series==='services'?'Servicios':'Contenido total')}><Icon name="download" size={17}/> Exportar CSV</button>
    </header>
    <div className="ac-filter-entry"><div><strong>Filtros de evolución</strong><span>{activeFilters?activeFilters+' filtro(s) del directorio aplicado(s)':'Vista general del catálogo'} · {period==='all'?'Todo el histórico':period==='60m'?'5 años':period==='24m'?'24 meses':period==='6m'?'6 meses':'12 meses'}</span></div>
      <button type="button" className="ac-secondary" aria-expanded={open} aria-controls="ac-analytics-filters" onClick={()=>setOpen(v=>!v)}><Icon name="settings" size={17}/>{open?'Ocultar filtros':'Mostrar filtros'} <Icon name="chevron" size={16}/></button>
    </div>
    <div className="ac-analytics-filters" id="ac-analytics-filters" hidden={!open}>
      <label>Ciudad <select value={filters.city??''} onChange={e=>onFilter('city',e.target.value)}><option value="">Todas las ciudades</option>{data?.filters.cities.map(v=><option key={v.value} value={v.value}>{v.label}</option>)}</select></label>
      <label>Categoría <select value={filters.categoryId??''} onChange={e=>onFilter('categoryId',e.target.value)}><option value="">Todas las categorías</option>{data?.filters.categories.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      <label>Tipo <select value={filters.kind??''} onChange={e=>onFilter('kind',e.target.value)}><option value="">Productos y servicios</option><option value="PRODUCT">Productos</option><option value="SERVICE">Servicios</option></select></label>
      <label>Publicación <select value={filters.status??''} onChange={e=>onFilter('status',e.target.value)}><option value="">Todos los vigentes</option><option value="PUBLISHED">Publicados</option><option value="REVIEW">En revisión</option><option value="UNPUBLISHED">No publicados</option><option value="DELETED">Eliminados</option></select></label>
      <label>Temporalidad <select value={period} onChange={e=>onPeriod(e.target.value)}><option value="6m">6 meses</option><option value="12m">12 meses</option><option value="24m">24 meses</option><option value="60m">5 años</option><option value="all">Todo el histórico</option></select></label>
      <button type="button" className="ac-primary" onClick={show}><Icon name="chart" size={17}/> Ver gráfica</button>
    </div>
    {loading?<div className="ac-analytics-state" role="status">Consultando las estadísticas del catálogo…</div>:
      error?<div className="ac-analytics-state" role="alert"><strong>No fue posible consultar la evolución.</strong><p>{error}</p><button type="button" className="ac-secondary" onClick={onRetry}>Reintentar</button></div>:
      data&&<>
        <div className="ac-chart-card" ref={chartRef}>
          <div className="ac-chart-head"><div><h3>Comportamiento histórico</h3><p>Registros creados por mes · datos reales de MySQL</p></div>
            <div className="ac-chart-controls">
              <div className="ac-segmented" role="group" aria-label="Indicador"><button className={series==='total'?'selected':''} aria-pressed={series==='total'} onClick={()=>setSeries('total')} type="button">Total</button><button className={series==='products'?'selected':''} aria-pressed={series==='products'} onClick={()=>setSeries('products')} type="button">Productos</button><button className={series==='services'?'selected':''} aria-pressed={series==='services'} onClick={()=>setSeries('services')} type="button">Servicios</button></div>
              <div className="ac-segmented" role="group" aria-label="Presentación"><button className={mode==='line'?'selected':''} aria-pressed={mode==='line'} onClick={()=>setMode('line')} type="button">Línea</button><button className={mode==='bars'?'selected':''} aria-pressed={mode==='bars'} onClick={()=>setMode('bars')} type="button">Barras</button></div>
              <div className="ac-segmented" role="group" aria-label="Ver datos"><button type="button" className={view==='chart'?'selected':''} aria-pressed={view==='chart'} onClick={()=>setView('chart')}>Gráfica</button><button type="button" className={view==='table'?'selected':''} aria-pressed={view==='table'} onClick={()=>setView('table')}>Tabla</button></div>
            </div>
          </div>
          {view==='chart'?<Timeline points={points} mode={mode}/>:<div className="ac-chart-table-wrap"><table><thead><tr><th>Mes</th><th>Productos</th><th>Servicios</th><th>Total</th></tr></thead><tbody>{data.series.map(p=><tr key={p.month}><td>{month(p.month)}</td><td>{num(p.products)}</td><td>{num(p.services)}</td><td>{num(p.total)}</td></tr>)}</tbody></table></div>}
        </div>
        <div className="ac-chart-bottom"><div className="ac-status-card"><h3>Estado del catálogo</h3><div className="ac-status-bars">{[
          {label:'Publicados',value:data.totals.published,color:'blue'},
          {label:'En revisión',value:data.totals.inReview,color:'amber'},
          {label:'No publicados',value:data.totals.unpublished,color:'violet'},
          {label:'Eliminados',value:data.totals.deleted,color:'gray'},
        ].map(v=><div key={v.label}><div><span>{v.label}</span><strong>{num(v.value)}</strong></div><i><b className={v.color} style={{width:(v.value/Math.max(1,data.totals.total)*100)+'%'}}/></i></div>)}</div></div>
        <div className="ac-status-card"><h3>Categorías con más contenido</h3>{data.ranking.length?<div className="ac-ranking">{data.ranking.map(v=><div key={v.name}><div><span title={v.name}>{v.name}</span><strong>{num(v.count)}</strong></div><i><b style={{width:(v.count/Math.max(1,data.ranking[0].count)*100)+'%'}}/></i></div>)}</div>:<p className="ac-muted">No hay registros para estos filtros.</p>}</div></div>
        <p className="ac-analytics-note"><Icon name="shield" size={16}/>{data.definition}</p>
      </>}
  </section>;
}
