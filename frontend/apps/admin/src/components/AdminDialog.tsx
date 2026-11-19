import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

export function AdminDialog({ title, children, onClose, busy = false, wide = false, contextLabel = 'XAMUKO ADMIN · ARCHIVO PRIVADO' }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean; contextLabel?: string }) {
  const ref = useRef<HTMLElement>(null);
  const latest = useRef({ onClose, busy }); latest.current = { onClose, busy };
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!latest.current.busy) latest.current.onClose(); }
      if (event.key === 'Tab') {
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], iframe') ?? []).filter(item => item.getClientRects().length);
        if (!items.length) { event.preventDefault(); return; }
        if (!ref.current?.contains(document.activeElement) || document.activeElement === ref.current) { event.preventDefault(); (event.shiftKey ? items.at(-1) : items[0])?.focus(); }
        else if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return <div className="ad-dialog-backdrop" onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className={`ad-dialog${wide ? ' ad-dialog--wide' : ''}`} ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} tabIndex={-1}>
      <header><div><span className="ad-kicker">{contextLabel}</span><h2 id={titleId}>{title}</h2></div><button type="button" className="ad-icon-button" aria-label="Cerrar ventana" disabled={busy} onClick={onClose}><Icon name="close" /></button></header>
      {children}
    </section>
  </div>;
}
