import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './Layout';
import App from '../App';
import { navigation, navigationGroups } from '../data/navigation';
import { authenticateWithPassword, getSession, logout } from '../services/adminService';

// Isolated API fixtures: never shipped as application profile data.
const profile = { user: { id: 'test-admin', displayName: 'Perfil de prueba', emailNormalized: 'admin@example.test', avatarUrl: '/api/v1/auth/me/avatar?v=1' }, role: 'SUPER_ADMIN', permissions: ['ADMINS_MANAGE'] };
let currentProfile = profile;
let validSession = true;
let failLogout = false;
let failCsrfOnce = false;
let failAvatar = false;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fetcher = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
  const path = String(url);
  if (path.endsWith('/admin/auth/password')) { validSession = true; return json({ admin: currentProfile, csrfToken: 'test-csrf' }); }
  if (path.endsWith('/admin/auth/logout')) {
    if (failCsrfOnce) { failCsrfOnce = false; return json({ error: { code: 'ADMIN_CSRF_INVALID' } }, 403); }
    if (failLogout) return json({ error: { message: 'offline' } }, 500);
    validSession = false; return new Response(null, { status: 204 });
  }
  if (!validSession) return json({ error: { code: 'UNAUTHENTICATED' } }, 401);
  if (path.endsWith('/admin/auth/session')) return json({ authenticated: true, csrfToken: 'test-csrf' });
  if (path.endsWith('/admin/me')) return json({ admin: currentProfile });
  if (path.includes('/auth/me/avatar')) return failAvatar ? new Response(null, { status: 404 }) : new Response(new Blob(['test-image'], { type: 'image/png' }));
  return json({});
});

function show(path = '/dashboard') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route element={<Layout />}><Route path="*" element={<h1>Contenido existente</h1>} /></Route>
    <Route path="/login" element={<h1>Acceso</h1>} />
  </Routes></MemoryRouter>);
}
const sidebar = () => document.querySelector<HTMLElement>('aside')!;
const group = (id: string) => document.getElementById(`nav-${id}`)!.closest('details')!;
const toggle = (id: string) => fireEvent.click(group(id).querySelector('summary')!);

beforeEach(async () => {
  currentProfile = profile; validSession = true; failLogout = false; failCsrfOnce = false; failAvatar = false;
  vi.stubGlobal('fetch', fetcher); fetcher.mockClear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:test-avatar'); static revokeObjectURL = vi.fn(); });
  await authenticateWithPassword('admin@example.test', 'test-only');
});
afterEach(async () => { cleanup(); failLogout = false; await logout(); vi.unstubAllGlobals(); });

