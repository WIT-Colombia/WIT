import { describe, expect, it } from 'vitest';
import { estimatePlusRoute, optimizePlusRoute, plusOpenStatus } from './plusRoutePlanner';
import type { PlusRouteFavorite } from '../services/userPlusService';

const place = (id: string, lat: number, lng: number, hours: PlusRouteFavorite['hours'] = [],
  timezone = 'America/Panama'): PlusRouteFavorite => ({ id, name: id, lat, lng, hours, timezone });

describe('Xamuko Plus: rutas con varios negocios', () => {
  it('finds the shortest straight-line ordering with an origin among up to four stops', () => {
    const stops = [place('lejos', 4.2, -76), place('cerca', 3.52, -76.29),
      place('medio', 3.7, -76.25), place('segundo', 3.55, -76.28)];
    const ordered = optimizePlusRoute(stops, { lat: 3.519, lng: -76.291 });
    expect(ordered.map(stop => stop.id)).toEqual(['cerca', 'segundo', 'medio', 'lejos']);
    expect(stops.map(stop => stop.id)).toEqual(['lejos', 'cerca', 'medio', 'segundo']);
    expect(optimizePlusRoute(stops.slice(0, 1))).toHaveLength(1);
  });
  it('uses the business local timezone and handles overnight opening hours', () => {
    const overnight = place('abierto', 3.52, -76.29,
      [{ dayOfWeek: 5, isClosed: false, opensAt: '18:00', closesAt: '02:00' }]);
    expect(plusOpenStatus(overnight, new Date('2026-11-21T02:00:00.000Z'))).toBe('OPEN');
    expect(plusOpenStatus(overnight, new Date('2026-11-21T06:00:00.000Z'))).toBe('OPEN');
    expect(plusOpenStatus(overnight, new Date('2026-11-21T09:00:00.000Z'))).toBe('UNKNOWN');
    expect(plusOpenStatus(place('sin horas', 3.51, -76.29), new Date())).toBe('UNKNOWN');
  });
  it('warns closed vs unknown at approximate arrival, without claiming road traffic data', () => {
    const closed = place('cerrado', 3.52, -76.29,
      [{ dayOfWeek: 5, isClosed: true, opensAt: null, closesAt: null }]);
    const unknown = place('sin horario', 3.53, -76.30);
    const predictions = estimatePlusRoute([closed, unknown], 'walking',
      new Date('2026-11-20T15:00:00.000Z'));
    expect(predictions).toHaveLength(2);
    expect(predictions[0].hoursStatus).toBe('CLOSED');
    expect(predictions[1].hoursStatus).toBe('UNKNOWN');
    expect(predictions[1].arrivalAt.getTime()).toBeGreaterThan(predictions[0].arrivalAt.getTime());
  });
});
