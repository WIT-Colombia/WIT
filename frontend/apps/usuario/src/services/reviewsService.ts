import { requestWithSession } from './authService';

export type PublicReview = { id: string; businessId: string; businessName?: string; businessPhotoUrl?: string | null; userId: string; author: string; rating: number; comment: string; createdAt: string; updatedAt: string; response: { body: string; createdAt: string; updatedAt: string } | null };
export type ReviewSummary = { average: number | null; total: number; distribution: Record<string, number> };
export type ReviewsResponse = { reviews: PublicReview[]; pagination: { page: number; pageSize: number; total: number; totalPages: number }; summary?: ReviewSummary };

export function listPublicReviews(businessId: string, page = 1, pageSize = 20) { return requestWithSession<ReviewsResponse>(`/api/v1/public/businesses/${encodeURIComponent(businessId)}/reviews?page=${page}&pageSize=${pageSize}`); }
export function listMyReviews(page = 1, pageSize = 20) { return requestWithSession<ReviewsResponse>(`/api/v1/reviews/mine?page=${page}&pageSize=${pageSize}`); }
export function createReview(businessId: string, rating: number, comment: string) { return requestWithSession<{ review: PublicReview }>(`/api/v1/businesses/${encodeURIComponent(businessId)}/reviews`, { method: 'POST', body: JSON.stringify({ rating, comment }) }); }
export function updateReview(reviewId: string, rating: number, comment: string) { return requestWithSession<{ review: PublicReview }>(`/api/v1/reviews/${encodeURIComponent(reviewId)}`, { method: 'PATCH', body: JSON.stringify({ rating, comment }) }); }
export function deleteReview(reviewId: string) { return requestWithSession<{ deleted: boolean }>(`/api/v1/reviews/${encodeURIComponent(reviewId)}`, { method: 'DELETE' }); }
