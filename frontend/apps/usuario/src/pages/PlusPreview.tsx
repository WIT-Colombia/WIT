import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PlusIcon, type PlusIconName } from '../components/PlusIcon';
import { PageLayout } from '../components/PageLayout';
import { useAuth } from '../context/AuthContext';
import { readPlusComparison, readPlusComparisonLabels, savePlusComparison } from '../services/plusComparisonSelection';
import { parsePlusTarget, searchHref, type PlusRouteFavorite } from '../services/userPlusService';
import { estimatePlusRoute, optimizePlusRoute } from '../utils/plusRoutePlanner';

type Watch = { id: string; name: string; business: string; price: string | null; original: string | null; target: string | null };
type Collection = { id: number; title: string; items: Array<{ id: string; description: string }> };
type SavedSearch = { id: number; title: string; query: string; category: string };
type Comparison = { id: string; name: string; business: string; price: string | null };
const sampleOffers: Comparison[] = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Producto de muestra A', business: 'Negocio de ejemplo A', price: '32.900' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Producto de muestra B', business: 'Negocio de ejemplo B', price: '29.900' },
];
const sampleCollectionCandidates = {
  BUSINESS: [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', description: 'Cafetería favorita de ejemplo · Negocio' },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', description: 'Tienda favorita de ejemplo · Negocio' },
  ],
  OFFER: [
    { id: sampleOffers[0].id, description: sampleOffers[0].name + ' · Producto con Me gusta' },
    { id: sampleOffers[1].id, description: sampleOffers[1].name + ' · Servicio con Me gusta' },
  ],
};
const sampleStops: Array<PlusRouteFavorite & { address: string }> = [
  { id: 'a', name: 'Negocio favorito de ejemplo A', address: 'Punto de muestra 1',
    lat: 3.52, lng: -76.29, timezone: 'America/Bogota',
    hours: Array.from({length: 7}, (_, dayOfWeek) =>
      ({ dayOfWeek, isClosed: false, opensAt: '08:00', closesAt: '18:00' })) },
  { id: 'b', name: 'Negocio favorito de ejemplo B', address: 'Punto de muestra 2',
    lat: 3.56, lng: -76.34, timezone: 'America/Bogota',
    hours: Array.from({length: 7}, (_, dayOfWeek) =>
      ({ dayOfWeek, isClosed: true, opensAt: null, closesAt: null })) },
  { id: 'c', name: 'Negocio favorito de ejemplo C', address: 'Punto de muestra 3',
    lat: 3.54, lng: -76.32, timezone: 'America/Bogota', hours: [] },
];
const sections: Array<{ id: string; label: string; icon: PlusIconName }> = [
  { id: 'radar', label: 'Novedades', icon: 'radar' },
  { id: 'prices', label: 'Precios', icon: 'price' },
  { id: 'compare', label: 'Comparador', icon: 'compare' },
  { id: 'collections', label: 'Colecciones', icon: 'collection' },
  { id: 'searches', label: 'Búsquedas', icon: 'collection' },
  { id: 'routes', label: 'Rutas', icon: 'route' },
  { id: 'adfree', label: 'Sin anuncios', icon: 'ad-free' },
];

