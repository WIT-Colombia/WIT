import { describe, expect, it } from 'vitest';
import { effectiveCatalogLimits, effectivePromotionLimits } from './effectivePlanLimits';
import type { CatalogLimits, PromotionLimits } from './businessApiClient';

const proCatalog: CatalogLimits = {
  level: 'BASIC', plan: 'PRO',
  products: { used: 28, limit: null, available: null, unlimited: true },
  services: { used: 4, limit: null, available: null, unlimited: true },
};
const proPromotions: PromotionLimits = {
  plan: 'PRO', maxActive: 10, activeCount: 3, maxPhotos: 4,
  canSchedule: true, canRecur: true, detailedAnalytics: true,
  summary: { active: 3, scheduled: 0, finished: 2, totalViews: 100 },
};

describe('cuotas cuando termina o se deshabilita Business PRO', () => {
  it('vuelve al límite básico, conserva lo publicado y no permite nuevas altas si excede cuota', () => {
    const limits = effectiveCatalogLimits(proCatalog, false)!;
    expect(limits.plan).toBe('BASIC');
    expect(limits.products).toEqual({ used: 28, limit: 20, available: 0, unlimited: false });
    expect(limits.services).toEqual({ used: 4, limit: 20, available: 16, unlimited: false });
    expect(proCatalog.products.unlimited).toBe(true);
  });
  it('conserva las cuotas obtenidas por referidos sin reactivar PRO', () => {
    const limits = effectiveCatalogLimits({ ...proCatalog, level: 'DIAMOND' }, false)!;
    expect(limits.products.limit).toBe(75);
    expect(limits.services.limit).toBe(75);
    expect(limits.plan).toBe('BASIC');
  });
  it('restringe ofertas y promociones a una publicación, sin borrar las existentes', () => {
    const limits = effectivePromotionLimits(proPromotions, false)!;
    expect(limits.plan).toBe('BASIC');
    expect(limits.maxActive).toBe(1);
    expect(limits.activeCount).toBe(3);
    expect(limits.canRecur).toBe(false);
    expect(limits.canSchedule).toBe(false);
    expect(limits.maxPhotos).toBe(1);
    expect(limits.detailedAnalytics).toBe(false);
  });
  it('mantiene los beneficios cuando el plan está habilitado y el servidor acredita PRO', () => {
    expect(effectiveCatalogLimits(proCatalog, true)).toBe(proCatalog);
    expect(effectivePromotionLimits(proPromotions, true)).toBe(proPromotions);
    expect(effectiveCatalogLimits(null, false)).toBeNull();
  });
});
