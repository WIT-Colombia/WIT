import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@wit/utils', () => ({ API_BASE_URL: '/api/v1', buildApiUrl: (path: string) => path.startsWith('/api/v1') ? path : '/api/v1' + path }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const storage = () => { const values = new Map<string, string>(); return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) }; };
for (const application of ['usuario', 'negocios'] as const) {
  const service = () => application === 'usuario' ? import('../../../usuario/src/services/authService') : import('../../../negocios/src/services/businessAuthService');
  it(`${application}: concurrent expired requests share one refresh and retry with the renewed token`, async () => {
    vi.stubGlobal('window', { localStorage: storage() });
    let refreshes = 0;
    vi.stubGlobal('fetch', vi.fn(async (path: string, init: RequestInit) => {
      if (path.endsWith('/refresh')) { refreshes++; await new Promise(resolve => setTimeout(resolve, 15)); return json({ user: { id: 'u' }, accessToken: 'renewed' }); }
      if (new Headers(init.headers).get('Authorization') !== 'Bearer renewed') return json({ error: { code: 'UNAUTHENTICATED' } }, 401);
      return json({ user: { id: 'u' }, businesses: [] });
    }));
    const auth = await service();
    if (application === 'usuario') {
      const api = await import('../../../usuario/src/services/authService');
      await Promise.all(Array.from({ length: 10 }, () => api.requestWithSession('/api/v1/auth/me')));
    } else {
      const api = await import('../../../negocios/src/services/businessApiClient');
      await Promise.all(Array.from({ length: 10 }, () => api.requestJson('/businesses', { headers: { Authorization: 'Bearer expired' } })));
    }
    expect(refreshes).toBe(1); auth.clearAccessToken();
  });
  it(`${application}: 403 never refreshes or bypasses permissions`, async () => {
    vi.stubGlobal('window', { localStorage: storage() });
    const fetcher = vi.fn(async () => json({ error: { code: 'DENIED' } }, 403)); vi.stubGlobal('fetch', fetcher);
    await service();
    if (application === 'usuario') { const api = await import('../../../usuario/src/services/authService'); await expect(api.requestWithSession('/api/v1/auth/me')).rejects.toMatchObject({ status: 403 }); }
    else { const api = await import('../../../negocios/src/services/businessApiClient'); await expect(api.requestJson('/businesses')).rejects.toMatchObject({ status: 403 }); }
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
}
it('Admin: network failure is retryable; only invalid authentication clears session', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(json({ error: { code: 'ADMIN_SESSION_INVALID' } }, 401));
  vi.stubGlobal('fetch', fetcher);
  const auth = await import('./adminService');
  await expect(auth.restoreSession()).rejects.toThrow('offline');
  await expect(auth.restoreSession()).resolves.toBeNull();
});
it('Admin: forwards persistent preference and CSRF, without browser-readable token storage', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json({ admin: { user: {} }, csrfToken: 'csrf' })).mockResolvedValueOnce(json({ authenticated: true, csrfToken: 'csrf-fresh' })).mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetcher);
  const api = await import('./adminApiClient'); await api.adminLogin('a@example.test', 'fixture', true); await api.adminSessionLogout();
  expect(JSON.parse(fetcher.mock.calls[0][1].body).rememberMe).toBe(true);
  expect(fetcher.mock.calls[1][0]).toContain('/admin/auth/session');
  expect(new Headers(fetcher.mock.calls[2][1].headers).get('X-Admin-CSRF')).toBe('csrf-fresh');
});

it('Admin: sensitive reauthentication opens login without treating ordinary 403 as logout', async () => {
  const assign = vi.fn(); vi.stubGlobal('window', { location: { assign } });
  const fetcher = vi.fn().mockResolvedValueOnce(json({ error: { code: 'ADMIN_PERMISSION_DENIED' } }, 403)).mockResolvedValueOnce(json({ error: { code: 'ADMIN_REAUTH_REQUIRED' } }, 403));
  vi.stubGlobal('fetch', fetcher); const api = await import('./adminApiClient');
  await expect(api.assignPioneer('brand', 'test')).rejects.toMatchObject({ code: 'ADMIN_PERMISSION_DENIED' }); expect(assign).not.toHaveBeenCalled();
  await expect(api.assignPioneer('brand', 'test')).rejects.toMatchObject({ code: 'ADMIN_REAUTH_REQUIRED' }); expect(assign).toHaveBeenCalledWith('/login?reauth=1');
});
