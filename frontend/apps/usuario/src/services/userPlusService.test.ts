import { describe, expect, it } from 'vitest';
import { PAID_PLAN_MONTHLY_COP, formatCopPrice } from '@wit/utils';
import { parsePlusTarget, searchHref } from './userPlusService';

const uuid = '12345678-1234-4234-8234-123456789abc';
describe('Precios de los planes Xamuko en COP', () => {
  it('conserva precios mensuales aprobados y formato colombiano', () => {
    expect(PAID_PLAN_MONTHLY_COP.businessPro).toBe(29900);
    expect(PAID_PLAN_MONTHLY_COP.xamukoPlus).toBe(4900);
    expect(formatCopPrice(PAID_PLAN_MONTHLY_COP.businessPro)).toBe('$29.900');
    expect(formatCopPrice(PAID_PLAN_MONTHLY_COP.xamukoPlus)).toBe('$4.900');
  });
});

describe('Xamuko Plus: enlaces seguros para colecciones, precios y comparador', () => {
  it('acepta identificadores públicos correctos y enlaces internos de negocios', () => {
    expect(parsePlusTarget('/business/' + uuid)).toEqual({ targetType: 'BUSINESS', targetId: uuid });
    expect(parsePlusTarget('/product/' + uuid)).toEqual({ targetType: 'OFFER', targetId: uuid });
    expect(parsePlusTarget('/service/' + uuid)).toEqual({ targetType: 'OFFER', targetId: uuid });
    expect(parsePlusTarget(uuid)).toEqual({ targetType: 'OFFER', targetId: uuid });
  });
  it('rechaza URLs de terceros, rutas ajenas y supuestos IDs no válidos', () => {
    expect(parsePlusTarget('https://evil.example/product/' + uuid)).toBeNull();
    expect(parsePlusTarget('/admin/users/' + uuid)).toBeNull();
    expect(parsePlusTarget('test')).toBeNull();
    expect(parsePlusTarget('')).toBeNull();
  });
  it('repite una búsqueda sin incluir permisos o estado del plan en la URL', () => {
    expect(searchHref({
      id: 'saved', title: 'Panaderías', query: 'pan artesanal', category: 'Panaderías',
      city: 'Palmira', openNow: true, minRating: 4, sort: 'rating',
    })).toBe('/results?q=pan+artesanal&category=Panader%C3%ADas');
  });
});
