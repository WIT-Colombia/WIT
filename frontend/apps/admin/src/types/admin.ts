export type Role = 'principal' | 'verification' | 'moderator' | 'support' | 'analyst';
export type Permission = 'dashboard:read' | 'verification:write' | 'content:moderate' | 'settings:write' | 'business:write';
export interface Admin { id: string; name: string; email: string; role: Role }
export interface Location { country: string; region: string; city: string; zone?: string }
export interface User { id: string; name: string; email: string; phone?: string; location: Location }
export interface Business { id: string; name: string; ownerId?: string; location: Location; status: string }
export interface BusinessClaim { id: string; businessId: string; claimantId: string; status: 'unclaimed' | 'pending' | 'verified' | 'review' }
export interface BusinessVerification { id: string; businessId: string; status: 'pending' | 'approved' | 'rejected'; requestedAt: string }
export interface VisibilityPeriod { businessId: string; startsAt: string; expiresAt: string; status: string }
export interface Product { id: string; name: string; businessId: string; price?: number; currency: string; negotiable: boolean }
export interface Service extends Product { }
export interface Rating { id: string; userId: string; businessId: string; value: number }
export interface Review { id: string; userId: string; businessId: string; text: string; ratingId?: string }
export interface Report { id: string; entityId: string; reporterId: string; createdAt: string; status: 'pending' | 'review' | 'resolved' | 'dismissed' }
export interface Need { id: string; term: string; location: Location; interestedUsers: number }
export interface Category { id: string; name: string; active: boolean }
export interface Zone { id: string; location: Location; status: 'unavailable' | 'preparing' | 'registration' | 'publication' | 'suspended' }
export interface Notification { id: string; title: string; read: boolean; href: string }
export interface AuditLog { id: string; adminId: string; action: string; entityId: string; previousState: string; newState: string; createdAt: string; reason: string; comment?: string; ip?: string }
export type Period = 7 | 30 | 90;
export interface Metric { label: string; value: number; change: number; icon: string; caption: string }
export interface Attention { title: string; description: string; count: number; priority: 'Alta' | 'Media' | 'Normal'; href: string; icon: string }
export interface Activity { id: string; title: string; context: string; date: string; icon: string; href: string }
export interface DashboardData { metrics: Metric[]; attention: Attention[]; activity: Activity[]; trend: number[]; breakdown: { label: string; value: number; color: string }[] }
