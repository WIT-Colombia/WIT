import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

describe('sesión administrativa', () => {
  it.each(['admin.xamuko.com', 'preview.xamuko-admin.pages.dev', 'localhost'])('no crea una sesión ficticia en %s', async hostname => {
    vi.stubEnv('VITE_ADMIN_DEMO_MODE', 'true');
    vi.stubGlobal('window', { location: { hostname } });
    const service = await import('./adminService');
    expect(service.getSession()).toBeNull();
  });
});
