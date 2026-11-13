import type { Business } from "../data/mockData";
import { searchUniversal } from "./businessService";

const PAGE_SIZE = 50;
const BATCH_SIZE = 4;

/**
 * Fetch every published/active business in a selected Colombian municipality,
 * not just the first page used by the regular Home search.
 * Product and service page sizes are kept small since this carousel needs businesses only.
 */
export async function listDiscoverBusinesses(city: string, region?: string): Promise<Business[]> {
  const filters = {
    scope: "city" as const,
    city,
    ...(region ? { region } : {}),
    businessPageSize: PAGE_SIZE,
    productPageSize: 1,
    servicePageSize: 1,
  };
  const first = await searchUniversal({ ...filters, businessPage: 1 });
  const result = [...first.businesses];
  const reportedPages = Number(first.pagination?.businesses?.totalPages ?? 1);
  const totalPages = Number.isFinite(reportedPages) ? Math.max(1, Math.floor(reportedPages)) : 1;
  for (let start = 2; start <= totalPages; start += BATCH_SIZE) {
    const last = Math.min(totalPages, start + BATCH_SIZE - 1);
    const pages = await Promise.all(
      Array.from({ length: last - start + 1 }, (_, index) =>
        searchUniversal({ ...filters, businessPage: start + index })),
    );
    for (const page of pages) result.push(...page.businesses);
  }
  // A pagination boundary may shift as businesses are registered.
  return [...new Map(result.map((business) => [business.id, business])).values()];
}
