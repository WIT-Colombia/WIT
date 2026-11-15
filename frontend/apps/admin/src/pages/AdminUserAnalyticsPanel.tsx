import { useEffect, useMemo, useRef, useState, type PointerEvent as ChartPointerEvent } from 'react';
import { Icon } from '../components/Icon';
import type { AdminUserOverview } from '../services/adminApiClient';
import './AdminUsersRefresh.css';

const number = (value: number) => new Intl.NumberFormat('es-CO').format(value);
const monthName = (month: string) => new Date(month + '-01T12:00:00Z').toLocaleDateString('es-CO', { month: 'short', year: '2-digit', timeZone: 'UTC' });

type Point = { label: string; value: number };
function RegistrationChart({ points, mode }: { points: Point[]; mode: 'area' | 'bars' }) {
  const canvas = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const observer = new ResizeObserver(entries => {
      const next = Math.max(310, Math.round(entries[0]?.contentRect.width ?? 760));
      setWidth(old => old === next ? old : next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setActive(null); }, [points, mode]);
  const h = 280, left = 48, right = 31, top = 25, bottom = 43;
  const pw = width - left - right, ph = h - top - bottom;
  const max = Math.max(1, ...points.map(p => p.value));
  const power = Math.pow(10, Math.floor(Math.log10(max / 4)));
  const tick = Math.max(1, Math.ceil(max / 4 / power) * power);
  const ceiling = tick * 4, base = top + ph;
  const xx = (i: number) => left + (points.length === 1 ? pw / 2 : i / (points.length - 1) * pw);
  const yy = (value: number) => top + ph * (1 - value / ceiling);
  const coords = points.map((p, i) => xx(i) + ',' + yy(p.value)).join(' ');
  const fill = points.length > 1 ? 'M' + xx(0) + ' ' + base + ' L' + points.map((p, i) => xx(i) + ' ' + yy(p.value)).join(' L') + ' L' + xx(points.length - 1) + ' ' + base + 'Z' : '';
  const bw = Math.min(49, pw / Math.max(1, points.length) * .59);
  const selected = active !== null ? points[active] : null;
  const selectedX = active === null ? 0 : mode === 'bars' ? left + (active + .5) * pw / points.length : xx(active);
  const step = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(pw / 85))));
  const hover = (event: ChartPointerEvent<SVGSVGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const pt = event.currentTarget.createSVGPoint();
    pt.x = event.clientX; pt.y = event.clientY;
    const x = pt.matrixTransform(matrix.inverse()).x;
    const ratio = Math.max(0, Math.min(1, (x - left) / pw));
    setActive(mode === 'bars' ? Math.min(points.length - 1, Math.floor(ratio * points.length)) : Math.round(ratio * (points.length - 1)));
  };
  return <div ref={canvas} className="au-plot">
    <svg viewBox={'0 0 ' + width + ' ' + h} role="group" aria-label={'Altas de usuarios: ' + points.map(p => p.label + ' ' + number(p.value)).join(', ')}
      onPointerMove={hover} onPointerDown={hover} onPointerLeave={() => setActive(null)}>
      <defs>
        <linearGradient id="au-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#225cf1" stopOpacity=".23" /><stop offset="100%" stopColor="#225cf1" stopOpacity="0" /></linearGradient>
        <linearGradient id="au-bars" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#225cf1" /><stop offset="100%" stopColor="#743fff" /></linearGradient>
      </defs>
      {[0,1,2,3,4].map(i => <g key={i}><line className="au-plot-grid" x1={left} x2={width-right} y1={top + i*ph/4} y2={top + i*ph/4}/><text className="au-plot-axis" x={left-9} y={top+i*ph/4+4} textAnchor="end">{number(ceiling-i*tick)}</text></g>)}
      <rect x={left} y={top} width={pw} height={ph} fill="transparent" pointerEvents="all"/>
      {mode === 'area' ? <>
        {fill && <path d={fill} fill="url(#au-gradient)" pointerEvents="none"/>}
        <polyline points={coords} fill="none" className="au-plot-line" pointerEvents="none"/>
        {points.map((p,i)=><circle key={p.label} cx={xx(i)} cy={yy(p.value)} r={active===i?5.5:3.6}
          className="au-plot-point" tabIndex={0} aria-label={p.label+': '+number(p.value)}
          onFocus={()=>setActive(i)} onClick={()=>setActive(i)}/>)}
      </> : points.map((p,i)=><rect key={p.label} x={left+(i+.5)*pw/points.length-bw/2} y={yy(p.value)} width={bw} height={Math.max(1,base-yy(p.value))}
        rx="5" fill="url(#au-bars)" tabIndex={0} aria-label={p.label+': '+number(p.value)}
        onFocus={()=>setActive(i)} onClick={()=>setActive(i)}/>)}
      {selected && active !== null && <>
        <line className="au-plot-guide" x1={selectedX} x2={selectedX} y1={top} y2={base} pointerEvents="none"/>
        <circle cx={selectedX} cy={yy(selected.value)} r="6" fill="#fff" stroke="#225cf1" strokeWidth="2.5" pointerEvents="none"/>
        {(() => {const tx=Math.max(left,Math.min(width-right-83,selectedX-41));const ty=Math.max(3,yy(selected.value)-42);return <g pointerEvents="none"><rect x={tx} y={ty} width="83" height="31" rx="9" fill="#172b51"/><text x={tx+41.5} y={ty+21} textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">{number(selected.value)}</text></g>;})()}
      </>}
      {points.map((p,i)=>(i%step===0||i===points.length-1)&&<text key={p.label} className="au-plot-axis" x={mode==='bars'?left+(i+.5)*pw/points.length:xx(i)} y={h-16} textAnchor="middle">{p.label}</text>)}
    </svg>
    <p className="au-chart-hint">{selected ? <><strong>{number(selected.value)}</strong> altas · {selected.label}</> : 'Mueve el cursor o desliza el dedo: los meses sin altas aparecen con valor 0.'}</p>
  </div>;
}

function csvExport(series: Point[]) {
  const rows = ['Período;Altas de usuarios', ...series.map(p=>p.label+';'+p.value)].join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+rows], {type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='xamuko-usuarios-evolucion.csv';a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function AdminUserAnalyticsPanel({ data }: { data: AdminUserOverview }) {
  const [range,setRange]=useState<'6'|'12'>('12');
  const [mode,setMode]=useState<'area'|'bars'>('area');
  const points=useMemo(()=>data.series.slice(range==='6'?-6:-12).map(p=>({label:monthName(p.month),value:p.registrations})),[data,range]);
  const registered=points.reduce((n,p)=>n+p.value,0);
  const stateCounts=[{label:'Activos',value:data.active,className:'active'},{label:'Suspendidos',value:data.suspended,className:'suspended'},{label:'Eliminados',value:data.deleted,className:'deleted'}];
  const total=Math.max(1,data.total);
  return <section className="au-analytics" aria-labelledby="au-analytics-title">
    <header className="au-panel-heading"><div><span className="au-eyebrow">ANÁLISIS DE CRECIMIENTO</span><h2 id="au-analytics-title">Evolución de usuarios</h2><p>Altas reales y distribución actual de cuentas de la plataforma.</p></div>
      <button className="au-outline-button" onClick={()=>csvExport(points)} type="button"><Icon name="download" size={16}/> Exportar CSV</button></header>
    <div className="au-chart-grid">
      <div className="au-chart-card">
        <div className="au-chart-title"><div><h3>Registros por período</h3><p>{number(registered)} altas durante los últimos {range} meses</p></div>
          <div className="au-chart-controls"><select aria-label="Temporalidad" value={range} onChange={e=>setRange(e.target.value as '6'|'12')}><option value="6">6 meses</option><option value="12">12 meses</option></select>
            <div role="group" aria-label="Visualización" className="au-segmented"><button type="button" aria-pressed={mode==='area'} className={mode==='area'?'selected':''} onClick={()=>setMode('area')}>Línea</button><button type="button" aria-pressed={mode==='bars'} className={mode==='bars'?'selected':''} onClick={()=>setMode('bars')}>Barras</button></div></div>
        </div>
        <RegistrationChart points={points} mode={mode}/>
      </div>
      <div className="au-chart-card au-distribution">
        <div className="au-chart-title"><div><h3>Estado de las cuentas</h3><p>Distribución actual · {number(data.total)} cuentas</p></div></div>
        <div className="au-donut-wrap">
          <svg className="au-donut" viewBox="0 0 160 160" role="img" aria-label={stateCounts.map(x=>x.label+': '+number(x.value)).join(', ')}>
            <circle cx="80" cy="80" r="57" stroke="#edf1f9" strokeWidth="18" fill="none"/>
            {stateCounts.reduce<{elements: Array<import("react").ReactNode>;offset:number}>((state,item,i)=>{
              const fraction=item.value/total;const len=fraction*358.14;
              state.elements.push(<circle key={item.label} cx="80" cy="80" r="57" stroke={['#225cf1','#f2a338','#bdc8db'][i]}
                strokeWidth="18" fill="none" strokeDasharray={len+' '+(358.14-len)} strokeDashoffset={-state.offset}
                transform="rotate(-90 80 80)"/>);state.offset+=len;return state;
            },{elements:[],offset:0}).elements}
            <text x="80" y="79" textAnchor="middle" fontSize="27" fontWeight="850" fill="#142a50">{number(data.total)}</text>
            <text x="80" y="99" textAnchor="middle" fontSize="11" fill="#74849f">Cuentas</text>
          </svg>
        </div>
        <div className="au-distribution-legend">{stateCounts.map(item=><div key={item.label}><span className={'au-legend-dot '+item.className}/><span>{item.label}</span><strong>{number(item.value)}</strong><small>{Math.round(item.value/total*100)}%</small></div>)}</div>
      </div>
    </div>
    <div className="au-relationship-strip"><div><span className="au-icon"><Icon name="store" size={19}/></span><div><strong>{number(data.owners)}</strong><span>Usuarios propietarios</span></div></div><div><span className="au-icon"><Icon name="users" size={19}/></span><div><strong>{number(data.collaborators)}</strong><span>Usuarios colaboradores</span></div></div><div><span className="au-icon"><Icon name="shield" size={19}/></span><div><strong>{number(data.adminCount)}</strong><span>Con rol administrativo activo</span></div></div></div>
    <p className="au-analytics-note"><Icon name="shield" size={16}/>{data.definition}</p>
  </section>;
}
