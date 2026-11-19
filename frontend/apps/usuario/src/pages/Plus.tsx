import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageLayout } from '../components/PageLayout';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { useFavorites } from '../services/favoritesService';
import { listPublicBusinesses } from '../services/publicBusinessApi';
import { getBusinessCoordinates } from '../utils/coordinates';
import type { Business } from '../data/mockData';
import {
  addPlusCollectionItem, addPlusWatch, comparePlusOffers, createPlusCollection, createPlusSearch,
  fetchPlusOverview, fetchPlusPriceHistory, fetchPlusRadar, fetchPlusStatus,
  parsePlusTarget, removePlusCollection, removePlusCollectionItem, removePlusSearch,
  removePlusWatch, savePlusPreferences, searchHref,
  type PlusOverview, type PlusRadarItem, type PlusCompareOffer, type PriceHistory, type PlusStatus,
} from '../services/userPlusService';
import './Plus.css';

const benefits = [
  { title: 'Radar de novedades', description: 'Novedades reales de tus negocios favoritos', icon: '✦' },
  { title: 'Seguimiento de precios', description: 'Historial y alertas cuando bajan los precios', icon: '↘' },
  { title: 'Comparar opciones', description: 'Hasta cuatro productos o servicios', icon: '≍' },
  { title: 'Colecciones y búsquedas', description: 'Guarda tus lugares e intereses', icon: '▣' },
  { title: 'Rutas múltiples', description: 'Organiza visitas a varios negocios', icon: '⌁' },
  { title: 'Sin anuncios de terceros', description: 'Una experiencia de navegación más limpia', icon: '◈' },
];

function readablePrice(value: string | null, currency = 'COP') {
  if (value === null || !Number.isFinite(Number(value))) return 'Precio por consultar';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: currency || 'COP', maximumFractionDigits: 0 }).format(Number(value));
}
function buildMultiStopRoute(points: Business[], travelMode: 'driving' | 'walking', origin?: { lat: number; lng: number }) {
  const sites = points.map(point => getBusinessCoordinates(point)).filter((p): p is { lat: number; lng: number } => Boolean(p));
  if (sites.length < 2) return null;
  const coordinates = sites.map(point => point.lat + ',' + point.lng);
  const input = new URLSearchParams({ api: '1', travelmode: travelMode });
  const allStops = origin ? [origin.lat + ',' + origin.lng, ...coordinates] : coordinates;
  input.set('origin', allStops[0]);
  input.set('destination', allStops[allStops.length - 1]);
  if (allStops.length > 2) input.set('waypoints', allStops.slice(1, -1).join('|'));
  return 'https://www.google.com/maps/dir/?' + input.toString();
}

