import type { AuditLog, Business } from './admin';

export type BusinessStatus = 'draft' | 'pending' | 'verified' | 'rejected' | 'hidden' | 'expired' | 'recovery' | 'deleted';
export type VisibilityStatus = 'visible' | 'hidden' | 'expired' | 'review' | 'noncompliant' | 'recovery' | 'unpublished';
export type ClaimStatus = 'unclaimed' | 'pending' | 'verified' | 'review';
export interface BusinessAudit extends AuditLog { adminName: string }
export interface BusinessAccount { id: string; name: string; email: string }
export interface BusinessContent { id: string; name: string; kind: 'product' | 'service'; price?: number; currency: string; negotiable: boolean; active: boolean; image?: string }
export interface BusinessOpinion { id: string; user: string; rating?: number; text?: string; createdAt: string; reported: boolean; deleted?: boolean }
export interface ManagedBusiness extends Business {
  status: BusinessStatus;
  category: string;
  /** The owner is the account that created the business in WIT Negocios. */
  owner?: BusinessAccount;
  createdBy: BusinessAccount;
  tags: string[];
  rating?: number;
  reviewCount: number;
  isOpen?: boolean;
  email: string;
  website: string;
  instagram: string;
  claimant?: BusinessAccount & { discrepancy: boolean };
  claimStatus: ClaimStatus;
  verification: { status: 'none' | 'pending' | 'approved' | 'rejected' | 'information'; requestedAt?: string };
  description: string;
  address: string;
  coordinates: { latitude: number; longitude: number };
  phone: string;
  whatsapp: string;
  hours: { days: string; time: string }[];
  /** Only media uploaded from WIT Negocios is allowed in this collection. */
  photos: { id: string; title: string; source: 'negocios'; url?: string; uploadedAt: string }[];
  visibility: { status: VisibilityStatus; startsAt?: string; expiresAt?: string; renewal: 'none' | 'pending' | 'renewed'; history: { id: string; date: string; previousExpiry?: string; newExpiry: string; reason: string; adminName: string }[] };
  deletion?: { deletedAt: string; recoverUntil: string; responsible: string; reason: string; previousStatus: BusinessStatus; previousVisibility: VisibilityStatus };
  createdAt: string;
  updatedAt: string;
  completeness: number;
  content: BusinessContent[];
  opinions: BusinessOpinion[];
  reports: { id: string; reason: string; distinctUsers: number; createdAt: string; status: string }[];
  audit: BusinessAudit[];
}
export type BusinessAction = 'approve' | 'reject' | 'request-info' | 'escalate' | 'resolve-review' | 'hide' | 'publish' | 'extend' | 'restore' | 'delete-business' | 'delete-permanently' | 'comment';
export interface BusinessMutation { action: BusinessAction; reason: string; comment: string; expiresAt?: string; confirmation?: string }
