import { useSyncExternalStore } from 'react';
import { buildApiUrl } from './api';
export type PaidPlanAvailability = { businessPro: boolean; xamukoPlus: boolean };
export type PaidPlanKey = keyof PaidPlanAvailability;
/** Monthly list prices in Colombian pesos. Actual payment is verified server-side. */
export const PAID_PLAN_MONTHLY_COP = Object.freeze({ businessPro: 29_900, xamukoPlus: 3_900 } as const);
export function formatCopPrice(amount: number): string {
  return String.fromCharCode(36) + new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(amount);
}
const disabled: PaidPlanAvailability = { businessPro: false, xamukoPlus: false };
let state = disabled;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();
function publish(next: PaidPlanAvailability) {
  if (state.businessPro === next.businessPro && state.xamukoPlus === next.xamukoPlus) return;
  state = next;
  listeners.forEach(listener => listener());
}
export function refreshPaidPlans(): Promise<void> {
  if (pending) return pending;
  pending = fetch(buildApiUrl('/public/paid-plans'), { cache: 'no-store', signal: AbortSignal.timeout(10000) })
    .then(async response => {
      if (!response.ok) throw new Error('Plans unavailable');
      const data = await response.json();
      publish({ businessPro: data.businessPro === true, xamukoPlus: data.xamukoPlus === true });
    }).catch(() => publish(disabled)).finally(() => { pending = null; });
  return pending;
}
let timer: ReturnType<typeof setInterval> | undefined;
const refresh = () => { void refreshPaidPlans(); };
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    refresh();
    timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { clearInterval(timer); window.removeEventListener('focus', refresh); }
  };
}
export function usePaidPlans() {
  return useSyncExternalStore(subscribe, () => state, () => disabled);
}
