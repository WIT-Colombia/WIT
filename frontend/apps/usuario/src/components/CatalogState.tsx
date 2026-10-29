export type CatalogState = 'loading' | 'ready' | 'error';

export function CatalogStateView({ state, hasResults, onRetry }: { state: CatalogState; hasResults: boolean; onRetry: () => void }) {
  if (state === 'loading') return <p role="status">Cargando negocios…</p>;
  if (state === 'error') return <div className="home-empty-state" role="alert"><h3>No pudimos cargar los negocios</h3><p>Revisa tu conexión e inténtalo nuevamente.</p><button type="button" onClick={onRetry}>Reintentar</button></div>;
  return hasResults ? null : <p role="status">No hay negocios disponibles.</p>;
}
