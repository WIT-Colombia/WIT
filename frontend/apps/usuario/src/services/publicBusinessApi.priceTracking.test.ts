import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listPublicProducts, listPublicServices } from './publicBusinessApi';

const request = vi.hoisted(() => vi.fn());
vi.mock('./authService', () => ({ requestWithSession: request }));

const base = {
  id: '12345678-1234-4234-8234-123456789abc',
  name: 'Pan queso',
  description: 'Delicioso pan con queso',
  category: null,
  photos: [],
};
const price = (amount: string | null, text: string | null, negotiable = false) =>
  ({ ...base, price: { amount, text, currency: 'COP', negotiable } });

beforeEach(() => request.mockReset());

describe('Xamuko Plus: precio numérico visible en fichas públicas', () => {
  it('shows Seguir precio for a numeric product price held in text, even when amount is missing', async () => {
    request.mockResolvedValue({ products: [price(null, '2000'), price('', '2000')] });
    const products = await listPublicProducts('panaderia');
    expect(products).toHaveLength(2);
    for (const product of products) {
      expect(product.priceTrackable).toBe(true);
      expect(product.priceLabel).toContain('2.000');
    }
  });

  it('also permits following a numeric-priced public service', async () => {
    request.mockResolvedValue({ services: [price(null, '2000')] });
    const services = await listPublicServices('panaderia');
    expect(services[0]?.priceTrackable).toBe(true);
    expect(services[0]?.priceLabel).toContain('2.000');
  });

  it('rejects prices without a positive numeric value or marked as negotiable', async () => {
    request.mockResolvedValue({ products: [
      price(null, null),
      price(null, 'Precio a convenir'),
      price('0', null),
      price(null, '2000', true),
    ] });
    const products = await listPublicProducts('panaderia');
    expect(products.every(product => product.priceTrackable === false)).toBe(true);
  });
});
