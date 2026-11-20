/** Per-account, per-tab comparison shortlist. Does not change Plus membership or send data to the API. */
const MAX_OPTIONS = 4;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function key(userId: string, preview: boolean) {
  return 'xamuko-plus-comparison:' + (preview ? 'preview:' : 'real:') + userId;
}

function labelsKey(userId: string, preview: boolean) {
  return key(userId, preview) + ':labels';
}
function safeLabel(label: string): string {
  return label.trim().slice(0, 110);
}
export function readPlusComparisonLabels(userId: string, preview = false): Record<string, string> {
  if (!userId) return {};
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(labelsKey(userId, preview)) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const valid = new Set(readPlusComparison(userId, preview));
    return Object.fromEntries(Object.entries(value).filter(([id, label]) => valid.has(id) &&
      typeof label === 'string' && safeLabel(label).length > 0)
      .map(([id, label]) => [id, safeLabel(label as string)]));
  } catch { return {}; }
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
    const labels = readPlusComparisonLabels(userId, preview);
    if (normalized.length) {
      window.sessionStorage.setItem(key(userId, preview), JSON.stringify(normalized));
      const kept = Object.fromEntries(Object.entries(labels).filter(([id]) => normalized.includes(id)));
      if (Object.keys(kept).length) window.sessionStorage.setItem(labelsKey(userId, preview), JSON.stringify(kept));
      else window.sessionStorage.removeItem(labelsKey(userId, preview));
    } else {
      window.sessionStorage.removeItem(key(userId, preview));
      window.sessionStorage.removeItem(labelsKey(userId, preview));
    }
  } catch { /* private browsing can disallow storage; the current view still works */ }
  return normalized;
}

export function appendPlusComparison(userId: string, offerId: string, preview = false, offerName = ''): {
  ids: string[]; outcome: 'added' | 'duplicate' | 'full' | 'invalid';
} {
  const ids = readPlusComparison(userId, preview);
  if (!UUID.test(offerId) || !userId) return { ids, outcome: 'invalid' };
  if (ids.includes(offerId)) return { ids, outcome: 'duplicate' };
  if (ids.length >= MAX_OPTIONS) return { ids, outcome: 'full' };
  const next = savePlusComparison(userId, [...ids, offerId], preview);
  const label = safeLabel(offerName);
  if (label) {
    try {
      window.sessionStorage.setItem(labelsKey(userId, preview),
        JSON.stringify({ ...readPlusComparisonLabels(userId, preview), [offerId]: label }));
    } catch { /* storage might be unavailable; IDs still work without labels */ }
  }
  return { ids: next, outcome: 'added' };
}
