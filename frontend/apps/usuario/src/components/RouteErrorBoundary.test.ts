import { describe, expect, it } from 'vitest';
import { isRouteChunkLoadError, shouldAutoReloadRoute } from './RouteErrorBoundary';

describe('Recuperación de navegación de XAMUKO Usuarios', () => {
  it('reconoce fallos reales de importación diferida', () => {
    expect(isRouteChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://user.xamuko.com/assets/Home-old.js'))).toBe(true);
    expect(isRouteChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isRouteChunkLoadError(new Error('ChunkLoadError: Loading chunk 324 failed.'))).toBe(true);
  });

  it('no convierte errores normales o respuestas del backend en recargas', () => {
    expect(isRouteChunkLoadError(new Error('No se pudo cargar el catálogo'))).toBe(false);
    expect(shouldAutoReloadRoute(new Error('HTTP 401'), null, 1000)).toBe(false);
  });

  it('recarga una sola vez por URL y permite recuperarse en una visita posterior', () => {
    const error = new TypeError('Failed to fetch dynamically imported module: /assets/Results-old.js');
    expect(shouldAutoReloadRoute(error, null, 100_000)).toBe(true);
    expect(shouldAutoReloadRoute(error, 99_900, 100_000)).toBe(false);
    expect(shouldAutoReloadRoute(error, 99_900, 220_001)).toBe(true);
  });
});
