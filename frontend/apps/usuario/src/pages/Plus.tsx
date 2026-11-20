import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PAID_PLAN_MONTHLY_COP, formatCopPrice } from '@wit/utils';
import { PlusIcon, type PlusIconName } from '../components/PlusIcon';
import { PageLayout } from '../components/PageLayout';
import { CatalogPhoto } from '../components/CatalogPhoto';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import { getPublicBusiness } from '../services/publicBusinessApi';
import { listPublicReviews } from '../services/reviewsService';
import { distanceBetweenCoordinates, getBusinessCoordinates } from '../utils/coordinates';
import type { Business } from '../data/mockData';
import { estimatePlusRoute, optimizePlusRoute } from '../utils/plusRoutePlanner';
import {
  addPlusCollectionItem, comparePlusOffers, createPlusCollection, createPlusSearch,
  fetchPlusCollectionCandidates,
  fetchPlusOverview, fetchPlusPriceHistory, fetchPlusRadar, fetchPlusRouteFavorites, fetchPlusStatus, fetchPlusPurchaseRequest, requestPlusMembership,
  parsePlusTarget, removePlusCollection, removePlusCollectionItem, removePlusSearch,
  removePlusWatch, savePlusPreferences, setPlusPriceTarget, searchHref,
  type PlusOverview, type PlusRadarItem, type PlusRouteFavorite, type PlusCompareOffer, type PriceHistory, type PlusStatus, type PlusPurchaseRequest, type PlusCollectionCandidate,
} from '../services/userPlusService';
import { appendPlusComparison, readPlusComparison, readPlusComparisonLabels, savePlusComparison } from '../services/plusComparisonSelection';
import './Plus.css';

const benefits: Array<{ title: string; description: string; icon: PlusIconName }> = [
  { title: 'Radar de novedades', description: 'Novedades reales de tus negocios favoritos', icon: 'radar' },
  { title: 'Seguimiento de precios', description: 'Historial y alertas cuando bajan los precios', icon: 'price' },
  { title: 'Comparar opciones', description: 'Hasta cuatro productos o servicios', icon: 'compare' },
  { title: 'Colecciones y búsquedas', description: 'Guarda tus lugares e intereses', icon: 'collection' },
  { title: 'Rutas múltiples', description: 'Organiza visitas a varios negocios', icon: 'route' },
  { title: 'Sin anuncios de terceros', description: 'Una experiencia de navegación más limpia', icon: 'ad-free' },
];

