import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

describe('acceso anónimo de demostración', () => {
  it.each(['admin.xamuko.com', 'api.xamuko.com', 'otro.example.test'])('no permite demo en %s aunque la variable esté activada', async hostname => {
    vi.stubEnv('VITE_ADMIN_DEMO_MODE', 'true');
    vi.stubGlobal('window', { location: { hostname } });
    const service = await import('./adminService');
    expect(service.isAdminDemoMode).toBe(false);
    expect(service.getSession()).toBeNull();
  });
  it('conserva la demostración en los previews explícitos de Pages', async () => {
    vi.stubEnv('VITE_ADMIN_DEMO_MODE', 'false');
    vi.stubGlobal('window', { location: { hostname: 'preview.xamuko-admin.pages.dev' } });
    const service = await import('./adminService');
    expect(service.isAdminDemoMode).toBe(true);
  });
});
