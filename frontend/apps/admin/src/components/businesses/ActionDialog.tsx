import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../Icon';
import { actionLabels } from '../../utils/business';
import type { BusinessAction, BusinessMutation, ManagedBusiness } from '../../types/business';
import { BUSINESS_VISIBILITY_DAYS } from '../../services/visibilityPolicy';
const explanations: Record<BusinessAction, { message: string; reversible: string }> = {
  approve: { message: 'Se aprobará la verificación y se asociará al reclamante como propietario. La aprobación no crea ni extiende la vigencia de publicación.', reversible: 'Una corrección posterior requiere revisión administrativa.' },
  reject: { message: 'Se rechazará la solicitud y el negocio quedará pendiente de revisión, sin publicación activa.', reversible: 'El caso podrá revisarse nuevamente cuando exista información suficiente.' },
  'request-info': { message: 'Se registrará la información adicional que se necesita. La solicitud quedará registrada para revisión.', reversible: 'La solicitud continuará pendiente hasta completar la revisión.' },
  escalate: { message: 'La reclamación pasará a revisión por una posible discrepancia. Podrá solicitarse documentación si el caso lo requiere, sin imponer documentos específicos.', reversible: 'El caso se mantendrá en revisión hasta resolver la discrepancia.' },
  'resolve-review': { message: 'Confirma que se revisó y resolvió la discrepancia de esta reclamación. El caso volverá a estar pendiente de verificación; esta acción no aprueba al reclamante ni publica el negocio.', reversible: 'La decisión y su motivo se conservarán en la bitácora. El caso podrá escalarse nuevamente.' },
  hide: { message: 'El negocio dejará de mostrarse por incumplimiento. Su información y periodo de visibilidad se conservarán.', reversible: 'La publicación podrá reactivarse tras la revisión si su vigencia es válida.' },
  publish: { message: 'El negocio volverá a mostrarse con su vigencia actual.', reversible: 'La publicación podrá ocultarse nuevamente si corresponde.' },
  extend: { message: `La visibilidad quedará activa durante ${BUSINESS_VISIBILITY_DAYS} días a partir de hoy. El cambio se guardará junto al motivo y el administrador responsable.`, reversible: 'El cambio quedará registrado; no se eliminará su historial.' },
  restore: { message: 'Se recuperará el negocio dentro de su periodo válido. Si la vigencia venció, no volverá a publicarse hasta renovar.', reversible: 'El registro administrativo de la recuperación se conservará.' },
  'delete-business': { message: 'El negocio dejará de estar publicado y pasará a recuperación temporal.', reversible: 'Podrás restaurarlo durante el periodo de recuperación.' },
  'delete-permanently': { message: 'El negocio quedará eliminado definitivamente y no podrá restaurarse desde la interfaz. La bitácora de esta acción se conserva.', reversible: 'Esta acción es irreversible desde la interfaz.' },
  comment: { message: 'El comentario será interno y quedará registrado en la bitácora de este negocio.', reversible: 'La bitácora no puede eliminarse desde la interfaz.' },
};
export function ActionDialog({ business, action, close, submit }: { business: ManagedBusiness; action: BusinessAction; close: () => void; submit: (mutation: BusinessMutation) => Promise<void> }) {
  const ref = useRef<HTMLDivElement>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) close();
      if (event.key !== 'Tab') return;
      const elements = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handle);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', handle); previous?.focus(); };
  }, [close, busy]);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError('');
    try { await submit({ action, reason: String(form.get('reason') || ''), comment: String(form.get('comment') || ''), expiresAt: String(form.get('expiry') || ''), confirmation: String(form.get('confirmation') || '') }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos guardar el cambio. Intenta nuevamente.'); setBusy(false); }
  }
  const destructive = ['reject', 'hide', 'delete-business', 'delete-permanently'].includes(action);
  return <div className="modal-backdrop"><div ref={ref} className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="action-title" aria-describedby="action-description"><div className="dialog-heading"><span className={`state-icon ${destructive ? 'danger-icon' : ''}`}><Icon name={destructive ? 'flag' : 'shield'} size={24} /></span><button className="icon-button" aria-label="Cerrar confirmación" onClick={close} disabled={busy}><Icon name="close" /></button></div><h2 id="action-title">{actionLabels[action]}</h2><p className="dialog-entity">{business.name}</p><p id="action-description">{explanations[action].message}</p><div className="dialog-consequence"><Icon name="clock" size={17} /><span>{explanations[action].reversible}</span></div><form onSubmit={handleSubmit}>
    {action === 'extend' && <div className="dialog-policy-note"><Icon name="clock" size={17} /><span>La vigencia quedará activa durante {BUSINESS_VISIBILITY_DAYS} días a partir de hoy.</span></div>}
    {!['delete-business', 'restore'].includes(action) && <label>{action === 'request-info' ? 'Información que se necesita' : action === 'comment' ? 'Comentario interno' : 'Motivo de la acción'}<textarea name="reason" rows={3} required maxLength={1000} placeholder="Explica el contexto de la decisión…" /></label>}
    {action !== 'comment' && !['delete-business', 'restore'].includes(action) && <label>Comentario interno <span>(opcional)</span><textarea name="comment" rows={2} maxLength={1000} placeholder="Información adicional para el equipo" /></label>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="dialog-actions"><button type="button" className="secondary-button" onClick={close} disabled={busy}>Cancelar</button><button type="submit" className={destructive ? 'danger-button' : 'primary'} disabled={busy}>{busy ? 'Guardando…' : action === 'comment' ? 'Guardar comentario' : action === 'delete-business' ? 'Confirmar eliminación' : action === 'restore' ? 'Confirmar restauración' : 'Confirmar acción'}</button></div></form></div></div>;
}
