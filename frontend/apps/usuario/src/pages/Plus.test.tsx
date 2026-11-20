import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import Plus from './Plus';
import { readPlusComparison, savePlusComparison } from '../services/plusComparisonSelection';

const previewAuth = vi.hoisted(() => ({ user: { id: 'user-test', emailNormalized: 'different@example.com', emailVerified: true, status: 'ACTIVE' } }));

const api = vi.hoisted(() => ({
  fetchPlusStatus: vi.fn(),
  fetchPlusPurchaseRequest: vi.fn(),
  requestPlusMembership: vi.fn(),
  fetchPlusOverview: vi.fn(),
  fetchPlusRadar: vi.fn(),
  fetchPlusPriceHistory: vi.fn(),
  removePlusWatch: vi.fn(),
  removePlusSearch: vi.fn(),
  removePlusCollectionItem: vi.fn(),
  fetchPlusRouteFavorites: vi.fn(),
  addPlusWatch: vi.fn(),
  savePlusPreferences: vi.fn(),
  comparePlusOffers: vi.fn(),
  createPlusCollection: vi.fn(),
  createPlusSearch: vi.fn(),
  addPlusCollectionItem: vi.fn(),
  fetchPlusCollectionCandidates: vi.fn(),
}));

vi.mock('../components/PageLayout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../components/CatalogPhoto', () => ({
  CatalogPhoto: ({ src, alt }: { src: string; alt: string }) => src
    ? <img src={src} alt={alt} />
    : <span data-testid="missing-business-photo" aria-hidden="true" />,
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
  fetchPlusPriceHistory: api.fetchPlusPriceHistory,
  removePlusWatch: api.removePlusWatch,
  removePlusSearch: api.removePlusSearch,
  removePlusCollectionItem: api.removePlusCollectionItem,
  fetchPlusRouteFavorites: api.fetchPlusRouteFavorites,
  addPlusWatch: api.addPlusWatch,
  savePlusPreferences: api.savePlusPreferences,
  comparePlusOffers: api.comparePlusOffers,
  createPlusCollection: api.createPlusCollection,
  createPlusSearch: api.createPlusSearch,
  addPlusCollectionItem: api.addPlusCollectionItem,
  fetchPlusCollectionCandidates: api.fetchPlusCollectionCandidates,
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
  window.sessionStorage.clear();
  previewAuth.user.emailNormalized = 'different@example.com';
  previewAuth.user.emailVerified = true;
  previewAuth.user.status = 'ACTIVE';
  api.fetchPlusStatus.mockResolvedValue(active);
  api.fetchPlusPurchaseRequest.mockResolvedValue({ request: null });
  api.fetchPlusOverview.mockResolvedValue(overview);
  api.fetchPlusRadar.mockResolvedValue({ items: [] });
  api.fetchPlusPriceHistory.mockResolvedValue({ offer: { id: 'offer-1', name: 'Pan queso', price: '2000', currency: 'COP' }, history: [] });
  api.removePlusWatch.mockResolvedValue({ ok: true });
  api.removePlusSearch.mockResolvedValue({ ok: true });
  api.removePlusCollectionItem.mockResolvedValue({ ok: true });
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
  api.fetchPlusCollectionCandidates.mockResolvedValue({ items: [], pagination: { page: 1, total: 0, totalPages: 0 } });
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

  it('shows each business profile photo beside its radar alert with a fallback if unavailable', async () => {
    const profilePhotoUrl = '/api/v1/public/businesses/panaderia-patico/photos/photo-123/content';
    api.fetchPlusRadar.mockResolvedValue({ items: [
      { id: 'offer-1', type: 'PRODUCT', title: 'Pan queso', business: 'Panadería Patico',
        businessProfilePhotoUrl: profilePhotoUrl, createdAt: '2026-11-20T10:00:00.000Z',
        href: '/product/offer-1' },
      { id: 'offer-2', type: 'SERVICE', title: 'Servicio nuevo', business: 'Negocio sin foto',
        businessProfilePhotoUrl: null, createdAt: '2026-11-19T10:00:00.000Z',
        href: '/service/offer-2' },
    ] });
    renderPlus();
    const image = await screen.findByRole('img', { name: 'Foto de perfil de Panadería Patico' });
    expect(image).toHaveAttribute('src', profilePhotoUrl);
    expect(screen.getByRole('link', { name: /Pan queso/ })).toHaveAttribute('href', '/product/offer-1');
    expect(screen.getByText(/Negocio sin foto/)).toBeInTheDocument();
    expect(screen.getByTestId('missing-business-photo')).toBeInTheDocument();
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

  it('guides users to the one-tap button on a product, without asking for a pasted link', async () => {
    renderPlus();
    await screen.findByRole('heading', { name: 'Seguimiento de precios' });
    expect(screen.getByText('Sigue precios con un solo toque')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorar productos' })).toHaveAttribute('href', '/results');
    expect(screen.queryByPlaceholderText('https://xamuko.com/product/…')).not.toBeInTheDocument();
    expect(api.addPlusWatch).not.toHaveBeenCalled();
  });

  it('opens and closes the actual price history without reloading all Plus data', async () => {
    api.fetchPlusOverview.mockResolvedValue({ ...overview, watches: [
      { id: 'watch-1', offerId: 'offer-1', kind: 'PRODUCT', name: 'Pan queso',
        businessName: 'Panadería Patico', price: '2000', priceText: null, currency: 'COP', available: true },
    ] });
    renderPlus();
    fireEvent.click(await screen.findByRole('button', { name: 'Historial' }));
    await waitFor(() => expect(api.fetchPlusPriceHistory).toHaveBeenCalledWith('offer-1'));
    expect(await screen.findByRole('heading', { name: 'Historial de Pan queso' })).toBeInTheDocument();
    expect(api.fetchPlusOverview).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar historial' }));
    expect(screen.queryByRole('heading', { name: 'Historial de Pan queso' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(api.removePlusWatch).toHaveBeenCalledWith('watch-1'));
  });

  it('explains when a selected comparison has fewer than two available offers', async () => {
    const ids = ['12345678-1234-4234-8234-123456789abc', '12345678-1234-4234-8234-123456789abd'];
    savePlusComparison('user-test', ids);
    api.comparePlusOffers.mockResolvedValue({ offers: [
      { id: ids[0], name: 'Pan queso', kind: 'PRODUCT', business: { name: 'Panadería', publicId: 'panaderia' },
        priceAmount: '2000', priceText: null, currency: 'COP', negotiable: false, description: '' },
    ] });
    renderPlus();
    fireEvent.click(await screen.findByRole('button', { name: 'Comparar 2 opciones' }));
    expect(await screen.findByText(/No hay dos publicaciones disponibles para comparar/)).toBeInTheDocument();
    expect(screen.queryByText('Comparación actualizada.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar selección' })).toBeInTheDocument();
  });

  it('retries a failed favorite-business collection picker without leaving Plus', async () => {
    api.fetchPlusOverview.mockResolvedValue({ ...overview, collections: [
      { id: 'collection-1', title: 'Para visitar', items: [] },
    ] });
    api.fetchPlusCollectionCandidates.mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ items: [{ targetType: 'BUSINESS', targetId: 'business-1',
        name: 'Café favorito', detail: 'Negocio favorito', href: '/business/cafe' }],
        pagination: { page: 1, total: 1, totalPages: 1 } });
    renderPlus();
    await screen.findByText('Para visitar');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText(/No pudimos cargar tus favoritos o Me gusta/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar consulta' }));
    expect(await screen.findByText('Café favorito')).toBeInTheDocument();
    expect(api.fetchPlusCollectionCandidates).toHaveBeenCalledTimes(2);
  });

  it('repeats or removes a saved search using the user account', async () => {
    api.fetchPlusOverview.mockResolvedValue({ ...overview, searches: [
      { id: 'search-1', title: 'Cafeterías', query: 'café', category: 'Restaurantes', city: null,
        openNow: false, minRating: null, sort: 'recommended' },
    ] });
    renderPlus();
    await screen.findByText('Cafeterías');
    expect(screen.getByRole('link', { name: 'Buscar' }).getAttribute('href'))
      .toContain('/results?q=caf%C3%A9&category=Restaurantes');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(api.removePlusSearch).toHaveBeenCalledWith('search-1'));
  });

  it('lets the user switch to walking and clear a multi-business route', async () => {
    api.fetchPlusRouteFavorites.mockResolvedValue({ items: [
      { id: 'a', name: 'Local A', lat: 3.52, lng: -76.29 },
      { id: 'b', name: 'Local B', lat: 3.53, lng: -76.30 },
      { id: 'c', name: 'Local C', lat: 3.54, lng: -76.31 },
    ] });
    renderPlus();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Local A' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Local B' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Transporte' }), { target: { value: 'walking' } });
    expect(screen.getByRole('link', { name: 'Abrir ruta en Google Maps' }).getAttribute('href')).toContain('travelmode=walking');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar ruta' }));
    expect(screen.queryByRole('link', { name: 'Abrir ruta en Google Maps' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Local A' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Local B' })).not.toBeChecked();
  });

  it('loads one-tap comparison choices and lets users restart without pasted links', async () => {
    const ids = [
      '12345678-1234-4234-8234-123456789abc',
      '12345678-1234-4234-8234-123456789abd',
    ];
    savePlusComparison('user-test', ids);
    renderPlus();
    await screen.findByRole('heading', { name: 'Compara tus opciones' });
    expect(screen.getByText('2 de 4 opciones seleccionadas')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Pega un enlace de Xamuko')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Comparar 2 opciones' }));
    await waitFor(() => expect(api.comparePlusOffers).toHaveBeenCalledWith(ids));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar selección' }));
    expect(readPlusComparison('user-test')).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Eliminar selección' })).not.toBeInTheDocument();
    expect(screen.getByText('Tu comparación está vacía')).toBeInTheDocument();
  });

  it('only permits picking saved favorites and liked offers into Plus collections', async () => {
    const businessId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const offerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    api.fetchPlusOverview.mockResolvedValue({ ...overview, collections: [
      { id: 'collection-1', title: 'Mis elegidos', items: [] },
    ] });
    api.fetchPlusCollectionCandidates.mockImplementation(async (type: 'BUSINESS' | 'OFFER') =>
      ({ items: [type === 'BUSINESS'
        ? { targetType: 'BUSINESS', targetId: businessId, name: 'Tienda favorita', detail: 'Negocio favorito', href: '/business/tienda' }
        : { targetType: 'OFFER', targetId: offerId, name: 'Servicio con Me gusta', detail: 'Servicio · Tienda', href: '/service/servicio' }],
        pagination: { page: 1, total: 1, totalPages: 1 } }));
    renderPlus();
    await screen.findByText('Mis elegidos');
    expect(screen.queryByPlaceholderText('/business/… o /product/…')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(api.fetchPlusCollectionCandidates).toHaveBeenCalledWith('BUSINESS', 1));
    expect(await screen.findByText('Tienda favorita')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }));
    await waitFor(() => expect(api.addPlusCollectionItem).toHaveBeenCalledWith(
      'collection-1', { targetType: 'BUSINESS', targetId: businessId },
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Productos y servicios con Me gusta' }));
    await waitFor(() => expect(api.fetchPlusCollectionCandidates).toHaveBeenCalledWith('OFFER', 1));
    expect(await screen.findByText('Servicio con Me gusta')).toBeInTheDocument();
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

  it('lets the authorized preview compare two sample products and clear the selection without backend calls', () => {
    previewAuth.user.emailNormalized = 'administradoreswit@gmail.com';
    renderPlus('/plus?preview=1');
    fireEvent.click(screen.getByRole('button', { name: 'Probar con dos opciones de ejemplo' }));
    expect(screen.getByText('2 de 4 opciones seleccionadas')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Comparar 2 opciones' }));
    expect(screen.getByRole('heading', { name: 'Producto de muestra A' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Producto de muestra B' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar selección' }));
    expect(readPlusComparison('user-test', true)).toEqual([]);
    expect(api.comparePlusOffers).not.toHaveBeenCalled();
    expect(api.fetchPlusStatus).not.toHaveBeenCalled();
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

  it('receives the product button in preview and edits collections without paid backend writes', () => {
    previewAuth.user.emailNormalized = 'administradoreswit@gmail.com';
    renderPlus('/plus?preview=1&watch=33333333-3333-4333-8333-333333333333');
    expect(screen.getByText('Producto seleccionado para la prueba')).toBeInTheDocument();
    expect(screen.getByText(/Has seguido un producto de ejemplo desde su ficha/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Ej. Mis cafeterías favoritas'), { target: { value: 'Cafés de prueba' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear colección' }));
    expect(screen.getByText('Cafés de prueba')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('/product/12345678-…')).not.toBeInTheDocument();
    expect(api.addPlusWatch).not.toHaveBeenCalled();
    expect(api.createPlusCollection).not.toHaveBeenCalled();
    expect(api.fetchPlusStatus).not.toHaveBeenCalled();
  });

});
