import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ZoneAvailabilityNotice } from './ZoneAvailabilityNotice';

const state = vi.hoisted(() => ({
  authenticated: false,
  get: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), remember: vi.fn(),
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: state.authenticated, status: state.authenticated ? 'authenticated' : 'anonymous' }),
}));
vi.mock('../services/zoneAlertService', () => ({
  getZoneAlert: state.get,
  subscribeZoneAlert: state.subscribe,
  unsubscribeZoneAlert: state.unsubscribe,
  savePendingZoneAlert: state.remember,
  ZONE_ALERT_CHANGED: 'xamuko-zone-alert-changed',
}));

function show() {
  return render(<MemoryRouter initialEntries={['/']}><Routes>
    <Route path="/" element={<ZoneAvailabilityNotice city="Villavicencio" region="Meta" />} />
    <Route path="/register" element={<h1>Pantalla de registro</h1>} />
  </Routes></MemoryRouter>);
}
beforeEach(() => {
  vi.clearAllMocks();
  state.authenticated = false;
  state.get.mockResolvedValue({ subscribed: false, notified: false, city: 'Villavicencio' });
  state.subscribe.mockResolvedValue({ subscribed: true, city: 'Villavicencio' });
  state.unsubscribe.mockResolvedValue({ subscribed: false });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      zone: { code: '50001', city: 'Villavicencio', region: 'Meta', state: 'CLOSED', opensAt: null, timezone: 'America/Bogota', virtualAvailable: true },
      serverTime: new Date().toISOString(),
    }),
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Aviso de apertura territorial', () => {
  it('muestra el único botón, sin formulario de correo, y manda a registro al visitante', async () => {
    show();
    const button = await screen.findByRole('button', { name: 'Notificarme cuando lleguen' });
    expect(screen.queryByPlaceholderText('Correo electrónico')).toBeNull();
    expect(screen.queryByText('Próximamente')).toBeNull();
    fireEvent.click(button);
    expect(state.remember).toHaveBeenCalledWith('50001', 'Villavicencio');
    expect(await screen.findByRole('heading', { name: 'Pantalla de registro' })).toBeInTheDocument();
  });
  it('activa y cancela la suscripción únicamente para la cuenta autenticada', async () => {
    state.authenticated = true;
    show();
    const button = await screen.findByRole('button', { name: 'Notificarme cuando lleguen' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(state.subscribe).toHaveBeenCalledWith('50001');
    expect(await screen.findByRole('button', { name: 'Notificación activada' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Te avisaremos en Xamuko cuando habilitemos Villavicencio.');
    fireEvent.click(screen.getByRole('button', { name: 'Notificación activada' }));
    expect(state.unsubscribe).toHaveBeenCalledWith('50001');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notificarme cuando lleguen' })).toHaveAttribute('aria-pressed', 'false'));
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('no muestra Ruta no encontrada ni confirma nada si el backend sigue sin desplegar', async () => {
    state.authenticated = true;
    state.get.mockRejectedValueOnce(new Error('Ruta no encontrada.'));
    show();
    const button = await screen.findByRole('button', { name: 'Notificarme cuando lleguen' });
    await waitFor(() => expect(button).toBeDisabled());
    expect(screen.queryByText('Ruta no encontrada.')).toBeNull();
    expect(screen.queryByText('¡Notificación activada!')).toBeNull();
    expect(state.subscribe).not.toHaveBeenCalled();
  });
});
