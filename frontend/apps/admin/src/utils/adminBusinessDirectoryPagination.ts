/** Admin Negocios alone uses 10 records; Users and Content keep their shared page size. */
export const ADMIN_BUSINESS_DIRECTORY_PAGE_SIZE = 10;

/** Compact numbered pagination for the 10-record Admin Negocios directory. */
export function businessDirectoryPages(current: number, total: number): Array<number | '…'> {
  const last = Math.max(1, total);
  const near = Array.from({ length: 5 }, (_, index) => Math.max(2, Math.min(last - 4, current - 2)) + index);
  const items = [...new Set([1, last, ...near.filter(n => n > 1 && n < last)])].sort((a, b) => a - b);
  const result: Array<number | '…'> = [];
  items.forEach((value, index) => {
    if (index > 0 && value > items[index - 1] + 1) result.push('…');
    result.push(value);
  });
  return result;
}
