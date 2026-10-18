import assert from 'node:assert/strict';
import test from 'node:test';
import { offerCreateSchema, offerUpdateSchema } from './offer.schemas.js';

test('los productos y servicios aceptan la clasificación +18 explícita', () => {
  const parsed = offerCreateSchema.parse({ kind: 'PRODUCT', name: 'Producto restringido', adultOnly: true });
  assert.equal(parsed.adultOnly, true);
  assert.equal(parsed.publicationStatus, 'UNPUBLISHED');
});

test('la edición conserva un valor booleano para adultOnly', () => {
  assert.equal(offerUpdateSchema.parse({ adultOnly: false }).adultOnly, false);
  assert.throws(() => offerUpdateSchema.parse({ adultOnly: 'true' }));
});
