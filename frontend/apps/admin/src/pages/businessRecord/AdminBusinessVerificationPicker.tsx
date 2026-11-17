import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon';
import type { AdminVerificationAction } from '../../services/adminApiClient';

const choices: Array<{ action: AdminVerificationAction; label: string; description: string; icon: string; tone: string }> = [
  { action: 'VERIFY', label: 'Verificado',
    description: 'Acredita la verificación tras las comprobaciones administrativas, sin cambiar la visibilidad ni el plan.',
    icon: 'shield', tone: 'verified' },
  { action: 'UNVERIFY', label: 'Sin verificar',
    description: 'Retira la insignia de verificado sin ocultar ni suspender el negocio. La decisión puede revertirse.',
    icon: 'info', tone: 'unverified' },
];

export function AdminBusinessVerificationPicker({ businessName, verificationStatus, onClose, onChoose }: {
  businessName: string; verificationStatus: string;
  onClose: () => void; onChoose: (action: AdminVerificationAction) => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault(); focusable.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
        event.preventDefault(); focusable[0]?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [onClose]);

  const current: AdminVerificationAction | null = verificationStatus === 'APPROVED' ? 'VERIFY'
    : verificationStatus === 'NONE' ? 'UNVERIFY' : null;
  const currentLabel = verificationStatus === 'APPROVED' ? 'Verificado'
    : verificationStatus === 'NONE' ? 'Sin verificar'
      : verificationStatus === 'PENDING' ? 'Solicitud pendiente'
        : verificationStatus === 'INFORMATION' ? 'Información solicitada'
          : verificationStatus === 'REJECTED' ? 'Solicitud rechazada' : 'Estado desconocido';

  return createPortal(<div className="bd-visibility-picker-overlay" role="presentation"
    onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="bd-visibility-picker bd-verification-picker" ref={dialogRef} role="dialog" aria-modal="true"
      aria-labelledby="bd-verification-picker-title" aria-describedby="bd-verification-picker-description">
      <header className="bd-visibility-picker-header">
        <span className="bd-visibility-picker-head-icon"><Icon name="shield" size={24}/></span>
        <div>
          <span className="bd-visibility-picker-eyebrow">XAMUKO ADMIN · ESTADO DEL NEGOCIO</span>
          <h2 id="bd-verification-picker-title">Cambiar verificación</h2>
          <p className="bd-visibility-picker-business">{businessName}</p>
        </div>
        <button type="button" ref={closeRef} className="bd-visibility-picker-close"
          aria-label="Cerrar opciones de verificación" onClick={onClose}><Icon name="close" size={19}/></button>
      </header>
      <div className="bd-visibility-picker-body">
        <p id="bd-verification-picker-description">
          Estado actual: <strong>{currentLabel}</strong>. Selecciona el estado de verificación del negocio.
        </p>
        <div className="bd-visibility-picker-choices" role="group" aria-label="Estados disponibles de verificación">
          {choices.map(option => {
            const active = option.action === current;
            return <button type="button" key={option.action}
              className={`bd-visibility-picker-choice bd-verification-choice--${option.tone}${active ? ' is-current' : ''}`}
              disabled={active} aria-label={option.label} onClick={() => onChoose(option.action)}>
              <span className="bd-visibility-picker-choice-icon"><Icon name={option.icon} size={23}/></span>
              <span className="bd-visibility-picker-choice-copy"><strong>{option.label}</strong><small>{option.description}</small></span>
              {active ? <span className="bd-visibility-picker-current">Estado actual</span> : <Icon name="chevron" size={18}/>}
            </button>;
          })}
        </div>
        <p className="bd-visibility-picker-notice"><Icon name="shield" size={17}/>
          La decisión exige confirmación y motivo administrativo. Quedará registrada en el historial y en Auditoría,
          y se notificará al propietario. Las solicitudes documentales abiertas deben resolverse desde Verificaciones.
        </p>
      </div>
      <footer className="bd-visibility-picker-footer"><button type="button" onClick={onClose}>Cancelar</button></footer>
    </section>
  </div>, document.body);
}
