/** Consistent directory page size across Users, Businesses and Content in Admin. */
export const ADMIN_DIRECTORY_PAGE_SIZE = 20;

type AdminDirectoryPagination = {
  page: number;
  pageSize: number;
  total: number;
};

export function adminDirectoryPageSummary(
  pagination: AdminDirectoryPagination,
  visibleCount: number,
  itemName: string,
): string {
  const { page, pageSize, total } = pagination;
  const start = visibleCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const end = visibleCount > 0 ? Math.min(total, start + visibleCount - 1) : 0;
  const range = visibleCount > 0 ? `${start}–${end}` : '0';
  return `Mostrando ${range} de ${total.toLocaleString('es-CO')} ${itemName} · ${pageSize} por página`;
}
