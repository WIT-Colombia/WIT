import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthPage } from './AuthPage';
import { BusinessApiError } from '../services/businessApiClient';

const auth = vi.hoisted(() => ({ signIn: vi.fn(), signUp: vi.fn(), google: vi.fn(), remember: vi.fn(), clear: vi.fn() }));
vi.mock('../services/businessAuthContext', () => ({ useBusinessAuth: () => ({ signIn: auth.signIn, signUp: auth.signUp }) }));
vi.mock('../services/businessStore', () => ({ useBusinessStore: () => ({ account: { name: 'Propietario' } }) }));
vi.mock('../services/businessAuthService', () => ({ getRememberedEmail: () => '', startGoogleLogin: auth.google, resolveBusinessNext: () => '/inicio' }));
vi.mock('../services/pendingVerification', () => ({ clearPendingVerificationEmail: auth.clear, rememberPendingVerificationEmail: auth.remember }));
vi.mock('../components/layout/BusinessHeader', () => ({ BusinessHeader: () => <header /> }));

function show(path = '/registro') {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/registro" element={<AuthPage mode="register" />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/inicio" element={<h1>Panel del negocio</h1>} />
    <Route path="/verify-email" element={<h1>Verifica el correo</h1>} />
    <Route path="/recuperar" element={<h1>Recuperación de contraseña</h1>} />
    <Route path="/preview" element={<h1>Vista previa</h1>} />
  </Routes></MemoryRouter>);
}
function credentials() {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'propietario@example.test' } });
  // The existing label includes the existing password visibility button.
  fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'password-de-prueba' } });
}
beforeEach(() => { vi.clearAllMocks(); auth.signIn.mockResolvedValue(undefined); auth.signUp.mockResolvedValue({ verificationExpiresAt: '2030-01-01T00:00:00Z', verificationEmailSent: true }); });
afterEach(cleanup);

describe('Business: presentación conserva el acceso existente', () => {
  it('publica metadatos propios, un H1 y no copia parámetros sensibles', () => {
    show('/registro?email=privado@example.test&ref=invitacion');
    expect(document.title).toBe('Registra tu cuenta de negocio | XAMUKO Business');
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://business.xamuko.com/registro');
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    const data = JSON.parse(document.querySelector('script[data-auth-seo]')!.textContent!);
    expect(data.url).toBe('https://business.xamuko.com/registro');
    expect(JSON.stringify(data)).not.toContain('privado');
  });
  it('actualiza SEO al cambiar de modo y lo retira al salir a recuperación', async () => {
    show();
    expect(document.querySelector('meta[name="robots"]')!.getAttribute('content')).toBe('noindex,follow');
    fireEvent.click(screen.getByRole('button', { name: '¿Ya tienes una cuenta? Iniciar sesión' }));
    await screen.findByLabelText('Mantener mi sesión iniciada');
    expect(document.title).toBe('Iniciar sesión | XAMUKO Business');
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
    expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.querySelectorAll('script[data-auth-seo]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' }));
    await screen.findByText('Recuperación de contraseña');
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  });
  it('mantiene todos los campos y el referido deshabilitado, logo íntegro y eslogan', () => {
    show();
    for (const label of ['Nombre completo', 'Correo electrónico', 'Confirmar contraseña']) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByLabelText('Código de referido (opcional)')).toBeDisabled();
    expect(screen.getByLabelText(/^Contraseña/)).toHaveAttribute('minlength', '8');
    expect(screen.getByAltText('XAMUKO')).toHaveAttribute('src', expect.stringContaining('XAMUKO-V1-transparent.webp'));
    expect(screen.getByText('Lo que necesitas, está más cerca.')).toBeVisible();
    expect(screen.getByText('Conecta con clientes cercanos')).toBeVisible();
    expect(screen.queryByText('Business', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apple/ })).not.toBeInTheDocument();
  });
  it('envía el registro existente y conserva la navegación a verificación', async () => {
    show(); credentials();
    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Cuenta de negocio' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'password-de-prueba' } });
    expect(screen.getByRole('checkbox')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));
    await waitFor(() => expect(auth.signUp).toHaveBeenCalledWith('Cuenta de negocio', 'propietario@example.test', 'password-de-prueba'));
    expect(auth.remember).toHaveBeenCalledWith('propietario@example.test', '2030-01-01T00:00:00Z', true);
    expect(await screen.findByText('Verifica el correo')).toBeInTheDocument();
  });
  it('conserva el consentimiento y la comprobación de contraseñas', () => {
    show(); credentials();
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'otra-password' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Crear mi cuenta' }).closest('form')!);
    expect(screen.getByRole('status')).toHaveTextContent('Las contraseñas no coinciden.');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(screen.getByRole('button', { name: 'Crear mi cuenta' }).closest('form')!);
    expect(screen.getByRole('status')).toHaveTextContent('Acepta los términos');
    expect(auth.signUp).not.toHaveBeenCalled();
  });
  it('login conserva rememberMe, las credenciales y /inicio', async () => {
    show('/login'); credentials();
    fireEvent.click(screen.getByLabelText('Mantener mi sesión iniciada'));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith('propietario@example.test', 'password-de-prueba', true));
    expect(auth.clear).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Panel del negocio')).toBeInTheDocument();
  });
  it('conserva el estado de carga sin enviar dos solicitudes', async () => {
    auth.signIn.mockReturnValue(new Promise(() => {}));
    show('/login'); credentials();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('button', { name: 'Conectando…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Conectando…' }));
    expect(auth.signIn).toHaveBeenCalledTimes(1);
  });
  it('muestra el error del backend y conserva el reenvío de verificación', async () => {
    auth.signIn.mockRejectedValue(new BusinessApiError(403, 'EMAIL_NOT_VERIFIED', 'Verifica tu correo primero.'));
    show('/login'); credentials();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Verifica tu correo primero.');
    const resend = screen.getByRole('link', { name: 'Reenviar correo de verificación' });
    expect(resend).toHaveAttribute('href', '/verify-email?pending=1');
    fireEvent.click(resend);
    expect(auth.remember).toHaveBeenCalledWith('propietario@example.test');
  });
  it('conserva Google, sus opciones y el consentimiento', () => {
    show();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(auth.google).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(auth.google).toHaveBeenCalledWith({ returnTo: '/inicio', consent: true, rememberMe: false });
  });
  it('conserva mostrar contraseña y los destinos de los modos', async () => {
    show('/login');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(screen.getByLabelText(/^Contraseña/)).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: '¿No tienes una cuenta? Crear cuenta' }));
    expect(await screen.findByLabelText('Confirmar contraseña')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '¿Ya tienes una cuenta? Iniciar sesión' }));
    expect(await screen.findByLabelText('Mantener mi sesión iniciada')).toBeInTheDocument();
  });
  it('conserva los enlaces legales y recuperación, sin mostrar la vista previa demo', async () => {
    show();
    expect(screen.getByRole('link', { name: 'Términos y condiciones' })).toHaveAttribute('href', '/legal/terms?from=registro');
    expect(screen.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute('href', '/legal/privacy?from=registro');
    expect(screen.queryByRole('link', { name: 'Entrar en vista previa demo' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '¿Ya tienes una cuenta? Iniciar sesión' }));
    fireEvent.click(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' }));
    expect(await screen.findByText('Recuperación de contraseña')).toBeInTheDocument();
  });
});
