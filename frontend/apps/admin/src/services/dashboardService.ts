import { getAdminDashboardStats, listAdminReviews, listReviewReports, type AdminDashboardStats, type AdminReview, type AdminReviewReport } from './adminApiClient';
import { can } from './adminService';
import type { Admin } from '../types/admin';

export type DashboardSnapshot = {
  stats: AdminDashboardStats | null;
  statsError: boolean;
  recentReviews: AdminReview[];
  recentReports: AdminReviewReport[];
  reviewError: boolean;
};

// Data is always read from protected backend endpoints. No sample or inferred
// values are displayed as real company statistics.
export async function loadDashboardSnapshot(admin: Admin): Promise<DashboardSnapshot> {
  const moderate = can(admin, 'content:moderate');
  const [statsResult, reviewsResult, reportsResult] = await Promise.allSettled([
    getAdminDashboardStats(),
    moderate ? listAdminReviews(1, 20) : Promise.resolve(null),
    moderate ? listReviewReports() : Promise.resolve(null),
  ]);
  const reviews = reviewsResult.status === 'fulfilled' ? reviewsResult.value?.reviews ?? [] : [];
  return {
    stats: statsResult.status === 'fulfilled' ? statsResult.value : null,
    statsError: statsResult.status === 'rejected',
    recentReviews: reviews.filter(review => review.status === 'PUBLISHED').slice(0, 4),
    recentReports: reportsResult.status === 'fulfilled' ? reportsResult.value?.reports.slice(0, 4) ?? [] : [],
    reviewError: moderate && (reviewsResult.status === 'rejected' || reportsResult.status === 'rejected'),
  };
}
