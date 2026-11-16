import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AdminZonesPage } from './AdminZonesPage';
import type { ZoneRegistry } from '../services/adminApiClient';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAdminZones: vi.fn(),
  updateAdminZone: vi.fn(),
}));
vi.mock('../services/adminService', () => ({ getSession: mocks.getSession }));
vi.mock('../services/adminApiClient', () => ({
  getAdminZones: mocks.getAdminZones,
  updateAdminZone: mocks.updateAdminZone,
}));

const opening = new Date(Date.now() + 8 * 86400000).toISOString();
const fixture: ZoneRegistry = {
  serverTime: new Date().toISOString(),
  nextLaunch: { scope: 'MUNICIPALITY', code: '76001', name: 'Cali',
    opensAt: opening, timezone: 'America/Bogota' },
  municipalities: [
    { code: '76520', name: 'Palmira', context: 'Valle del Cauca', departmentCode: '76',
      state: 'OPEN', opensAt: null, source: 'INITIAL', configured: false, registered: 3, ready: 2 },
    { code: '76001', name: 'Cali', context: 'Valle del Cauca', departmentCode: '76',
      state: 'SCHEDULED', opensAt: opening, source: 'DIRECT', configured: true, registered: 5, ready: 3 },
    { code: '76892', name: 'Yumbo', context: 'Valle del Cauca', departmentCode: '76',
      state: 'CLOSED', opensAt: null, source: 'DEFAULT', configured: false, registered: 0, ready: 0 },
  ],
  departments: [
    { code: '76', name: 'Valle del Cauca', state: 'CLOSED', opensAt: null,
      source: 'DEFAULT', configured: false, registered: 8, ready: 5 },
  ],
  records: [],
  audit: [],
  summary: { municipalitiesActive: 1, municipalitiesScheduled: 1,
    municipalitiesClosed: 1, registered: 8, ready: 5 },
};

beforeEach(() => {
  mocks.getSession.mockReturnValue({ role: 'SUPER_ADMIN' });
  mocks.getAdminZones.mockResolvedValue(fixture);
  mocks.updateAdminZone.mockResolvedValue({ zone: { id: 'zone-1', state: 'PAUSED' } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Admin → Zonas: experiencia visual y operaciones reales', () => {
  it('muestra indicadores reales, incluido cero, y la próxima apertura sincronizada', async () => {
    render(<AdminZonesPage />);
    expect(await screen.findByRole('heading', { name: 'Zonas y expansión territorial' })).toBeInTheDocument();
    const metrics = document.querySelector('.zones-metrics')!;
    expect(within(metrics as HTMLElement).getByText('Municipios activos')).toBeInTheDocument();
    expect(within(metrics as HTMLElement).getByText('Negocios registrados')).toBeInTheDocument();
    expect(within(metrics as HTMLElement).getByText('8')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cali' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Tiempo restante hasta el lanzamiento/)).toBeInTheDocument();
    expect(screen.getByText('Yumbo')).toBeInTheDocument();
    const row = screen.getByText('Yumbo').closest('tr')!;
    expect(within(row).getAllByText('0')).toHaveLength(2);
  });

  it('permite buscar, filtrar y alternar municipios, departamentos y auditoría', async () => {
    render(<AdminZonesPage />);
    await screen.findByRole('heading', { name: 'Zonas y expansión territorial' });
    fireEvent.change(screen.getByPlaceholderText(/Ciudad, departamento/), { target: { value: 'Yumbo' } });
    expect(screen.getByText('Yumbo')).toBeInTheDocument();
    expect(screen.queryByText('Palmira')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Departamentos/ }));
    expect(screen.getByText('Valle del Cauca')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Auditoría/ }));
    expect(screen.getByText('Sin actuaciones registradas')).toBeInTheDocument();
  });

  it('exige motivo y confirmación y envía la decisión al backend', async () => {
    render(<AdminZonesPage />);
    await screen.findByRole('heading', { name: 'Zonas y expansión territorial' });
    fireEvent.click(screen.getByRole('button', { name: 'Gestionar Palmira' }));
    const dialog = screen.getByRole('dialog', { name: 'Palmira' });
    expect(within(dialog).getByText(/Apertura inicial/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Acción territorial'), { target: { value: 'PAUSED' } });
    fireEvent.change(within(dialog).getByLabelText(/Motivo administrativo/), {
      target: { value: 'Pausa operativa autorizada para controlar la expansión.' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Confirmación de seguridad/), {
      target: { value: 'APLICAR' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar decisión' }));
    await waitFor(() => expect(mocks.updateAdminZone).toHaveBeenCalledWith({
      scope: 'MUNICIPALITY', code: '76520', state: 'PAUSED', opensAt: null,
      reason: 'Pausa operativa autorizada para controlar la expansión.',
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('bloquea acceso si no es SUPER_ADMIN y no consulta el registro', () => {
    mocks.getSession.mockReturnValue({ role: 'ADMIN' });
    render(<AdminZonesPage />);
    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
    expect(mocks.getAdminZones).not.toHaveBeenCalled();
  });
});
