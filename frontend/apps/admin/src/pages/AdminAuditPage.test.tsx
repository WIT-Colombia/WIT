import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAuditPage } from './AdminAuditPage';

const api = vi.hoisted(() => ({ getAdminVisibilityAudit: vi.fn() }));
vi.mock('../services/adminApiClient', async original => ({
  ...await original<typeof import('../services/adminApiClient')>(),
  getAdminVisibilityAudit: api.getAdminVisibilityAudit,
}));
let permitted = true;
vi.mock('../services/adminService', () => ({
  getSession: () => ({ role: permitted ? 'SUPER_ADMIN' : 'ADMIN',
    permissions: permitted ? ['audit:read'] : ['business:write'] }),
}));
const result = {
  entries: [{
    id: 'audit-one', entityId: 'business-one', action: 'ADMIN_BUSINESS_SET_HIDDEN',
    createdAt: '2026-11-17T13:00:00.000Z', reason: 'Medida administrativa documentada',
    comment: null, actor: { displayName: 'Administración autorizada' },
    previousState: { visibilityStatus: 'VISIBLE', administrativeRestriction: null },
    newState: { visibilityStatus: 'HIDDEN', administrativeRestriction: null },
    business: { id: 'business-one', name: 'Comercio registrado', publicId: 'B-123' },
  }],
  pagination: { page: 1, pageSize: 15, total: 1, totalPages: 1 },
};
const setup = () => render(<MemoryRouter><AdminAuditPage/></MemoryRouter>);
describe('Auditoría de visibilidad de negocios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permitted = true;
    api.getAdminVisibilityAudit.mockResolvedValue(result);
  });
  afterEach(cleanup);
  it('muestra exactamente el evento compartido con la ficha del negocio', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Negocio ocultado por Admin' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Comercio registrado/ })).toHaveAttribute('href', '/businesses/business-one');
    expect(screen.getByText('Medida administrativa documentada')).toBeInTheDocument();
    expect(screen.getByText('Administración autorizada')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Consultar estado anterior y nuevo'));
    expect(screen.getByText('Estado anterior')).toBeInTheDocument();
    expect(screen.getByText('Estado nuevo')).toBeInTheDocument();
    expect(api.getAdminVisibilityAudit).toHaveBeenCalledWith({ page: 1, kind: 'ALL', search: '' });
  });
  it('filtra y busca sin inventar registros', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Negocio ocultado por Admin' });
    fireEvent.change(screen.getByLabelText('Tipo de actuación'), { target: { value: 'SUSPENDED' } });
    await waitFor(() => expect(api.getAdminVisibilityAudit).toHaveBeenCalledWith({ page: 1, kind: 'SUSPENDED', search: '' }));
    fireEvent.change(screen.getByLabelText('Buscar negocio'), { target: { value: 'B-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(api.getAdminVisibilityAudit).toHaveBeenCalledWith({ page: 1, kind: 'SUSPENDED', search: 'B-123' }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(api.getAdminVisibilityAudit).toHaveBeenCalledWith({ page: 1, kind: 'ALL', search: '' }));
  });
  it('bloquea la consulta sin el permiso de auditoría', () => {
    permitted = false;
    setup();
    expect(screen.getByRole('heading', { name: 'Acceso restringido' })).toBeInTheDocument();
    expect(api.getAdminVisibilityAudit).not.toHaveBeenCalled();
  });
});
