import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaidPlanControl } from './PaidPlanControl';
import { getAdminPaidPlans, updateAdminPaidPlan } from '../services/adminApiClient';
import { getSession } from '../services/adminService';

vi.mock('../services/adminApiClient', () => ({
  getAdminPaidPlans: vi.fn(), updateAdminPaidPlan: vi.fn(),
}));
vi.mock('../services/adminService', () => ({ getSession: vi.fn() }));
vi.mock('@wit/utils', () => ({ refreshPaidPlans: vi.fn().mockResolvedValue(undefined) }));

beforeEach(() => {
  vi.mocked(getSession).mockReturnValue({ role: 'SUPER_ADMIN' } as any);
  vi.mocked(getAdminPaidPlans).mockResolvedValue({ businessPro: false, xamukoPlus: false });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('Interruptores maestros de planes', () => {
  it.each(['businessPro', 'xamukoPlus'] as const)('requiere motivo y CONFIRMAR para habilitar %s', async plan => {
    vi.mocked(updateAdminPaidPlan).mockResolvedValue({ businessPro: plan === 'businessPro', xamukoPlus: plan === 'xamukoPlus' });
    const name = plan === 'businessPro' ? 'Business PRO' : 'XAMUKO Plus';
    render(<PaidPlanControl plan={plan} name={name} />);
    fireEvent.click(await screen.findByRole('button', { name: `Habilitar ${name}` }));
    const confirm = screen.getByRole('button', { name: 'Confirmar habilitar' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Registra el motivo y quién autoriza este cambio'), {
      target: { value: 'Activación administrativa debidamente autorizada' },
    });
    fireEvent.change(screen.getByPlaceholderText('CONFIRMAR'), { target: { value: 'CONFIRMAR' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(updateAdminPaidPlan).toHaveBeenCalledWith(
      plan, true, 'Activación administrativa debidamente autorizada', 'CONFIRMAR',
    ));
    expect(await screen.findByText(new RegExp(name + ': habilitado'))).toBeInTheDocument();
  });

  it('informa que deshabilitar suspende las funciones PRO incluso a suscripciones vigentes', async () => {
    vi.mocked(getAdminPaidPlans).mockResolvedValue({ businessPro: true, xamukoPlus: false });
    render(<PaidPlanControl plan="businessPro" name="Business PRO" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Deshabilitar Business PRO' }));
    expect(screen.getByText(/suspenderá las funciones exclusivas del plan incluso para suscripciones vigentes/)).toBeInTheDocument();
    expect(updateAdminPaidPlan).not.toHaveBeenCalled();
  });

  it('conserva el estado previo si falla el guardado', async () => {
    vi.mocked(updateAdminPaidPlan).mockRejectedValue(new Error('Error de conexión'));
    render(<PaidPlanControl plan="businessPro" name="Business PRO" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Habilitar Business PRO' }));
    fireEvent.change(screen.getByPlaceholderText('Registra el motivo y quién autoriza este cambio'), {
      target: { value: 'Razón válida para la solicitud' },
    });
    fireEvent.change(screen.getByPlaceholderText('CONFIRMAR'), { target: { value: 'CONFIRMAR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar habilitar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Error de conexión');
    expect(screen.getByText('Deshabilitado')).toBeInTheDocument();
  });

  it('impide a administradores ordinarios modificar los planes', async () => {
    vi.mocked(getSession).mockReturnValue({ role: 'ADMIN' } as any);
    render(<PaidPlanControl plan="xamukoPlus" name="XAMUKO Plus" />);
    expect(await screen.findByText('Deshabilitado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /habilitar/i })).not.toBeInTheDocument();
  });
});
