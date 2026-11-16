import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminCategoriesPage } from './AdminCategoriesPage';
import type { AdminCategoryRecord } from '../services/adminApiClient';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), listAdminCategories: vi.fn() }));
vi.mock('../services/adminService', () => ({ getSession: mocks.getSession }));
vi.mock('../services/adminApiClient', () => ({ listAdminCategories: mocks.listAdminCategories }));

const records: AdminCategoryRecord[] = [
  { id: '1', code: 'RESTAURANTS', active: true, sortOrder: 1,
    translations: [{ locale: 'es', name: 'Restaurantes' }, { locale: 'en', name: 'Restaurants' }],
    productCount: 8, serviceCount: 3, _count: { businesses: 4, offers: 11 } },
  { id: '2', code: 'FASHION', active: true, sortOrder: 2,
    translations: [{ locale: 'es', name: 'Moda y accesorios' }],
    productCount: 0, serviceCount: 0, _count: { businesses: 0, offers: 0 } },
  { id: '3', code: 'HEALTH', active: false, sortOrder: 3,
    translations: [{ locale: 'es', name: 'Salud y bienestar' }],
    productCount: 0, serviceCount: 2, _count: { businesses: 1, offers: 2 } },
];
function show() {
  return render(<MemoryRouter initialEntries={['/categories']}><AdminCategoriesPage /></MemoryRouter>);
}
beforeEach(() => {
  mocks.getSession.mockReturnValue({
    role: 'SUPER_ADMIN', realRole: 'SUPER_ADMIN', permissions: ['catalog:read', 'business:write'],
  });
  mocks.listAdminCategories.mockResolvedValue(records);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Admin → Categorías', () => {
  it('uses real business, product and service counts, including zero', async () => {
    show();
    expect(await screen.findByRole('heading', { name: 'Categorías' })).toBeInTheDocument();
    const metrics = document.querySelector<HTMLElement>('.cat-metrics')!;
    expect(within(metrics).getByText('Categorías totales')).toBeInTheDocument();
    expect(within(metrics).getByText('3')).toBeInTheDocument();
    expect(within(metrics).getByText('Negocios asignados')).toBeInTheDocument();
    expect(within(metrics).getByText('5')).toBeInTheDocument();
    expect(within(metrics).getByText('Productos y servicios')).toBeInTheDocument();
    expect(within(metrics).getByText('13')).toBeInTheDocument();
    const directory = document.querySelector<HTMLElement>('.cat-table')!;
    const fashion = within(directory).getByText('Moda y accesorios').closest('tr')!;
    expect(within(fashion).getAllByText('0')).toHaveLength(3);
  });

  it('filters by state and search and does not hide independent analytics', async () => {
    show();
    await screen.findByRole('heading', { name: 'Categorías' });
    const directory = document.querySelector<HTMLElement>('.cat-directory')!;
    fireEvent.change(within(directory).getByPlaceholderText('Nombre, código o idioma'), {
      target: { value: 'Salud' },
    });
    const table = document.querySelector<HTMLElement>('.cat-table')!;
    expect(within(table).getByText('Salud y bienestar')).toBeInTheDocument();
    expect(within(table).queryByText('Restaurantes')).not.toBeInTheDocument();
    fireEvent.change(within(directory).getByLabelText('Estado'), { target: { value: 'ACTIVE' } });
    expect(within(directory).getByText('No hay categorías con esos filtros')).toBeInTheDocument();
    fireEvent.click(within(directory).getByRole('button', { name: 'Restablecer filtros' }));
    expect(within(document.querySelector<HTMLElement>('.cat-table')!).getByText('Restaurantes')).toBeInTheDocument();
  });

  it('opens a descriptive detail drawer with the actual destination routes', async () => {
    show();
    await screen.findByRole('heading', { name: 'Categorías' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle de Restaurantes' }));
    const dialog = screen.getByRole('dialog', { name: 'Restaurantes' });
    expect(within(dialog).getByText('RESTAURANTS')).toBeInTheDocument();
    expect(within(dialog).getByText('Restaurants')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /Ver negocios/ }))
      .toHaveAttribute('href', '/businesses?categoryId=1');
    expect(within(dialog).getByRole('link', { name: /Ver contenido/ }))
      .toHaveAttribute('href', '/content?categoryId=1');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar ficha de categoría' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('protects the module from sessions without catalog permissions', () => {
    mocks.getSession.mockReturnValue({ role: 'ADMIN', realRole: 'ADMIN', permissions: [] });
    show();
    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
    expect(mocks.listAdminCategories).not.toHaveBeenCalled();
  });
});
