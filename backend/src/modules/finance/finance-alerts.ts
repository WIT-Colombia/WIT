export const FINANCE_THRESHOLDS = [50, 75, 90, 100] as const;
export function pendingBudgetAlerts(budgetId: string, consumedCop: number, budgetCop: number, existingKeys: Set<string>) {
  if (budgetCop <= 0) return [] as Array<{ dedupeKey: string; threshold: number }>;
  return FINANCE_THRESHOLDS.filter(threshold => consumedCop >= budgetCop * threshold / 100).map(threshold => ({ threshold, dedupeKey: `${budgetId}:${threshold}` })).filter(alert => !existingKeys.has(alert.dedupeKey));
}
