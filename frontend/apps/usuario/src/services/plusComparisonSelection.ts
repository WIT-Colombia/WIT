/** Per-account, per-tab comparison shortlist. Does not change Plus membership or send data to the API. */
const MAX_OPTIONS = 4;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function key(userId: string, preview: boolean) {
  return 'xamuko-plus-comparison:' + (preview ? 'preview:' : 'real:') + userId;
}

function validIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((v): v is string => typeof v === 'string' && UUID.test(v)))).slice(0, MAX_OPTIONS);
}

export function readPlusComparison(userId: string, preview = false): string[] {
  if (!userId) return [];
  try { return validIds(JSON.parse(window.sessionStorage.getItem(key(userId, preview)) ?? '[]')); }
  catch { return []; }
}

export function savePlusComparison(userId: string, ids: string[], preview = false): string[] {
  const normalized = validIds(ids);
  if (!userId) return [];
  try {
    if (normalized.length) window.sessionStorage.setItem(key(userId, preview), JSON.stringify(normalized));
    else window.sessionStorage.removeItem(key(userId, preview));
  } catch { /* private browsing can disallow storage; the current view still works */ }
  return normalized;
}

export function appendPlusComparison(userId: string, offerId: string, preview = false): {
  ids: string[]; outcome: 'added' | 'duplicate' | 'full' | 'invalid';
} {
  const ids = readPlusComparison(userId, preview);
  if (!UUID.test(offerId) || !userId) return { ids, outcome: 'invalid' };
  if (ids.includes(offerId)) return { ids, outcome: 'duplicate' };
  if (ids.length >= MAX_OPTIONS) return { ids, outcome: 'full' };
  return { ids: savePlusComparison(userId, [...ids, offerId], preview), outcome: 'added' };
}
