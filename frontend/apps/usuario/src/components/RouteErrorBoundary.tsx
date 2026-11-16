import { Component, type ErrorInfo, type ReactNode } from 'react';
import './RouteErrorBoundary.css';

const RECOVERY_WINDOW_MS = 2 * 60 * 1000;

/**
 * The HTML shell can outlive a Cloudflare deployment. A lazy() import from
 * the previous release may refer to a chunk that is no longer available.
 * A hard refresh re-fetches the current HTML manifest while retaining the URL.
 */
export function isRouteChunkLoadError(error: unknown): boolean {
  const detail = error instanceof Error ? error.name + ' ' + error.message : String(error ?? '');
  return /ChunkLoadError|Loading (?:CSS )?chunk [^ ]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script|error loading dynamically imported module|Unable to preload CSS/i.test(detail);
}

/** Limit recovery to one automatic hard refresh per URL in a short window. */
export function shouldAutoReloadRoute(error: unknown, previousAttempt: number | null, now: number): boolean {
  if (!isRouteChunkLoadError(error)) return false;
  return previousAttempt === null || !Number.isFinite(previousAttempt) || now - previousAttempt > RECOVERY_WINDOW_MS;
}

type Props = { children: ReactNode };
type State = { error: Error | null };

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error('Error inesperado al abrir la página') };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Keep a diagnostic in the browser console without including user/session data.
    console.error('[xamuko/navigation] No se pudo abrir la vista.', error, info.componentStack);
    if (!isRouteChunkLoadError(error)) return;
    const key = 'xamuko:route-reload:' + window.location.pathname + window.location.search;
    try {
      const stored = window.sessionStorage.getItem(key);
      const last = stored === null ? null : Number(stored);
      if (!shouldAutoReloadRoute(error, last, Date.now())) return;
      window.sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // No reliable persisted guard: never reload automatically in a loop.
      return;
    }
    // Reload only after a failed lazy import; no reload for ordinary navigation.
    window.location.reload();
  }

  render() {
    if (this.state.error) return <main className="xamuko-route-recovery" role="alert">
      <img src="/brand/xamuko-lockup.png" alt="XAMUKO" width="2170" height="725" />
      <h1>No pudimos abrir esta página</h1>
      <p>Puede que el sitio se haya actualizado mientras navegabas. Puedes volver a cargarla sin perder la dirección.</p>
      <div className="xamuko-route-recovery__actions">
        <button type="button" onClick={() => window.location.reload()}>Reintentar</button>
        <a href="/home">Volver al inicio</a>
      </div>
    </main>;
    return this.props.children;
  }
}
