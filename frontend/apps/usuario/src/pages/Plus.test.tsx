import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import Plus from './Plus';

const previewAuth = vi.hoisted(() => ({ user: { id: 'user-test', emailNormalized: 'different@example.com', emailVerified: true, status: 'ACTIVE' } }));

const api = vi.hoisted(() => ({
  fetchPlusStatus: vi.fn(),
  fetchPlusPurchaseRequest: vi.fn(),
  requestPlusMembership: vi.fn(),
  fetchPlusOverview: vi.fn(),
  fetchPlusRadar: vi.fn(),
  fetchPlusRouteFavorites: vi.fn(),
  addPlusWatch: vi.fn(),
  savePlusPreferences: vi.fn(),
  comparePlusOffers: vi.fn(),
  createPlusCollection: vi.fn(),
  createPlusSearch: vi.fn(),
  addPlusCollectionItem: vi.fn(),
}));

vi.mock('../components/PageLayout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: previewAuth.user }),
}));
vi.mock('../context/LocationContext', () => ({
  useLocationContext: () => ({ selection: null }),
}));
vi.mock('../services/publicBusinessApi', () => ({
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
  fetchPlusRouteFavorites: api.fetchPlusRouteFavorites,
  addPlusWatch: api.addPlusWatch,
  savePlusPreferences: api.savePlusPreferences,
  comparePlusOffers: api.comparePlusOffers,
  createPlusCollection: api.createPlusCollection,
  createPlusSearch: api.createPlusSearch,
  addPlusCollectionItem: api.addPlusCollectionItem,
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
  previewAuth.user.emailNormalized = 'different@example.com';
  previewAuth.user.emailVerified = true;
  previewAuth.user.status = 'ACTIVE';
  api.fetchPlusStatus.mockResolvedValue(active);
  api.fetchPlusPurchaseRequest.mockResolvedValue({ request: null });
  api.fetchPlusOverview.mockResolvedValue(overview);
  api.fetchPlusRadar.mockResolvedValue({ items: [] });
  api.fetchPlusRouteFavorites.mockResolvedValue({ items: [] });
  api.requestPlusMembership.mockResolvedValue({ created: true, request: {
    id: 'request-1', status: 'PENDING_PAYMENT', amountCop: 3900,
    currency: 'COP', periodMonths: 1, createdAt: '2026-11-19T12:00:00.000Z',
  } });
  api.addPlusWatch.mockResolvedValue({ id: 'watch-1' });
  api.savePlusPreferences.mockResolvedValue({ radarEnabled: true, priceAlertsEnabled: false });
  api.comparePlusOffers.mockResolvedValue({ offers: [] });
  api.createPlusCollection.mockResolvedValue({ id: 'collection-1' });
  api.createPlusSearch.mockResolvedValue({ id: 'search-1' });
  api.addPlusCollectionItem.mockResolvedValue({ id: 'item-1' });
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
  it('does not display fabricated values or tools when overview API is unavailable', async () => {
    api.fetchPlusOverview.mockRejectedValue(new Error('overview unavailable'));
    renderPlus();
    expect(await screen.findByText(/No pudimos cargar tus herramientas Plus/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Precios seguidos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Compara tus opciones' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar conexión' })).toBeInTheDocument();
  });

  it('records explicit opt-in to updates from favorite businesses', async () => {
    renderPlus();
    const radar = await screen.findByRole('heading', { name: 'Tu radar de novedades' });
    expect(radar).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Recibir avisos' }));
    await waitFor(() => expect(api.savePlusPreferences).toHaveBeenCalledWith({ radarEnabled: true }));
  });

  it('sends only the validated offer UUID for real price tracking', async () => {
    renderPlus();
    await screen.findByRole('heading', { name: 'Seguimiento de precios' });
    const id = '12345678-1234-4234-8234-123456789abc';
    fireEvent.change(screen.getByPlaceholderText('https://xamuko.com/product/…'), {
      target: { value: '/product/' + id },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Seguir precio' }));
    await waitFor(() => expect(api.addPlusWatch).toHaveBeenCalledWith(id));
    expect(await screen.findByText('Producto o servicio añadido al seguimiento de precios.')).toBeInTheDocument();
  });

  it('compares exactly the two selected publications and never more than four', async () => {
    renderPlus();
    await screen.findByRole('heading', { name: 'Compara tus opciones' });
    const ids = [
      '12345678-1234-4234-8234-123456789abc',
      '12345678-1234-4234-8234-123456789abd',
    ];
    const input = screen.getByPlaceholderText('Pega un enlace de Xamuko');
    for (const id of ids) {
      fireEvent.change(input, { target: { value: '/product/' + id } });
      fireEvent.click(screen.getByRole('button', { name: 'Añadir a comparación' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Comparar 2 opciones' }));
    await waitFor(() => expect(api.comparePlusOffers).toHaveBeenCalledWith(ids));
  });

  it('saves a personal collection and a search using the real API payload', async () => {
    renderPlus();
    await screen.findByRole('heading', { name: 'Tus colecciones' });
    fireEvent.change(screen.getByPlaceholderText('Ej. Mis cafés favoritos'), {
      target: { value: 'Cafeterías' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear colección' }));
    await waitFor(() => expect(api.createPlusCollection).toHaveBeenCalledWith('Cafeterías'));
    await screen.findByText('Colección creada.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar búsqueda' })).not.toBeDisabled());
    fireEvent.change(screen.getByPlaceholderText('Ej. Panaderías cerca'), {
      target: { value: 'Desayunos' },
    });
    fireEvent.change(screen.getByPlaceholderText('Qué quieres encontrar'), {
      target: { value: 'pan artesanal' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar búsqueda' }));
    await waitFor(() => expect(api.createPlusSearch).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Desayunos', query: 'pan artesanal', sort: 'recommended' }),
    ));
  });

  it('builds a Google Maps trip only from verified favorite coordinates', async () => {
    const id1 = '12345678-1234-4234-8234-123456789abc';
    const id2 = '12345678-1234-4234-8234-123456789abd';
    api.fetchPlusRouteFavorites.mockResolvedValue({ items: [
      { id: id1, name: 'Negocio A', lat: 3.52, lng: -76.29 },
      { id: id2, name: 'Negocio B', lat: 3.53, lng: -76.30 },
    ] });
    renderPlus();
    await screen.findByText('Negocio A');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Negocio A' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Negocio B' }));
    const route = screen.getByRole('link', { name: 'Abrir ruta en Google Maps' });
    expect(route.getAttribute('href')).toContain('https://www.google.com/maps/dir/?');
    expect(route.getAttribute('href')).toContain('travelmode=driving');
    expect(route.getAttribute('href')).toContain('3.52');
    expect(route.getAttribute('href')).toContain('3.53');
  });

  it('opens local-only Plus visual preview for the verified designated account', async () => {
    previewAuth.user.emailNormalized = 'administradoreswit@gmail.com';
    renderPlus('/plus?preview=1');
    expect(screen.getByText('Prueba visual con datos de ejemplo')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tu radar de novedades' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Seguimiento de precios' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Compara tus opciones' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tus colecciones' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Búsquedas guardadas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rutas con varios negocios' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Experiencia sin anuncios/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Recibir avisos' }));
    expect(screen.getByText(/Preferencia de prueba actualizada localmente/)).toBeInTheDocument();
    expect(api.fetchPlusStatus).not.toHaveBeenCalled();
    expect(api.fetchPlusOverview).not.toHaveBeenCalled();
    expect(api.savePlusPreferences).not.toHaveBeenCalled();
    expect(api.requestPlusMembership).not.toHaveBeenCalled();
  });

  it('does not expose the visual walkthrough to other email accounts', async () => {
    api.fetchPlusStatus.mockResolvedValue(inactive);
    renderPlus('/plus?preview=1');
    expect(await screen.findByText('Xamuko Plus aún no está habilitado')).toBeInTheDocument();
    expect(screen.queryByText('Prueba visual con datos de ejemplo')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Recorrer Xamuko Plus en vista de prueba/ })).not.toBeInTheDocument();
  });

  it('requires a verified and active session before exposing the visual walkthrough', async () => {
    api.fetchPlusStatus.mockResolvedValue(inactive);
    previewAuth.user.emailNormalized = 'administradoreswit@gmail.com';
    previewAuth.user.emailVerified = false;
    renderPlus('/plus?preview=1');
    expect(await screen.findByText('Xamuko Plus aún no está habilitado')).toBeInTheDocument();
    expect(screen.queryByText('Prueba visual con datos de ejemplo')).not.toBeInTheDocument();
  });

  it('allows local collection and price edits in preview without any Plus backend writes', () => {
    previewAuth.user.emailNormalized = 'administradoreswit@gmail.com';
    renderPlus('/plus?preview=1');
    fireEvent.change(screen.getByPlaceholderText('Ej. Mis cafeterías favoritas'), { target: { value: 'Cafés de prueba' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear colección' }));
    expect(screen.getByText('Cafés de prueba')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('/product/12345678-…');
    fireEvent.change(input, { target: { value: '/product/33333333-3333-4333-8333-333333333333' } });
    fireEvent.click(screen.getByRole('button', { name: 'Seguir precio' }));
    expect(screen.getByText('Seguimiento agregado únicamente a esta vista previa.')).toBeInTheDocument();
    expect(api.addPlusWatch).not.toHaveBeenCalled();
    expect(api.createPlusCollection).not.toHaveBeenCalled();
    expect(api.fetchPlusStatus).not.toHaveBeenCalled();
  });

});
