import type { PlusRouteFavorite } from '../services/userPlusService';

export type PlusTravelMode = 'driving' | 'walking';
export type Point = { lat: number; lng: number };
export type PlusStopEstimate = { stop: PlusRouteFavorite; arrivalAt: Date; hoursStatus: 'OPEN' | 'CLOSED' | 'UNKNOWN' };

function straightLineKm(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad)
    * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Checks every permutation (max 4 stops) to find the shortest straight-line route.
 * Google Maps is responsible for actual road routing and traffic after opening the route.
 */
export function optimizePlusRoute(stops: PlusRouteFavorite[], origin?: Point): PlusRouteFavorite[] {
  if (stops.length < 2 || stops.length > 4) return [...stops];
  const permutations = (items: PlusRouteFavorite[]): PlusRouteFavorite[][] =>
    items.length < 2 ? [items] : items.flatMap((item, index) =>
      permutations(items.filter((_, i) => i !== index)).map(rest => [item, ...rest]));
  const distance = (route: PlusRouteFavorite[]) =>
    route.reduce((total, stop, index) => {
      const from = index === 0 ? origin : route[index - 1];
      return total + (from ? straightLineKm(from, stop) : 0);
    }, 0);
  const all = permutations(stops);
  all.sort((a, b) => distance(a) - distance(b));
  return all[0];
}
const clock = (value: string | null): number | null => {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
};
export function plusOpenStatus(stop: PlusRouteFavorite, at: Date): 'OPEN' | 'CLOSED' | 'UNKNOWN' {
  if (!stop.hours?.length || !Number.isFinite(at.valueOf())) return 'UNKNOWN';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: stop.timezone,
      weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
    const pick = (type: string) => parts.find(part => part.type === type)?.value ?? '';
    const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = weekdays[pick('weekday')], minute = Number(pick('hour')) * 60 + Number(pick('minute'));
    if (day === undefined || !Number.isFinite(minute)) return 'UNKNOWN';
    const today = stop.hours.find(item => item.dayOfWeek === day);
    const yesterday = stop.hours.find(item => item.dayOfWeek === (day + 6) % 7);
    const prevStart = clock(yesterday?.opensAt ?? null), prevEnd = clock(yesterday?.closesAt ?? null);
    if (yesterday && !yesterday.isClosed && prevStart !== null && prevEnd !== null
      && prevEnd < prevStart && minute < prevEnd) return 'OPEN';
    if (!today) return 'UNKNOWN';
    if (today.isClosed) return 'CLOSED';
    const opens = clock(today.opensAt), closes = clock(today.closesAt);
    if (opens === null || closes === null || opens === closes) return 'UNKNOWN';
    return closes > opens ? (minute >= opens && minute < closes ? 'OPEN' : 'CLOSED')
      : (minute >= opens ? 'OPEN' : 'CLOSED');
  } catch { return 'UNKNOWN'; }
}

/** Travel estimates are illustrative, not road traffic forecasts.
 * The warnings check published opening hours at each approximate arrival time.
 */
export function estimatePlusRoute(stops: PlusRouteFavorite[], mode: PlusTravelMode,
  departAt: Date, origin?: Point): PlusStopEstimate[] {
  if (!Number.isFinite(departAt.getTime())) return [];
  const speedKmH = mode === 'walking' ? 4.5 : 25;
  let time = departAt.getTime();
  return stops.map((stop, index) => {
    const previous = index === 0 ? origin : stops[index - 1];
    if (previous) time += (7 + straightLineKm(previous, stop) / speedKmH * 60) * 60_000;
    const arrivalAt = new Date(time);
    time += 20 * 60_000; // A configurable visit schedule may be added later.
    return { stop, arrivalAt, hoursStatus: plusOpenStatus(stop, arrivalAt) };
  });
}
