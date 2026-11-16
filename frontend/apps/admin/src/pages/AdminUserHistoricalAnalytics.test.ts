import { describe, expect, it } from 'vitest';
import { groupedPoints } from './AdminUserHistoricalAnalytics';

describe('Histórico de usuarios: fechas, ceros y acumulados', () => {
  const months = [
    { month: '2026-01', registrations: 4, cumulative: 8 },
    { month: '2026-02', registrations: 0, cumulative: 8 },
    { month: '2026-03', registrations: 3, cumulative: 11 },
  ];
  it('no descarta períodos de cero registros', () => {
    const result = groupedPoints(months,'month');
    expect(result.map(x=>x.registrations)).toEqual([4,0,3]);
    expect(result.map(x=>x.cumulative)).toEqual([8,8,11]);
  });
  it('agrupa por trimestre y conserva el último acumulado', () => {
    expect(groupedPoints(months,'quarter')).toEqual([{label:'T1 2026',registrations:7,cumulative:11}]);
  });
  it('agrupa por año sin inventar registros', () => {
    expect(groupedPoints(months,'year')).toEqual([{label:'2026',registrations:7,cumulative:11}]);
  });
});
