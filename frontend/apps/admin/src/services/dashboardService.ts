import { getAdminDashboardStats, listAdminReviews, listReviewReports, listVerificationRequests, type AdminDashboardStats, type AdminReview, type AdminReviewReport } from './adminApiClient';
import { can } from './adminService';
import type { Admin } from '../types/admin';

export type DashboardSnapshot = {
  stats: AdminDashboardStats | null;
  statsError: boolean;
  pendingVerifications: number | null;
  pendingReports: number | null;
  recentReviews: AdminReview[];
  recentReports: AdminReviewReport[];
  verificationError: boolean;
  reviewError: boolean;
};

// Dashboard-only, read-only requests. Do not synthesize business/user/revenue data.
export async function loadDashboardSnapshot(admin: Admin): Promise<DashboardSnapshot> {
  const moderate = can(admin, 'content:moderate');
  const verify = can(admin, 'verification:write');
  const [statsResult, reviewsResult, reportsResult, verificationsResult] = await Promise.allSettled([
    getAdminDashboardStats(),
    moderate ? listAdminReviews(1, 20) : Promise.resolve(null),
    moderate ? listReviewReports() : Promise.resolve(null),
    verify ? listVerificationRequests() : Promise.resolve(null),
  ]);
  const reviews = reviewsResult.status === 'fulfilled' ? reviewsResult.value?.reviews ?? [] : [];
  const reports = reportsResult.status === 'fulfilled' ? reportsResult.value?.reports ?? [] : [];
  const verifications = verificationsResult.status === 'fulfilled' ? verificationsResult.value?.requests ?? [] : [];
  return {
    stats: statsResult.status === 'fulfilled' ? statsResult.value : null,
    statsError: statsResult.status === 'rejected',
    pendingVerifications: verify && verificationsResult.status === 'fulfilled'
      ? verifications.filter(item => ['PENDING', 'INFORMATION'].includes(item.status)).length : null,
    pendingReports: moderate && reportsResult.status === 'fulfilled'
      ? reports.filter(item => item.status === 'PENDING').length : null,
    recentReviews: reviews.filter(review => review.status === 'PUBLISHED').slice(0, 4),
    recentReports: reports.slice(0, 4),
    verificationError: verify && verificationsResult.status === 'rejected',
    reviewError: moderate && (reviewsResult.status === 'rejected' || reportsResult.status === 'rejected'),
  };
}
