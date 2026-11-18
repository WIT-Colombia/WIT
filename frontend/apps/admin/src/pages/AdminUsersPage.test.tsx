import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminUsersPage } from './AdminUsersPage';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAdminUserOverview: vi.fn(),
  getAdminUserCapabilities: vi.fn(),
  getAdminUserAnalytics: vi.fn(),
  listAdminUsers: vi.fn(),
  setAdminUserStatus: vi.fn(),
  revokeAdminUserSessions: vi.fn(),
}));

vi.mock('../services/adminService', () => ({ getSession: mocks.getSession }));
vi.mock('../services/adminApiClient', () => ({
  getAdminUserOverview: mocks.getAdminUserOverview,
  getAdminUserCapabilities: mocks.getAdminUserCapabilities,
  getAdminUserAnalytics: mocks.getAdminUserAnalytics,
  listAdminUsers: mocks.listAdminUsers,
  setAdminUserStatus: mocks.setAdminUserStatus,
  revokeAdminUserSessions: mocks.revokeAdminUserSessions,
}));
vi.mock('./AdminUserHistoricalAnalytics', () => ({ AdminUserHistoricalAnalytics: () => <div data-testid="charts"/> }));
vi.mock('./AdminUserAnalyticsPanel', () => ({ AdminUserAnalyticsPanel: () => <div data-testid="basic-charts"/> }));

const overview = {
  generatedAt: '2026-11-18T12:00:00.000Z',
  total: 4, active: 2, suspended: 1, deleted: 1, owners: 1, collaborators: 1,
  adminCount: 0, linkedBusinesses: 2, withBusiness: 2, cities: ['Cali', 'Palmira'],
  active30: 2, dormant90: 0, neverLoggedIn: 1, emailVerified: 2, googleUsers: 1,
  series: [], definition: 'Datos reales de prueba',
};
const users = [
  {
    id: 'u-1', publicId: 'USR-1', displayName: 'Ana Torres', nickname: null,
    emailNormalized: 'ana@example.com', status: 'ACTIVE', avatarUrl: null,
    locale: 'es-CO', createdAt: '2026-11-13T12:00:00Z', lastLoginAt: '2026-11-18T10:00:00Z',
    ownedBusinesses: 1, collaboratingBusinesses: 0, createdBusinesses: 1,
    isAdmin: false, emailVerified: true, authProviders: ['EMAIL'],
  },
  {
    id: 'u-2', publicId: 'USR-2', displayName: 'Luis Pérez', nickname: null,
    emailNormalized: 'luis@example.com', status: 'SUSPENDED', avatarUrl: null,
    locale: 'es-CO', createdAt: '2026-11-12T12:00:00Z', lastLoginAt: null,
    ownedBusinesses: 0, collaboratingBusinesses: 0, createdBusinesses: 0,
    isAdmin: false, emailVerified: true, authProviders: ['GOOGLE'],
  },
] as const;

function show() {
  return render(<MemoryRouter initialEntries={['/users']}><AdminUsersPage /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockReturnValue({ id: 'admin-1', role: 'SUPER_ADMIN', permissions: ['settings:write'] });
  mocks.getAdminUserCapabilities.mockResolvedValue({ userManagement: true, canManageStatus: true, analytics: true });
  mocks.getAdminUserOverview.mockResolvedValue(overview);
  mocks.getAdminUserAnalytics.mockResolvedValue({ period: '12m', timezone: 'UTC', series: [], definition: '' });
  mocks.listAdminUsers.mockResolvedValue({ users, pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 } });
  mocks.setAdminUserStatus.mockResolvedValue({ id: 'u-1', status: 'SUSPENDED', message: 'Cuenta suspendida.' });
  mocks.revokeAdminUserSessions.mockResolvedValue({ id: 'u-1', sessionsRevoked: 2, message: 'Sesiones cerradas.' });
});
afterEach(() => { cleanup(); });

