import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { deleteAdminBusiness, type AdminBusinessRecord } from '../../services/adminApiClient';

export function AdminBusinessDeleteDialog({ business, onClose, onSuccess }: {
  business: Pick<AdminBusinessRecord, 'id' | 'name'>;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),input:not(:disabled)') ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', onKeyDown); prior?.focus({ preventScroll: true }); };
  }, [busy, onClose]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || confirmation !== 'ELIMINAR' || reason.trim().length < 12) return;
    setBusy(true); setError('');
    try {
      const result = await deleteAdminBusiness(business.id, reason.trim(), confirmation);
      onSuccess(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible eliminar el negocio.');
    } finally { setBusy(false); }
  };
  return createPortal(<div className="admin-business-delete-backdrop" onMouseDown={event => {
    if (!busy && event.target === event.currentTarget) onClose();
  }}>
    <section ref={dialogRef} className="admin-business-delete-modal" role="dialog" aria-modal="true" aria-labelledby="admin-business-delete-title" aria-describedby="admin-business-delete-description">
      <span className="admin-business-delete-icon" aria-hidden="true">!</span>
      <h2 id="admin-business-delete-title">¿Eliminar este negocio?</h2>
      <p id="admin-business-delete-description">Se retirará <strong>{business.name}</strong> de XAMUKO y dejará de mostrarse en Usuarios y Business. Las transferencias pendientes se cancelarán. <strong>La cuenta personal de su propietario no se eliminará.</strong> Los registros históricos se conservan para auditoría.</p>
      <form onSubmit={submit}>
        <label htmlFor="admin-business-delete-reason">Motivo de la eliminación (mínimo 12 caracteres)</label>
        <textarea id="admin-business-delete-reason" value={reason} onChange={event => setReason(event.target.value)} rows={3} minLength={12} maxLength={500} required disabled={busy} placeholder="Explica el motivo de la decisión administrativa."/>
        <label htmlFor="admin-business-delete-word">Escribe <strong>ELIMINAR</strong> para confirmar</label>
        <input id="admin-business-delete-word" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" required disabled={busy} placeholder="ELIMINAR"/>
        {error && <p className="admin-business-delete-error" role="alert">{error}</p>}
        <div className="admin-business-delete-actions">
          <button ref={cancelRef} type="button" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="admin-business-delete-danger" type="submit" disabled={busy || reason.trim().length < 12 || confirmation !== 'ELIMINAR'}>{busy ? 'Eliminando…' : 'Confirmar eliminación'}</button>
        </div>
      </form>
    </section>
  </div>, document.body);
}
