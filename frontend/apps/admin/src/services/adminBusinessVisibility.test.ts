import { describe, expect, it } from 'vitest';
import { adminBusinessVisibilityLabel } from './adminApiClient';

describe('Negocios Admin: visibilidad del negocio', () => {
  it('distingue suspensión administrativa de ocultamiento voluntario', () => {
    expect(adminBusinessVisibilityLabel({ visibilityStatus: 'HIDDEN', administrativeRestriction: 'SUSPENDED' })).toBe('Suspendido por Admin');
    expect(adminBusinessVisibilityLabel({ visibilityStatus: 'HIDDEN', administrativeRestriction: 'HIDDEN' })).toBe('Oculto por Admin');
    expect(adminBusinessVisibilityLabel({ visibilityStatus: 'HIDDEN', administrativeRestriction: null })).toBe('Oculto por propietario');
  });
  it('no transforma un vencimiento en estado visible', () => {
    expect(adminBusinessVisibilityLabel({ visibilityStatus: 'EXPIRED', administrativeRestriction: null })).toBe('Vencido');
  });
});
