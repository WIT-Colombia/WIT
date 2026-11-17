import { describe, expect, it } from 'vitest';
import { homeVisibilityState } from './homeVisibilityState';
import type { BusinessVisibility } from './businessApiClient';

const fixture: BusinessVisibility = {
  businessId: 'business-real', publicId: 'B-REAL-1', createdAt: '2026-11-01T00:00:00Z',
  visibilityStatus: 'VISIBLE', administrativeRestriction: null,
  publicationStatus: 'PUBLISHED', isWithinPeriod: true,
  period: { id: 'period-1', kind: 'INITIAL', startsAt: '2026-11-01T00:00:00Z',
    expiresAt: '2026-12-11T00:00:00Z', requestedAt: '2026-11-01T00:00:00Z' },
};

describe('Visibilidad en Business Inicio', () => {
  it('distingue un negocio visible de su vigencia', () => {
    expect(homeVisibilityState(fixture, true)).toMatchObject({ label: 'Visible', variant: 'active', blockedByAdmin: false });
  });
  it('muestra Oculta y permite que el propietario la reactive sin alterar el período', () => {
    expect(homeVisibilityState({ ...fixture, visibilityStatus: 'HIDDEN' }, true))
      .toMatchObject({ label: 'Oculta', hiddenByOwner: true, blockedByAdmin: false });
  });
  it('muestra la suspensión aun si quedan días vigentes', () => {
    const state = homeVisibilityState({ ...fixture, visibilityStatus: 'HIDDEN', administrativeRestriction: 'SUSPENDED' }, true);
    expect(state).toMatchObject({ label: 'Suspendida', blockedByAdmin: true, hiddenByOwner: false });
    expect(state.note).toContain('Solo XAMUKO Admin');
  });
  it('respeta restricciones anteriores sin habilitar la reactivación', () => {
    expect(homeVisibilityState({ ...fixture, administrativeRestriction: 'HIDDEN' }, true))
      .toMatchObject({ label: 'Restringida', blockedByAdmin: true });
  });
  it('no presenta como visible una vigencia vencida ni un negocio sin publicar', () => {
    expect(homeVisibilityState({ ...fixture, visibilityStatus: 'EXPIRED' }, false).label).toBe('Vencida');
    expect(homeVisibilityState({ ...fixture, publicationStatus: 'UNPUBLISHED' }, true).label).toBe('Sin publicar');
  });
  it('mantiene el estado Oculta aunque el período se venza, para permitir renovarlo después', () => {
    expect(homeVisibilityState({ ...fixture, visibilityStatus: 'HIDDEN' }, false))
      .toMatchObject({ label: 'Oculta', hiddenByOwner: true });
  });
});