describe('Admin → Usuarios: controles reales', () => {
  it('los accesos rápidos aplican filtros y Todos los restablece de verdad', async () => {
    show();
    await screen.findByText('Ana Torres');
    const withBusiness = screen.getByRole('button', { name: /Con negocio/ });
    await waitFor(() => expect(withBusiness).not.toBeDisabled());
    fireEvent.click(withBusiness);
    await waitFor(() => expect(mocks.listAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ relation: 'ANY' })));

    fireEvent.change(screen.getByLabelText('Buscar usuarios'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(mocks.listAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ q: 'Ana', relation: 'ANY' })));

    fireEvent.click(screen.getByRole('button', { name: /Todos \(/ }));
    await waitFor(() => expect(mocks.listAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ q: '', relation: '', status: '' })));
    expect(screen.getByLabelText('Buscar usuarios')).toHaveValue('');
  });

  it('filtro de ciudad y filtros avanzados llegan al backend y Limpiar restablece', async () => {
    show();
    await screen.findByText('Ana Torres');
    const city = screen.getByRole('combobox', { name: 'Filtrar por ciudad preferida' });
    await waitFor(() => expect(city).not.toBeDisabled());
    fireEvent.change(city, { target: { value: 'Palmira' } });
    await waitFor(() => expect(mocks.listAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ city: 'Palmira' })));

    fireEvent.click(screen.getByRole('button', { name: /Filtros avanzados/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Proveedor de acceso' }), { target: { value: 'GOOGLE' } });
    await waitFor(() => expect(mocks.listAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ city: 'Palmira', provider: 'GOOGLE' })));

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(mocks.listAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ q: '', city: '', provider: '' })));
  });

  it('desactiva filtros nuevos en backend antiguo, para no simular resultados', async () => {
    mocks.getAdminUserOverview.mockResolvedValue({ ...overview, withBusiness: undefined, linkedBusinesses: undefined, cities: undefined });
    mocks.getAdminUserCapabilities.mockRejectedValue(new Error('Backend anterior'));
    show();
    await screen.findByText('Ana Torres');
    expect(screen.getByRole('button', { name: /Con negocio/ })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Filtrar por ciudad preferida' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: /Filtros avanzados/ })).toBeDisabled());
    expect(mocks.listAdminUsers).toHaveBeenCalled();
  });

  it('Suspender y Cerrar sesiones abren confirmaciones con acciones auténticas', async () => {
    show();
    await screen.findByText('Ana Torres');
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Suspender' }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: 'Suspender' })[0]);
    let dialog = screen.getByRole('dialog', { name: 'Suspender cuenta' });
    fireEvent.change(within(dialog).getByLabelText('Motivo administrativo obligatorio'), {
      target: { value: 'Revisión administrativa preventiva de esta cuenta.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar suspensión' }));
    await waitFor(() => expect(mocks.setAdminUserStatus).toHaveBeenCalledWith('u-1', 'SUSPEND', 'Revisión administrativa preventiva de esta cuenta.'));

    // The same directory also exposes a protected, reasoned session-revocation action.
    fireEvent.click(screen.getAllByText('Más')[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar sesiones' })[0]);
    dialog = screen.getByRole('dialog', { name: 'Cerrar todas las sesiones' });
    fireEvent.change(within(dialog).getByLabelText('Motivo administrativo obligatorio'), {
      target: { value: 'Protección de acceso ante un incidente reportado.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar sesiones' }));
    await waitFor(() => expect(mocks.revokeAdminUserSessions).toHaveBeenCalledWith('u-1', 'Protección de acceso ante un incidente reportado.'));
  });

  it('no expone controles de administración sin permisos', () => {
    mocks.getSession.mockReturnValue({ id: 'u-0', role: 'ADMIN', permissions: [] });
    show();
    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
    expect(mocks.listAdminUsers).not.toHaveBeenCalled();
  });
});
