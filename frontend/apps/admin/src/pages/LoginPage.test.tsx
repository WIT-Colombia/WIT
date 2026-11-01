import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

const auth = vi.hoisted(() => ({
  login: vi.fn(),
  getSession: vi.fn(() => null),
}));

vi.mock('../services/adminService', () => ({
  getSession: auth.getSession,
  login: auth.login,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('XAMUKO Admin email/password login', () => {
  it('shows email and password on the public login screen without requiring Google', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByRole('textbox', { name: /correo electrónico/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña$/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument();
  });

  it('submits existing credentials using the real admin login client', async () => {
    auth.login.mockRejectedValueOnce(new Error('Credenciales incorrectas'));
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox', { name: /correo electrónico/i }), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'a-valid-secret' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));
    await waitFor(() => expect(auth.login).toHaveBeenCalledWith('admin@example.com', 'a-valid-secret', true));
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales incorrectas');
  });
});
