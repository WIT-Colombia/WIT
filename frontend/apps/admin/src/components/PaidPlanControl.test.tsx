import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PaidPlanControl } from './PaidPlanControl';
import { getAdminPaidPlans, updateAdminPaidPlan } from '../services/adminApiClient';
import { getSession } from '../services/adminService';
vi.mock('../services/adminApiClient', () => ({ getAdminPaidPlans: vi.fn(), updateAdminPaidPlan: vi.fn() }));
vi.mock('../services/adminService', () => ({ getSession: vi.fn() }));
vi.mock('@wit/utils', () => ({ refreshPaidPlans: vi.fn() }));
beforeEach(() => {
  vi.mocked(getSession).mockReturnValue({ role: 'SUPER_ADMIN' } as any);
  vi.mocked(getAdminPaidPlans).mockResolvedValue({ businessPro: false, xamukoPlus: false });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe('Disponibilidad global de planes', () => {
  it.each(['businessPro', 'xamukoPlus'] as const)('activa y desactiva %s con el resultado del servidor', async plan => {
    vi.mocked(updateAdminPaidPlan).mockResolvedValueOnce({ businessPro: false, xamukoPlus: false, [plan]: true })
      .mockResolvedValueOnce({ businessPro: false, xamukoPlus: false });
    render(<PaidPlanControl plan={plan} name={plan} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activar plan' }));
    await waitFor(() => expect(updateAdminPaidPlan).toHaveBeenCalledWith(plan, true));
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar plan' }));
    await waitFor(() => expect(updateAdminPaidPlan).toHaveBeenLastCalledWith(plan, false));
    expect(await screen.findByRole('button', { name: 'Activar plan' })).toBeEnabled();
  });
  it('conserva el estado anterior si falla el guardado', async () => {
    vi.mocked(updateAdminPaidPlan).mockRejectedValue(new Error('Error de conexión'));
    render(<PaidPlanControl plan="businessPro" name="Business Pro" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activar plan' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Error de conexión');
    expect(screen.getByRole('button', { name: 'Activar plan' })).toBeEnabled();
    expect(screen.queryByText('Activado')).not.toBeInTheDocument();
  });
  it('permite reintentar una lectura fallida sin activar el plan', async () => {
    vi.mocked(getAdminPaidPlans).mockRejectedValueOnce(new Error('offline'));
    render(<PaidPlanControl plan="businessPro" name="Business Pro" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: 'Activar plan' })).toBeEnabled();
    expect(updateAdminPaidPlan).not.toHaveBeenCalled();
  });
  it('no ofrece cambios a administradores sin el rol principal', async () => {
    vi.mocked(getSession).mockReturnValue({ role: 'ADMIN' } as any);
    render(<PaidPlanControl plan="xamukoPlus" name="Xamuko Plus" />);
    await screen.findByText('Desactivado');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