export default function Plus() {
  const { user } = useAuth();
  const [queryParams] = useSearchParams();
  const { selection } = useLocationContext();
  const { favorites } = useFavorites();
  const requestEpoch = useRef(0);
  const [status, setStatus] = useState<PlusStatus | null>(null);
  const [data, setData] = useState<PlusOverview | null>(null);
  const [radar, setRadar] = useState<PlusRadarItem[]>([]);
  const [places, setPlaces] = useState<Business[]>([]);
  const [routeIds, setRouteIds] = useState<string[]>([]);
  const [travelMode, setTravelMode] = useState<'driving' | 'walking'>('driving');
  const [collectionName, setCollectionName] = useState('');
  const [collectionValue, setCollectionValue] = useState(queryParams.get('item') ?? '');
  const [savedQuery, setSavedQuery] = useState('');
  const [savedTitle, setSavedTitle] = useState('');
  const [savedCategory, setSavedCategory] = useState('');
  const [targetValue, setTargetValue] = useState(queryParams.get('watch') ?? '');
  const [compareValue, setCompareValue] = useState(queryParams.get('compare') ?? '');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<PlusCompareOffer[]>([]);
  const [history, setHistory] = useState<PriceHistory | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const currentCity = selection?.locality?.name ?? null;

  const reload = useCallback(async () => {
    if (!user) return;
    const epoch = ++requestEpoch.current;
    const current = await fetchPlusStatus();
    if (epoch !== requestEpoch.current) return;
    setStatus(current);
    if (current.active) {
      const [overview, feed] = await Promise.all([fetchPlusOverview(), fetchPlusRadar()]);
      if (epoch !== requestEpoch.current) return;
      setData(overview);
      setRadar(feed.items);
    } else if (epoch === requestEpoch.current) {
      setData(null); setRadar([]); setHistory(null); setComparison([]);
    }
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setStatus(null); setData(null);
    void reload().catch(e => { if (active) setError(e instanceof Error ? e.message : 'No se pudo consultar Xamuko Plus.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; requestEpoch.current += 1; };
  }, [reload]);

  useEffect(() => {
    if (!data?.active) { setPlaces([]); return; }
    let active = true;
    void listPublicBusinesses().then(items => { if (active) setPlaces(items); }).catch(() => { if (active) setPlaces([]); });
    return () => { active = false; };
  }, [data?.active]);

  // Refetch entitlement on returning to the page, and while a signed-in session remains open.
  useEffect(() => {
    if (!user) return;
    const refresh = () => { if (document.visibilityState === 'visible') void reload().catch(() => setError('No se pudo actualizar la suscripción.')); };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [reload, user?.id]);

  async function run(task: () => Promise<unknown>, success = 'Cambios guardados.'): Promise<boolean> {
    setBusy(true); setError(''); setNotice('');
    try {
      await task();
      try { await reload(); } catch { setError('El cambio se guardó, pero no se pudo actualizar la información.'); }
      setNotice(success);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos guardar los cambios.');
      return false;
    } finally { setBusy(false); }
  }
  const routeBusinesses = useMemo(() => routeIds.flatMap(id => {
    const item = places.find(b => b.id === id);
    return item ? [item] : [];
  }), [places, routeIds]);
  const availableFavorites = useMemo(() => places.filter(place => favorites.includes(place.id) && getBusinessCoordinates(place)), [places, favorites]);
  const routeUrl = buildMultiStopRoute(routeBusinesses, travelMode, selection?.coordinates ?? undefined);

  function watchOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = parsePlusTarget(targetValue);
    if (!target || target.targetType !== 'OFFER') { setError('Escribe el enlace de un producto o servicio de Xamuko.'); return; }
    void run(() => addPlusWatch(target.targetId), 'Producto o servicio añadido al seguimiento de precios.');
  }
  function addComparison(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = parsePlusTarget(compareValue);
    if (!target || target.targetType !== 'OFFER') { setError('Escribe el enlace de un producto o servicio válido.'); return; }
    if (compareIds.includes(target.targetId)) return;
    if (compareIds.length >= 4) { setError('Puedes comparar un máximo de cuatro elementos.'); return; }
    setCompareIds([...compareIds, target.targetId]); setCompareValue(''); setComparison([]); setError('');
  }
  const dateFormat = (value: string) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

  return <PageLayout className="plus-page">
    <Link to="/profile" className="plus-back">← Volver al perfil</Link>
    <header className="plus-hero">
      <span className="plus-kicker">MEMBRESÍA XAMUKO</span>
      <h1><span aria-hidden="true">♛</span> Xamuko Plus</h1>
      <p>Descubre oportunidades, organiza tus favoritos y aprovecha mejor tu ciudad.</p>
      <div className="plus-hero-state" role="status">
        {loading ? 'Consultando membresía…' : error && !status ? 'No pudimos verificar tu membresía' : status?.active
          ? 'Tu membresía Plus está activa'
          : !status?.enabled ? 'Xamuko Plus aún no está habilitado' : 'No tienes una membresía Plus vigente'}
      </div>
      {status?.subscription && <small>Vigencia registrada hasta {dateFormat(status.subscription.expiresAt)}. Los datos permanecen guardados cuando termina la membresía.</small>}
    </header>
    {error && <p className="plus-error" role="alert">{error}</p>}
    {notice && <p className="plus-success" role="status">{notice}</p>}
    {!status?.active ? <section className="plus-benefits" aria-label="Beneficios incluidos">
      <h2>Lo que incluye Plus</h2>
      <div className="plus-benefit-grid">{benefits.map(b => <article key={b.title}><span aria-hidden="true">{b.icon}</span><h3>{b.title}</h3><p>{b.description}</p></article>)}</div>
      <p className="plus-note">Todavía no se ofrecen compras ni cobros desde esta sección. Los beneficios se habilitan únicamente para suscripciones vigentes y con el interruptor administrativo activado.</p>
      <button type="button" className="plus-button plus-button-secondary" disabled={loading} onClick={() => { setLoading(true); void reload().catch(() => setError('No pudimos actualizar la consulta.')).finally(() => setLoading(false)); }}>Verificar otra vez</button>
    </section> : <>
      <section className="plus-panel" id="radar">
        <div className="plus-heading"><div><span>01 · DESCUBRIMIENTO</span><h2>Tu radar de novedades</h2><p>Productos, servicios y promociones recientes de tus negocios favoritos.</p></div>
          <label className="plus-toggle"><input type="checkbox" checked={data?.preferences?.radarEnabled ?? true} disabled={busy}
            onChange={event => void run(() => savePlusPreferences({ radarEnabled: event.target.checked }))}/>Recibir avisos</label></div>
        {radar.length ? <div className="plus-list">{radar.map(item => <Link key={item.type + ':' + item.id} to={item.href} className="plus-list-row">
          <span className="plus-row-symbol">✦</span><span><strong>{item.title}</strong><small>{item.business} · {dateFormat(item.createdAt)}</small></span><span>Ver ›</span></Link>)}</div>
          : <p className="plus-empty">Aún no hay novedades recientes. Guarda negocios como favoritos para recibir sus nuevas publicaciones.</p>}
      </section>

      <section className="plus-panel" id="prices">
        <div className="plus-heading"><div><span>02 · AHORRO</span><h2>Seguimiento de precios</h2><p>Observa precios reales y recibe avisos si bajan.</p></div>
          <label className="plus-toggle"><input type="checkbox" checked={data?.preferences?.priceAlertsEnabled ?? true} disabled={busy}
            onChange={event => void run(() => savePlusPreferences({ priceAlertsEnabled: event.target.checked }))}/>Avisar cuando bajen</label></div>
        <form className="plus-form" onSubmit={watchOffer}>
          <label>Enlace del producto o servicio<input value={targetValue} onChange={event => setTargetValue(event.target.value)} placeholder="https://xamuko.com/product/…" required/></label>
          <button className="plus-button" disabled={busy}>Seguir precio</button>
        </form>
        <div className="plus-list">{data?.watches.map(item => <div className="plus-list-row" key={item.id}>
          <span className="plus-row-symbol">↘</span><span><strong>{item.name}</strong><small>{item.businessName} · {item.available ? readablePrice(item.price, item.currency ?? 'COP') : 'Publicación no disponible'}</small></span>
          <div className="plus-row-buttons">
            {item.available && <button type="button" disabled={busy} onClick={() => void run(async () => {
              const result = await fetchPlusPriceHistory(item.offerId); setHistory(result);
            }, 'Historial actualizado.')}>Historial</button>}
            <button type="button" disabled={busy} onClick={() => void run(() => removePlusWatch(item.id))}>Quitar</button>
          </div></div>)}</div>
        {!data?.watches.length && <p className="plus-empty">Todavía no sigues ningún precio.</p>}
        {history && <div className="plus-history"><h3>Historial de {history.offer.name}</h3>
          <p>Precio actual publicado: {readablePrice(history.offer.price, history.offer.currency ?? 'COP')}</p>
          {history.history.length ? <ul>{history.history.map((point, i) => <li key={point.createdAt + i}>{dateFormat(point.createdAt)} · {point.previousPrice === null ? 'Primer precio registrado' : readablePrice(point.previousPrice, point.previousCurrency ?? 'COP')} → {readablePrice(point.newPrice, point.currency ?? 'COP')}</li>)}</ul> : <p>Sin cambios registrados desde que se habilitó el historial.</p>}
          <button type="button" onClick={() => setHistory(null)}>Cerrar historial</button>
        </div>}
      </section>

      <section className="plus-panel" id="compare">
        <div className="plus-heading"><div><span>03 · COMPARACIÓN</span><h2>Compara tus opciones</h2><p>Selecciona hasta cuatro productos o servicios publicados.</p></div></div>
        <form className="plus-form" onSubmit={addComparison}><label>Enlace de producto o servicio<input value={compareValue} onChange={event => setCompareValue(event.target.value)} placeholder="Pega un enlace de Xamuko" required/></label><button className="plus-button" disabled={busy || compareIds.length >= 4}>Añadir a comparación</button></form>
        {compareIds.length > 0 && <><div className="plus-chips">{compareIds.map((id, i) => <button key={id} type="button" onClick={() => { setCompareIds(compareIds.filter(x => x !== id)); setComparison([]); }}>Opción {i + 1} ×</button>)}</div>
          <button className="plus-button plus-button-secondary" type="button" disabled={busy || compareIds.length < 2}
            onClick={() => void run(async () => { const result = await comparePlusOffers(compareIds); setComparison(result.offers); }, 'Comparación actualizada.')}>Comparar {compareIds.length} opciones</button></>}
        {comparison.length > 0 && <div className="plus-compare-grid">{comparison.map(item => <article key={item.id}>
          <span>{item.kind === 'PRODUCT' ? 'Producto' : 'Servicio'}</span><h3>{item.name}</h3><p>{item.business.name}</p>
          <strong>{item.negotiable ? 'Precio a convenir' : item.priceAmount !== null ? readablePrice(item.priceAmount, item.currency ?? 'COP') : item.priceText || 'Consultar'}</strong>
          <p>{item.description || 'Sin descripción publicada'}</p><Link to={`/${item.kind === 'PRODUCT' ? 'product' : 'service'}/${item.id}`}>Ver detalle ›</Link>
        </article>)}</div>}
      </section>

      <section className="plus-panel" id="collections">
        <div className="plus-heading"><div><span>04 · ORGANIZACIÓN</span><h2>Tus colecciones</h2><p>Listas personales para guardar negocios, productos y servicios.</p></div></div>
        <form className="plus-form" onSubmit={event => { event.preventDefault(); if (collectionName.trim()) void run(() => createPlusCollection(collectionName.trim()), 'Colección creada.').then(ok => { if (ok) setCollectionName(''); }); }}>
          <label>Nombre de la colección<input value={collectionName} onChange={event => setCollectionName(event.target.value)} maxLength={80} placeholder="Ej. Mis cafés favoritos" required/></label><button className="plus-button" disabled={busy}>Crear colección</button>
        </form>
        <div className="plus-list">{data?.collections.map(col => <article key={col.id} className="plus-collection">
          <div className="plus-collection-head"><strong>{col.title}</strong><button type="button" disabled={busy} onClick={() => void run(() => removePlusCollection(col.id))}>Eliminar</button></div>
          <form className="plus-form plus-form-inline" onSubmit={event => {
            event.preventDefault(); const target = parsePlusTarget(collectionValue);
            if (!target) { setError('Copia el enlace del negocio, producto o servicio en Xamuko.'); return; }
            void run(() => addPlusCollectionItem(col.id, target), 'Guardado en tu colección.').then(ok => { if (ok) setCollectionValue(''); });
          }}><label>Enlace para agregar<input value={collectionValue} onChange={event => setCollectionValue(event.target.value)} placeholder="/business/… o /product/…" required/></label><button type="submit" disabled={busy}>Agregar</button></form>
          <div className="plus-collection-items">{col.items.map(item => <div key={item.id}>
            {item.href ? <Link to={item.href}>{item.name} ›</Link> : <span>{item.name}</span>}
            <button type="button" disabled={busy} onClick={() => void run(() => removePlusCollectionItem(col.id, item.id))}>Quitar</button>
          </div>)}</div>
        </article>)}</div>
        {!data?.collections.length && <p className="plus-empty">Crea una colección para comenzar.</p>}
      </section>

      <section className="plus-panel" id="searches">
        <div className="plus-heading"><div><span>04 · ORGANIZACIÓN</span><h2>Búsquedas guardadas</h2><p>Guarda una búsqueda que puedas repetir cuando quieras.</p></div></div>
        <form className="plus-form" onSubmit={event => {
          event.preventDefault();
          void run(() => createPlusSearch({
            title: savedTitle.trim(), query: savedQuery.trim(), category: savedCategory.trim() || null,
            city: currentCity, openNow: false, minRating: null, sort: 'recommended',
          }), 'Búsqueda guardada.').then(ok => { if (ok) { setSavedTitle(''); setSavedQuery(''); } });
        }}>
          <label>Nombre<input value={savedTitle} maxLength={80} onChange={event => setSavedTitle(event.target.value)} placeholder="Ej. Panaderías cerca" required/></label>
          <label>Buscar<input value={savedQuery} maxLength={160} onChange={event => setSavedQuery(event.target.value)} placeholder="Qué quieres encontrar" required/></label>
          <label>Categoría (opcional)<input value={savedCategory} maxLength={120} onChange={event => setSavedCategory(event.target.value)} placeholder="Ej. Restaurantes"/></label>
          <button className="plus-button" disabled={busy}>Guardar búsqueda</button>
        </form>
        <p className="plus-footnote">Las búsquedas se ejecutan en la zona que tengas seleccionada al abrirlas. Puedes cambiar tu ubicación en Xamuko.</p>
        <div className="plus-list">{data?.searches.map(item => <div key={item.id} className="plus-list-row"><span className="plus-row-symbol">⌕</span><span><strong>{item.title}</strong><small>{item.query}{item.city ? ' · Guardada en ' + item.city : ''}</small></span>
          <div className="plus-row-buttons"><Link to={searchHref(item)}>Buscar</Link><button type="button" disabled={busy} onClick={() => void run(() => removePlusSearch(item.id))}>Quitar</button></div>
        </div>)}</div>
      </section>

      <section className="plus-panel" id="routes">
        <div className="plus-heading"><div><span>05 · EXPLORACIÓN</span><h2>Rutas con varios negocios</h2><p>Selecciona entre dos y cuatro negocios favoritos con ubicación registrada.</p></div></div>
        <div className="plus-routes-list">{availableFavorites.map(place => <label key={place.id}>
          <input type="checkbox" checked={routeIds.includes(place.id)} disabled={!routeIds.includes(place.id) && routeIds.length >= 4}
            onChange={() => setRouteIds(current => current.includes(place.id) ? current.filter(x => x !== place.id) : [...current, place.id])}/>
          <span>{place.name}</span></label>)}</div>
        {!availableFavorites.length && <p className="plus-empty">Primero guarda como favoritos negocios con ubicación disponible.</p>}
        <div className="plus-route-actions"><label>Transporte <select value={travelMode} onChange={event => setTravelMode(event.target.value as 'driving' | 'walking')}><option value="driving">En vehículo</option><option value="walking">A pie</option></select></label>
          {routeUrl ? <a className="plus-button" href={routeUrl} target="_blank" rel="noopener noreferrer">Abrir ruta en Google Maps</a> : <span>Selecciona al menos dos negocios.</span>}</div>
        <p className="plus-footnote">La ruta se abre en Google Maps; la disponibilidad y el recorrido final dependen de ese servicio. Si compartes tu ubicación, se usará como punto de partida.</p>
      </section>

      <section className="plus-panel plus-adfree"><span aria-hidden="true">◈</span><div><h2>06 · Experiencia sin anuncios</h2><p>Mientras Plus esté activo, se ocultan los espacios publicitarios de terceros. Los negocios y resultados públicos siguen visibles.</p></div></section>
    </>}
  </PageLayout>;
}
