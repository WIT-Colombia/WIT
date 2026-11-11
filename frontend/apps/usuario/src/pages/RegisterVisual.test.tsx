import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Register from './Register';
import { ApiError } from '../services/httpClient';

const auth = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn(), google: vi.fn(), remember: vi.fn(), clear: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ login: auth.login, register: auth.register, status: 'anonymous' }) }));
vi.mock('../services/authService', () => ({ getRememberedEmail: () => '', startGoogleLogin: auth.google, isBusinessReferralRegistrationAvailable: async () => true, validateBusinessReferralCode: async () => true }));
vi.mock('../services/pendingVerification', () => ({ clearPendingVerificationEmail: auth.clear, rememberPendingVerificationEmail: auth.remember }));

function show(path = '/register') {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/register" element={<Register />} />
    <Route path="/home" element={<h1>Inicio de exploración</h1>} />
    <Route path="/verify-email" element={<h1>Verifica tu correo</h1>} />
    <Route path="/recover-password" element={<h1>Recuperar contraseña</h1>} />
  </Routes></MemoryRouter>);
}
function fillLogin() {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'cuenta@example.test' } });
  fireEvent.change(screen.getByLabelText('Contraseña', { exact: true }), { target: { value: 'password-de-prueba' } });
}
beforeEach(() => { vi.clearAllMocks(); auth.login.mockResolvedValue(undefined); auth.register.mockResolvedValue({ verificationExpiresAt: '2030-01-01T00:00:00Z', verificationEmailSent: true }); });
afterEach(cleanup);

describe('presentación de acceso: conserva el formulario original', () => {
  it('publica metadatos propios, un H1 y no copia parámetros sensibles', () => {
    show('/register?email=privado@example.test&ref=invitacion');
    expect(document.title).toContain('Crea tu cuenta');
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://user.xamuko.com/register');
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    const data = JSON.parse(document.querySelector('script[data-auth-seo]')!.textContent!);
    expect(data.url).toBe('https://user.xamuko.com/register');
    expect(JSON.stringify(data)).not.toContain('privado');
  });
  it('actualiza SEO al cambiar de modo y lo retira al salir a recuperación', async () => {
    show();
    expect(document.querySelector('meta[name="robots"]')!.getAttribute('content')).toBe('noindex,follow');
    fireEvent.click(screen.getByRole('button', { name: '¿Ya tienes una cuenta? Inicia sesión' }));
    expect(document.title).toBe('Iniciar sesión | XAMUKO Usuarios');
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://user.xamuko.com/register?mode=login');
    expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' }));
    await screen.findByText('Recuperar contraseña');
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('script[data-auth-seo]')).toBeNull();
  });
  it('conserva los campos, logo y eslogan, sin la etiqueta Usuarios', () => {
    show();
    for (const label of ['Nombre completo', 'Correo electrónico', 'Contraseña', 'Confirmar contraseña', 'Código de referido (opcional)']) expect(screen.getByLabelText(label, { exact: true })).toBeInTheDocument();
    expect(screen.getByAltText('XAMUKO')).toHaveAttribute('src', expect.stringContaining('xamuko-wordmark.webp'));
    expect(screen.getByText('Lo que necesitas, está más cerca.')).toBeInTheDocument();
    expect(screen.getByText('Conoce cada negocio')).toBeInTheDocument();
    expect(screen.queryByText('Usuarios', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apple/ })).not.toBeInTheDocument();
  });
  it('login envía las mismas credenciales y rememberMe, y navega a /home', async () => {
    show('/register?mode=login'); fillLogin();
    fireEvent.click(screen.getByLabelText('Mantener mi sesión iniciada'));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(auth.login).toHaveBeenCalledWith('cuenta@example.test', 'password-de-prueba', true));
    expect(await screen.findByText('Inicio de exploración')).toBeInTheDocument();
    expect(auth.clear).toHaveBeenCalledTimes(1);
  });
  it('registro mantiene consentimiento, llamada y navegación a verificación', async () => {
    show(); fillLogin();
    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Cuenta existente' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'password-de-prueba' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));
    expect(auth.register).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Acepta los términos');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));
    await waitFor(() => expect(auth.register).toHaveBeenCalledWith('Cuenta existente', 'cuenta@example.test', 'password-de-prueba', undefined));
    expect(auth.remember).toHaveBeenCalledWith('cuenta@example.test', '2030-01-01T00:00:00Z', true);
    expect(await screen.findByText('Verifica tu correo')).toBeInTheDocument();
  });
  it('conserva validación, mostrar contraseña y cambio de modo', () => {
    show(); fillLogin();
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'otra-contraseña' } });
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear mi cuenta' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(screen.getByLabelText('Contraseña', { exact: true })).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: '¿Ya tienes una cuenta? Inicia sesión' }));
    expect(screen.queryByLabelText('Confirmar contraseña')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
  it('mantiene enlaces legales y recuperación', async () => {
    show();
    expect(screen.getByRole('link', { name: 'Términos y condiciones' })).toHaveAttribute('href', '/legal/terms?from=register');
    expect(screen.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute('href', '/legal/privacy?from=register');
    fireEvent.click(screen.getByRole('button', { name: '¿Ya tienes una cuenta? Inicia sesión' }));
    fireEvent.click(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' }));
    expect(await screen.findByText('Recuperar contraseña')).toBeInTheDocument();
  });
  it('conserva Google y su consentimiento, sin añadir proveedores', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(auth.google).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(auth.google).toHaveBeenCalledWith({ returnTo: '/home', consent: true, rememberMe: false, referralCode: undefined });
  });
  it('mantiene el error del backend y el reenvío de verificación', async () => {
    auth.login.mockRejectedValue(new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Verifica tu correo primero.'));
    show('/register?mode=login'); fillLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifica tu correo primero.');
    const resend = screen.getByRole('link', { name: 'Reenviar correo de verificación' });
    expect(resend).toHaveAttribute('href', '/verify-email?pending=1');
    fireEvent.click(resend);
    expect(auth.remember).toHaveBeenCalledWith('cuenta@example.test');
  });
});
