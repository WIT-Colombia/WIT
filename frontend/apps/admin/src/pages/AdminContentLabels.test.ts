import { describe, expect, it } from 'vitest';
import { contentStatusLabel, offerKindLabel, offerPrice, reportReasonLabel, reportStatusLabel } from './AdminContentLabels';

describe('Etiquetas de contenido en español', () => {
  it('traduce producto, servicio y los estados de publicación', () => {
    expect(offerKindLabel('PRODUCT')).toBe('Producto');
    expect(offerKindLabel('SERVICE')).toBe('Servicio');
    expect(contentStatusLabel('PUBLISHED')).toBe('Publicado');
    expect(contentStatusLabel('REVIEW')).toBe('En revisión');
    expect(contentStatusLabel('UNPUBLISHED')).toBe('No publicado');
    expect(contentStatusLabel('PUBLISHED', '2026-11-15T00:00:00Z')).toBe('Eliminado');
  });
  it('traduce los reportes sin mostrar códigos internos', () => {
    expect(reportReasonLabel('WRONG_IMAGE')).toBe('Imagen incorrecta');
    expect(reportStatusLabel('UNDER_REVIEW')).toBe('En revisión');
  });
  it('formatea precios reales y evita valores inventados', () => {
    const regular = { priceAmount: '25000.00', currency: 'COP', priceText: null, negotiable: false };
    expect(offerPrice(regular)).toContain('25.000');
    expect(offerPrice({ priceAmount: null, currency: null, priceText: null, negotiable: false })).toBe('Precio no registrado');
    expect(offerPrice({ priceAmount: null, currency: null, priceText: 'Consultar al negocio', negotiable: true })).toBe('Consultar al negocio');
  });
});
