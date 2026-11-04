import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GoogleCallbackPage } from './GoogleCallbackPage';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), authenticateWithPasskey: vi.fn() }));
vi.mock('../services/adminService', () => auth);

function show(path = '/auth/google/callback') {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
    <Route path="/dashboard" element={<h1>Panel administrativo autorizado</h1>} />
    <Route path="/login" element={<h1>Inicio de sesión</h1>} />
  </Routes></MemoryRouter>);
}

describe('Admin Google OAuth callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getSession.mockReturnValue(null);
    auth.authenticateWithPasskey.mockResolvedValue({ id: 'admin-test' });
  });
  afterEach(() => cleanup());

  it('no concede acceso automáticamente al regresar de Google', () => {
    show();
    expect(screen.getByRole('button', { name: 'Verificar passkey y entrar' })).toBeInTheDocument();
    expect(auth.authenticateWithPasskey).not.toHaveBeenCalled();
    expect(screen.queryByText('Panel administrativo autorizado')).not.toBeInTheDocument();
  });

  it('requiere un toque explícito para WebAuthn y luego abre el panel', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Verificar passkey y entrar' }));
    await waitFor(() => expect(auth.authenticateWithPasskey).toHaveBeenCalledOnce());
    expect(await screen.findByText('Panel administrativo autorizado')).toBeInTheDocument();
  });

  it('muestra errores de Google sin intentar WebAuthn', () => {
    show('/auth/google/callback?error=GOOGLE_NOT_CONFIGURED');
    expect(screen.getByRole('alert')).toHaveTextContent('no está configurado');
    expect(screen.queryByRole('button', { name: 'Verificar passkey y entrar' })).not.toBeInTheDocument();
    expect(auth.authenticateWithPasskey).not.toHaveBeenCalled();
  });

  it('no inicia sesión si falla la verificación de passkey', async () => {
    auth.authenticateWithPasskey.mockRejectedValue(new Error('Passkey rechazada'));
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Verificar passkey y entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo verificar la passkey');
    expect(screen.queryByText('Panel administrativo autorizado')).not.toBeInTheDocument();
  });
});
