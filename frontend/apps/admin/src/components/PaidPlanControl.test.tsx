import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PaidPlanControl } from './PaidPlanControl';
import { getAdminPaidPlans, updateAdminPaidPlan } from '../services/adminApiClient';
import { getSession } from '../services/adminService';

vi.mock('../services/adminApiClient', () => ({
  getAdminPaidPlans: vi.fn(),
  updateAdminPaidPlan: vi.fn(),
}));
vi.mock('../services/adminService', () => ({ getSession: vi.fn() }));
vi.mock('@wit/utils', () => ({ refreshPaidPlans: vi.fn() }));

beforeEach(() => {
  vi.mocked(getSession).mockReturnValue({ role: 'SUPER_ADMIN' } as ReturnType<typeof getSession>);
  vi.mocked(getAdminPaidPlans).mockResolvedValue({ businessPro: true, xamukoPlus: false });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('Interruptores maestros de planes pagos', () => {
  it('exige justificación y CONFIRMAR para deshabilitar Business PRO', async () => {
    vi.mocked(updateAdminPaidPlan).mockResolvedValue({ businessPro: false, xamukoPlus: false });
    render(<PaidPlanControl plan="businessPro" name="Business PRO" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Deshabilitar Business PRO' }));

    const confirm = screen.getByRole('button', { name: 'Confirmar deshabilitar' });
    expect(confirm.hasAttribute('disabled')).toBe(true);
    expect(updateAdminPaidPlan).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('Registra el motivo y quién autoriza este cambio'), {
      target: { value: 'Desactivación autorizada del plan para mantenimiento.' },
    });
    fireEvent.change(screen.getByPlaceholderText('CONFIRMAR'), { target: { value: 'CONFIRMAR' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(updateAdminPaidPlan).toHaveBeenCalledWith(
      'businessPro', false, 'Desactivación autorizada del plan para mantenimiento.', 'CONFIRMAR',
    ));
    expect(await screen.findByText('Business PRO: deshabilitado en toda la plataforma.')).toBeTruthy();
  });

  it('el interruptor Plus no inventa funciones o cobros todavía inexistentes', async () => {
    render(<PaidPlanControl plan="xamukoPlus" name="Xamuko Plus" />);
    expect(await screen.findByText(/Actualmente no existen contratación, cobros ni beneficios Plus operativos/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Habilitar Xamuko Plus' })).toBeTruthy();
  });


  it('habilitar Plus exige confirmación, pero no crea cobros', async () => {
    vi.mocked(getAdminPaidPlans).mockResolvedValue({ businessPro: false, xamukoPlus: false });
    vi.mocked(updateAdminPaidPlan).mockResolvedValue({ businessPro: false, xamukoPlus: true });
    render(<PaidPlanControl plan="xamukoPlus" name="Xamuko Plus" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Habilitar Xamuko Plus' }));
    expect(screen.getByText(/Plus seguirá sin funciones de pago ni beneficios implementados/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Registra el motivo y quién autoriza este cambio'), {
      target: { value: 'Habilitar indicador para preparación administrativa del plan Plus' },
    });
    fireEvent.change(screen.getByPlaceholderText('CONFIRMAR'), { target: { value: 'CONFIRMAR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar habilitar' }));
    await waitFor(() => expect(updateAdminPaidPlan).toHaveBeenCalledWith(
      'xamukoPlus', true, 'Habilitar indicador para preparación administrativa del plan Plus', 'CONFIRMAR',
    ));
  });

  it('un fallo de guardado conserva el estado anterior y permite reintentar', async () => {
    vi.mocked(updateAdminPaidPlan).mockRejectedValueOnce(new Error('Error de conexión'));
    render(<PaidPlanControl plan="businessPro" name="Business PRO" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Deshabilitar Business PRO' }));
    expect(screen.getByText(/incluso para suscripciones vigentes/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Registra el motivo y quién autoriza este cambio'), {
      target: { value: 'Suspensión por validación técnica de la plataforma XAMUKO' },
    });
    fireEvent.change(screen.getByPlaceholderText('CONFIRMAR'), { target: { value: 'CONFIRMAR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar deshabilitar' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Habilitado')).toBeTruthy();
  });

  it('no permite modificar planes a administradores que no son SUPER_ADMIN', async () => {
    vi.mocked(getSession).mockReturnValue({ role: 'ADMIN' } as ReturnType<typeof getSession>);
    render(<PaidPlanControl plan="businessPro" name="Business PRO" />);
    expect(await screen.findByText(/Solo el superadministrador puede modificar/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Deshabilitar Business PRO' })).toBeNull();
  });
});
