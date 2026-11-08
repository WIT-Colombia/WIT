import { listAdminReviews, listReviewReports, listVerificationRequests, type AdminReview, type AdminReviewReport } from './adminApiClient';
import { can } from './adminService';
import type { Admin } from '../types/admin';

export type DashboardSnapshot = {
  pendingVerifications: number | null;
  pendingReports: number | null;
  recentReviews: AdminReview[];
  recentReports: AdminReviewReport[];
  verificationError: boolean;
  reviewError: boolean;
};

// The current Admin API has no platform-wide business/user totals, revenue,
// growth history, or general activity feed. Keep those values unavailable.
export async function loadDashboardSnapshot(admin: Admin): Promise<DashboardSnapshot> {
  const canReviewContent = can(admin, 'content:moderate');
  const canReviewVerifications = can(admin, 'verification:write');
  const [reviewsResult, reportsResult, verificationsResult] = await Promise.allSettled([
    canReviewContent ? listAdminReviews(1, 100) : Promise.resolve(null),
    canReviewContent ? listReviewReports() : Promise.resolve(null),
    canReviewVerifications ? listVerificationRequests() : Promise.resolve(null),
  ]);
  const reviewsOk = reviewsResult.status === 'fulfilled' && reviewsResult.value !== null;
  const reportsOk = reportsResult.status === 'fulfilled' && reportsResult.value !== null;
  const verificationsOk = verificationsResult.status === 'fulfilled' && verificationsResult.value !== null;
  const reviews = reviewsResult.status === 'fulfilled' && reviewsResult.value ? reviewsResult.value.reviews : [];
  const reports = reportsResult.status === 'fulfilled' && reportsResult.value ? reportsResult.value.reports : [];
  const verifications = verificationsResult.status === 'fulfilled' && verificationsResult.value ? verificationsResult.value.requests : [];

  return {
    pendingVerifications: verificationsOk ? verifications.filter(item => ['PENDING', 'INFORMATION'].includes(item.status)).length : null,
    pendingReports: reportsOk ? reports.filter(item => item.status === 'PENDING').length : null,
    recentReviews: reviews.filter(review => review.status === 'PUBLISHED').slice(0, 4),
    recentReports: reports.slice(0, 4),
    verificationError: canReviewVerifications && !verificationsOk,
    reviewError: canReviewContent && (!reviewsOk || !reportsOk),
  };
}