export default function PlusPreview() {
  const { user } = useAuth();
  const [queryParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const requestedWatch = queryParams.get('watch');
  const parsedWatch = requestedWatch ? parsePlusTarget(requestedWatch) : null;
  const initialWatchId = parsedWatch?.targetType === 'OFFER' ? parsedWatch.targetId : null;
  // A deep link must select its tool without forcing a seven-section scroll.
  // A product coming from "Seguir precio" opens directly in Precios.
  const requestedSection = location.hash.slice(1);
  const activeSection = sections.some(item => item.id === requestedSection)
    ? requestedSection : initialWatchId ? 'prices' : 'radar';
  const activeIndex = sections.findIndex(item => item.id === activeSection);
  const explicitNavigation = useRef(false);
  const chooseSection = (id: string) => {
    if (!sections.some(item => item.id === id)) return;
    explicitNavigation.current = true;
    navigate({ pathname: location.pathname, search: location.search, hash: '#' + id },
      { preventScrollReset: true });
  };
  useEffect(() => {
    if (!location.hash && !initialWatchId && !explicitNavigation.current) return;
    const frame = window.requestAnimationFrame(() => {
      const panel = document.getElementById(activeSection);
      panel?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
      if (explicitNavigation.current) panel?.focus({ preventScroll: true });
      explicitNavigation.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSection, location.hash, initialWatchId]);
  const [radarEnabled, setRadarEnabled] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<'IMMEDIATE' | 'DAILY'>('IMMEDIATE');
  const [digestZone, setDigestZone] = useState('America/Panama');
  const [digestHour, setDigestHour] = useState(8);
  const [targetEditor, setTargetEditor] = useState<string | null>(null);
  const [targetDraft, setTargetDraft] = useState('');
  const [watches, setWatches] = useState<Watch[]>(() => {
    const initial: Watch[] = [{ id: sampleOffers[0].id, name: sampleOffers[0].name, business: sampleOffers[0].business, price: sampleOffers[0].price, original: '39.900', target: null }];
    if (initialWatchId && !initial.some(item => item.id === initialWatchId)) {
      initial.push({ id: initialWatchId, name: 'Producto seleccionado para la prueba', business: 'Sin datos reales', price: null, original: null, target: null });
    }
    return initial;
  });
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>(() => readPlusComparison(user?.id ?? '', true));
  const [compared, setCompared] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([
    { id: 1, title: 'Mis favoritos de ejemplo', items: [{ id: sampleOffers[0].id, description: 'Producto de ejemplo A' }] },
  ]);
  const [collectionName, setCollectionName] = useState('');
  const [collectionPicker, setCollectionPicker] = useState<number | null>(null);
  const [collectionSource, setCollectionSource] = useState<'BUSINESS' | 'OFFER'>('BUSINESS');
  const [searches, setSearches] = useState<SavedSearch[]>([
    { id: 1, title: 'Desayunos de ejemplo', query: 'desayunos', category: 'Restaurantes' },
  ]);
  const [searchTitle, setSearchTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [selectedStops, setSelectedStops] = useState<string[]>(['a', 'b']);
  const [travelMode, setTravelMode] = useState<'driving' | 'walking'>('driving');
  const [showRoute, setShowRoute] = useState(false);
  const [routeOptimized, setRouteOptimized] = useState(false);
  const [visitAt, setVisitAt] = useState(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16));
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const updateNotice = (message: string) => { setNotice(message); setError(''); };
  const resolve = (id: string): Comparison =>
    sampleOffers.find(item => item.id === id) ?? { id, name: 'Publicación agregada para probar la interfaz', business: 'Sin datos del servidor', price: null };
  const updateCompareSelection = (ids: string[]) => {
    setCompareIds(savePlusComparison(user?.id ?? '', ids, true));
    setCompared(false);
    setNotice('');
    setError('');
  };
  const addCollection = (event: FormEvent) => {
    event.preventDefault();
    const title = collectionName.trim();
    if (!title || collections.length >= 50) return;
    setCollections(items => [...items, { id: Date.now(), title, items: [] }]);
    setCollectionName(''); updateNotice('Colección de ejemplo creada. No se guardará en tu cuenta.');
  };
  const addCollectionItem = (id: number, item: { id: string; description: string }) => {
    setCollections(items => items.map(col => col.id !== id || col.items.some(x => x.id === item.id)
      ? col : { ...col, items: [...col.items, item] }));
    updateNotice('Elemento de ejemplo seleccionado. No se guardará en tu cuenta.');
  };
  const addSearch = (event: FormEvent) => {
    event.preventDefault();
    if (!searchTitle.trim() || !searchQuery.trim() || searches.length >= 50) return;
    setSearches(items => [...items, { id: Date.now(), title: searchTitle.trim(), query: searchQuery.trim(), category: searchCategory.trim() }]);
    setSearchTitle(''); setSearchQuery(''); setSearchCategory('');
    updateNotice('Búsqueda agregada a la vista previa, sin guardar datos.');
  };
  const selectedDemoStops = selectedStops.flatMap(id => {
    const found = sampleStops.find(stop => stop.id === id);
    return found ? [found] : [];
  });
  const orderedDemoStops = routeOptimized ? optimizePlusRoute(selectedDemoStops) : selectedDemoStops;
  const demoEstimates = estimatePlusRoute(orderedDemoStops, travelMode, new Date(visitAt));
  const compareLabels = readPlusComparisonLabels(user?.id ?? '', true);
  const stats = [
    { label: 'Novedades de ejemplo', value: 2, href: '#radar', icon: 'radar' as const },
    { label: 'Precios de ejemplo', value: watches.length, href: '#prices', icon: 'price' as const },
    { label: 'Colecciones de ejemplo', value: collections.length, href: '#collections', icon: 'collection' as const },
    { label: 'Búsquedas de ejemplo', value: searches.length, href: '#searches', icon: 'compare' as const },
  ];
  return <PageLayout className="plus-page plus-preview-page">
    <Link to="/plus" className="plus-back">← Salir de la vista previa</Link>
    <header className="plus-hero">
      <span className="plus-kicker">DEMOSTRACIÓN VISUAL · XAMUKO PLUS</span>
      <h1><span className="plus-hero-crown"><PlusIcon name="crown" size={32}/></span> Xamuko Plus</h1>
      <p>Recorre las herramientas Plus con datos de demostración, sin modificar tu cuenta.</p>
      <div className="plus-hero-state" role="status">Vista previa autorizada · No es una membresía activa</div>
    </header>
    <div className="plus-preview-warning" role="note">
      <strong>Prueba visual con datos de ejemplo</strong>
      <p>Los precios, negocios y novedades de esta página son ficticios. Puedes usar los controles para revisar la experiencia, pero los cambios no se guardan, no se envían al servidor y no generan notificaciones ni pagos.</p>
      <Link to="/plus">Volver a mi cuenta real</Link>
    </div>
    {error && <p className="plus-error" role="alert">{error}</p>}
    {notice && <p className="plus-success" role="status">{notice}</p>}
    <div className="plus-overview" aria-label="Indicadores de demostración">
      {stats.map(item => <a className="plus-overview-card" key={item.href} href={item.href}
        onClick={event => { event.preventDefault(); chooseSection(item.href.slice(1)); }}>
        <span className="plus-overview-icon"><PlusIcon name={item.icon} size={22}/></span><strong>{item.value}</strong><span>{item.label}</span><span className="plus-overview-arrow" aria-hidden="true">↗</span>
      </a>)}
    </div>
    <div className="plus-tool-workspace" id="plus-tools-workspace">
      <aside className="plus-tool-sidebar">
        <span className="plus-tool-eyebrow">TU RECORRIDO PLUS</span>
        <h2>Elige qué quieres probar</h2>
        <p>Siete herramientas. Una a la vez, sin perder tu lugar.</p>
        <nav className="plus-tool-menu" aria-label="Navegación de herramientas Plus de prueba">
          {sections.map((item, index) => <a href={'#' + item.id} key={item.id}
            aria-current={activeSection === item.id ? 'location' : undefined}
            onClick={event => { event.preventDefault(); chooseSection(item.id); }}>
            <span className="plus-tool-menu-number">{String(index + 1).padStart(2, '0')}</span>
            <PlusIcon name={item.icon} size={19}/><span>{item.label}</span>
            {activeSection === item.id && <span className="plus-tool-current" aria-hidden="true"><PlusIcon name="check" size={15}/></span>}
          </a>)}
        </nav>
      </aside>
      <div className="plus-tool-content">
        <div className="plus-tool-picker">
          <label htmlFor="plus-tool-select">¿Qué herramienta quieres probar?</label>
          <select id="plus-tool-select" aria-label="Elegir herramienta de demostración" value={activeSection}
            onChange={event => chooseSection(event.target.value)}>
            {sections.map((item, index) => <option key={item.id} value={item.id}>
              {String(index + 1).padStart(2, '0')} · {item.label}
            </option>)}
          </select>
        </div>
        <div className="plus-tool-position" aria-live="polite">
          <span>HERRAMIENTA {String(activeIndex + 1).padStart(2, '0')} DE {String(sections.length).padStart(2, '0')}</span>
          <strong>{sections[activeIndex].label}</strong>
        </div>
        <div className="plus-tool-stage">
    <section className="plus-panel" id="radar" tabIndex={-1} hidden={activeSection !== 'radar'}>
      <div className="plus-heading"><div><span>01 · DESCUBRIMIENTO · EJEMPLO</span><h2>Tu radar de novedades</h2><p>Así aparecen las novedades de los negocios favoritos y se configuran los avisos.</p></div>
        <label className="plus-toggle"><input type="checkbox" checked={radarEnabled} onChange={e => { setRadarEnabled(e.target.checked); updateNotice('Preferencia de prueba actualizada localmente.'); }}/>Recibir avisos</label></div>
      <div className="plus-delivery-controls">
        <label>Entrega de avisos de ejemplo
          <select aria-label="Entrega de avisos de ejemplo" value={deliveryMode} onChange={e=>{
            setDeliveryMode(e.target.value as 'IMMEDIATE'|'DAILY'); updateNotice('Modalidad cambiada solo en esta demostración.');
          }}><option value="IMMEDIATE">Avisos inmediatos</option><option value="DAILY">Un resumen diario</option></select>
        </label>
        {deliveryMode === 'DAILY' && <div className="plus-digest-schedule">
          <label>Zona horaria<input value={digestZone} onChange={e=>setDigestZone(e.target.value)}
            aria-label="Zona horaria de ejemplo"/></label>
          <label>Hora de entrega<select aria-label="Hora de entrega de ejemplo" value={digestHour}
            onChange={e=>setDigestHour(Number(e.target.value))}>
            {Array.from({length:24},(_,hour)=><option key={hour} value={hour}>{String(hour).padStart(2,'0')}:00</option>)}
          </select></label>
          <p>Esta modalidad no enviará notificaciones reales.</p>
        </div>}
      </div>
      <div className="plus-list">{[{ name: 'Nuevo servicio de muestra', business: 'Negocio favorito de ejemplo A' },{ name: 'Promoción de demostración', business: 'Negocio favorito de ejemplo B' }].map((item,i) =>
        <div className="plus-list-row" key={item.name}><span className="plus-row-symbol"><PlusIcon name="radar" size={19}/></span><span><strong>{item.name}</strong><small>{item.business} · Ejemplo {i + 1}</small></span><span className="plus-preview-chip">Demo</span></div>)}</div>
      <p className="plus-footnote">En la versión real, estas novedades se obtienen de publicaciones recientes de tus favoritos.</p>
    </section>
    <section className="plus-panel" id="prices" tabIndex={-1} hidden={activeSection !== 'prices'}>
      <div className="plus-heading"><div><span>02 · AHORRO · EJEMPLO</span><h2>Seguimiento de precios</h2><p>Prueba el seguimiento de precios, fija un objetivo y consulta un historial de ejemplo.</p></div>
        <label className="plus-toggle"><input type="checkbox" checked={priceAlerts} onChange={e => { setPriceAlerts(e.target.checked); updateNotice('Alerta simulada; no se enviarán notificaciones.'); }}/>Avisar cuando bajen</label></div>
      <div className="plus-follow-guide">
        <span className="plus-follow-guide-icon" aria-hidden="true"><PlusIcon name="price" size={25}/></span>
        <div><strong>Un botón en cada ficha de producto</strong><p>Abre un producto o servicio con precio numérico publicado y pulsa <b>Seguir precio</b>. Volverás a esta demostración sin activar pagos ni guardar datos.</p></div>
        <Link className="plus-button plus-button-secondary" to="/results">Explorar productos</Link>
      </div>
      {initialWatchId && <p className="plus-preview-chip" role="status">Has seguido un producto de ejemplo desde su ficha. No se registró ningún seguimiento real.</p>}
      <div className="plus-list">{watches.map(watch => <div className="plus-list-row" key={watch.id}>
        <span className="plus-row-symbol"><PlusIcon name="price" size={19}/></span><span><strong>{watch.name}</strong><small>{watch.business} · {watch.price ? '$' + watch.price + ' COP · ejemplo' : 'Sin precio real, vista previa'}</small></span>
        <div className="plus-row-buttons">
          <button type="button" onClick={()=>setHistoryId(historyId === watch.id ? null : watch.id)}>Historial</button>
          {watch.price && <button type="button" onClick={()=>{
            setTargetEditor(targetEditor === watch.id ? null : watch.id); setTargetDraft(watch.target ?? '');
          }}>{watch.target ? 'Cambiar objetivo' : 'Fijar objetivo'}</button>}
          <button type="button" onClick={()=>{setWatches(items=>items.filter(x=>x.id!==watch.id));setHistoryId(null);}}>Quitar</button>
        </div>
        {watch.target && <p className="plus-target-summary">Objetivo de demostración: {watch.target} COP</p>}
        {targetEditor === watch.id && <form className="plus-target-editor" onSubmit={e=>{
          e.preventDefault();
          const value = Number(targetDraft);
          if (!Number.isFinite(value) || value <= 0 || value >= Number(watch.price?.replace(/\./g,''))) {
            updateNotice('El objetivo debe ser positivo e inferior al precio de muestra.'); return;
          }
          setWatches(rows=>rows.map(row=>row.id === watch.id ? {...row,target:targetDraft}:row));
          setTargetEditor(null); updateNotice('Precio objetivo registrado solo en esta demostración.');
        }}>
          <label>Precio objetivo de ejemplo<input aria-label={`Precio objetivo demo de ${watch.name}`}
            type="number" min="0.01" step="0.01" value={targetDraft}
            onChange={e=>setTargetDraft(e.target.value)} required/></label>
          <button type="submit" className="plus-button">Guardar objetivo</button>
          {watch.target && <button type="button" className="plus-button plus-button-secondary" onClick={()=>{
            setWatches(rows=>rows.map(row=>row.id===watch.id?{...row,target:null}:row));
            setTargetEditor(null);updateNotice('Objetivo de ejemplo eliminado.');
          }}>Quitar objetivo</button>}
        </form>}
      </div>)}</div>
      {historyId && <div className="plus-history"><h3>Historial de demostración</h3>{watches.find(x=>x.id===historyId)?.original
        ? <p>Precio anterior: $39.900 COP → Precio de ejemplo: $32.900 COP. Valores ficticios.</p>
        : <p>Esta publicación no tiene historial de ejemplo. El backend real todavía no se consulta.</p>}
        <button type="button" onClick={()=>setHistoryId(null)}>Cerrar historial</button></div>}
    </section>
    <section className="plus-panel" id="compare" tabIndex={-1} hidden={activeSection !== 'compare'}>
      <div className="plus-heading"><div><span>03 · COMPARACIÓN · EJEMPLO</span><h2>Compara tus opciones</h2><p>Selecciona de dos a cuatro publicaciones para explorar el comparador.</p></div></div>
      <div className="plus-follow-guide"><span className="plus-follow-guide-icon"><PlusIcon name="compare" size={25}/></span>
        <div><strong>Compara sin pegar enlaces</strong><p>Abre la ficha de un producto o servicio y pulsa <b>Comparar precio</b>. La selección de demostración aparecerá aquí.</p></div>
        <Link className="plus-button plus-button-secondary" to="/results">Elegir publicaciones</Link>
      </div>
      <p className="plus-selection-caption">{compareIds.length} de 4 opciones seleccionadas</p>
      <div className="plus-chips">{compareIds.map((id,i)=><button key={id} type="button" aria-label={`Quitar ${compareLabels[id] ?? `opción ${i+1}`}`} onClick={()=>updateCompareSelection(compareIds.filter(x=>x!==id))}>{compareLabels[id] ?? resolve(id).name} ×</button>)}</div>
      {compareIds.length < 2 && <button type="button" className="plus-button plus-button-secondary"
        onClick={()=>updateCompareSelection(sampleOffers.map(item => item.id))}>Probar con dos opciones de ejemplo</button>}
      {compareIds.length > 0 && <button type="button" className="plus-button plus-clear-selection" onClick={()=>updateCompareSelection([])}>Eliminar selección</button>}
      <button type="button" className="plus-button plus-button-secondary" disabled={compareIds.length<2} onClick={()=>setCompared(true)}>Comparar {compareIds.length} opciones</button>
      {compared && <div className="plus-compare-grid">{compareIds.map(id=>{const item=resolve(id);return <article key={id}><span>Publicación de ejemplo</span><h3>{item.name}</h3><p>{item.business}</p><strong>{item.price ? '$'+item.price+' COP · ejemplo' : 'Precio no consultado'}</strong><p>La ubicación, calificación y distancia se consultarán desde el backend real.</p></article>;})}</div>}
    </section>
    <section className="plus-panel" id="collections" tabIndex={-1} hidden={activeSection !== 'collections'}>
      <div className="plus-heading"><div><span>04 · ORGANIZACIÓN · EJEMPLO</span><h2>Tus colecciones</h2><p>Agrega únicamente negocios favoritos y publicaciones con «Me gusta». Todo es un ejemplo local.</p></div></div>
      <form className="plus-form" onSubmit={addCollection}><label>Nombre de la colección<input value={collectionName} maxLength={80} onChange={e=>setCollectionName(e.target.value)} placeholder="Ej. Mis cafeterías favoritas" required/></label><button type="submit" className="plus-button" disabled={collections.length>=50}>Crear colección</button></form>
      <div className="plus-list">{collections.map(col=><article className="plus-collection" key={col.id}>
        <div className="plus-collection-head"><strong>{col.title}</strong><div className="plus-collection-actions">
          <button type="button" className="plus-button plus-collection-add" aria-expanded={collectionPicker === col.id}
            onClick={()=>{setCollectionPicker(collectionPicker===col.id?null:col.id);setCollectionSource('BUSINESS');}}>
            {collectionPicker === col.id ? 'Cerrar' : 'Agregar'}</button>
          <button type="button" onClick={()=>setCollections(items=>items.filter(x=>x.id!==col.id))}>Eliminar</button>
        </div></div>
        {collectionPicker === col.id && <div className="plus-collection-picker">
          <p>Selecciona solamente entre los favoritos y «Me gusta» de demostración.</p>
          <div className="plus-picker-types" role="group" aria-label="Origen de los elementos">
            <button type="button" className={collectionSource==='BUSINESS'?'selected':''} aria-pressed={collectionSource==='BUSINESS'} onClick={()=>setCollectionSource('BUSINESS')}>Negocios favoritos</button>
            <button type="button" className={collectionSource==='OFFER'?'selected':''} aria-pressed={collectionSource==='OFFER'} onClick={()=>setCollectionSource('OFFER')}>Productos y servicios con Me gusta</button>
          </div>
          <div className="plus-picker-list">{sampleCollectionCandidates[collectionSource].map(item => {
            const exists=col.items.some(saved=>saved.id===item.id);
            return <div className="plus-picker-item" key={item.id}>
              <span><strong>{item.description.split(' · ')[0]}</strong><small>{item.description.split(' · ')[1]}</small></span>
              <button type="button" disabled={exists} onClick={()=>addCollectionItem(col.id,item)}>{exists?'Ya agregado':'Seleccionar'}</button>
            </div>;
          })}</div>
        </div>}
        <div className="plus-collection-items">{col.items.length===0 && <p className="plus-footnote">Todavía no hay elementos en esta lista.</p>}
          {col.items.map(item=><div key={item.id}><span>{item.description}</span><button type="button" onClick={()=>setCollections(items=>items.map(c=>c.id===col.id?{...c,items:c.items.filter(x=>x.id!==item.id)}:c))}>Quitar</button></div>)}</div>
      </article>)}</div>
    </section>
    <section className="plus-panel" id="searches" tabIndex={-1} hidden={activeSection !== 'searches'}>
      <div className="plus-heading"><div><span>04 · ORGANIZACIÓN · EJEMPLO</span><h2>Búsquedas guardadas</h2><p>Guarda criterios de búsqueda. La lista de prueba se borra al salir.</p></div></div>
      <form className="plus-form" onSubmit={addSearch}><label>Nombre<input value={searchTitle} onChange={e=>setSearchTitle(e.target.value)} placeholder="Ej. Panaderías cerca" required maxLength={80}/></label><label>Buscar<input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Qué quieres encontrar" required maxLength={160}/></label><label>Categoría (opcional)<input value={searchCategory} onChange={e=>setSearchCategory(e.target.value)} maxLength={120}/></label><button type="submit" className="plus-button" disabled={searches.length>=50}>Guardar búsqueda</button></form>
      <div className="plus-list">{searches.map(item=><div className="plus-list-row" key={item.id}><span className="plus-row-symbol"><PlusIcon name="collection" size={19}/></span><span><strong>{item.title}</strong><small>{item.query}{item.category?' · '+item.category:''} · ejemplo</small></span><div className="plus-row-buttons"><Link to={searchHref({id:String(item.id),title:item.title,query:item.query,category:item.category||null,city:null,openNow:false,minRating:null,sort:'recommended'})}>Buscar</Link><button type="button" onClick={()=>setSearches(items=>items.filter(x=>x.id!==item.id))}>Quitar</button></div></div>)}</div>
      <p className="plus-footnote">«Buscar» abre los resultados públicos de Xamuko, no una búsqueda Plus almacenada en el backend.</p>
    </section>
    <section className="plus-panel" id="routes" tabIndex={-1} hidden={activeSection !== 'routes'}>
      <div className="plus-heading"><div><span>05 · EXPLORACIÓN · EJEMPLO</span><h2>Rutas con varios negocios</h2><p>Elige de dos a cuatro paradas, optimiza el recorrido y revisa horarios de ejemplo.</p></div></div>
      <div className="plus-routes-list">{sampleStops.map(stop=><label key={stop.id}><input type="checkbox" checked={selectedStops.includes(stop.id)} disabled={!selectedStops.includes(stop.id)&&selectedStops.length>=4} onChange={()=>{setSelectedStops(ids=>ids.includes(stop.id)?ids.filter(x=>x!==stop.id):[...ids,stop.id]);setShowRoute(false);}}/><span>{stop.name} · {stop.address}</span></label>)}</div>
      <div className="plus-route-actions">
        <label>Transporte <select value={travelMode} onChange={e=>setTravelMode(e.target.value as 'driving'|'walking')}><option value="driving">En vehículo</option><option value="walking">A pie</option></select></label>
        <label>Salida prevista<input type="datetime-local" aria-label="Salida demo" value={visitAt} onChange={e=>setVisitAt(e.target.value)}/></label>
        <button type="button" className="plus-button plus-button-secondary" disabled={selectedStops.length<2}
          onClick={()=>{setRouteOptimized(value=>!value);setShowRoute(true);}}>
          {routeOptimized ? 'Usar orden original' : 'Optimizar recorrido'}
        </button>
        <button type="button" className="plus-button" disabled={selectedStops.length<2} onClick={()=>setShowRoute(true)}>Ver recorrido de ejemplo</button>
      </div>
      {showRoute && <div className="plus-preview-trip">
        <strong>Recorrido simulado {routeOptimized ? 'optimizado por cercanía' : 'en orden de selección'} · {travelMode==='driving'?'En vehículo':'A pie'}</strong>
        <ol>{demoEstimates.map(estimate=><li key={estimate.stop.id}>{estimate.stop.name}
          <small> · Llegada aproximada: {new Intl.DateTimeFormat('es-CO',{dateStyle:'short',timeStyle:'short'}).format(estimate.arrivalAt)}
            {' · '}{estimate.hoursStatus==='CLOSED'?'Cerrado según horario de ejemplo':
              estimate.hoursStatus==='OPEN'?'Abierto según horario de ejemplo':'Horario no disponible'}
          </small></li>)}</ol>
      </div>}
      <p className="plus-footnote">Los negocios y horarios de esta demostración son ficticios. No hay tráfico ni consultas a mapas; Plus real estima el orden por cercanía y abre después el recorrido en Google Maps.</p>
    </section>
    <section className="plus-panel plus-adfree" id="adfree" tabIndex={-1} hidden={activeSection !== 'adfree'}><span aria-hidden="true"><PlusIcon name="ad-free" size={35}/></span><div><h2>06 · Experiencia sin anuncios</h2><p>La membresía real oculta anuncios identificados como publicidad de terceros. Aquí solo se muestra cómo se presenta el beneficio; no cambia el resto de la plataforma.</p><small>Simulación visual · Sin activación de la política global de anuncios</small></div></section>
        </div>
        <nav className="plus-tool-pager" aria-label="Avanzar entre herramientas Plus">
          <button type="button" className="plus-tool-previous" disabled={activeIndex === 0}
            onClick={() => chooseSection(sections[activeIndex - 1].id)}>
            ‹ Anterior
          </button>
          <span>{activeIndex + 1} de {sections.length}</span>
          <button type="button" className="plus-tool-next" disabled={activeIndex === sections.length - 1}
            onClick={() => chooseSection(sections[activeIndex + 1].id)}>
            {activeIndex < sections.length - 1 ? 'Siguiente: ' + sections[activeIndex + 1].label : 'Recorrido completado'} <PlusIcon name="arrow-right" size={17}/>
          </button>
        </nav>
      </div>
    </div>
    {activeSection === 'adfree' && <div className="plus-preview-exit"><p>Fin del recorrido de demostración. Los cambios que hiciste aquí no se guardarán.</p><Link to="/plus" className="plus-button plus-button-secondary">Salir de la vista previa</Link></div>}
  </PageLayout>;
}
