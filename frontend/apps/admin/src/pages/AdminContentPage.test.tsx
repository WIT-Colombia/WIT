import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminContentPage } from './AdminContentPage';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAdminContentInsights: vi.fn(),
  getAdminContentCapabilities: vi.fn(),
  listAdminOffers: vi.fn(),
}));

vi.mock('../services/adminService', () => ({ getSession: mocks.getSession }));
vi.mock('../services/adminApiClient', () => ({
  getAdminContentInsights: mocks.getAdminContentInsights,
  getAdminContentCapabilities: mocks.getAdminContentCapabilities,
  listAdminOffers: mocks.listAdminOffers,
}));
vi.mock('./AdminContentPhoto', () => ({ AdminContentPhoto: () => <div data-testid="catalog-photo" /> }));
vi.mock('./AdminContentAnalyticsPanel', () => ({
  AdminContentAnalyticsPanel: () => <section data-testid="catalog-analytics">Estadísticas reales</section>,
}));
vi.mock('./AdminContentBulkDialog', () => ({
  AdminContentBulkDialog: ({ action }: { action: string }) => <div role="dialog" aria-label={'Moderación '+action}/>,
}));

const insights = {
  period: '30d', granularity: 'day', timezone: 'America/Bogota',
  totals: { total: 2, products: 1, services: 1, published: 1, inReview: 1,
    unpublished: 0, deleted: 0, deletedOverall: 0, hidden: 0, inactive: 0 },
  series: [], ranking: [],
  filters: { cities: [{ value: 'CO|Cali', label: 'Cali' }],
    categories: [{ id: 'cat-1', name: 'Moda' }] },
  definition: 'Estadísticas derivadas de los registros del catálogo.',
};
const offers = [
  {
    id: 'product-1', internalCode: 'PROD-001', kind: 'PRODUCT', name: 'Zapatillas deportivas',
    description: 'Producto real del catálogo', categoryId: 'cat-1', category: 'Moda',
    priceAmount: '120000.00', currency: 'COP', priceText: null, negotiable: false,
    active: true, adultOnly: false, publicationStatus: 'PUBLISHED', administrativeStatus: 'NONE',
    adminRestrictedAt: null, deletedAt: null, createdAt: '2026-11-01T12:00:00Z',
    updatedAt: '2026-11-18T12:00:00Z', photoId: null, photoAlt: null, likes: 3, views: 8, reports: 0,
    business: { id: 'business-1', publicId: 'NEG-1', name: 'Calzado del Valle',
      city: 'Cali', country: 'CO', publicationStatus: 'PUBLISHED' },
  },
  {
    id: 'service-1', internalCode: 'SERV-001', kind: 'SERVICE', name: 'Reparación de celulares',
    description: 'Servicio real del catálogo', categoryId: null, category: 'Tecnología',
    priceAmount: null, currency: null, priceText: 'Consultar tarifa', negotiable: false,
    active: true, adultOnly: false, publicationStatus: 'REVIEW', administrativeStatus: 'NONE',
    adminRestrictedAt: null, deletedAt: null, createdAt: '2026-11-11T12:00:00Z',
    updatedAt: '2026-11-17T12:00:00Z', photoId: null, photoAlt: null, likes: 1, views: 2, reports: 1,
    business: { id: 'business-2', publicId: 'NEG-2', name: 'Tecnología Norte',
      city: 'Palmira', country: 'CO', publicationStatus: 'REVIEW' },
  },
];

function renderPage() {
  return render(<MemoryRouter initialEntries={['/content']}><AdminContentPage /></MemoryRouter>);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockReturnValue({ permissions: ['catalog:read', 'content:moderate:write'] });
  mocks.getAdminContentCapabilities.mockResolvedValue({ canModerate: true, canDelete: false });
  mocks.getAdminContentInsights.mockResolvedValue(insights);
  mocks.listAdminOffers.mockResolvedValue({
    offers, pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
  });
});
afterEach(() => cleanup());

describe('Admin → Contenido: rediseño con datos y funciones existentes', () => {
  it('muestra únicamente las métricas disponibles y los negocios reales de la respuesta', async () => {
    renderPage();
    await screen.findByText('Zapatillas deportivas');
    await screen.findByText('Reparación de celulares');
    expect(screen.getByRole('group', { name: 'Filtrar contenido por tipo' })).toBeInTheDocument();
    expect(screen.getByText('Calzado del Valle')).toBeInTheDocument();
    expect(screen.getByText('Tecnología Norte')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Contenido del segmento/ })).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /Publicados/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /Ocultos por Admin/ })).toHaveTextContent('0');
    expect(screen.queryByText('Programados')).not.toBeInTheDocument();
    expect(screen.queryByText('Crear contenido')).not.toBeInTheDocument();
    expect(screen.queryByText('Artículo')).not.toBeInTheDocument();
    expect(screen.getByTestId('catalog-analytics')).toBeInTheDocument();
  });

  it('las pestañas y tarjetas aplican filtros soportados por el backend', async () => {
    renderPage();
    await screen.findByText('Zapatillas deportivas');
    fireEvent.click(screen.getByRole('button', { name: 'Servicios' }));
    await waitFor(() => expect(mocks.listAdminOffers).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'SERVICE' })));
    expect(screen.getByRole('button', { name: 'Servicios' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /Ocultos por Admin/ }));
    await waitFor(() => expect(mocks.listAdminOffers).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'SERVICE', status: 'HIDDEN' })));
    expect(screen.getByRole('button', { name: /Ocultos por Admin/ })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    await waitFor(() => expect(mocks.listAdminOffers).toHaveBeenCalledWith(
      expect.objectContaining({ kind: '', status: 'HIDDEN' })));
  });

  it('búsqueda, orden y moderación múltiple conservan su funcionalidad', async () => {
    renderPage();
    await screen.findByText('Zapatillas deportivas');
    fireEvent.change(screen.getByPlaceholderText('Buscar publicación, código o negocio'),
      { target: { value: 'Zapatillas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(mocks.listAdminOffers).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'Zapatillas' })));

    fireEvent.change(screen.getByLabelText('Ordenar publicaciones'), { target: { value: 'name' } });
    await waitFor(() => expect(mocks.listAdminOffers).toHaveBeenCalledWith(
      expect.objectContaining({ order: 'name' })));

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar página (máx. 25)' }));
    expect(screen.getByText('2 seleccionados')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar selección' }));
    expect(screen.getByRole('dialog', { name: 'Moderación HIDE' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    await waitFor(() => expect(mocks.listAdminOffers).toHaveBeenCalledWith(
      expect.objectContaining({ q: '', order: '' })));
  });

  it('no presenta datos falsos cuando la API de estadísticas falla', async () => {
    mocks.getAdminContentInsights.mockRejectedValue(new Error('Sin conexión con estadísticas'));
    renderPage();
    await screen.findByText('Zapatillas deportivas');
    expect(await screen.findByText(/Los indicadores generales no están disponibles/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Contenido del segmento/ })).not.toBeInTheDocument();
    expect(screen.getByText('Calzado del Valle')).toBeInTheDocument();
  });
});
