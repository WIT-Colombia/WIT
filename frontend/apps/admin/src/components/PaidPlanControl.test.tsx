import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PaidPlanControl } from './PaidPlanControl';
import { AdminApiError, getAdminPaidPlans, updateAdminPaidPlan } from '../services/adminApiClient';
import { getSession } from '../services/adminService';

vi.mock('../services/adminApiClient', () => ({
  AdminApiError: class AdminApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
      this.name = 'AdminApiError';
    }
  },
  getAdminPaidPlans: vi.fn(),
  updateAdminPaidPlan: vi.fn(),
}));
vi.mock('../services/adminService', () => ({ getSession: vi.fn() }));
vi.mock('@wit/utils', () => ({ refreshPaidPlans: vi.fn() }));

async function switchFor(plan: string) {
  const toggle = await screen.findByRole('switch', { name: `Activar o desactivar ${plan}` }) as HTMLInputElement;
  await waitFor(() => expect(toggle.disabled).toBe(false));
  return toggle;
}
beforeEach(() => {
  vi.mocked(getSession).mockReturnValue({ role: 'SUPER_ADMIN' } as ReturnType<typeof getSession>);
  vi.mocked(getAdminPaidPlans).mockResolvedValue({ businessPro: true, xamukoPlus: false });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('Interruptores maestros de planes pagos', () => {
  it('muestra siempre el interruptor, exige motivo y CONFIRMAR para deshabilitar Business PRO', async () => {
    vi.mocked(updateAdminPaidPlan).mockResolvedValue({ businessPro: false, xamukoPlus: false });
    render(<PaidPlanControl plan="businessPro" name="Business PRO" />);
    const toggle = await switchFor('Business PRO');
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true); // Solo cambia después de confirmar con la API.
    const confirm = screen.getByRole('button', { name: 'Confirmar deshabilitar' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(updateAdminPaidPlan).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('Registra el motivo y quién autoriza este cambio'), {
      target: { value: 'Desactivación autorizada del plan para mantenimiento.' },
    });
    fireEvent.change(screen.getByPlaceholderText('CONFIRMAR'), { target: { value: 'CONFIRMAR' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(updateAdminPaidPlan).toHaveBeenCalledWith(
      'businessPro', false, 'Desactivación autorizada del plan para mantenimiento.', 'CONFIRMAR',
    ));
    await waitFor(() => expect(toggle.checked).toBe(false));
    expect(await screen.findByText('Business PRO: deshabilitado en toda la plataforma.')).toBeTruthy();
  });

  it('con un endpoint 404 mantiene visible el interruptor, bloqueado y con diagnóstico', async () => {
    vi.mocked(getAdminPaidPlans).mockRejectedValueOnce(new AdminApiError(404, 'NOT_FOUND', 'Not found'))
      .mockResolvedValueOnce({ businessPro: false, xamukoPlus: false });
    render(<PaidPlanControl plan="businessPro" name="Business PRO" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404');
    const toggle = screen.getByRole('switch', { name: 'Activar o desactivar Business PRO' }) as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    expect(screen.getByText('No conectado')).toBeTruthy();
    expect(updateAdminPaidPlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar conexión' }));
    await waitFor(() => expect(toggle.disabled).toBe(false));
    expect(toggle.checked).toBe(false);
  });

  it('el interruptor Xamuko Plus no inventa funciones o cobros todavía inexistentes', async () => {
    render(<PaidPlanControl plan="xamukoPlus" name="Xamuko Plus" />);
    expect(await screen.findByText(/La contratación y los cobros siguen deshabilitados/)).toBeTruthy();
    const toggle = await switchFor('Xamuko Plus');
    expect(toggle.checked).toBe(false);
  });

  it('habilitar Plus exige confirmación, pero no crea cobros', async () => {
    vi.mocked(getAdminPaidPlans).mockResolvedValue({ businessPro: false, xamukoPlus: false });
    vi.mocked(updateAdminPaidPlan).mockResolvedValue({ businessPro: false, xamukoPlus: true });
    render(<PaidPlanControl plan="xamukoPlus" name="Xamuko Plus" />);
    const toggle = await switchFor('Xamuko Plus');
    fireEvent.click(toggle);
    expect(screen.getByText(/La activación no genera cobros/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Registra el motivo y quién autoriza este cambio'), {
      target: { value: 'Habilitar indicador para preparación administrativa del plan Plus' },
    });
    fireEvent.change(screen.getByPlaceholderText('CONFIRMAR'), { target: { value: 'CONFIRMAR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar habilitar' }));
    await waitFor(() => expect(updateAdminPaidPlan).toHaveBeenCalledWith(
      'xamukoPlus', true, 'Habilitar indicador para preparación administrativa del plan Plus', 'CONFIRMAR',
    ));
    await waitFor(() => expect(toggle.checked).toBe(true));
  });

  it('un fallo de guardado conserva el estado anterior y permite reintentar', async () => {
    vi.mocked(updateAdminPaidPlan).mockRejectedValueOnce(new Error('Error de conexión'));
    render(<PaidPlanControl plan="businessPro" name="Business PRO" />);
    const toggle = await switchFor('Business PRO');
    fireEvent.click(toggle);
    expect(screen.getByText(/incluso para suscripciones vigentes/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Registra el motivo y quién autoriza este cambio'), {
      target: { value: 'Suspensión por validación técnica de la plataforma XAMUKO' },
    });
    fireEvent.change(screen.getByPlaceholderText('CONFIRMAR'), { target: { value: 'CONFIRMAR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar deshabilitar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Error de conexión');
    expect(toggle.checked).toBe(true);
    expect(screen.getByText('Habilitado')).toBeTruthy();
  });

  it('el administrador ordinario ve el estado pero no puede utilizar el interruptor', async () => {
    vi.mocked(getSession).mockReturnValue({ role: 'ADMIN' } as ReturnType<typeof getSession>);
    render(<PaidPlanControl plan="businessPro" name="Business PRO" />);
    expect(await screen.findByText(/Solo el superadministrador puede modificar/)).toBeTruthy();
    const toggle = screen.getByRole('switch', { name: 'Activar o desactivar Business PRO' }) as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
  });
});
