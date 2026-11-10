import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDashboardSnapshot } from './dashboardService';
import type { Admin } from '../types/admin';

const api = vi.hoisted(() => ({
  getAdminDashboardStats: vi.fn(),
  listAdminReviews: vi.fn(),
  listReviewReports: vi.fn(),
}));
vi.mock('./adminApiClient', () => api);
vi.mock('./adminService', () => ({ can: (_admin: unknown, permission: string) => permission === 'content:moderate' }));
const admin = { id: 'test-admin', name: 'Test admin', permissions: ['content:moderate'] } as unknown as Admin;

describe('XAMUKO Admin dashboard data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAdminDashboardStats.mockResolvedValue({
      generatedAt: '2026-11-04T12:00:00Z',
      totals: { users: 5, businesses: 3, businessesVerified: 1, reviewsPublished: 0, businessProActive: 0 },
      businessStatuses: { published: 2, unpublished: 1, review: 0 },
      userStatuses: { active: 5, suspended: 0 },
      subscriptions: { proActive: 0, proPending: 0, proExpiring30Days: 0, plus: null },
      monthly: [], revenue: null,
    });
    api.listAdminReviews.mockResolvedValue({ reviews: [], pagination: { total: 0 } });
    api.listReviewReports.mockResolvedValue({ reports: [] });
  });

  it('preserva todos los valores reales, incluidos los ceros', async () => {
    const result = await loadDashboardSnapshot(admin);
    expect(result.stats?.totals.users).toBe(5);
    expect(result.stats?.totals.reviewsPublished).toBe(0);
    expect(result.stats?.revenue).toBeNull();
    expect(result.statsError).toBe(false);
  });

  it('no inventa cifras cuando la API está desconectada', async () => {
    api.getAdminDashboardStats.mockRejectedValue(new Error('Servicio indisponible'));
    const result = await loadDashboardSnapshot(admin);
    expect(result.stats).toBeNull();
    expect(result.statsError).toBe(true);
    expect(result.recentReviews).toEqual([]);
  });

  it('conserva las estadísticas cuando falla el listado de opiniones', async () => {
    api.listAdminReviews.mockRejectedValue(new Error('No disponible'));
    const result = await loadDashboardSnapshot(admin);
    expect(result.stats?.totals.businesses).toBe(3);
    expect(result.reviewError).toBe(true);
    expect(result.statsError).toBe(false);
  });
});
