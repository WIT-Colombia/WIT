import type { FreeTierUsage } from '../services/adminApiClient';

export function comparableFreeTierPercent(usage: FreeTierUsage) {
  if (!Number.isFinite(usage.actual) || usage.limit === null || !Number.isFinite(usage.limit) || usage.limit <= 0) return null;
  return Math.min(100, Math.max(0, usage.actual / usage.limit * 100));
}

export function AwsFreeTierPanel({ state, usages, updatedAt, error }: { state: 'loading' | 'available' | 'empty' | 'unconfigured' | 'error'; usages: FreeTierUsage[]; updatedAt: string | null; error?: string }) {
  return <section aria-label="AWS Free Tier" className="finance-free-tier">
    <div className="page-heading"><div><p className="eyebrow">AWS · FREE TIER</p><h2>Uso gratuito</h2></div><span>{updatedAt ? `Actualizado: ${new Date(updatedAt).toLocaleString('es-CO')}` : 'Sin actualización'}</span></div>
    {state === 'loading' && <p role="status">Cargando uso de Free Tier…</p>}
    {state === 'error' && <p role="alert">{error || 'No se pudo consultar Free Tier.'}</p>}
    {(state === 'empty' || state === 'unconfigured') && <p data-testid="free-tier-unavailable">No disponible automáticamente.</p>}
    {state === 'available' && <div className="finance-free-tier-grid">{usages.map(usage => { const percent = comparableFreeTierPercent(usage); return <article key={`${usage.service}:${usage.usageType}:${usage.region}`} className="finance-card"><h3>{usage.service}</h3><p>{usage.region} · {usage.unit}</p><strong>{usage.actual} {usage.unit}</strong><p>Previsto: {usage.forecasted ?? '—'} · Límite: {usage.limit ?? '—'}</p>{percent !== null && <><progress max="100" value={percent} aria-label={`${usage.service} porcentaje usado`} /><small>{percent.toFixed(1)}% utilizado</small></>}{percent !== null && percent >= 85 && <p role="alert">Consumo cercano al límite gratuito.</p>}</article>; })}</div>}
  </section>;
}