function readablePrice(value: string | null, currency = 'COP') {
  if (value === null || !Number.isFinite(Number(value))) return 'Precio por consultar';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: currency || 'COP', maximumFractionDigits: 0 }).format(Number(value));
}
function buildMultiStopRoute(points: PlusRouteFavorite[], travelMode: 'driving' | 'walking', origin?: { lat: number; lng: number }) {
  const sites = points.map(point => ({ lat: point.lat, lng: point.lng }));
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
  const requestEpoch = useRef(0);
  const [status, setStatus] = useState<PlusStatus | null>(null);
  const [purchaseRequest, setPurchaseRequest] = useState<PlusPurchaseRequest | null>(null);
  const [confirmPurchase, setConfirmPurchase] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [data, setData] = useState<PlusOverview | null>(null);
  const [radar, setRadar] = useState<PlusRadarItem[]>([]);
  const [radarAvailable, setRadarAvailable] = useState(true);
  const [places, setPlaces] = useState<PlusRouteFavorite[]>([]);
  const [routeLoadError, setRouteLoadError] = useState(false);
  const [routeLoading, setRouteLoading] = useState(true);
  const [routeIds, setRouteIds] = useState<string[]>([]);
  const [travelMode, setTravelMode] = useState<'driving' | 'walking'>('driving');
  const [routeOptimized, setRouteOptimized] = useState(false);
  const [visitAt, setVisitAt] = useState(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  const [targetEditor, setTargetEditor] = useState<string | null>(null);
  const [targetDraft, setTargetDraft] = useState('');
  const [digestZone, setDigestZone] = useState(() =>
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota');
  const [digestHour, setDigestHour] = useState(8);
  const [collectionName, setCollectionName] = useState('');
  const [collectionPicker, setCollectionPicker] = useState<string | null>(null);
  const [pickerType, setPickerType] = useState<'BUSINESS' | 'OFFER'>('BUSINESS');
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerItems, setPickerItems] = useState<PlusCollectionCandidate[]>([]);
  const [pickerTotalPages, setPickerTotalPages] = useState(0);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [pickerReload, setPickerReload] = useState(0);
  const [savedQuery, setSavedQuery] = useState('');
  const [savedTitle, setSavedTitle] = useState('');
  const [savedCategory, setSavedCategory] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>(() => readPlusComparison(user?.id ?? ''));
  const [comparison, setComparison] = useState<PlusCompareOffer[]>([]);
  const [comparisonBusinesses, setComparisonBusinesses] = useState<Record<string, Business>>({});
  const [history, setHistory] = useState<PriceHistory | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const currentCity = selection?.locality?.name ?? null;
  const comparePrefill = queryParams.get('compare') ?? '';
  useEffect(() => {
    if (data?.preferences) {
      setDigestZone(data.preferences.digestTimeZone);
      setDigestHour(data.preferences.digestHour);
    }
  }, [data?.preferences?.digestTimeZone, data?.preferences?.digestHour]);

  const reload = useCallback(async () => {
    if (!user) return;
    const epoch = ++requestEpoch.current;
    const current = await fetchPlusStatus();
    if (epoch !== requestEpoch.current) return;
    setStatus(current);
    if (current.enabled && !current.active) {
      const pendingPurchase = await fetchPlusPurchaseRequest();
      if (epoch !== requestEpoch.current) return;
      setPurchaseRequest(pendingPurchase.request);
    } else {
      setPurchaseRequest(null);
    }
    if (current.active) {
      // A temporary radar outage must not block prices, collections or saved searches.
      const [overviewResult, radarResult] = await Promise.allSettled([fetchPlusOverview(), fetchPlusRadar()]);
      if (epoch !== requestEpoch.current) return;
      if (overviewResult.status === 'rejected') throw overviewResult.reason;
      setData(overviewResult.value);
      setRadar(radarResult.status === 'fulfilled' ? radarResult.value.items : []);
      setRadarAvailable(radarResult.status === 'fulfilled');
      setError(radarResult.status === 'rejected'
        ? 'No pudimos consultar las novedades recientes. Tus demás herramientas Plus siguen disponibles.' : '');
    } else if (epoch === requestEpoch.current) {
      setData(null); setRadar([]); setRadarAvailable(true); setHistory(null); setComparison([]); setComparisonBusinesses({});
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
    if (!user?.id) { setCompareIds([]); return; }
    if (comparePrefill) {
      const target = parsePlusTarget(comparePrefill);
      if (target?.targetType === 'OFFER') {
        const { ids } = appendPlusComparison(user.id, target.targetId);
        setCompareIds(ids);
        return;
      }
    }
    setCompareIds(readPlusComparison(user.id));
  }, [user?.id, comparePrefill]);
  useEffect(() => {
    if (!status?.active) return;
    const section = comparePrefill || window.location.hash === '#compare' ? 'compare' : '';
    if (section && data) document.getElementById(section)?.scrollIntoView({ block: 'start' });
  }, [comparePrefill, status?.active, Boolean(data)]);

  useEffect(() => {
    if (!data?.active) { setPlaces([]); setRouteLoadError(false); setRouteLoading(false); return; }
    let active = true;
    setRouteLoading(true);
    void fetchPlusRouteFavorites().then(result => {
      if (active) { setPlaces(result.items); setRouteLoadError(false); setRouteLoading(false); }
    }).catch(() => {
      if (active) { setPlaces([]); setRouteLoadError(true); setRouteLoading(false); }
    });
    return () => { active = false; };
  }, [data?.active]);
  useEffect(() => {
    setRouteIds(ids => ids.filter(id => places.some(place => place.id === id)));
  }, [places]);

  useEffect(() => {
    if (!collectionPicker || !status?.active) { setPickerItems([]); return; }
    let active = true;
    setPickerLoading(true);
    setPickerError('');
    void fetchPlusCollectionCandidates(pickerType, pickerPage)
      .then(result => {
        if (!active) return;
        setPickerItems(result.items);
        setPickerTotalPages(result.pagination.totalPages);
      })
      .catch(() => {
        if (active) { setPickerItems([]); setPickerTotalPages(0); setPickerError('No pudimos cargar tus favoritos o Me gusta. Vuelve a intentarlo.'); }
      })
      .finally(() => { if (active) setPickerLoading(false); });
    return () => { active = false; };
  }, [collectionPicker, pickerType, pickerPage, pickerReload, status?.active]);

  // Refetch entitlement on returning to the page, and while a signed-in session remains open.
  useEffect(() => {
    if (!user) return;
    const refresh = () => { if (document.visibilityState === 'visible') void reload().catch(() => setError('No se pudo actualizar la suscripción.')); };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [reload, user?.id]);

  async function submitPurchaseRequest() {
    if (!status?.enabled || status.active || !acceptedTerms || purchaseBusy || purchaseRequest) return;
    setPurchaseBusy(true); setError(''); setNotice('');
    try {
      const result = await requestPlusMembership(PAID_PLAN_MONTHLY_COP.xamukoPlus);
      setPurchaseRequest(result.request);
      setConfirmPurchase(false);
      setAcceptedTerms(false);
      setNotice('Tu solicitud de Xamuko Plus quedó registrada. Aún no se ha realizado ningún cobro ni activado la membresía.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos registrar tu solicitud de Xamuko Plus.');
    } finally { setPurchaseBusy(false); }
  }

  async function run(task: () => Promise<unknown>, success = 'Cambios guardados.'): Promise<boolean> {
    setBusy(true); setError(''); setNotice('');
    try {
      await task();
      try {
        await reload();
        setNotice(success);
      } catch {
        setNotice('El cambio se guardó, pero no pudimos actualizar la información. Comprueba el resultado antes de repetir la acción.');
      }
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos guardar los cambios.');
      return false;
    } finally { setBusy(false); }
  }
  async function saveTarget(watchId: string) {
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(targetDraft) || Number(targetDraft) <= 0) {
      setError('Introduce un precio objetivo positivo, sin separadores de miles y con máximo dos decimales.');
      return;
    }
    const watched = data?.watches.find(item => item.id === watchId);
    const currentPrice = watched?.available && watched.price !== null ? Number(watched.price) : NaN;
    if (Number.isFinite(currentPrice) && Number(targetDraft) >= currentPrice) {
      setError('El precio objetivo debe ser menor que el precio actual (' +
        readablePrice(watched?.price ?? null, watched?.currency ?? 'COP') + ').');
      return;
    }
    const ok = await run(() => setPlusPriceTarget(watchId, targetDraft),
      'Precio objetivo guardado. Te avisaremos al alcanzarlo, según la modalidad de notificaciones elegida.');
    if (ok) { setTargetEditor(null); setTargetDraft(''); }
  }
  async function showPriceHistory(offerId: string) {
    if (busy) return;
    setBusy(true); setError(''); setNotice(''); setHistory(null);
    try {
      setHistory(await fetchPlusPriceHistory(offerId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos consultar el historial de precios.');
    } finally { setBusy(false); }
  }
  async function showComparison() {
    if (busy || compareIds.length < 2) return;
    setBusy(true); setError(''); setNotice(''); setComparison([]); setComparisonBusinesses({});
    try {
      const result = await comparePlusOffers(compareIds);
      if (result.offers.length < 2) {
        setError('No hay dos publicaciones disponibles para comparar. Revisa tu selección y reemplaza las que ya no estén publicadas.');
        return;
      }
      setComparison(result.offers);
      const details = await Promise.all(result.offers.map(async offer => {
        const id = offer.business.publicId;
        const [detail, reviews] = await Promise.all([
          getPublicBusiness(id).catch(() => null),
          listPublicReviews(id, 1, 1).catch(() => null),
        ]);
        if (!detail) return null;
        return { id, business: {
          ...detail.business,
          rating: reviews?.summary?.average ?? detail.business.rating,
          reviewCount: reviews?.summary?.total ?? detail.business.reviewCount,
        } };
      }));
      setComparisonBusinesses(Object.fromEntries(details.filter((item): item is { id: string; business: Business } => item !== null)
        .map(item => [item.id, item.business])));
      if (result.offers.length < compareIds.length) {
        setNotice('Algunas publicaciones ya no están disponibles. Solo se muestran las opciones verificadas.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos comparar las publicaciones seleccionadas.');
    } finally { setBusy(false); }
  }
  const selectedRouteBusinesses = useMemo(() => routeIds.flatMap(id => {
    const item = places.find(b => b.id === id);
    return item ? [item] : [];
  }), [places, routeIds]);
  const routeBusinesses = useMemo(() => routeOptimized
    ? optimizePlusRoute(selectedRouteBusinesses, selection?.coordinates ?? undefined)
    : selectedRouteBusinesses, [selectedRouteBusinesses, routeOptimized, selection?.coordinates]);
  const availableFavorites = places;
  const routeUrl = buildMultiStopRoute(routeBusinesses, travelMode, selection?.coordinates ?? undefined);
  const routeEstimates = estimatePlusRoute(routeBusinesses, travelMode, new Date(visitAt),
    selection?.coordinates ?? undefined);
  const compareLabels = readPlusComparisonLabels(user?.id ?? '');
  const overviewCounts = [
    { label: 'Novedades recientes', count: radarAvailable ? radar.length : null, icon: 'radar' as const, href: '#radar' },
    { label: 'Precios seguidos', count: data?.watches.length ?? 0, icon: 'price' as const, href: '#prices' },
    { label: 'Colecciones', count: data?.collections.length ?? 0, icon: 'collection' as const, href: '#collections' },
    { label: 'Búsquedas guardadas', count: data?.searches.length ?? 0, icon: 'compare' as const, href: '#searches' },
  ];
  const plusSections = [
    { label: 'Novedades', href: '#radar', icon: 'radar' as const },
    { label: 'Precios', href: '#prices', icon: 'price' as const },
    { label: 'Comparador', href: '#compare', icon: 'compare' as const },
    { label: 'Colecciones', href: '#collections', icon: 'collection' as const },
    { label: 'Búsquedas', href: '#searches', icon: 'collection' as const },
    { label: 'Rutas', href: '#routes', icon: 'route' as const },
    { label: 'Sin anuncios', href: '#adfree', icon: 'ad-free' as const },
  ];

  const updateCompareSelection = (next: string[]) => {
    setCompareIds(savePlusComparison(user?.id ?? '', next));
    setComparison([]);
    setComparisonBusinesses({});
    setError('');
  };
  const dateFormat = (value: string) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

  return <PageLayout className="plus-page">
    <Link to="/profile" className="plus-back">← Volver al perfil</Link>
    <header className="plus-hero">
      <span className="plus-kicker">MEMBRESÍA XAMUKO</span>
      <h1><span className="plus-hero-crown"><PlusIcon name="crown" size={32}/></span> Xamuko Plus</h1>
      <p>Descubre oportunidades, organiza tus favoritos y aprovecha mejor tu ciudad.</p>
      <div className="plus-hero-state" role="status" aria-live="polite">
        {loading ? 'Consultando membresía…' : error && !status ? 'No pudimos verificar tu membresía' : status?.active
          ? 'Tu membresía Plus está activa'
          : !status?.enabled ? 'Xamuko Plus aún no está habilitado' : 'No tienes una membresía Plus vigente'}
      </div>
      {status?.subscription && <small>Vigencia registrada hasta {dateFormat(status.subscription.expiresAt)}. Los datos permanecen guardados cuando termina la membresía.</small>}
    </header>
    {error && <p className="plus-error" role="alert">{error}</p>}
    {notice && <p className="plus-success" role="status">{notice}</p>}
    {status?.active && data && <>
      <div className="plus-welcome" aria-label="Resumen de tu membresía">
        <div className="plus-welcome-copy">
          <span className="plus-overline">TU ESPACIO PERSONAL</span>
          <h2>Todo lo que te interesa, en un solo lugar.</h2>
          <p>Explora novedades, sigue precios y organiza tus próximas visitas. Los indicadores corresponden únicamente a tus datos de Xamuko.</p>
        </div>
        <div className="plus-welcome-icon" aria-hidden="true"><PlusIcon name="crown" size={42}/></div>
      </div>
      <div className="plus-overview" aria-label="Actividad personal de Xamuko Plus">
        {overviewCounts.map(item => <a key={item.href} href={item.href} className="plus-overview-card">
          <span className="plus-overview-icon"><PlusIcon name={item.icon} size={22}/></span>
          <strong>{item.count === null ? '—' : item.count.toLocaleString('es-CO')}</strong>
          <span>{item.label}</span>
          <span className="plus-overview-arrow" aria-hidden="true">↗</span>
        </a>)}
      </div>
      <nav className="plus-section-nav" aria-label="Ir a una herramienta de Xamuko Plus">
        {plusSections.map(item => <a key={item.href} href={item.href}><PlusIcon name={item.icon} size={17}/>{item.label}</a>)}
      </nav>
    </>}
    {!status?.active ? <>
      <section className="plus-subscription-banner" aria-labelledby="plus-subscription-title">
        <div className="plus-subscription-heading"><span className="plus-subscription-emblem"><PlusIcon name="crown" size={29}/></span>
          <div><span className="plus-subscription-eyebrow">TU MEMBRESÍA PERSONAL</span>
            <h2 id="plus-subscription-title">Descubre todo con Xamuko Plus</h2>
            <p>Radar, alertas, comparador, colecciones y rutas en una sola experiencia.</p>
          </div>
        </div>
        <div className="plus-subscription-action">
          <div className="plus-subscription-price"><strong>{formatCopPrice(PAID_PLAN_MONTHLY_COP.xamukoPlus)}</strong><span> COP / mes</span></div>
          {purchaseRequest ? <p className="plus-subscription-pending" role="status"><PlusIcon name="check" size={17}/> Solicitud registrada · pendiente de pago y activación</p>
            : <button type="button" className="plus-button plus-subscription-cta"
              disabled={loading || !status?.enabled || purchaseBusy}
              onClick={() => { setConfirmPurchase(true); setAcceptedTerms(false); }}>
                {status?.enabled ? 'Solicitar Xamuko Plus' : 'Adquisición no disponible'}
                <PlusIcon name="arrow-right" size={17}/>
              </button>}
          <small>No se cobrará dinero al enviar una solicitud. El pago en línea y la renovación automática aún no están habilitados.</small>
        </div>
      </section>
      {confirmPurchase && <section className="plus-purchase-confirm" aria-label="Confirmar solicitud de suscripción">
        <h2>Solicitar Xamuko Plus</h2>
        <p>Precio anunciado: <strong>{formatCopPrice(PAID_PLAN_MONTHLY_COP.xamukoPlus)} COP mensuales.</strong> Esta solicitud no constituye un pago ni activa automáticamente la membresía.</p>
        <label><input type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)}/>
          Acepto el precio mensual indicado y entiendo que el pago se gestionará por separado antes de activar el servicio.
        </label>
        <div className="plus-purchase-buttons">
          <button type="button" className="plus-button" onClick={() => void submitPurchaseRequest()}
            disabled={purchaseBusy || !acceptedTerms}>{purchaseBusy ? 'Enviando solicitud…' : 'Confirmar solicitud'}</button>
          <button type="button" className="plus-button plus-button-secondary" disabled={purchaseBusy}
            onClick={() => setConfirmPurchase(false)}>Cancelar</button>
        </div>
      </section>}
      <section className="plus-benefits" aria-label="Beneficios incluidos">
      <h2>Lo que incluye Plus</h2>
      <div className="plus-benefit-grid">{benefits.map(b => <article key={b.title}><span className="plus-benefit-icon"><PlusIcon name={b.icon} size={26}/></span><h3>{b.title}</h3><p>{b.description}</p></article>)}</div>
      <p className="plus-note">Los beneficios se activan solo después de verificar la suscripción. Las funciones gratuitas de Xamuko siguen disponibles para todos.</p>
      <button type="button" className="plus-button plus-button-secondary" disabled={loading} onClick={() => { setLoading(true); void reload().catch(() => setError('No pudimos actualizar la consulta.')).finally(() => setLoading(false)); }}>Verificar otra vez</button>
    </section></> : !data ? <section className="plus-panel plus-loading" role="status">
      <span className="plus-overline">TU MEMBRESÍA ESTÁ ACTIVA</span>
      <h2>{loading ? 'Preparando tus herramientas Plus…' : 'No pudimos cargar tus herramientas Plus'}</h2>
      <p>Los datos de tus negocios y precios deben verificarse con el servidor. No mostramos valores de ejemplo.</p>
      {!loading && <button type="button" className="plus-button" onClick={() => { setLoading(true); setError(''); void reload().catch(e => setError(e instanceof Error ? e.message : 'Error de conexión.')).finally(() => setLoading(false)); }}>Reintentar conexión</button>}
    </section> : <>
      <section className="plus-panel" id="radar" tabIndex={-1} aria-labelledby="plus-radar-heading">
        <div className="plus-heading"><div><span>01 · DESCUBRIMIENTO</span><h2 id="plus-radar-heading">Tu radar de novedades</h2><p>Novedades de tus negocios favoritos y avisos inmediatos o en un resumen diario.</p></div>
          <label className="plus-toggle"><input type="checkbox" checked={data?.preferences?.radarEnabled ?? false} disabled={busy}
            onChange={event => void run(() => savePlusPreferences({ radarEnabled: event.target.checked }))}/>Recibir avisos</label></div>
        <div className="plus-delivery-controls" aria-label="Frecuencia de notificaciones Plus">
          <label>¿Cómo quieres recibir los avisos?
            <select aria-label="Frecuencia de avisos Plus" disabled={busy}
              value={data?.preferences?.deliveryMode ?? 'IMMEDIATE'}
              onChange={event => {
                const mode = event.target.value as 'IMMEDIATE' | 'DAILY';
                // Read the verified saved schedule, not an initial browser placeholder.
                const zone = data?.preferences?.digestTimeZone ?? digestZone;
                const hour = data?.preferences?.digestHour ?? digestHour;
                if (mode === 'DAILY') { setDigestZone(zone); setDigestHour(hour); }
                void run(() => savePlusPreferences({ deliveryMode: mode,
                  ...(mode === 'DAILY' ? { digestTimeZone: zone, digestHour: hour } : {}) }),
                  'Preferencia de avisos actualizada.');
              }}>
              <option value="IMMEDIATE">Avisos inmediatos</option>
              <option value="DAILY">Un resumen diario</option>
            </select>
          </label>
          {data?.preferences?.deliveryMode === 'DAILY' && <form className="plus-digest-schedule"
            onSubmit={event => {
              event.preventDefault();
              const zone = digestZone.trim();
              try { new Intl.DateTimeFormat('es-CO', { timeZone: zone }).format(); }
              catch {
                setError('Ingresa una zona horaria válida, por ejemplo America/Bogota.');
                return;
              }
              void run(
                () => savePlusPreferences({ deliveryMode: 'DAILY', digestTimeZone: zone, digestHour }),
                'Horario de resumen diario guardado.');
            }}>
            <label>Zona horaria
              <input aria-label="Zona horaria del resumen" value={digestZone} maxLength={64}
                list="plus-zones" autoComplete="off"
                onChange={event => setDigestZone(event.target.value)} required placeholder="America/Bogota"/>
              <datalist id="plus-zones">
                {['America/Bogota', 'America/Panama', 'America/Lima', 'America/Guayaquil',
                  'America/Mexico_City', 'America/El_Salvador', 'America/Santiago',
                  'America/Argentina/Buenos_Aires', 'America/Sao_Paulo', 'Europe/Madrid', 'UTC']
                  .map(zone => <option key={zone} value={zone}/>)}
              </datalist>
            </label>
            <label>Hora local del resumen
              <select aria-label="Hora del resumen" value={digestHour}
                onChange={event => setDigestHour(Number(event.target.value))}>
                {Array.from({ length: 24 }, (_, hour) =>
                  <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}
              </select>
            </label>
            <button className="plus-button plus-button-secondary" type="submit" disabled={busy}>Guardar horario</button>
          </form>}
          <p>Los avisos se entregan en las notificaciones de Xamuko, no por correo. El resumen diario reúne novedades, rebajas y objetivos alcanzados de las categorías autorizadas.</p>
        </div>
        {!radarAvailable ? <p className="plus-empty">El radar está temporalmente fuera de servicio. Tus demás funciones Plus siguen disponibles.</p>
          : radar.length ? <div className="plus-list">{radar.map(item => <Link key={item.type + ':' + item.id} to={item.href} className="plus-list-row">
          <div className="plus-row-symbol plus-radar-avatar"><PlusIcon name="radar" size={19}/><CatalogPhoto src={item.businessProfilePhotoUrl ?? ""} alt={`Foto de perfil de ${item.business}`}/></div><span><strong>{item.title}</strong><small>{item.business} · {dateFormat(item.createdAt)}</small></span><span>Ver ›</span></Link>)}</div>
          : <div className="plus-empty"><strong>Tu radar está al día</strong><p>No hay publicaciones recientes de tus favoritos. Guarda negocios para seguir sus próximas novedades.</p><Link to="/favorites">Ver mis favoritos →</Link></div>}
      </section>

      <section className="plus-panel" id="prices" tabIndex={-1} aria-labelledby="plus-prices-heading">
        <div className="plus-heading"><div><span>02 · AHORRO</span><h2 id="plus-prices-heading">Seguimiento de precios</h2><p>Sigue cambios de precios, fija tus objetivos y recibe avisos cuando se alcancen.</p></div>
          <label className="plus-toggle"><input type="checkbox" checked={data?.preferences?.priceAlertsEnabled ?? false} disabled={busy}
            onChange={event => void run(() => savePlusPreferences({ priceAlertsEnabled: event.target.checked }))}/>Avisar cuando bajen</label></div>
        <p className="plus-feature-note">Puedes seguir hasta 100 publicaciones con precio numérico. Recibirás alertas de rebajas únicamente si las activas.</p>
        <div className="plus-follow-guide">
          <span className="plus-follow-guide-icon" aria-hidden="true"><PlusIcon name="price" size={25}/></span>
          <div><strong>Sigue precios con un solo toque</strong>
            <p>Abre la ficha de un producto o servicio con precio numérico publicado y pulsa <b>Seguir precio</b>. Aparecerá aquí automáticamente para consultar sus cambios.</p>
          </div>
          <Link className="plus-button plus-button-secondary" to="/results">Explorar productos</Link>
        </div>
        <div className="plus-list">{data?.watches.map(item => <div className="plus-list-row" key={item.id}>
          <span className="plus-row-symbol"><PlusIcon name="price" size={19}/></span><span><strong>{item.name}</strong><small>{item.businessName} · {item.available ? readablePrice(item.price, item.currency ?? 'COP') : 'Publicación no disponible'}</small></span>
          <div className="plus-row-buttons">
            {item.available && <button type="button" disabled={busy} onClick={() => void showPriceHistory(item.offerId)}>Historial</button>}
            {item.available && <button type="button" disabled={busy}
              aria-expanded={targetEditor === item.id} onClick={() => {
                setTargetEditor(targetEditor === item.id ? null : item.id);
                setTargetDraft(item.targetAmount ?? '');
              }}>{item.targetAmount ? 'Cambiar objetivo' : 'Fijar objetivo'}</button>}
            <button type="button" disabled={busy} onClick={() => void run(() => removePlusWatch(item.id))}>Quitar</button>
          </div>
          {item.targetAmount && <p className="plus-target-summary">Objetivo: {readablePrice(item.targetAmount, item.targetCurrency ?? item.currency ?? 'COP')}
            {item.targetNotifiedAt ? ' · Objetivo notificado' : ' · Alerta pendiente'}</p>}
          {targetEditor === item.id && <form className="plus-target-editor" onSubmit={event => {
            event.preventDefault(); void saveTarget(item.id);
          }}>
            <label>Precio objetivo ({item.currency ?? 'COP'})
              <input aria-label={`Precio objetivo de ${item.name}`} type="number" min="0.01" max="9999999999.99"
                step="0.01" value={targetDraft} onChange={event => setTargetDraft(event.target.value)}
                placeholder="Ej. 120000" required/>
            </label>
            <button type="submit" className="plus-button" disabled={busy}>Guardar objetivo</button>
            {item.targetAmount && <button type="button" className="plus-button plus-button-secondary" disabled={busy}
              onClick={() => void run(() => setPlusPriceTarget(item.id, null), 'Objetivo retirado.')
                .then(ok => { if (ok) setTargetEditor(null); })}>Quitar objetivo</button>}
            <small>Elige un precio menor que el actual. Recibirás un solo aviso cuando el producto alcance o baje de ese objetivo. Puedes cambiarlo para crear un objetivo nuevo.</small>
          </form>}
          </div>)}</div>
        {!data?.watches.length && <div className="plus-empty"><strong>Aún no sigues precios</strong><p>Explora los productos, abre uno con precio y pulsa «Seguir precio». No necesitas copiar ningún enlace.</p><Link to="/results">Encontrar un producto →</Link></div>}
        {history && <div className="plus-history"><h3>Historial de {history.offer.name}</h3>
          <p>Precio actual publicado: {readablePrice(history.offer.price, history.offer.currency ?? 'COP')}</p>
          {history.history.length ? <ul>{history.history.map((point, i) => <li key={point.createdAt + i}>{dateFormat(point.createdAt)} · {point.previousPrice === null ? 'Primer precio registrado' : readablePrice(point.previousPrice, point.previousCurrency ?? 'COP')} → {readablePrice(point.newPrice, point.currency ?? 'COP')}</li>)}</ul> : <p>Sin cambios registrados desde que se habilitó el historial.</p>}
          <button type="button" onClick={() => setHistory(null)}>Cerrar historial</button>
        </div>}
      </section>

      <section className="plus-panel" id="compare" tabIndex={-1} aria-labelledby="plus-compare-heading">
        <div className="plus-heading"><div><span>03 · COMPARACIÓN</span><h2 id="plus-compare-heading">Compara tus opciones</h2><p>Selecciona hasta cuatro productos o servicios publicados.</p></div></div>
        <p className="plus-feature-note">Elige de dos a cuatro publicaciones desde sus fichas; no tienes que copiar enlaces. Las opciones se conservan en esta pestaña mientras realizas la comparación.</p>
        <div className="plus-follow-guide">
          <span className="plus-follow-guide-icon" aria-hidden="true"><PlusIcon name="compare" size={25}/></span>
          <div><strong>Selecciona desde cada producto o servicio</strong><p>Abre su ficha y pulsa <b>Comparar precio</b>. Cada selección se añade aquí automáticamente, hasta cuatro opciones.</p></div>
          <Link className="plus-button plus-button-secondary" to="/results">Elegir publicaciones</Link>
        </div>
        {compareIds.length === 0 && <div className="plus-empty"><strong>Tu comparación está vacía</strong><p>Abre un producto o servicio y pulsa «Comparar precio». Puedes añadir hasta cuatro opciones.</p></div>}
        {compareIds.length > 0 && <><p className="plus-selection-caption">{compareIds.length} de 4 opciones seleccionadas</p><div className="plus-chips">{compareIds.map((id, i) => <button key={id} type="button" aria-label={`Quitar ${compareLabels[id] ?? `opción ${i + 1}`}`} onClick={() => updateCompareSelection(compareIds.filter(x => x !== id))}>{compareLabels[id] ?? `Opción ${i + 1}`} ×</button>)}</div>
          <button type="button" className="plus-button plus-clear-selection" disabled={busy} onClick={() => updateCompareSelection([])}>Eliminar selección</button>
          <button className="plus-button plus-button-secondary" type="button" disabled={busy || compareIds.length < 2}
            onClick={() => void showComparison()}>Comparar {compareIds.length} opciones</button></>}
        {comparison.length > 0 && <div className="plus-compare-grid">{comparison.map(item => {
          const place = comparisonBusinesses[item.business.publicId];
          const coordinates = place ? getBusinessCoordinates(place) : null;
          const distance = coordinates && selection?.coordinates
            ? distanceBetweenCoordinates(selection.coordinates, coordinates) : null;
          return <article key={item.id}>
            <span>{item.kind === 'PRODUCT' ? 'Producto' : 'Servicio'}</span><h3>{item.name}</h3><p>{item.business.name}</p>
            <strong>{item.negotiable ? 'Precio a convenir' : item.priceAmount !== null ? readablePrice(item.priceAmount, item.currency ?? 'COP') : item.priceText || 'Consultar'}</strong>
            <p>{item.description || 'Sin descripción publicada'}</p>
            <p><b>Ubicación:</b> {place?.address || place?.city || 'No verificada'}</p>
            <p><b>Calificación:</b> {place && place.reviewCount > 0 ? place.rating.toFixed(1) + ' / 5 (' + place.reviewCount + ')' : 'Sin calificaciones verificadas'}</p>
            <p><b>Distancia:</b> {distance !== null ? distance.toFixed(1) + ' km' : 'No disponible'}</p>
            <Link to={`/${item.kind === 'PRODUCT' ? 'product' : 'service'}/${item.id}`}>Ver detalle ›</Link>
          </article>;
        })}</div>}
      </section>

      <section className="plus-panel" id="collections" tabIndex={-1} aria-labelledby="plus-collections-heading">
        <div className="plus-heading"><div><span>04 · ORGANIZACIÓN</span><h2 id="plus-collections-heading">Tus colecciones</h2><p>Listas personales para guardar negocios, productos y servicios.</p></div></div>
        <form className="plus-form" onSubmit={event => { event.preventDefault(); if (collectionName.trim()) void run(() => createPlusCollection(collectionName.trim()), 'Colección creada.').then(ok => { if (ok) setCollectionName(''); }); }}>
          <label>Nombre de la colección<input value={collectionName} onChange={event => setCollectionName(event.target.value)} maxLength={80} placeholder="Ej. Mis cafés favoritos" required/></label><button className="plus-button" disabled={busy}>Crear colección</button>
        </form>
        <div className="plus-list">{data?.collections.map(col => <article key={col.id} className="plus-collection">
          <div className="plus-collection-head"><strong>{col.title}</strong>
            <div className="plus-collection-actions">
              <button type="button" className="plus-button plus-collection-add" disabled={busy || col.items.length >= 100}
                aria-expanded={collectionPicker === col.id} aria-controls={`plus-picker-${col.id}`}
                onClick={() => { setCollectionPicker(collectionPicker === col.id ? null : col.id); setPickerType('BUSINESS'); setPickerPage(1); }}>
                {collectionPicker === col.id ? 'Cerrar' : 'Agregar'}
              </button>
              <button type="button" disabled={busy} onClick={() => void run(() => removePlusCollection(col.id)).then(ok => { if (ok && collectionPicker === col.id) setCollectionPicker(null); })}>Eliminar</button>
            </div>
          </div>
          {collectionPicker === col.id && <div className="plus-collection-picker" id={`plus-picker-${col.id}`}>
            <p>Elige únicamente entre tus negocios favoritos y las publicaciones a las que diste «Me gusta».</p>
            <div className="plus-picker-types" role="group" aria-label="Origen de los elementos">
              <button type="button" className={pickerType === 'BUSINESS' ? 'selected' : ''} aria-pressed={pickerType === 'BUSINESS'}
                onClick={() => { setPickerType('BUSINESS'); setPickerPage(1); }}>Negocios favoritos</button>
              <button type="button" className={pickerType === 'OFFER' ? 'selected' : ''} aria-pressed={pickerType === 'OFFER'}
                onClick={() => { setPickerType('OFFER'); setPickerPage(1); }}>Productos y servicios con Me gusta</button>
            </div>
            {pickerLoading ? <p role="status">Consultando tus elementos guardados…</p>
              : pickerError ? <div className="plus-picker-empty"><p role="alert">{pickerError}</p>
                  <button type="button" className="plus-button plus-button-secondary" onClick={() => setPickerReload(value => value + 1)}>Reintentar consulta</button>
                </div>
              : pickerItems.length === 0 ? <div className="plus-picker-empty"><p>No tienes elementos disponibles en esta categoría.</p>
                  <Link to={pickerType === 'BUSINESS' ? '/favorites' : '/likes'}>Ver {pickerType === 'BUSINESS' ? 'mis negocios favoritos' : 'mis Me gusta'} →</Link>
                </div>
              : <div className="plus-picker-list">{pickerItems.map(item => {
                const exists = col.items.some(saved => saved.targetType === item.targetType && saved.targetId === item.targetId);
                return <div className="plus-picker-item" key={item.targetType + item.targetId}>
                  <span><strong>{item.name}</strong><small>{item.detail}</small></span>
                  <button type="button" disabled={busy || exists || col.items.length >= 100}
                    onClick={() => void run(() => addPlusCollectionItem(col.id, { targetType: item.targetType, targetId: item.targetId }), 'Guardado en tu colección.')}>
                    {exists ? 'Ya agregado' : 'Seleccionar'}
                  </button>
                </div>;
              })}</div>}
            {pickerTotalPages > 1 && <div className="plus-picker-pages">
              <button type="button" disabled={pickerPage === 1 || pickerLoading} onClick={() => setPickerPage(page => page - 1)}>Anterior</button>
              <span>Página {pickerPage} de {pickerTotalPages}</span>
              <button type="button" disabled={pickerPage >= pickerTotalPages || pickerLoading} onClick={() => setPickerPage(page => page + 1)}>Siguiente</button>
            </div>}
          </div>}
          <div className="plus-collection-items">{col.items.map(item => <div key={item.id}>
            {item.href ? <Link to={item.href}>{item.name} ›</Link> : <span>{item.name}</span>}
            <button type="button" disabled={busy} onClick={() => void run(() => removePlusCollectionItem(col.id, item.id))}>Quitar</button>
          </div>)}</div>
        </article>)}</div>
        {!data?.collections.length && <p className="plus-empty">Crea una colección para comenzar.</p>}
      </section>

      <section className="plus-panel" id="searches" tabIndex={-1} aria-labelledby="plus-searches-heading">
        <div className="plus-heading"><div><span>04 · ORGANIZACIÓN</span><h2 id="plus-searches-heading">Búsquedas guardadas</h2><p>Guarda una búsqueda que puedas repetir cuando quieras.</p></div></div>
        <form className="plus-form" onSubmit={event => {
          event.preventDefault();
          void run(() => createPlusSearch({
            title: savedTitle.trim(), query: savedQuery.trim(), category: savedCategory.trim() || null,
            city: currentCity, openNow: false, minRating: null, sort: 'recommended',
          }), 'Búsqueda guardada.').then(ok => { if (ok) { setSavedTitle(''); setSavedQuery(''); setSavedCategory(''); } });
        }}>
          <label>Nombre<input value={savedTitle} maxLength={80} onChange={event => setSavedTitle(event.target.value)} placeholder="Ej. Panaderías cerca" required/></label>
          <label>Buscar<input value={savedQuery} maxLength={160} onChange={event => setSavedQuery(event.target.value)} placeholder="Qué quieres encontrar" required/></label>
          <label>Categoría (opcional)<input value={savedCategory} maxLength={120} onChange={event => setSavedCategory(event.target.value)} placeholder="Ej. Restaurantes"/></label>
          <button className="plus-button" disabled={busy}>Guardar búsqueda</button>
        </form>
        <p className="plus-footnote">Las búsquedas se ejecutan en la zona que tengas seleccionada al abrirlas. Puedes cambiar tu ubicación en Xamuko.</p>
        <div className="plus-list">{data?.searches.map(item => <div key={item.id} className="plus-list-row"><span className="plus-row-symbol"><PlusIcon name="collection" size={19}/></span><span><strong>{item.title}</strong><small>{item.query}{item.city ? ' · Guardada en ' + item.city : ''}</small></span>
          <div className="plus-row-buttons"><Link to={searchHref(item)}>Buscar</Link><button type="button" disabled={busy} onClick={() => void run(() => removePlusSearch(item.id))}>Quitar</button></div>
        </div>)}</div>
      </section>

      <section className="plus-panel" id="routes" tabIndex={-1} aria-labelledby="plus-routes-heading">
        <div className="plus-heading"><div><span>05 · EXPLORACIÓN</span><h2 id="plus-routes-heading">Rutas con varios negocios</h2><p>Organiza hasta cuatro negocios por cercanía y revisa sus horarios antes de salir.</p></div></div>
        <div className="plus-routes-list">{availableFavorites.map(place => <label key={place.id}>
          <input type="checkbox" checked={routeIds.includes(place.id)} disabled={!routeIds.includes(place.id) && routeIds.length >= 4}
            onChange={() => setRouteIds(current => current.includes(place.id) ? current.filter(x => x !== place.id) : [...current, place.id])}/>
          <span>{place.name}</span></label>)}</div>
        {routeLoading ? <p className="plus-empty" role="status">Consultando tus negocios favoritos con ubicación pública…</p>
          : routeLoadError
          ? <div className="plus-empty"><strong>No fue posible consultar tus favoritos</strong><p>La consulta de las ubicaciones está temporalmente fuera de servicio. Tus demás funciones Plus siguen disponibles.</p><button type="button" className="plus-button plus-button-secondary" onClick={() => { setRouteLoadError(false); setRouteLoading(true); void fetchPlusRouteFavorites().then(result => { setPlaces(result.items); setRouteLoading(false); }).catch(() => { setRouteLoadError(true); setRouteLoading(false); }); }}>Reintentar consulta</button></div>
          : !availableFavorites.length && <div className="plus-empty"><strong>Tu ruta comienza con tus favoritos</strong><p>Guarda al menos dos negocios con ubicación pública para armar un recorrido.</p><Link to="/favorites">Ver mis favoritos →</Link></div>}
        {!!availableFavorites.length && <div className="plus-route-selection"><p className="plus-selection-caption">{routeIds.length} de 4 negocios seleccionados</p>
          {routeIds.length > 0 && <button type="button" className="plus-button plus-clear-selection" onClick={() => setRouteIds([])}>Limpiar ruta</button>}
        </div>}
        <div className="plus-route-actions">
          <label>Transporte <select value={travelMode} onChange={event => setTravelMode(event.target.value as 'driving' | 'walking')}><option value="driving">En vehículo</option><option value="walking">A pie</option></select></label>
          <label>Salida prevista
            <input aria-label="Fecha y hora de salida" type="datetime-local" value={visitAt}
              onChange={event => setVisitAt(event.target.value)}/>
          </label>
          <button type="button" className="plus-button plus-button-secondary" disabled={routeIds.length < 2}
            onClick={() => setRouteOptimized(value => !value)}>
            {routeOptimized ? 'Usar orden de selección' : 'Optimizar recorrido'}
          </button>
          {routeUrl ? <a className="plus-button" href={routeUrl} target="_blank" rel="noopener noreferrer">Abrir ruta en Google Maps</a> : <span>Selecciona al menos dos negocios.</span>}
        </div>
        {routeEstimates.length >= 2 && <div className="plus-route-itinerary">
          <strong>{routeOptimized ? 'Recorrido optimizado por cercanía geográfica' : 'Recorrido en el orden elegido'}</strong>
          <ol>{routeEstimates.map(estimate => <li key={estimate.stop.id}>
            <span>{estimate.stop.name} · llegada aproximada {new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(estimate.arrivalAt)}</span>
            <small className={estimate.hoursStatus === 'CLOSED' ? 'plus-closed-warning' : ''}>
              {estimate.hoursStatus === 'CLOSED' ? 'Advertencia: cerrado según horario publicado' :
                estimate.hoursStatus === 'UNKNOWN' ? 'Horario no disponible para verificar apertura' :
                  'Abierto según horario publicado'}
            </small>
          </li>)}</ol>
        </div>}
        <p className="plus-footnote">La optimización minimiza distancias en línea recta entre hasta cuatro paradas, no tiempos de tráfico. Las horas de llegada son estimaciones orientativas (incluyen 20 minutos por negocio); verifica horarios y tráfico antes de salir. La ruta final se abre en Google Maps. Tu ubicación, si la compartes, se usa como origen.</p>
      </section>

      <section className="plus-panel plus-adfree" id="adfree" tabIndex={-1} aria-label="Beneficio de experiencia sin publicidad"><span aria-hidden="true"><PlusIcon name="ad-free" size={35}/></span><div><h2>06 · Experiencia sin anuncios</h2><p>Mientras Plus esté activo, se ocultan los espacios publicitarios de terceros. Los negocios y resultados públicos siguen visibles.</p></div></section>
    </>}
  </PageLayout>;
}

