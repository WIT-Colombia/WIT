import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';
import { changeAdminBusinessVisibility, type AdminVisibilityAction } from '../../services/adminApiClient';

const labels = {
  SET_VISIBLE: { title: 'Establecer como visible', verb: 'Confirmar estado visible', icon: 'eye', description: 'El administrador retirará cualquier suspensión o restricción. El negocio solo aparecerá al público si cumple la vigencia y las demás condiciones de publicación; no se conceden días adicionales.' },
  SET_HIDDEN: { title: 'Ocultar negocio', verb: 'Confirmar ocultamiento', icon: 'eye-off', description: 'El negocio dejará de aparecer públicamente. El propietario podrá volver a hacerlo visible desde Business, si cumple los requisitos de publicación y vigencia.' },
  HIDE: { title: 'Ocultar negocio', verb: 'Confirmar ocultamiento', icon: 'eye-off', description: 'El negocio dejará de aparecer públicamente. Su propietario no podrá reactivar la visibilidad hasta que Admin levante esta medida.' },
  SUSPEND: { title: 'Suspender negocio', verb: 'Confirmar suspensión', icon: 'lock', description: 'El negocio quedará oculto del directorio público y su propietario no podrá renovar, activar ni volver a publicar mientras se mantenga la suspensión.' },
  RESTORE: { title: 'Levantar restricción', verb: 'Confirmar restitución', icon: 'check', description: 'Se retirará la medida administrativa. No se renovará automáticamente la vigencia ni se publicará un establecimiento que estuviera oculto por su propietario.' },
} as const;

export function AdminBusinessVisibilityDialog({ business, action, onClose, onSuccess }: {
  business: { id: string; name: string }; action: AdminVisibilityAction;
  onClose: () => void; onSuccess: (message: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const info = labels[action];
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const els = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled)') ?? []);
      if (event.shiftKey && document.activeElement === els[0]) { event.preventDefault(); els.at(-1)?.focus(); }
      if (!event.shiftKey && document.activeElement === els.at(-1)) { event.preventDefault(); els[0]?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; previousFocus?.focus({ preventScroll: true }); };
  }, [onClose, submitting]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || reason.trim().length < 12 || reason.trim().length > 500) return;
    setSubmitting(true); setError('');
    try {
      const result = await changeAdminBusinessVisibility(business.id, action, reason.trim());
      onSuccess(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo registrar la decisión.');
      setSubmitting(false);
    }
  };
  return createPortal(<div className="ad-business-visibility-overlay" onMouseDown={event => {
    if (!submitting && event.target === event.currentTarget) onClose();
  }}>
    <section className="ad-business-visibility-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="ad-visibility-title" aria-describedby="ad-visibility-explain">
      <span className="ad-business-visibility-symbol"><Icon name={info.icon} size={24} /></span>
      <h2 id="ad-visibility-title">{info.title}</h2>
      <p className="ad-business-visibility-name">{business.name}</p>
      <p id="ad-visibility-explain">{info.description}</p>
      <form onSubmit={event => void submit(event)}>
        <label htmlFor="admin-visibility-reason">Motivo administrativo <small>(mínimo 12 caracteres)</small></label>
        <textarea id="admin-visibility-reason" rows={4} value={reason} onChange={event => setReason(event.target.value)}
          maxLength={500} minLength={12} required disabled={submitting} placeholder="Describe los hechos, la razón y el fundamento de esta decisión." />
        <p className="ad-business-visibility-hint">La decisión se registrará en el historial de auditoría y se notificará al propietario. {reason.trim().length}/500</p>
        {error && <p role="alert" className="ad-business-visibility-error">{error}</p>}
        <div className="ad-business-visibility-dialog-actions">
          <button type="button" ref={cancelRef} onClick={onClose} disabled={submitting}>Cancelar</button>
          <button type="submit" disabled={submitting || reason.trim().length < 12} className={action === 'RESTORE' ? 'confirm-restore' : 'confirm-restrict'}>
            {submitting ? 'Registrando…' : info.verb}
          </button>
        </div>
      </form>
    </section>
  </div>, document.body);
}
