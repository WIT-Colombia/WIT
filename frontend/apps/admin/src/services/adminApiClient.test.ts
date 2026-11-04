import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@wit/utils', () => ({
  API_BASE_URL: 'https://api.xamuko.com/api/v1',
  buildApiUrl: (path: string) => 'https://api.xamuko.com/api/v1' + path,
}));

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('sesión administrativa entre subdominios', () => {
  it('recupera CSRF al recargar y lo envía con cookies al cerrar sesión', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: true, userId: 'admin', csrfToken: 'api-csrf-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    const api = await import('./adminApiClient');
    await api.getAdminSession();
    await api.adminSessionLogout();
    const [url, init] = fetcher.mock.calls[1]!;
    expect(url).toBe('https://api.xamuko.com/api/v1/admin/auth/logout');
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).get('X-Admin-CSRF')).toBe('api-csrf-token');
  });

  it('usa el CSRF del login para las operaciones protegidas', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ admin: { role: 'SUPER_ADMIN' }, csrfToken: 'login-csrf-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const api = await import('./adminApiClient');
    await api.adminLogin('admin@example.test', 'ci-only-password', false);
    await api.assignPioneer('brand', 'prueba');
    expect(fetcher.mock.calls[0]![1].credentials).toBe('include');
    expect(new Headers(fetcher.mock.calls[1]![1].headers).get('X-Admin-CSRF')).toBe('login-csrf-token');
  });
});
