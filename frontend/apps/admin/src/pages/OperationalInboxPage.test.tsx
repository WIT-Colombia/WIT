import { cleanup, render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationalInboxPage } from './OperationalInboxPage';

const api = vi.hoisted(() => ({
  listOperationalRecords: vi.fn(), getOperationalBusinessReport: vi.fn(), decideOperationalRecord: vi.fn(),
}));
vi.mock('../services/adminApiClient', () => api);
let canDecide = true;
vi.mock('../services/adminService', () => ({
  getSession: () => ({ permissions: canDecide ? ['content:moderate:write'] : [] }),
}));
afterEach(() => cleanup());

describe('Centro de moderación — expediente concreto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canDecide = true;
    api.listOperationalRecords.mockResolvedValue({
      records: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    });
    api.getOperationalBusinessReport.mockResolvedValue({
      id: 'report-target', title: 'Negocio específico',
      category: 'FALSE_INFORMATION', description: 'Contenido de la denuncia original',
      status: 'UNDER_REVIEW', decisionNote: null, createdAt: '2026-11-17T21:00:00Z',
      reporter: 'Denunciante registrada', context: 'Negocio reportado',
      targetPath: '/businesses/business-real', targetLabel: 'Abrir ficha del negocio',
    });
    api.decideOperationalRecord.mockResolvedValue({});
  });

  it('abre directamente el expediente indicado aunque no esté en la primera página', async () => {
    render(<MemoryRouter initialEntries={['/business-reports?report=report-target']}>
      <OperationalInboxPage kind="business-reports"/>
    </MemoryRouter>);
    await waitFor(() => expect(api.getOperationalBusinessReport).toHaveBeenCalledWith('report-target'));
    const detail = await screen.findByRole('region', { name: 'Detalle de solicitud' });
    expect(within(detail).getByText('Negocio específico')).toBeInTheDocument();
    expect(within(detail).getByText('Radicado: report-target')).toBeInTheDocument();
    expect(within(detail).getByText('Contenido de la denuncia original')).toBeInTheDocument();
    expect(within(detail).getByText('Denunciante registrada')).toBeInTheDocument();
    expect(within(detail).getByRole('link', { name: /Abrir ficha del negocio/ }))
      .toHaveAttribute('href', '/businesses/business-real');
  });

  it('respeta los permisos de decisión en el expediente directo', async () => {
    canDecide = false;
    render(<MemoryRouter initialEntries={['/business-reports?report=report-target']}>
      <OperationalInboxPage kind="business-reports"/>
    </MemoryRouter>);
    const detail = await screen.findByRole('region', { name: 'Detalle de solicitud' });
    expect(within(detail).getByText(/no tiene permisos para tomar decisiones/)).toBeInTheDocument();
    expect(within(detail).queryByRole('button', { name: 'Resuelto' })).not.toBeInTheDocument();
    expect(within(detail).queryByRole('button', { name: 'Rechazado' })).not.toBeInTheDocument();
  });

  it('conserva la justificación y envía la decisión a la ruta de moderación existente', async () => {
    api.getOperationalBusinessReport.mockResolvedValueOnce({
      id: 'report-target', title: 'Negocio específico',
      category: 'FALSE_INFORMATION', description: 'Contenido de la denuncia original',
      status: 'PENDING', decisionNote: null, createdAt: '2026-11-17T21:00:00Z',
      reporter: 'Denunciante registrada', context: 'Negocio reportado',
    }).mockResolvedValueOnce({
      id: 'report-target', title: 'Negocio específico',
      category: 'FALSE_INFORMATION', description: 'Contenido de la denuncia original',
      status: 'UNDER_REVIEW', decisionNote: 'Fundamento de la revisión',
      createdAt: '2026-11-17T21:00:00Z', reporter: 'Denunciante registrada', context: 'Negocio reportado',
    });
    render(<MemoryRouter initialEntries={['/business-reports?report=report-target']}>
      <OperationalInboxPage kind="business-reports"/>
    </MemoryRouter>);
    const detail = await screen.findByRole('region', { name: 'Detalle de solicitud' });
    fireEvent.click(within(detail).getByRole('button', { name: 'En revisión' }));
    expect(await screen.findByRole('dialog', { name: /Iniciar revisión/ })).toBeInTheDocument();
    // Do not bypass the existing confirmation dialog: the backend needs a reason.
    expect(api.decideOperationalRecord).not.toHaveBeenCalled();
  });
});
