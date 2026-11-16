import { describe, expect, it } from 'vitest';
import { OFFICIAL_CATEGORY_CODES, normalizeCategoryCode, resolveCategoryVisual } from './categoryVisuals';

describe('Iconografía de Categorías en Admin', () => {
  it('cubre las 33 categorías oficiales sin repetir pictogramas genéricos', () => {
    expect(OFFICIAL_CATEGORY_CODES).toHaveLength(33);
    const resolved = OFFICIAL_CATEGORY_CODES.map(code => resolveCategoryVisual(code));
    expect(resolved.every(item => item.glyph !== 'tag')).toBe(true);
    expect(new Set(resolved.map(item => item.glyph)).size).toBe(33);
  });
  it('asigna pictogramas relevantes y estables a categorías distintas', () => {
    expect(resolveCategoryVisual('restaurantes').glyph).toBe('utensils');
    expect(resolveCategoryVisual('salud-y-bienestar').glyph).toBe('heart-pulse');
    expect(resolveCategoryVisual('tecnologia').glyph).toBe('laptop');
    expect(resolveCategoryVisual('mascotas-y-veterinarias').glyph).toBe('paw');
    expect(resolveCategoryVisual('servicios-profesionales').glyph).toBe('briefcase');
  });
  it('acepta códigos históricos y nombres en español con tildes sin depender de IDs', () => {
    expect(resolveCategoryVisual('RESTAURANTS').glyph).toBe('utensils');
    expect(resolveCategoryVisual('FASHION').glyph).toBe('shirt');
    expect(resolveCategoryVisual('HEALTH').glyph).toBe('heart-pulse');
    expect(normalizeCategoryCode('Panaderías y reposterías')).toBe('panaderias-y-reposterias');
    expect(resolveCategoryVisual('legacy-312', 'Ópticas').glyph).toBe('glasses');
  });
  it('utiliza un icono neutral cuando la categoría no está reconocida', () => {
    expect(resolveCategoryVisual('categoria-personalizada')).toEqual({glyph:'tag',tone:'slate'});
  });
});
