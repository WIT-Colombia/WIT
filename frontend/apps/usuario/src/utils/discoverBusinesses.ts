import type { Business } from "../data/mockData";

const DAY_MS = 86_400_000;
const BOGOTA_UTC_OFFSET_MS = 5 * 3_600_000;

/** Day number at midnight in Colombia (UTC-05:00, no daylight saving). */
export function bogotaDayIndex(timestamp = Date.now()): number {
  return Math.floor((timestamp - BOGOTA_UTC_OFFSET_MS) / DAY_MS);
}

/**
 * Display up to six distinct businesses each Colombian day.
 * Reserve up to two places for pioneers, two for Premium/featured and
 * two for standard businesses; if a group is short, redistribute its slots.
 * The stable daily offset allows every business in a group to be seen over time.
 */
export function selectDiscoverBusinesses(businesses: Business[], dayIndex: number, limit = 6): Business[] {
  const unique = [...new Map(businesses.map((business) => [business.id, business])).values()]
    .sort((a, b) => a.id.localeCompare(b.id));
  const pioneers = unique.filter((business) => typeof business.pioneerNumber === "number");
  const premium = unique.filter((business) => typeof business.pioneerNumber !== "number"
    && (business.plan === "premium" || business.isFeatured));
  const standard = unique.filter((business) => typeof business.pioneerNumber !== "number"
    && business.plan !== "premium" && !business.isFeatured);
  const selected: Business[] = [];
  const used = new Set<string>();
  const capacity = Math.max(0, Math.floor(limit));
  const rotation = Number.isFinite(dayIndex) ? Math.floor(dayIndex) : 0;

  const take = (group: Business[], count: number) => {
    if (!group.length || count <= 0) return;
    const start = ((rotation * capacity) % group.length + group.length) % group.length;
    for (let i = 0; i < group.length && count > 0 && selected.length < capacity; i++) {
      const business = group[(start + i) % group.length];
      if (used.has(business.id)) continue;
      used.add(business.id);
      selected.push(business);
      count--;
    }
  };

  // Prioridades comerciales, pero sin bloquear la exposición de cuentas gratuitas.
  take(pioneers, 2);
  take(premium, 2);
  take(standard, 2);
  // Completar los espacios libres: Premium primero y después los demás.
  for (const group of [premium, pioneers, standard]) {
    take(group, capacity - selected.length);
  }
  return selected;
}
