import { AppError } from '../../shared/errors/app-error.js';

export type PlusHour = { dayOfWeek: number; isClosed: boolean; opensAt: string | null; closesAt: string | null };
export type PlusHoursState = 'OPEN' | 'CLOSED' | 'UNKNOWN';

export function validatedPlusTimezone(timezone: string): string {
  if (timezone.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(timezone))
    throw new AppError(400, 'PLUS_INVALID_TIMEZONE', 'Selecciona una zona horaria válida.');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    throw new AppError(400, 'PLUS_INVALID_TIMEZONE', 'Selecciona una zona horaria válida.');
  }
}

export function plusLocalDateTime(now: Date, timezone: string) {
  const items = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => items.find(item => item.type === type)?.value ?? '';
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    day: [get('year'), get('month'), get('day')].join('-'),
    weekday: weekdays[get('weekday')] ?? -1,
    minuteOfDay: Number(get('hour')) * 60 + Number(get('minute')),
    hour: Number(get('hour')),
  };
}

const minutes = (clock: string | null) => {
  if (!clock || !/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) return null;
  return Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
};

/** Public hours may cross midnight. No schedule -> unknown (never presume open). */
export function plusHoursState(hours: PlusHour[], timezone: string, now: Date): PlusHoursState {
  if (!hours.length) return 'UNKNOWN';
  let local;
  try { local = plusLocalDateTime(now, timezone); }
  catch { return 'UNKNOWN'; }
  const day = hours.find(h => h.dayOfWeek === local.weekday);
  const previous = hours.find(h => h.dayOfWeek === (local.weekday + 6) % 7);
  const startPrev = minutes(previous?.opensAt ?? null);
  const endPrev = minutes(previous?.closesAt ?? null);
  if (previous && !previous.isClosed && startPrev !== null && endPrev !== null
      && endPrev <= startPrev && local.minuteOfDay < endPrev) return 'OPEN';
  if (!day) return 'UNKNOWN';
  if (day.isClosed) return 'CLOSED';
  const start = minutes(day.opensAt), end = minutes(day.closesAt);
  if (start === null || end === null) return 'UNKNOWN';
  if (start === end) return 'UNKNOWN';
  if (end > start) return local.minuteOfDay >= start && local.minuteOfDay < end ? 'OPEN' : 'CLOSED';
  return local.minuteOfDay >= start ? 'OPEN' : 'CLOSED';
}
