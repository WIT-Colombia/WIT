/** Integration boundary only: credentials and scheduling remain disabled until approved. */
export type SyncProvider = 'AWS' | 'GOOGLE_MAPS' | 'RESEND';
export type SyncPlan = { provider: SyncProvider; periodStart: Date; periodEnd: Date; idempotencyKey: string; maxAttempts: number; retryDelaysMs: number[] };

export function buildDailySyncPlan(provider: SyncProvider, date = new Date()): SyncPlan {
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 1);
  return { provider, periodStart: start, periodEnd: end, idempotencyKey: `${provider}:${start.toISOString().slice(0, 10)}`, maxAttempts: 3, retryDelaysMs: [1000, 5000, 30000] };
}

export function providerSupportsAutomaticBilling(provider: SyncProvider): boolean {
  return provider === 'AWS';
}
