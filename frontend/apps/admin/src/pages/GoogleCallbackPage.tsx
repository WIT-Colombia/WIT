import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import xamukoLogo from '../assets/xamuko-logo.png';
import { authenticateWithPasskey, getSession } from '../services/adminService';
import { AdminApiError } from '../services/adminApiClient';

const googleMessages: Record<string, string> = {
  GOOGLE_AUTH_CANCELLED: 'Cancelaste el inicio de sesión con Google.',
  GOOGLE_NOT_CONFIGURED: 'El inicio de sesión con Google aún no está configurado en el servidor.',
  GOOGLE_STATE_INVALID: 'La sesión de Google expiró o no pudo verificarse. Vuelve a intentarlo.',
  GOOGLE_AUTH_FAILED: 'Google no pudo completar el acceso. Comprueba que tu cuenta esté autorizada.',
  GOOGLE_PROVIDER_ERROR: 'Google no pudo completar la autenticación. Inténtalo nuevamente.',
  GOOGLE_APPLICATION_INVALID: 'La aplicación de acceso indicada no es válida.',
};

function passkeyMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case 'ADMIN_WEBAUTHN_REQUIRED':
        return 'Esta cuenta necesita registrar su primera passkey. Regresa al inicio de sesión y utiliza el código de activación autorizado.';
      case 'ADMIN_PENDING_INVALID':
        return 'La verificación de Google caducó. Vuelve a iniciar sesión con Google.';
      case 'ADMIN_IDENTITY_NOT_LINKED':
        return 'La cuenta de Google autorizada todavía no está vinculada a una cuenta administrativa.';
      case 'ADMIN_ACCESS_DENIED':
      case 'ADMIN_SUPER_ADMIN_REQUIRED':
        return 'Esta cuenta no tiene un rol SUPER_ADMIN activo. Solicita la revisión de su autorización.';
      case 'ADMIN_WEBAUTHN_NOT_CONFIGURED':
        return 'La verificación de passkey de Admin no está configurada en el servidor.';
      case 'ADMIN_WEBAUTHN_CANCELLED':
        return 'Cancelaste la verificación de la passkey. Puedes intentarlo de nuevo.';
      case 'UNTRUSTED_ORIGIN':
        return 'El dominio de Admin no está autorizado por el servidor. Revisa su configuración.';
      default:
        return error.message;
    }
  }
  return error instanceof Error && error.name === 'NotAllowedError'
    ? 'La passkey fue cancelada o el navegador bloqueó su verificación.'
    : 'No se pudo verificar la passkey. Inténtalo de nuevo.';
}

/**
 * The backend deliberately creates only a short-lived pending OAuth cookie.
 * Never accept a Google redirect as an Admin session: the authorized user must
 * also complete WebAuthn in a direct user gesture.
 */
export function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const providerError = params.get('error');
  if (getSession()) return <Navigate to="/dashboard" replace />;

  async function finishLogin() {
    if (busy || providerError) return;
    setBusy(true);
    setError('');
    try {
      await authenticateWithPasskey();
      navigate('/dashboard', { replace: true });
    } catch (cause) {
      setError(passkeyMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page admin-login">
    <section className="admin-login-form-wrap">
      <div className="admin-login-form">
        <div className="admin-login-form-brand">
          <img src={xamukoLogo} alt="XAMUKO" /><span>ADMIN</span>
        </div>
        <header>
          <h2>{providerError ? 'No se pudo acceder con Google' : 'Completa tu acceso seguro'}</h2>
          <p>{providerError
            ? 'La cuenta administrativa no pudo verificarse.'
            : 'Google completó la primera etapa. Verifica ahora tu passkey para entrar a XAMUKO Admin.'}</p>
        </header>
        {providerError ? <p role="alert" className="admin-login-error">{googleMessages[providerError] ?? 'No se pudo completar el inicio de sesión con Google.'}</p> : <>
          <button className="admin-login-submit" type="button" onClick={() => void finishLogin()} disabled={busy}>
            {busy ? 'Verificando passkey…' : 'Verificar passkey y entrar'}
          </button>
          {error && <p role="alert" className="admin-login-error">{error}</p>}
          <p className="admin-login-access">
            La cuenta debe estar autorizada como administradora. Para activar una primera passkey, regresa al acceso y utiliza el código de activación autorizado.
          </p>
        </>}
        <Link className="admin-login-submit" to="/login">Volver al inicio de sesión</Link>
      </div>
    </section>
  </main>;
}
