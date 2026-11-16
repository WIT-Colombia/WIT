import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';
import { setAdminUserStatus, revokeAdminUserSessions, type AdminUserAdministrativeAction } from '../../services/adminApiClient';

const actions = {
  SUSPEND: {
    title: 'Suspender cuenta',
    description: 'Se bloqueará el acceso a XAMUKO Usuarios y Business y se revocarán todas las sesiones. Los negocios y sus publicaciones no se eliminarán.',
    button: 'Confirmar suspensión',
    icon: 'lock',
  },
  RESTORE: {
    title: 'Reactivar cuenta',
    description: 'Se levantará la suspensión. La persona podrá iniciar una sesión nueva; sus negocios conservarán sus estados propios.',
    button: 'Confirmar reactivación',
    icon: 'check',
  },
  REVOKE: {
    title: 'Cerrar todas las sesiones',
    description: 'Se cerrarán las sesiones de XAMUKO Usuarios y Business, sin suspender ni eliminar la cuenta. La persona podrá iniciar sesión nuevamente.',
    button: 'Cerrar sesiones',
    icon: 'shield',
  },
} as const;

export function AdminUserStatusDialog({ user, action, onClose, onSuccess }: {
  user: { id: string; displayName: string; emailNormalized: string | null };
  action: AdminUserAdministrativeAction;
  onClose: () => void; onSuccess: (message: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const formerOverflow = document.body.style.overflow;
    const formerFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus({ preventScroll: true });
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled)') ?? []);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = formerOverflow;
      formerFocus?.focus({ preventScroll: true });
    };
  }, [busy]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || reason.trim().length < 12 || reason.trim().length > 500) return;
    setBusy(true); setError('');
    try {
      const result = action === 'REVOKE'
        ? await revokeAdminUserSessions(user.id, reason.trim())
        : await setAdminUserStatus(user.id, action, reason.trim());
      onSuccess(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos registrar la decisión.');
      setBusy(false);
    }
  }
  const info = actions[action];
  return createPortal(<div className="au-control-backdrop" onMouseDown={e => {
    if (e.target === e.currentTarget && !busy) closeRef.current();
  }}>
    <section className="au-control-dialog" ref={dialogRef} role="dialog" aria-modal="true"
      aria-labelledby="au-control-dialog-title" aria-describedby="au-control-dialog-description">
      <span className="au-control-dialog-icon"><Icon name={info.icon} size={26}/></span>
      <h2 id="au-control-dialog-title">{info.title}</h2>
      <p className="au-control-person">{user.displayName} <small>{user.emailNormalized ?? 'Sin correo'}</small></p>
      <p id="au-control-dialog-description">{info.description}</p>
      <form onSubmit={e => void submit(e)}>
        <label htmlFor="au-control-reason">Motivo administrativo obligatorio</label>
        <textarea id="au-control-reason" required minLength={12} maxLength={500} rows={4} value={reason}
          placeholder="Describe los hechos y la razón de esta decisión. Debe ser verificable."
          disabled={busy} onChange={e => setReason(e.target.value)}/>
        <small>Se conservará en el historial de auditoría. La notificación estará disponible al titular cuando tenga acceso. {reason.length}/500 caracteres.</small>
        {error && <p className="au-control-dialog-error" role="alert">{error}</p>}
        <div className="au-control-dialog-actions">
          <button type="button" onClick={() => closeRef.current()} disabled={busy} ref={cancelRef}>Cancelar</button>
          <button type="submit" className={action === 'SUSPEND' ? 'danger' : 'restore'} disabled={busy || reason.trim().length < 12}>
            {busy ? 'Registrando…' : info.button}
          </button>
        </div>
      </form>
    </section>
  </div>, document.body);
}
