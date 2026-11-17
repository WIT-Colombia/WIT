import { describe, expect, it } from 'vitest';
import { businessDirectoryPages } from './adminBusinessDirectoryPagination';

describe('Directorio Admin de negocios: paginación compacta', () => {
  it('muestra todas las páginas cuando son pocas', () => {
    expect(businessDirectoryPages(1, 1)).toEqual([1]);
    expect(businessDirectoryPages(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it('permite navegar al principio y al final sin páginas inventadas', () => {
    expect(businessDirectoryPages(1, 62)).toEqual([1, 2, 3, 4, 5, 6, '…', 62]);
    expect(businessDirectoryPages(62, 62)).toEqual([1, '…', 58, 59, 60, 61, 62]);
  });
  it('indica los saltos en páginas intermedias', () => {
    expect(businessDirectoryPages(30, 62)).toEqual([1, '…', 28, 29, 30, 31, 32, '…', 62]);
  });
});
