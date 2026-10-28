import { useEffect, useState } from 'react';
import { BusinessProBenefitsDialog } from '../components/business/BusinessProBenefitsDialog';
import { BusinessProfileThumbnail } from '../components/layout/Sidebar';
import { developmentReferralTestFor, recognitionLevelFor, recognitionLevels } from '../config/businessRecognition';
import { freeCards, periods, proCards, referralCards, type Period } from '../config/statisticsDashboard';
import { businessApi, type BusinessStatisticsDashboard, type OfferViewRanking } from '../services/businessApiClient';
import { useBusinessStore } from '../services/businessStore';
import './StatisticsDashboardV1.css';

type Point = { label: string; value: number };
const number = (value: number) => value.toLocaleString('es-CO', { maximumFractionDigits: 1 });
function change(current: number, previous: number | undefined) {
  if (previous === undefined || previous === 0) return null;
  return Math.round((current - previous) / previous * 100);
}
function FreeCardIcon({ icon, metric }: { icon: string; metric: string }) {
  if (metric === 'searchAppearances') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6" /><path d="m15.8 15.8 5 5" /></svg>;
  if (metric === 'whatsappClicks') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11.7a8 8 0 0 1-11.8 7l-4.1 1.1 1.1-4A8 8 0 1 1 20 11.7Z" /><path d="M8.7 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.8 1.8c.1.2.1.4 0 .6l-.5.7c.6 1.2 1.5 2.1 2.7 2.7l.7-.5c.2-.1.4-.1.6 0l1.8.8c.3.1.4.3.4.5v.5c0 .3 0 .6-.5.8-.5.2-1.7.4-3.7-.5-1.2-.5-2.3-1.4-3.2-2.3-.9-.9-1.8-2-2.3-3.2-.9-2-.7-3.2-.5-3.7Z" /></svg>;
  return <>{icon}</>;
}
function Sparkline({ points, color = '#7b3ffb' }: { points: Point[]; color?: string }) {
  if (!points.length || points.every(point => point.value === 0)) return <span className="stats-v1-no-chart">Sin actividad para graficar</span>;
  const max = Math.max(1, ...points.map(point => point.value));
  const coords = points.map((point, index) => `${8 + index * 144 / Math.max(1, points.length - 1)},${47 - point.value / max * 35}`).join(' ');
  return <svg className="stats-v1-sparkline" viewBox="0 0 160 54" role="img" aria-label={points.map(point => `${point.label}: ${number(point.value)}`).join('; ')}>
    <line x1="8" y1="48" x2="152" y2="48" stroke="#e4e9f3" />
    <polyline points={coords} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    {points.length === 1 && <circle cx="8" cy={47 - points[0].value / max * 35} r="3" fill={color} />}
  </svg>;
}
function Bars({ points }: { points: Point[] }) {
  if (!points.some(point => point.value > 0)) return <span className="stats-v1-no-chart">Sin actividad registrada</span>;
  const max = Math.max(...points.map(point => point.value), 1);
  return <div className="stats-v1-bars" role="img" aria-label={points.map(point => `${point.label}: ${number(point.value)}`).join('; ')}>
    {points.map(point => <span key={point.label} title={`${point.label}: ${number(point.value)}`}><i style={{ height: `${Math.max(3, point.value / max * 100)}%` }} /></span>)}
  </div>;
}
function DataTable({ points }: { points: Point[] }) {
  if (!points.length) return null;
  return <details className="stats-v1-data"><summary>Ver datos</summary><div><table><thead><tr><th scope="col">Período</th><th scope="col">Valor</th></tr></thead><tbody>{points.map(point => <tr key={point.label}><th scope="row">{point.label}</th><td>{number(point.value)}</td></tr>)}</tbody></table></div></details>;
}
async function countPublishedReviewsInWindow(businessId: string, start: string | null, end: string) {
  const firstPage = await businessApi.listReviews(businessId, 1, 50);
  const distribution = [1, 2, 3, 4, 5].map(rating => ({ rating, count: firstPage.summary.distribution[String(rating)] ?? 0 }));
  if (!start) return { periodCount: firstPage.summary.total, total: firstPage.summary.total, distribution };
  const remainingPages = firstPage.pagination.totalPages > 1
    ? await Promise.all(Array.from({ length: firstPage.pagination.totalPages - 1 }, (_, index) => businessApi.listReviews(businessId, index + 2, 50)))
    : [];
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const periodCount = [firstPage, ...remainingPages]
    .flatMap(page => page.reviews)
    .filter(review => {
      const publishedAt = new Date(review.createdAt).getTime();
      return publishedAt >= startTime && publishedAt < endTime;
    }).length;
  return { periodCount, total: firstPage.summary.total, distribution };
}
function RatingDistribution({ distribution, total }: { distribution: Array<{ rating: number; count: number }>; total: number }) {
  if (total === 0) return <p className="stats-v1-rating-empty">Aún no tienes opiniones publicadas.</p>;
  return <div className="stats-v1-rating-distribution" role="img" aria-label={distribution.map(row => `${row.rating} estrellas: ${row.count} opiniones`).join('; ')}>{[...distribution].reverse().map(row => {
    const percentage = Math.round(row.count / total * 100);
    return <div className="stats-v1-rating-row" key={row.rating}><span>{row.rating} ★</span><i><b style={{ width: `${percentage}%` }} /></i><small>{row.count} · {percentage}%</small></div>;
  })}</div>;
}
function HorizontalRanking({ points, emptyMessage }: { points: Point[]; emptyMessage: string }) {
  const rows = points.slice(0, 5);
  if (!rows.length) return <p className="stats-v1-pro-ranking-empty">{emptyMessage}</p>;
  const max = Math.max(...rows.map(row => row.value), 1);
  return <div className="stats-v1-pro-ranking" role="img" aria-label={rows.map(row => `${row.label}: ${number(row.value)}`).join('; ')}>{rows.map(row => <div className="stats-v1-pro-ranking-row" key={row.label} title={row.label}><span>{row.label}</span><i><b style={{ width: `${row.value / max * 100}%` }} /></i><small>{number(row.value)}</small></div>)}</div>;
}
function proRanking(key: string, data: BusinessStatisticsDashboard, offerViews: OfferViewRanking | null): Point[] | null {
  if (!data.pro) return null;
  if (key === 'keywords') return data.pro.keywords;
  if (key === 'categoryPerformance') return data.pro.categoryPerformance;
  if (key === 'topProducts') return (offerViews?.productOffers ?? []).map(row => ({ label: row.name, value: row.value }));
  if (key === 'topServices') return (offerViews?.serviceOffers ?? []).map(row => ({ label: row.name, value: row.value }));
  return null;
}
function proContent(key: string, data: BusinessStatisticsDashboard) {
  const pro = data.pro;
  if (!pro) return null;
  if (key === 'viewEvolution') return { value: number(data.metrics.businessViews), points: data.trends.businessViews, kind: 'line' };
  if (key === 'searchEvolution') return { value: number(data.metrics.searchAppearances), points: data.trends.searchAppearances, kind: 'line' };
  if (key === 'uniqueVisitors') return { value: number(pro.uniqueVisitors) };
  if (key === 'repeatVisitors') return { value: number(pro.repeatVisitors) };
  if (key === 'contactRate') return pro.contactRate === null ? null : { value: `${number(pro.contactRate)} %` };
  if (key === 'interactionRate') return pro.interactionRate === null ? null : { value: `${number(pro.interactionRate)} %` };
  if (key === 'navigationRate') return pro.navigationRate === null ? null : { value: `${number(pro.navigationRate)} %` };
  if (key === 'hourlyActivity') return { value: number(data.metrics.businessViews), points: pro.hourlyActivity, kind: 'bar' };
  if (key === 'weekdayActivity') return { value: number(data.metrics.businessViews), points: pro.weekdayActivity, kind: 'bar' };
  if (key === 'visitOrigins') return { value: number(pro.visitOrigins.reduce((sum, point) => sum + point.value, 0)), points: pro.visitOrigins, kind: 'bar' };
  if (key === 'averagePosition') return pro.averagePosition === null ? null : { value: `#${number(pro.averagePosition)}` };
  if (key === 'favoriteEvolution') return { value: number(pro.favoriteAcquisitions.reduce((sum, point) => sum + point.value, 0)), points: pro.favoriteAcquisitions, kind: 'line' };
  if (key === 'ratingEvolution') return pro.ratingEvolution.length ? { value: `${number(pro.ratingEvolution.at(-1)!.value)} / 5`, points: pro.ratingEvolution, kind: 'line' } : null;
  if (key === 'featuredPerformance') return { value: pro.featuredPerformance.interactionRate === null ? number(pro.featuredPerformance.views) : `${number(pro.featuredPerformance.interactionRate)} %` };
  if (key === 'periodComparison') {
    const difference = change(data.metrics.businessViews, data.previous?.businessViews);
    return difference === null ? null : { value: `${difference > 0 ? '+' : ''}${difference} %`, points: data.trends.businessViews, kind: 'line' };
  }
  return null;
}

