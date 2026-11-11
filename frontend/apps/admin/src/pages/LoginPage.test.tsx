import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from './LoginPage';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  authenticateWithPassword: vi.fn(),
}));
vi.mock('../services/adminService', () => auth);

function showLogin() {
  render(<MemoryRouter initialEntries={['/login']}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/dashboard" element={<h1>Panel administrativo autorizado</h1>} />
  </Routes></MemoryRouter>);
}

describe('XAMUKO Admin: acceso con cuenta existente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getSession.mockReturnValue(null);
    auth.authenticateWithPassword.mockResolvedValue({ id: 'super-admin' });
  });
  afterEach(() => cleanup());

  it('presenta solo correo y contraseña, sin Google ni código de activación', () => {
    showLogin();
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continuar con google/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Código de activación inicial')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /passkey/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registr|crear cuenta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /registr|crear cuenta/i })).not.toBeInTheDocument();
  });

  it('entra únicamente cuando el backend acepta la cuenta administrativa', async () => {
    showLogin();
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'admin@example.test' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'una-clave-de-prueba' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(auth.authenticateWithPassword).toHaveBeenCalledWith('admin@example.test', 'una-clave-de-prueba', false));
    expect(await screen.findByText('Panel administrativo autorizado')).toBeInTheDocument();
  });

  it('no permite entrar si el backend rechaza el rol administrativo', async () => {
    auth.authenticateWithPassword.mockRejectedValue(new Error('La cuenta no tiene acceso administrativo.'));
    showLogin();
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'usuario@example.test' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'una-clave-de-prueba' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La cuenta no tiene acceso administrativo.');
    expect(screen.queryByText('Panel administrativo autorizado')).not.toBeInTheDocument();
  });

  it('conserva recordar sesión, visibilidad y bloqueo durante el acceso', async () => {
    let finishLogin!: () => void;
    auth.authenticateWithPassword.mockImplementationOnce(() => new Promise<void>(resolve => { finishLogin = resolve; }));
    showLogin();
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'admin@example.test' } });
    const passwordInput = screen.getByLabelText('Contraseña');
    fireEvent.change(passwordInput, { target: { value: 'una-clave-de-prueba' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByLabelText('Mantener sesión iniciada'));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(auth.authenticateWithPassword).toHaveBeenCalledWith('admin@example.test', 'una-clave-de-prueba', true);
    expect(screen.getByRole('button', { name: 'Iniciando sesión…' })).toBeDisabled();
    expect(screen.getByLabelText('Correo electrónico')).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    finishLogin();
    expect(await screen.findByText('Panel administrativo autorizado')).toBeInTheDocument();
  });

  it('conserva la redirección de una sesión administrativa existente', async () => {
    auth.getSession.mockReturnValue({ id: 'super-admin' });
    showLogin();
    expect(await screen.findByText('Panel administrativo autorizado')).toBeInTheDocument();
    expect(auth.authenticateWithPassword).not.toHaveBeenCalled();
  });
});
