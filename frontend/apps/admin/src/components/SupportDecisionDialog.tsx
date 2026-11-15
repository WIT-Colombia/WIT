import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import './SupportDecisionDialog.css';

export function SupportDecisionDialog({
  title, description, affected, confirmWord, initialReason = '', shareReason = false, onClose, onConfirm,
}: {
  title: string; description: string; affected: string; confirmWord: string;
  initialReason?: string; shareReason?: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(initialReason);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cancel = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose; busyRef.current = busy;
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancel.current?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key === 'Tab') {
        const elements = Array.from(box.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled)') ?? []);
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; before?.focus({ preventScroll: true }); };
  }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || reason.trim().length < 10 || typed !== confirmWord) return;
    setBusy(true); setError('');
    try { await onConfirm(reason.trim()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo registrar la decisión.'); }
    finally { setBusy(false); }
  };
  return createPortal(<div className="sd-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <section ref={box} className="sd-dialog" role="dialog" aria-modal="true" aria-labelledby="sd-title" aria-describedby="sd-description">
      <div className="sd-top"><span className="sd-symbol"><Icon name="shield" size={26}/></span>
        <button type="button" className="sd-close" disabled={busy} aria-label="Cerrar" onClick={onClose}><Icon name="close" size={19}/></button>
      </div>
      <h2 id="sd-title">{title}</h2>
      <p id="sd-description">{description}</p>
      <div className="sd-target"><Icon name="message" size={21}/><strong>{affected}</strong></div>
      <p className="sd-notice">{shareReason ? "La respuesta que escribas se enviará al solicitante identificado por notificación interna. No incluyas datos privados ni deliberaciones internas." : "La justificación quedará en la auditoría administrativa. El interesado recibirá solo el cambio de estado, sin detalles privados de la investigación."}</p>
      <form onSubmit={submit}>
        <label htmlFor="sd-reason">{shareReason ? "Respuesta para el solicitante (mínimo 10 caracteres)" : "Justificación administrativa (mínimo 10 caracteres)"}</label>
        <textarea id="sd-reason" value={reason} onChange={event => setReason(event.target.value)} minLength={10} maxLength={1000} rows={4} required disabled={busy}
          placeholder="Describe los hechos y la decisión tomada." />
        <label htmlFor="sd-confirm">Escribe <strong>{confirmWord}</strong> para confirmar</label>
        <input id="sd-confirm" value={typed} onChange={event => setTyped(event.target.value)} autoComplete="off" required disabled={busy} placeholder={confirmWord} />
        {error && <p className="sd-error" role="alert">{error}</p>}
        <div className="sd-actions">
          <button ref={cancel} className="sd-secondary" type="button" disabled={busy} onClick={onClose}>Cancelar</button>
          <button className="sd-primary" type="submit" disabled={busy || typed !== confirmWord || reason.trim().length < 10}>
            <Icon name="check" size={17}/>{busy ? 'Registrando…' : 'Confirmar decisión'}
          </button>
        </div>
      </form>
    </section>
  </div>, document.body);
}
