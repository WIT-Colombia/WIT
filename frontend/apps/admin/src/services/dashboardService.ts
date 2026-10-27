import { listAdminReviews, listReviewReports, type AdminReview, type AdminReviewReport } from './adminApiClient';
import { can } from './adminService';
import type { Admin } from '../types/admin';

export type DashboardSnapshot = {
  publishedReviews: number | null;
  recentReviews: AdminReview[];
  recentReports: AdminReviewReport[];
  reviewError: boolean;
};

// The current Admin API exposes reviews and reports, but no platform-wide
// analytics, membership, subscription, or finance totals.
export async function loadDashboardSnapshot(admin: Admin): Promise<DashboardSnapshot> {
  if (!can(admin, 'content:moderate')) return { publishedReviews: null, recentReviews: [], recentReports: [], reviewError: false };
  const [reviewsResult, reportsResult] = await Promise.allSettled([listAdminReviews(1, 100), listReviewReports()]);
  const reviews = reviewsResult.status === 'fulfilled' ? reviewsResult.value.reviews : [];
  // A page total includes moderated and removed records. Only show a complete
  // published count when every review fits in the returned page.
  const total = reviewsResult.status === 'fulfilled' && reviewsResult.value.pagination.total <= reviews.length
    ? reviews.filter(review => review.status === 'PUBLISHED').length
    : null;
  return {
    publishedReviews: total,
    recentReviews: reviews.filter(review => review.status === 'PUBLISHED').slice(0, 4),
    recentReports: reportsResult.status === 'fulfilled' ? reportsResult.value.reports.slice(0, 4) : [],
    reviewError: reviewsResult.status === 'rejected' || reportsResult.status === 'rejected',
  };
}
