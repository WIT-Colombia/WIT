import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import Plus from './Plus';

const api = vi.hoisted(() => ({
  fetchPlusStatus: vi.fn(),
  fetchPlusPurchaseRequest: vi.fn(),
  requestPlusMembership: vi.fn(),
  fetchPlusOverview: vi.fn(),
  fetchPlusRadar: vi.fn(),
  listPublicBusinesses: vi.fn(),
  addPlusWatch: vi.fn(),
}));

vi.mock('../components/PageLayout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-test' } }),
}));
vi.mock('../context/LocationContext', () => ({
  useLocationContext: () => ({ selection: null }),
}));
vi.mock('../services/favoritesService', () => ({
  useFavorites: () => ({ favorites: [] }),
}));
vi.mock('../services/publicBusinessApi', () => ({
  listPublicBusinesses: api.listPublicBusinesses,
  getPublicBusiness: vi.fn(),
}));
vi.mock('../services/reviewsService', () => ({ listPublicReviews: vi.fn() }));
vi.mock('../services/userPlusService', async importOriginal => ({
  ...(await importOriginal<typeof import('../services/userPlusService')>()),
  fetchPlusStatus: api.fetchPlusStatus,
  fetchPlusPurchaseRequest: api.fetchPlusPurchaseRequest,
  requestPlusMembership: api.requestPlusMembership,
  fetchPlusOverview: api.fetchPlusOverview,
  fetchPlusRadar: api.fetchPlusRadar,
  addPlusWatch: api.addPlusWatch,
}));

const inactive = { enabled: false, active: false, subscription: null };
const active = { enabled: true, active: true, subscription: {
  status: 'ACTIVE', startsAt: '2026-11-01T00:00:00.000Z',
  expiresAt: '2026-12-01T00:00:00.000Z', revoked: false,
}};
const overview = {
  ...active, collections: [], searches: [], watches: [],
  preferences: { radarEnabled: false, priceAlertsEnabled: false },
};
const renderPlus = (path = '/plus') => render(<MemoryRouter initialEntries={[path]}><Plus /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchPlusStatus.mockResolvedValue(active);
  api.fetchPlusPurchaseRequest.mockResolvedValue({ request: null });
  api.fetchPlusOverview.mockResolvedValue(overview);
  api.fetchPlusRadar.mockResolvedValue({ items: [] });
  api.listPublicBusinesses.mockResolvedValue([]);
  api.requestPlusMembership.mockResolvedValue({ created: true, request: {
    id: 'request-1', status: 'PENDING_PAYMENT', amountCop: 3900,
    currency: 'COP', periodMonths: 1, createdAt: '2026-11-19T12:00:00.000Z',
  } });
  api.addPlusWatch.mockResolvedValue({ id: 'watch-1' });
});

describe('Xamuko Plus: member experience and real entitlement', () => {
  it('does not show premium tools when the global plan is disabled', async () => {
    api.fetchPlusStatus.mockResolvedValue(inactive);
    renderPlus();
    expect(await screen.findByText('Xamuko Plus aún no está habilitado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adquisición no disponible' })).toBeDisabled();
    expect(screen.queryByRole('heading', { name: 'Tu radar de novedades' })).not.toBeInTheDocument();
  });

  it('shows six tools and real zero counts only after membership and data verification', async () => {
    renderPlus();
    expect(await screen.findByRole('heading', { name: 'Tu radar de novedades' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Ir a una herramienta de Xamuko Plus' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Seguimiento de precios' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Compara tus opciones' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tus colecciones' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Búsquedas guardadas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rutas con varios negocios' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Experiencia sin anuncios/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Novedades recientes/ })).toHaveTextContent('0');
  });

  it('does not fabricate zero news when the radar API fails', async () => {
    api.fetchPlusRadar.mockRejectedValue(new Error('radar unavailable'));
    renderPlus();
    expect(await screen.findByText(/El radar está temporalmente fuera de servicio/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Novedades recientes/ })).toHaveTextContent('—');
    expect(screen.getByRole('heading', { name: 'Tus colecciones' })).toBeInTheDocument();
  });

  it('records a membership request without treating it as a payment or activation', async () => {
    api.fetchPlusStatus.mockResolvedValue({ ...inactive, enabled: true });
    renderPlus();
    fireEvent.click(await screen.findByRole('button', { name: /Solicitar Xamuko Plus/ }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar solicitud' }));
    await waitFor(() => expect(api.requestPlusMembership).toHaveBeenCalledWith(3900));
    expect(await screen.findByText(/Aún no se ha realizado ningún cobro ni activado la membresía/)).toBeInTheDocument();
  });
});
