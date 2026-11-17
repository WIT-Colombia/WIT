import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon';
type AdminSubscriptionPlan = 'BASIC' | 'PRO';

const choices: Array<{ action: AdminSubscriptionPlan; label: string; description: string; icon: string; tone: string }> = [
  { action: 'BASIC', label: 'Básico',
    description: 'Revoca el acceso PRO vigente, incluso si procede de una suscripción de pago. Revisa las obligaciones comerciales.',
    icon: 'store', tone: 'basic' },
  { action: 'PRO', label: 'Business PRO',
    description: 'Activa PRO por decisión administrativa, sin cobro ni renovación automática, hasta su revocación.',
    icon: 'crown', tone: 'pro' },
];

export function AdminBusinessSubscriptionPicker({ businessName, currentPlan, onClose, onChoose }: {
  businessName: string; currentPlan: AdminSubscriptionPlan;
  onClose: () => void; onChoose: (action: AdminSubscriptionPlan) => void;
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

  const current: AdminSubscriptionPlan = currentPlan;
  const currentLabel = currentPlan === 'PRO' ? 'Business PRO' : 'Básico';

  return createPortal(<div className="bd-visibility-picker-overlay" role="presentation"
    onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="bd-visibility-picker bd-subscription-picker" ref={dialogRef} role="dialog" aria-modal="true"
      aria-labelledby="bd-subscription-picker-title" aria-describedby="bd-subscription-picker-description">
      <header className="bd-visibility-picker-header">
        <span className="bd-visibility-picker-head-icon"><Icon name="crown" size={24}/></span>
        <div>
          <span className="bd-visibility-picker-eyebrow">XAMUKO ADMIN · ESTADO DEL NEGOCIO</span>
          <h2 id="bd-subscription-picker-title">Cambiar suscripción</h2>
          <p className="bd-visibility-picker-business">{businessName}</p>
        </div>
        <button type="button" ref={closeRef} className="bd-visibility-picker-close"
          aria-label="Cerrar opciones de suscripción" onClick={onClose}><Icon name="close" size={19}/></button>
      </header>
      <div className="bd-visibility-picker-body">
        <p id="bd-subscription-picker-description">
          Estado actual: <strong>{currentLabel}</strong>. Selecciona el plan que deseas asignar al negocio.
        </p>
        <div className="bd-visibility-picker-choices" role="group" aria-label="Planes disponibles de suscripción">
          {choices.map(option => {
            const active = option.action === current;
            return <button type="button" key={option.action}
              className={`bd-visibility-picker-choice bd-subscription-choice--${option.tone}${active ? ' is-current' : ''}`}
              disabled={active} aria-label={option.label} onClick={() => onChoose(option.action)}>
              <span className="bd-visibility-picker-choice-icon"><Icon name={option.icon} size={23}/></span>
              <span className="bd-visibility-picker-choice-copy"><strong>{option.label}</strong><small>{option.description}</small></span>
              {active ? <span className="bd-visibility-picker-current">Estado actual</span> : <Icon name="chevron" size={18}/>}
            </button>;
          })}
        </div>
        <p className="bd-visibility-picker-notice"><Icon name="shield" size={17}/>
          La asignación requiere confirmación y motivo administrativo. Quedará registrada en Historial administrativo
          y Auditoría, y se notificará al propietario. El cambio no genera un reembolso ni un nuevo cobro.
        </p>
      </div>
      <footer className="bd-visibility-picker-footer"><button type="button" onClick={onClose}>Cancelar</button></footer>
    </section>
  </div>, document.body);
}