describe('Sidebar aprobado de Admin', () => {
  it('conserva todas las rutas, nombres y módulos pendientes de la navegación', () => {
    show();
    const links = [...sidebar().querySelectorAll<HTMLAnchorElement>('nav a')];
    expect(links.map(link => link.getAttribute('href'))).toEqual(navigation.map(item => item.path));
    for (const item of navigation) {
      const link = links.find(link => link.getAttribute('href') === item.path)!;
      expect(link).toHaveTextContent(item.label);
      expect(Boolean(link.querySelector('.nav-pending'))).toBe(Boolean(item.pending));
    }
    expect(sidebar().querySelector('input')).toBeNull();
    expect(sidebar().querySelector('.sidebar-profile-copy svg')).toBeNull();
    expect(document.querySelector('.xa-profile-link > svg')).toBeNull();
  });

  it('no muestra header, búsqueda ni acceso al perfil y conserva la hamburguesa móvil', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    show('/users');
    expect(document.querySelector('.admin-header')).toBeNull();
    expect(document.querySelector('.global-search')).toBeNull();
    expect(document.querySelector('.xa-sidebar-search')).toBeNull();
    expect(sidebar().querySelector('a[href="/settings"]')).toBeNull();
    expect(sidebar().querySelector('.sidebar-footer a')).toBeNull();
    expect(sidebar().querySelector('button[aria-label="Cerrar sesión"]')).not.toBeNull();
    const hamburger = screen.getByRole('button', { name: 'Abrir navegación' });
    expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(hamburger);
    expect(hamburger).toHaveAttribute('aria-expanded', 'true');
    expect(sidebar()).toHaveClass('is-open');
  });

  it('expande un solo grupo y permite contraerlo', () => {
    show();
    expect(group('plataforma')).toHaveAttribute('open');
    toggle('finanzas');
    expect(group('finanzas')).toHaveAttribute('open');
    expect(group('plataforma')).not.toHaveAttribute('open');
    toggle('finanzas');
    expect(sidebar().querySelectorAll('details[open]')).toHaveLength(0);
  });

  it.each(navigationGroups.slice(1).map(entry => [entry.id, entry.items[0].path]))('abre el grupo %s al entrar por URL', (id, path) => {
    show(path);
    expect(group(id)).toHaveAttribute('open');
    expect(sidebar().querySelector('a[aria-current="page"]')).toHaveAttribute('href', path);
    expect(sidebar().querySelectorAll('details[open]')).toHaveLength(1);
  });

  it('conserva selección y grupo al entrar a un detalle y al navegar', () => {
    show('/businesses/business-id');
    expect(group('plataforma')).toHaveAttribute('open');
    expect(sidebar().querySelector('a.active')).toHaveAttribute('href', '/businesses');
    toggle('finanzas');
    fireEvent.click(within(sidebar()).getByText('Gastos tecnológicos'));
    expect(group('finanzas')).toHaveAttribute('open');
    expect(sidebar().querySelector('a.active')).toHaveAttribute('href', '/financial-reports');
  });

  it('muestra el perfil de sesión y recupera la imagen con credenciales', async () => {
    show();
    expect(within(sidebar()).getByText(profile.user.displayName)).toBeInTheDocument();
    expect(within(sidebar()).getByText('Administrador principal')).toBeInTheDocument();
    await waitFor(() => expect(sidebar().querySelector('.avatar img')).toHaveAttribute('src', 'blob:test-avatar'));
    const request = fetcher.mock.calls.find(([url]) => String(url).includes('/admin/auth/me/avatar'))!;
    expect(request[1]?.credentials).toBe('include');
    expect(new Headers(request[1]?.headers).get('Accept')).toBe('image/*');
  });

  it('actualiza nombre, rol y avatar al volver a la pestaña y libera el blob anterior', async () => {
    const view = show();
    await waitFor(() => expect(sidebar().querySelector('.avatar img')).not.toBeNull());
    currentProfile = { ...profile, user: { ...profile.user, displayName: 'Perfil actualizado', avatarUrl: '/api/v1/auth/me/avatar?v=2' }, role: 'ADMIN' };
    fireEvent.focus(window);
    expect(await within(sidebar()).findByText('Perfil actualizado')).toBeInTheDocument();
    expect(within(sidebar()).getByText('Administrador')).toBeInTheDocument();
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('avatar?v=2'))).toBe(true));
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-avatar');
  });

  it('usa iniciales cuando la fuente autenticada no tiene fotografía', async () => {
    failAvatar = true; show();
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).includes('/auth/me/avatar'))).toBe(true));
    expect(sidebar().querySelector('.avatar')).toHaveTextContent('Pd');
    expect(sidebar().querySelector('.avatar img')).toBeNull();
  });

  it('confirma, cancela y cierra por el servicio existente con CSRF', async () => {
    show();
    const trigger = within(sidebar()).getByRole('button', { name: 'Cerrar sesión' });
    trigger.focus(); fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(getSession()).not.toBeNull();
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByText('Acceso')).toBeInTheDocument();
    expect(getSession()).toBeNull();
    const request = fetcher.mock.calls.find(([url]) => String(url).endsWith('/admin/auth/logout'))!;
    expect(request[1]?.method).toBe('POST');
    expect(request[1]?.credentials).toBe('include');
    expect(new Headers(request[1]?.headers).get('X-Admin-CSRF')).toBe('test-csrf');
    const urls = fetcher.mock.calls.map(([url]) => String(url));
    const sessionCheck = urls.findIndex(path => path.endsWith('/admin/auth/session'));
    const logoutCall = urls.findIndex(path => path.endsWith('/admin/auth/logout'));
    expect(sessionCheck).toBeGreaterThanOrEqual(0);
    expect(logoutCall).toBeGreaterThan(sessionCheck);
  });

  it('informa un fallo de logout y conserva la sesión sin redirigir', async () => {
    failLogout = true; show();
    fireEvent.click(within(sidebar()).getByRole('button', { name: 'Cerrar sesión' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cerrar la sesión');
    expect(getSession()).not.toBeNull();
    failLogout = false;
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByText('Acceso')).toBeInTheDocument();
    const retries = fetcher.mock.calls.filter(([url]) => String(url).endsWith('/admin/auth/logout'));
    expect(retries).toHaveLength(2);
    expect(new Headers(retries[1][1]?.headers).get('X-Admin-CSRF')).toBe('test-csrf');
  });

  it('espera el refresco en curso antes de invalidar la sesión para evitar respuestas tardías', async () => {
    show();
    await waitFor(() => expect(sidebar().querySelector('.avatar img')).not.toBeNull());
    let finishRefresh!: (response: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { finishRefresh = resolve; }));
    fireEvent.focus(window);
    fireEvent.click(within(sidebar()).getByRole('button', { name: 'Cerrar sesión' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar sesión' }));
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/admin/auth/logout'))).toBe(false);
    finishRefresh(json({ authenticated: true, csrfToken: 'test-csrf' }));
    expect(await screen.findByText('Acceso')).toBeInTheDocument();
    expect(getSession()).toBeNull();
  });

  it('recupera el CSRF y reintenta el logout una vez si el servidor lo rechaza', async () => {
    failCsrfOnce = true; show();
    fireEvent.click(within(sidebar()).getByRole('button', { name: 'Cerrar sesión' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByText('Acceso')).toBeInTheDocument();
    const requests = fetcher.mock.calls.map(([url]) => String(url));
    expect(requests.filter(url => url.endsWith('/admin/auth/session'))).toHaveLength(2);
    expect(requests.filter(url => url.endsWith('/admin/auth/logout'))).toHaveLength(2);
    expect(getSession()).toBeNull();
  });

  it('sale del frontend si la sesión administrativa ya caducó', async () => {
    show(); validSession = false;
    fireEvent.click(within(sidebar()).getByRole('button', { name: 'Cerrar sesión' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByText('Acceso')).toBeInTheDocument();
    expect(getSession()).toBeNull();
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/admin/auth/logout'))).toBe(false);
  });

  it('rechaza volver a una ruta protegida después del logout', async () => {
    await logout();
    render(<MemoryRouter initialEntries={['/users']}><App /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Navegación administrativa')).toBeNull();
  });
});
