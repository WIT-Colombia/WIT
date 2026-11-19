import type { ReactNode, SVGProps } from 'react';

export type PlusIconName = 'crown' | 'radar' | 'price' | 'compare' | 'collection' | 'route' | 'ad-free' | 'check' | 'arrow-right';

export function PlusIcon({ name, size = 24, ...rest }: Omit<SVGProps<SVGSVGElement>, 'name'> & { name: PlusIconName; size?: number }) {
  const shapes: Record<PlusIconName, ReactNode> = {
    crown: <><path d="m2.5 7 4 4 5.5-7 5.5 7 4-4-2 12h-15Z"/><path d="M5 22h14"/></>,
    radar: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><path d="M12 12 18 6"/></>,
    price: <><path d="M4 5v14h16"/><path d="m6 8 5 5 4-4 4 3"/><path d="M19 9v3h-3"/></>,
    compare: <><rect x="2.5" y="4" width="8" height="16" rx="1.6"/><rect x="13.5" y="4" width="8" height="16" rx="1.6"/><path d="M5 8h3M5 12h3M16 8h3M16 12h3"/></>,
    collection: <><path d="M3 8.5V5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z"/><path d="M3 9h18M9 14h6M12 11v6"/></>,
    route: <><circle cx="5" cy="18" r="2"/><path d="M7 18h8a3 3 0 0 0 0-6h-6a3 3 0 0 1 0-6h8"/><path d="M17 3a3 3 0 0 1 3 3c0 2.5-3 5-3 5s-3-2.5-3-5a3 3 0 0 1 3-3Z"/><circle cx="17" cy="6" r=".7" fill="currentColor" stroke="none"/></>,
    'ad-free': <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M8 13h7M6 18 18 6"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
    'arrow-right': <><path d="M4 12h16m-7-7 7 7-7 7"/></>,
  };
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>{shapes[name]}</svg>;
}
