import { describe, expect, it } from 'vitest';
import { ADMIN_DIRECTORY_PAGE_SIZE, adminDirectoryPageSummary } from './adminDirectoryPagination';

describe('Admin: 20 registros por página', () => {
  it('usa 20 registros para el directorio de negocios', () => {
    expect(ADMIN_DIRECTORY_PAGE_SIZE).toBe(20);
  });
  it('muestra el rango de una primera página completa', () => {
    expect(adminDirectoryPageSummary({ page: 1, pageSize: 20, total: 105 }, 20, 'negocios'))
      .toBe('Mostrando 1–20 de 105 negocios · 20 por página');
  });
  it('calcula correctamente los registros de páginas posteriores', () => {
    expect(adminDirectoryPageSummary({ page: 3, pageSize: 20, total: 47 }, 7, 'usuarios'))
      .toBe('Mostrando 41–47 de 47 usuarios · 20 por página');
  });
  it('respeta los filtros cuando la página está vacía', () => {
    expect(adminDirectoryPageSummary({ page: 1, pageSize: 20, total: 0 }, 0, 'publicaciones'))
      .toBe('Mostrando 0 de 0 publicaciones · 20 por página');
  });
});