export function StatisticsDashboardV1() {
  const { business } = useBusinessStore();
  const [period, setPeriod] = useState<Period>('month');
  const [periodReadyKey, setPeriodReadyKey] = useState<string | null>(null);
  const periodStorageKey = business.id ? `xamuko:business:${business.id}:statistics-period` : null;
  const [data, setData] = useState<BusinessStatisticsDashboard | null>(null);
  const [favoriteCount, setFavoriteCount] = useState<number | null>(null);
  const [offerLikeCount, setOfferLikeCount] = useState<number | null>(null);
  const [reviewStatistics, setReviewStatistics] = useState<{ periodCount: number; total: number; distribution: Array<{ rating: number; count: number }> } | null>(null);
  const [reviewCountError, setReviewCountError] = useState(false);
  const [offerViewRanking, setOfferViewRanking] = useState<OfferViewRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [referralHelp, setReferralHelp] = useState(false);
  const [proHelp, setProHelp] = useState(false);
  useEffect(() => {
    setPeriodReadyKey(null);
    setPeriod('month');
    if (!periodStorageKey) return;
    try {
      const stored = localStorage.getItem(periodStorageKey);
      const valid = periods.some(item => item.id === stored);
      setPeriod(valid ? stored as Period : 'month');
    } catch {
      setPeriod('month');
    }
    setPeriodReadyKey(periodStorageKey);
  }, [periodStorageKey]);
  useEffect(() => {
    if (!periodStorageKey || periodReadyKey !== periodStorageKey) return;
    try { localStorage.setItem(periodStorageKey, period); } catch { /* Storage may be unavailable in private contexts. */ }
  }, [period, periodReadyKey, periodStorageKey]);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setLoading(true); setError(false);
    if (!business.id) { setLoading(false); setError(true); return () => controller.abort(); }
    void businessApi.getStatisticsDashboard(business.id, period, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [business.id, period, retry]);
  useEffect(() => {
    const controller = new AbortController();
    setOfferViewRanking(null);
    if (!business.id) return () => controller.abort();
    void businessApi.getOfferViewRanking(business.id, period, controller.signal)
      .then(result => { if (!controller.signal.aborted) setOfferViewRanking(result); })
      .catch(() => { /* The card reports a neutral unavailable state without affecting other statistics. */ });
    return () => controller.abort();
  }, [business.id, period, retry]);
  useEffect(() => {
    let cancelled = false;
    setFavoriteCount(null);
    setOfferLikeCount(null);
    if (!business.id) return () => { cancelled = true; };
    void Promise.allSettled([
      businessApi.getFavoriteCount(business.id),
      businessApi.getOfferLikeCounts(business.id),
    ]).then(([favorites, offerLikes]) => {
      if (cancelled) return;
      if (favorites.status === 'fulfilled') setFavoriteCount(favorites.value.count);
      if (offerLikes.status === 'fulfilled') setOfferLikeCount(offerLikes.value.offers.reduce((total, offer) => total + offer.likeCount, 0));
    });
    return () => { cancelled = true; };
  }, [business.id, retry]);
  useEffect(() => {
    let cancelled = false;
    setReviewStatistics(null);
    setReviewCountError(false);
    if (!business.publicId || !data) return () => { cancelled = true; };
    void countPublishedReviewsInWindow(business.publicId, data.window.start, data.window.end)
      .then(summary => { if (!cancelled) setReviewStatistics(summary); })
      .catch(() => { if (!cancelled) setReviewCountError(true); });
    return () => { cancelled = true; };
  }, [business.publicId, data]);

  const testReferrals = developmentReferralTestFor(business.name);
  const testLevel = testReferrals === null ? null : recognitionLevelFor(testReferrals);
  const testLevelIndex = testLevel ? recognitionLevels.findIndex(item => item.level === testLevel.level) : -1;
  const testNextLevel = testLevelIndex >= 0 ? recognitionLevels[testLevelIndex + 1] : null;
  const access = data?.access ? testReferrals === null ? data.access : { ...data.access, referralCount: testReferrals, nextLevel: testNextLevel?.level ?? null, nextLevelMinimum: testNextLevel?.min ?? null, unlockedReferralStatistics: testLevelIndex, referralsUnlocked: testLevelIndex > 0 } : undefined;
  const level = access ? recognitionLevelFor(access.referralCount) : null;
  const unlockedReferralStatistics = access?.unlockedReferralStatistics ?? (level ? Math.max(0, ['BASIC', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'].indexOf(level.level)) : 0);
  const nextLevelMinimum = access?.nextLevelMinimum ?? null;
  const from = data?.window.start ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: data.timezone }).format(new Date(data.window.start)) : null;
  const periodLabel = data ? data.period === 'all' ? 'Todo el historial' : `Desde ${from}` : 'Período seleccionado';
  const availablePro = data?.access.proUnlocked && Boolean(data.pro);
  return <div className="stats-v1">
    <header className="stats-v1-heading">
      <span>ANÁLISIS COMERCIAL {testReferrals !== null && <b className="stats-v1-test-badge">MODO PRUEBA</b>}</span>
      <h1>Estadísticas de tu negocio</h1>
      <p>Conoce el rendimiento de {business.name || 'tu negocio'} en XAMUKO.</p>
      <div className="stats-v1-periods" role="group" aria-label="Período de estadísticas">{periods.map(item => <button type="button" key={item.id} className={period === item.id ? 'selected' : ''} aria-pressed={period === item.id} onClick={() => setPeriod(item.id)}>{item.label}</button>)}</div>
      <small>{periodLabel} · Zona horaria: Bogotá</small>
    </header>
    {error && <div className="stats-v1-error" role="alert">No pudimos cargar las estadísticas de este negocio. <button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div>}
    <section className="stats-v1-context" aria-label="Negocio y derechos actuales">
      <div><span className="stats-v1-context-icon"><BusinessProfileThumbnail business={business} /></span><div><small>NEGOCIO SELECCIONADO</small><strong>{business.name || 'Sin negocio seleccionado'}</strong></div></div>
      <div><span className="stats-v1-context-icon purple">♛</span><div><small>PLAN COMERCIAL</small><strong>{loading ? 'Cargando…' : error ? 'No disponible' : access?.proUnlocked ? 'Business PRO' : 'Plan básico'}</strong><span>{access?.proUnlocked ? 'Acceso vigente' : error ? 'No se pudo verificar el plan' : 'Estadísticas PRO disponibles con un plan vigente'}</span></div></div>
      <div><span className="stats-v1-context-icon blue">★</span><div><small>NIVEL DE RECONOCIMIENTO</small><strong>{loading ? 'Cargando…' : level?.name ?? 'No disponible'}</strong><span>{access ? `${access.referralCount} referidos válidos` : 'Sin información'}</span></div></div>
    </section>

    <section className="stats-v1-section stats-v1-free" aria-labelledby="stats-v1-free-title">
      <div className="stats-v1-section-head"><div><span className="stats-v1-section-icon">◉</span><div><h2 id="stats-v1-free-title">Resumen de actividad <small>5 estadísticas gratuitas</small></h2><p>Métricas básicas disponibles para todos los negocios.</p></div></div></div>
      <div className="stats-v1-grid">{freeCards.map(card => {
        const key = card.key;
        const value = data?.metrics[key];
        const previous = data?.previous?.[key];
        const delta = value === undefined ? null : change(value, previous);
        const points = data?.trends[key] ?? [];
        return <article className="stats-v1-card" key={key} aria-busy={loading}>
          <div className="stats-v1-card-top"><span className="stats-v1-card-icon"><FreeCardIcon metric={key} icon={card.icon} /></span><h3>{card.label}</h3></div>
          <div className="stats-v1-number">{loading ? '…' : value === undefined ? '—' : number(value)}{delta !== null && <small className={delta >= 0 ? 'up' : 'down'}>{delta > 0 ? '+' : ''}{delta} %</small>}</div>
          <p className="stats-v1-description">{card.caption}</p>
          <Sparkline points={points} color={key === 'whatsappClicks' ? '#16a34a' : '#7b3ffb'} />
          <DataTable points={points} />
        </article>;
      })}</div>
    </section>

    <section className="stats-v1-section stats-v1-referrals" aria-labelledby="stats-v1-referral-title">
      <div className="stats-v1-section-head"><div><span className="stats-v1-section-icon">♧</span><div><h2 id="stats-v1-referral-title">Estadísticas por referidos <small>5 estadísticas adicionales</small></h2><p>{access && unlockedReferralStatistics > 0 ? `${unlockedReferralStatistics} de 5 estadísticas desbloqueadas.` : 'Desbloquea estadísticas al alcanzar cada nivel de reconocimiento.'}</p></div></div><button type="button" onClick={() => setReferralHelp(value => !value)}>Ver cómo funciona →</button></div>
      <div className="stats-v1-progress" aria-label={access ? (nextLevelMinimum === null ? `${access.referralCount} referidos válidos. Nivel máximo alcanzado.` : `${access.referralCount} de ${nextLevelMinimum} referidos válidos para ${access.nextLevel}`) : 'Progreso no disponible'}><strong>{access ? (nextLevelMinimum === null ? `${access.referralCount} referidos · Nivel Diamante` : `${access.referralCount} de ${nextLevelMinimum} para ${access.nextLevel === 'BRONZE' ? 'Bronce' : access.nextLevel === 'SILVER' ? 'Plata' : access.nextLevel === 'GOLD' ? 'Oro' : 'Platino'}`) : 'Sin información'}</strong><span><i style={{ width: `${access && nextLevelMinimum ? Math.min(100, access.referralCount / nextLevelMinimum * 100) : 100}%` }} /></span></div>
      {referralHelp && <p className="stats-v1-help">Los referidos válidos se validan en el servidor. Cada nivel desbloquea una estadística adicional: Bronce 1, Plata 2, Oro 3, Platino 4 y Diamante 5. Las métricas sin medición implementada muestran «Medición pendiente».</p>}
      <div className="stats-v1-grid">{referralCards.map(card => {
        const cardIndex = referralCards.findIndex(item => item.key === card.key);
        const unlocked = cardIndex < unlockedReferralStatistics;
        const isCurrentFavorites = cardIndex === 0;
        const isCurrentOfferLikes = cardIndex === 1;
        const isPeriodReviewCount = cardIndex === 2;
        const isRatingDistribution = cardIndex === 3;
        const isOfferViews = cardIndex === 4;
        const currentFavorites = favoriteCount ?? data?.metrics.currentFavorites;
        const currentOfferLikes = offerLikeCount ?? data?.referral?.offerLikes;
        const periodReviewCount = reviewStatistics?.periodCount ?? data?.referral?.reviewsCount;
        const currentStateMetric = isCurrentFavorites || isCurrentOfferLikes || isPeriodReviewCount;
        const currentStateValue = isCurrentFavorites ? currentFavorites : isCurrentOfferLikes ? currentOfferLikes : periodReviewCount;
        const metricUnavailable = isPeriodReviewCount && reviewCountError && currentStateValue === undefined;
        const currentStateLabel = number(currentStateValue ?? 0);
        if (isOfferViews) return <article className={`stats-v1-card stats-v1-referral-card stats-v1-offer-views ${unlocked ? '' : 'locked'}`} key={card.key}>
          <div className="stats-v1-card-top"><span className="stats-v1-card-icon">{unlocked ? '◉' : '♙'}</span><h3>{card.label}</h3></div>
          {!unlocked ? <><div className="stats-v1-number">Bloqueada</div><p className="stats-v1-description">Requiere nivel {card.requiredLevel} ({card.requiredMinimum} referidos válidos).</p></> : loading || !offerViewRanking ? <><div className="stats-v1-number">Cargando…</div><p className="stats-v1-description">Aperturas de productos y servicios durante el período elegido.</p></> : offerViewRanking.offers.length === 0 ? <><div className="stats-v1-number">0</div><p className="stats-v1-description">Aperturas de productos y servicios durante el período elegido.</p></> : <><p className="stats-v1-description">Productos y servicios que más personas abrieron para ver su detalle.</p><ol className="stats-v1-offer-ranking">{offerViewRanking.offers.map((offer, index) => <li key={offer.offerId}><span><b>{index + 1}. {offer.name}</b><small>{offer.kind === 'PRODUCT' ? 'Producto' : 'Servicio'}</small></span><strong>{number(offer.value)}</strong></li>)}</ol></>}
        </article>;
        if (isRatingDistribution) return <article className={`stats-v1-card stats-v1-referral-card stats-v1-rating-card ${unlocked ? '' : 'locked'}`} key={card.key}>
          <div className="stats-v1-card-top"><span className="stats-v1-card-icon">{unlocked ? '◉' : '♙'}</span><h3>{card.label}</h3></div>
          {!unlocked ? <><div className="stats-v1-number">Bloqueada</div><p className="stats-v1-description">Requiere nivel {card.requiredLevel} ({card.requiredMinimum} referidos válidos).</p></> : loading || !reviewStatistics ? <><div className="stats-v1-number">Cargando…</div><p className="stats-v1-description">Opiniones públicas vigentes, agrupadas por la puntuación que recibiste.</p></> : reviewCountError ? <><div className="stats-v1-number">No disponible</div><p className="stats-v1-description">No pudimos consultar tus opiniones públicas en este momento.</p></> : <><p className="stats-v1-description">Opiniones públicas vigentes, agrupadas por la puntuación que recibiste.</p><RatingDistribution distribution={reviewStatistics.distribution} total={reviewStatistics.total} /></>}
        </article>;
        return <article className={`stats-v1-card stats-v1-referral-card ${unlocked ? '' : 'locked'}`} key={card.key}>
          <div className="stats-v1-card-top"><span className="stats-v1-card-icon">{unlocked ? '◉' : '♙'}</span><h3>{card.label}</h3></div>
          <div className="stats-v1-number">{loading || (currentStateMetric && currentStateValue === undefined && !metricUnavailable) ? 'Cargando…' : error || metricUnavailable ? 'No disponible' : !unlocked ? 'Bloqueada' : currentStateMetric ? currentStateLabel : 'Medición pendiente'}</div>
          <p className="stats-v1-description">{!unlocked ? `Requiere nivel ${card.requiredLevel} (${card.requiredMinimum} referidos válidos).` : isCurrentFavorites ? 'Personas que actualmente tienen guardado tu negocio.' : isCurrentOfferLikes ? 'Me gusta activos en tus productos y servicios.' : isPeriodReviewCount ? 'Opiniones publicadas recibidas durante el período elegido.' : 'Aún no tiene una medición disponible.'}</p>
        </article>;
      })}</div>
    </section>

    <section className="stats-v1-section stats-v1-pro" aria-labelledby="stats-v1-pro-title">
      <div className="stats-v1-section-head"><div><span className="stats-v1-section-icon">♛</span><div><h2 id="stats-v1-pro-title">Estadísticas PRO <small>20 estadísticas exclusivas</small></h2><p>Análisis avanzado respaldado por datos reales, con fuentes pendientes claramente marcadas.</p></div></div>{!loading && !error && !availablePro && <button type="button" onClick={() => setProHelp(true)}>Ver Business PRO →</button>}</div>
      <div className="stats-v1-pro-grid">{proCards.map(card => {
        const content = availablePro && data ? proContent(card.key, data) : null;
        const ranking = availablePro && data ? proRanking(card.key, data, offerViewRanking) : null;
        const isRanking = ranking !== null;
        const isCommercialIndex = card.key === 'commercialIndex';
        const hasNoRatingHistory = card.key === 'ratingEvolution' && availablePro && data && content === null;
        const points = content && 'points' in content ? content.points : undefined;
        if (isRanking) return <article className={`stats-v1-card stats-v1-pro-card stats-v1-pro-ranking-card ${availablePro ? '' : 'locked'}`} key={card.key}>
          <h3>{card.label}</h3>
          <p className="stats-v1-description">{!availablePro ? 'Disponible con una suscripción Business PRO vigente.' : card.source}</p>
          {!availablePro ? <strong>Bloqueada</strong> : <HorizontalRanking points={ranking} emptyMessage={card.key === 'keywords' ? 'Aún no hay búsquedas registradas.' : card.key === 'categoryPerformance' ? 'Aún no hay actividad por categoría.' : 'Aún no hay aperturas registradas.'} />}
          {availablePro && card.contextualHistory && <span className="stats-v1-contextual-history">Disponible desde la activación de la analítica contextual</span>}
        </article>;
        if (isCommercialIndex) return <article className={`stats-v1-card stats-v1-pro-card stats-v1-commercial-index ${availablePro ? '' : 'locked'}`} key={card.key}>
          <h3>{card.label}</h3>
          <strong>{loading ? 'Cargando…' : error ? 'No disponible' : !availablePro ? 'Bloqueada' : 'Aún no hay datos comparables suficientes'}</strong>
          <p className="stats-v1-description">{!availablePro ? 'Disponible con una suscripción Business PRO vigente.' : card.source}</p>
        </article>;
        return <article className={`stats-v1-card stats-v1-pro-card ${availablePro ? '' : 'locked'}`} key={card.key}>
          <h3>{card.label}</h3>
          <strong>{loading ? 'Cargando…' : error ? 'No disponible' : !availablePro ? 'Bloqueada' : hasNoRatingHistory ? 'Sin calificaciones en este período' : content ? content.value : 'Medición pendiente'}</strong>
          <p className="stats-v1-description">{!availablePro ? 'Disponible con una suscripción Business PRO vigente.' : card.source}</p>
          {points && content && ('kind' in content && content.kind === 'bar' ? <Bars points={points} /> : <Sparkline points={points} />)}
          {points && <DataTable points={points} />}
          {availablePro && card.key === 'ratingEvolution' && data?.period === 'all' && <span className="stats-v1-history-note">Todo el tiempo muestra los últimos 24 meses.</span>}
          {availablePro && card.contextualHistory && <span className="stats-v1-contextual-history">Disponible desde la activación de la analítica contextual</span>}
        </article>;
      })}</div>
    </section>
    {proHelp && <BusinessProBenefitsDialog onClose={() => setProHelp(false)} />}
  </div>;
}
