import { describe, expect, it } from 'vitest';
import { whatsappLink } from './whatsapp';

describe('contacto de negocio', () => {
  it('construye WhatsApp con el número comercial internacional', () => {
    expect(whatsappLink('+573001234567', 'Hola')).toBe('https://wa.me/573001234567?text=Hola');
  });
  it('oculta WhatsApp cuando el número no es válido', () => {
    expect(whatsappLink('abc')).toBeNull();
  });
});
