import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusIcon, type PlusIconName } from '../components/PlusIcon';
import { PageLayout } from '../components/PageLayout';
import { useAuth } from '../context/AuthContext';
import { readPlusComparison, savePlusComparison } from '../services/plusComparisonSelection';
import { parsePlusTarget, searchHref } from '../services/userPlusService';

type Watch = { id: string; name: string; business: string; price: string | null; original: string | null };
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
const sampleStops = [
  { id: 'a', name: 'Negocio favorito de ejemplo A', address: 'Punto de muestra 1' },
  { id: 'b', name: 'Negocio favorito de ejemplo B', address: 'Punto de muestra 2' },
  { id: 'c', name: 'Negocio favorito de ejemplo C', address: 'Punto de muestra 3' },
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
  const requestedWatch = queryParams.get('watch');
  const parsedWatch = requestedWatch ? parsePlusTarget(requestedWatch) : null;
  const initialWatchId = parsedWatch?.targetType === 'OFFER' ? parsedWatch.targetId : null;
  const [radarEnabled, setRadarEnabled] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState(false);
  const [watches, setWatches] = useState<Watch[]>(() => {
    const initial: Watch[] = [{ id: sampleOffers[0].id, name: sampleOffers[0].name, business: sampleOffers[0].business, price: sampleOffers[0].price, original: '39.900' }];
    if (initialWatchId && !initial.some(item => item.id === initialWatchId)) {
      initial.push({ id: initialWatchId, name: 'Producto seleccionado para la prueba', business: 'Sin datos reales', price: null, original: null });
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
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const updateNotice = (message: string) => { setNotice(message); setError(''); };
  const showError = (message: string) => { setError(message); setNotice(''); };
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
      <p>Recorre las seis herramientas Plus antes de actualizar el backend.</p>
      <div className="plus-hero-state" role="status">Vista previa autorizada · No es una membresía activa</div>
    </header>
    <div className="plus-preview-warning" role="note">
      <strong>Prueba visual con datos de ejemplo</strong>
      <p>Los precios, negocios y novedades de esta página son ficticios. Puedes usar los controles para revisar la experiencia, pero los cambios no se guardan, no se envían al servidor y no generan notificaciones ni pagos.</p>
      <Link to="/plus">Volver a mi cuenta real</Link>
    </div>
    {error && <p className="plus-error" role="alert">{error}</p>}
    {notice && <p className="plus-success" role="status">{notice}</p>}
    <div className="plus-welcome"><div className="plus-welcome-copy"><span className="plus-overline">RECORRIDO DE DEMOSTRACIÓN</span><h2>Así se verá tu espacio Plus</h2><p>Explora y prueba la navegación sin activar permisos ni utilizar datos reales.</p></div><div className="plus-welcome-icon"><PlusIcon name="crown" size={42}/></div></div>
    <div className="plus-overview" aria-label="Indicadores de demostración">
      {stats.map(item => <a className="plus-overview-card" key={item.href} href={item.href}>
        <span className="plus-overview-icon"><PlusIcon name={item.icon} size={22}/></span><strong>{item.value}</strong><span>{item.label}</span><span className="plus-overview-arrow" aria-hidden="true">↗</span>
      </a>)}
    </div>
    <nav className="plus-section-nav" aria-label="Navegación de herramientas Plus de prueba">
      {sections.map(item => <a key={item.id} href={'#' + item.id}><PlusIcon name={item.icon} size={17}/>{item.label}</a>)}
    </nav>
    <section className="plus-panel" id="radar">
      <div className="plus-heading"><div><span>01 · DESCUBRIMIENTO · EJEMPLO</span><h2>Tu radar de novedades</h2><p>Así aparecen las novedades de los negocios favoritos.</p></div>
        <label className="plus-toggle"><input type="checkbox" checked={radarEnabled} onChange={e => { setRadarEnabled(e.target.checked); updateNotice('Preferencia de prueba actualizada localmente.'); }}/>Recibir avisos</label></div>
      <div className="plus-list">{[{ name: 'Nuevo servicio de muestra', business: 'Negocio favorito de ejemplo A' },{ name: 'Promoción de demostración', business: 'Negocio favorito de ejemplo B' }].map((item,i) =>
        <div className="plus-list-row" key={item.name}><span className="plus-row-symbol"><PlusIcon name="radar" size={19}/></span><span><strong>{item.name}</strong><small>{item.business} · Ejemplo {i + 1}</small></span><span className="plus-preview-chip">Demo</span></div>)}</div>
      <p className="plus-footnote">En la versión real, estas novedades se obtienen de publicaciones recientes de tus favoritos.</p>
    </section>
    <section className="plus-panel" id="prices">
      <div className="plus-heading"><div><span>02 · AHORRO · EJEMPLO</span><h2>Seguimiento de precios</h2><p>Prueba agregar o quitar productos y consultar un historial de ejemplo.</p></div>
        <label className="plus-toggle"><input type="checkbox" checked={priceAlerts} onChange={e => { setPriceAlerts(e.target.checked); updateNotice('Alerta simulada; no se enviarán notificaciones.'); }}/>Avisar cuando bajen</label></div>
      <div className="plus-follow-guide">
        <span className="plus-follow-guide-icon" aria-hidden="true"><PlusIcon name="price" size={25}/></span>
        <div><strong>Un botón en cada ficha de producto</strong><p>Abre un producto o servicio con precio numérico publicado y pulsa <b>Seguir precio</b>. Volverás a esta demostración sin activar pagos ni guardar datos.</p></div>
        <Link className="plus-button plus-button-secondary" to="/results">Explorar productos</Link>
      </div>
      {initialWatchId && <p className="plus-preview-chip" role="status">Has seguido un producto de ejemplo desde su ficha. No se registró ningún seguimiento real.</p>}
      <div className="plus-list">{watches.map(watch => <div className="plus-list-row" key={watch.id}>
        <span className="plus-row-symbol"><PlusIcon name="price" size={19}/></span><span><strong>{watch.name}</strong><small>{watch.business} · {watch.price ? '$' + watch.price + ' COP · ejemplo' : 'Sin precio real, vista previa'}</small></span>
        <div className="plus-row-buttons"><button type="button" onClick={()=>setHistoryId(historyId === watch.id ? null : watch.id)}>Historial</button><button type="button" onClick={()=>{setWatches(items=>items.filter(x=>x.id!==watch.id));setHistoryId(null);}}>Quitar</button></div>
      </div>)}</div>
      {historyId && <div className="plus-history"><h3>Historial de demostración</h3>{watches.find(x=>x.id===historyId)?.original
        ? <p>Precio anterior: $39.900 COP → Precio de ejemplo: $32.900 COP. Valores ficticios.</p>
        : <p>Esta publicación no tiene historial de ejemplo. El backend real todavía no se consulta.</p>}
        <button type="button" onClick={()=>setHistoryId(null)}>Cerrar historial</button></div>}
    </section>
    <section className="plus-panel" id="compare">
      <div className="plus-heading"><div><span>03 · COMPARACIÓN · EJEMPLO</span><h2>Compara tus opciones</h2><p>Selecciona de dos a cuatro publicaciones para explorar el comparador.</p></div></div>
      <div className="plus-follow-guide"><span className="plus-follow-guide-icon"><PlusIcon name="compare" size={25}/></span>
        <div><strong>Compara sin pegar enlaces</strong><p>Abre la ficha de un producto o servicio y pulsa <b>Comparar precio</b>. La selección de demostración aparecerá aquí.</p></div>
        <Link className="plus-button plus-button-secondary" to="/results">Elegir publicaciones</Link>
      </div>
      <p className="plus-selection-caption">{compareIds.length} de 4 opciones seleccionadas</p>
      <div className="plus-chips">{compareIds.map((id,i)=><button key={id} type="button" aria-label={`Quitar opción ${i+1}`} onClick={()=>updateCompareSelection(compareIds.filter(x=>x!==id))}>Opción {i+1} ×</button>)}</div>
      {compareIds.length > 0 && <button type="button" className="plus-button plus-clear-selection" onClick={()=>updateCompareSelection([])}>Eliminar selección</button>}
      <button type="button" className="plus-button plus-button-secondary" disabled={compareIds.length<2} onClick={()=>setCompared(true)}>Comparar {compareIds.length} opciones</button>
      {compared && <div className="plus-compare-grid">{compareIds.map(id=>{const item=resolve(id);return <article key={id}><span>Publicación de ejemplo</span><h3>{item.name}</h3><p>{item.business}</p><strong>{item.price ? '$'+item.price+' COP · ejemplo' : 'Precio no consultado'}</strong><p>La ubicación, calificación y distancia se consultarán desde el backend real.</p></article>;})}</div>}
    </section>
    <section className="plus-panel" id="collections">
      <div className="plus-heading"><div><span>04 · ORGANIZACIÓN · EJEMPLO</span><h2>Tus colecciones</h2><p>Crea listas y agrega enlaces para probar la organización.</p></div></div>
      <form className="plus-form" onSubmit={addCollection}><label>Nombre de la colección<input value={collectionName} maxLength={80} onChange={e=>setCollectionName(e.target.value)} placeholder="Ej. Mis cafeterías favoritas" required/></label><button type="submit" className="plus-button" disabled={collections.length>=50}>Crear colección</button></form>
      <div className="plus-list">{collections.map(col=><article className="plus-collection" key={col.id}><div className="plus-collection-head"><strong>{col.title}</strong><button type="button" onClick={()=>setCollections(items=>items.filter(x=>x.id!==col.id))}>Eliminar</button></div>
        <form className="plus-form plus-form-inline" onSubmit={e=>addCollectionItem(e,col.id)}><label>Enlace para agregar<input value={collectionInputs[col.id] ?? ''} onChange={e=>setCollectionInputs(inputs=>({...inputs,[col.id]:e.target.value}))} placeholder="/business/… o /product/…" required/></label><button type="submit">Agregar</button></form>
        <div className="plus-collection-items">{col.items.length===0 && <p className="plus-footnote">Todavía no hay elementos en esta lista.</p>}
          {col.items.map(item=><div key={item.id}><span>{item.description}</span><button type="button" onClick={()=>setCollections(items=>items.map(c=>c.id===col.id?{...c,items:c.items.filter(x=>x.id!==item.id)}:c))}>Quitar</button></div>)}</div>
      </article>)}</div>
    </section>
    <section className="plus-panel" id="searches">
      <div className="plus-heading"><div><span>04 · ORGANIZACIÓN · EJEMPLO</span><h2>Búsquedas guardadas</h2><p>Guarda criterios de búsqueda. La lista de prueba se borra al salir.</p></div></div>
      <form className="plus-form" onSubmit={addSearch}><label>Nombre<input value={searchTitle} onChange={e=>setSearchTitle(e.target.value)} placeholder="Ej. Panaderías cerca" required maxLength={80}/></label><label>Buscar<input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Qué quieres encontrar" required maxLength={160}/></label><label>Categoría (opcional)<input value={searchCategory} onChange={e=>setSearchCategory(e.target.value)} maxLength={120}/></label><button type="submit" className="plus-button" disabled={searches.length>=50}>Guardar búsqueda</button></form>
      <div className="plus-list">{searches.map(item=><div className="plus-list-row" key={item.id}><span className="plus-row-symbol"><PlusIcon name="collection" size={19}/></span><span><strong>{item.title}</strong><small>{item.query}{item.category?' · '+item.category:''} · ejemplo</small></span><div className="plus-row-buttons"><Link to={searchHref({id:String(item.id),title:item.title,query:item.query,category:item.category||null,city:null,openNow:false,minRating:null,sort:'recommended'})}>Buscar</Link><button type="button" onClick={()=>setSearches(items=>items.filter(x=>x.id!==item.id))}>Quitar</button></div></div>)}</div>
      <p className="plus-footnote">«Buscar» abre los resultados públicos de Xamuko, no una búsqueda Plus almacenada en el backend.</p>
    </section>
    <section className="plus-panel" id="routes">
      <div className="plus-heading"><div><span>05 · EXPLORACIÓN · EJEMPLO</span><h2>Rutas con varios negocios</h2><p>Elige de dos a cuatro paradas para revisar cómo se organiza el recorrido.</p></div></div>
      <div className="plus-routes-list">{sampleStops.map(stop=><label key={stop.id}><input type="checkbox" checked={selectedStops.includes(stop.id)} disabled={!selectedStops.includes(stop.id)&&selectedStops.length>=4} onChange={()=>{setSelectedStops(ids=>ids.includes(stop.id)?ids.filter(x=>x!==stop.id):[...ids,stop.id]);setShowRoute(false);}}/><span>{stop.name} · {stop.address}</span></label>)}</div>
      <div className="plus-route-actions"><label>Transporte <select value={travelMode} onChange={e=>setTravelMode(e.target.value as 'driving'|'walking')}><option value="driving">En vehículo</option><option value="walking">A pie</option></select></label><button type="button" className="plus-button" disabled={selectedStops.length<2} onClick={()=>setShowRoute(true)}>Ver recorrido de ejemplo</button></div>
      {showRoute && <div className="plus-preview-trip"><strong>Recorrido simulado · {travelMode==='driving'?'En vehículo':'A pie'}</strong><ol>{sampleStops.filter(stop=>selectedStops.includes(stop.id)).map(stop=><li key={stop.id}>{stop.name}</li>)}</ol></div>}
      <p className="plus-footnote">Esta demostración no envía direcciones a Google Maps. En Plus real, la ruta se construye con ubicaciones públicas verificadas.</p>
    </section>
    <section className="plus-panel plus-adfree" id="adfree"><span aria-hidden="true"><PlusIcon name="ad-free" size={35}/></span><div><h2>06 · Experiencia sin anuncios</h2><p>La membresía real oculta anuncios identificados como publicidad de terceros. Aquí solo se muestra cómo se presenta el beneficio; no cambia el resto de la plataforma.</p><small>Simulación visual · Sin activación de la política global de anuncios</small></div></section>
    <div className="plus-preview-exit"><p>Fin del recorrido de demostración. Los cambios que hiciste aquí no se guardarán.</p><Link to="/plus" className="plus-button plus-button-secondary">Salir de la vista previa</Link></div>
  </PageLayout>;
}
