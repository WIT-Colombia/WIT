import { createBusinessMocks } from '../data/businesses.mock';
import { can } from './adminService';
import type { Admin } from '../types/admin';
import type { BusinessAction, BusinessMutation, ManagedBusiness } from '../types/business';

export const businessStatusLabels = { draft: 'Borrador', pending: 'Verificación pendiente', verified: 'Verificado', rejected: 'Rechazado', hidden: 'Oculto por el propietario', expired: 'Visibilidad vencida', recovery: 'Eliminado en recuperación', deleted: 'Eliminado definitivamente' };
export const visibilityLabels = { visible: 'Visible', hidden: 'Oculto por el propietario', expired: 'Visibilidad vencida', review: 'Pendiente de revisión', noncompliant: 'No publicado por incumplimiento', recovery: 'Eliminado en recuperación', unpublished: 'No publicado' };
export const claimLabels = { unclaimed: 'No reclamado', pending: 'Reclamación pendiente', verified: 'Verificado', review: 'Requiere revisión' };
const storageKey = 'wit-admin-businesses-v4';
let cache: ManagedBusiness[] | undefined;
function readStore(): ManagedBusiness[] {
  if (cache) return cache;
  const stored = sessionStorage.getItem(storageKey);
  if (stored) {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed) || parsed.some(item => !item.id || !item.visibility || !item.audit || !item.createdBy || !Array.isArray(item.photos) || item.photos.some((photo: { source?: string }) => photo.source !== 'negocios'))) {
      cache = createBusinessMocks();
      sessionStorage.removeItem(storageKey);
      return cache;
    }
    cache = parsed as ManagedBusiness[];
  } else cache = createBusinessMocks();
  return cache;
}
export const daysRemaining = (date?: string) => date ? Math.ceil((new Date(date).getTime() - Date.now()) / 86400000) : null;
export function availableActions(business: ManagedBusiness, admin: Admin): BusinessAction[] {
  if (business.status === 'deleted') return [];
  const actions: BusinessAction[] = admin.role === 'analyst' ? [] : ['comment'];
  if (can(admin, 'business:write') && !['deleted', 'recovery'].includes(business.status)) actions.push('delete-business');
  if (can(admin, 'verification:write') && ['pending', 'information'].includes(business.verification.status) && !['recovery', 'deleted'].includes(business.status)) {
    actions.push('request-info');
    if (business.claimStatus !== 'review' && !business.claimant?.discrepancy) actions.push('approve', 'reject', 'escalate');
    else actions.push('reject', 'resolve-review');
  }
  if (can(admin, 'business:write') && !['recovery', 'draft', 'pending', 'rejected'].includes(business.status) && business.verification.status === 'approved') {
    actions.push('extend');
    if (business.visibility.status === 'visible') actions.push('hide');
    else if (['noncompliant', 'expired'].includes(business.visibility.status) && (daysRemaining(business.visibility.expiresAt) ?? 0) > 0) actions.push('publish');
  }
  if (can(admin, 'business:write') && business.status === 'recovery') {
    if ((daysRemaining(business.deletion?.recoverUntil) ?? 0) > 0) actions.push('restore');
    else actions.push('delete-permanently');
  }
  return actions;
}
export function applyBusinessMutation(business: ManagedBusiness, mutation: BusinessMutation, admin: Admin, now = new Date()): ManagedBusiness {
  if (!availableActions(business, admin).includes(mutation.action)) throw new Error('Esta acción ya no está disponible para este negocio o tu rol.');
  if (!['delete-business', 'restore'].includes(mutation.action) && !mutation.reason.trim()) throw new Error('Escribe un motivo para registrar esta acción.');
  const next = structuredClone(business);
  const previousState = JSON.stringify({ status: business.status, verification: business.verification.status, claim: business.claimStatus, owner: business.owner?.id, visibility: business.visibility.status, expiry: business.visibility.expiresAt });
  switch (mutation.action) {
    case 'delete-business':
      next.deletion = { deletedAt: now.toISOString(), recoverUntil: new Date(now.getTime() + 30 * 86400000).toISOString(), responsible: admin.name, reason: 'Eliminación solicitada por el administrador.', previousStatus: business.status, previousVisibility: business.visibility.status };
      next.status = 'recovery'; next.visibility.status = 'recovery';
      break;
    case 'approve':
      if (!next.claimant && !next.owner) throw new Error('Revisa quién solicita la verificación antes de aprobar.');
      next.verification.status = 'approved'; next.claimStatus = 'verified'; next.status = 'verified';
      if (next.claimant) { next.owner = { id: next.claimant.id, name: next.claimant.name, email: next.claimant.email }; next.ownerId = next.claimant.id; }
      // Verification does not grant a new visibility period.
      next.visibility.status = (daysRemaining(next.visibility.expiresAt) ?? 0) > 0 ? 'visible' : 'unpublished';
      break;
    case 'reject': next.verification.status = 'rejected'; next.status = 'rejected'; next.claimStatus = 'review'; next.visibility.status = 'review'; break;
    case 'resolve-review': next.claimStatus = 'pending'; if (next.claimant) next.claimant.discrepancy = false; break;
    case 'request-info': next.verification.status = 'information'; break;
    case 'escalate': next.claimStatus = 'review'; next.visibility.status = 'review'; break;
    case 'hide': next.visibility.status = 'noncompliant'; break;
    case 'publish': next.visibility.status = 'visible'; next.status = 'verified'; break;
    case 'extend': {
      const expiry = new Date(`${mutation.expiresAt}T23:59:59.999Z`);
      if (Number.isNaN(expiry.getTime()) || expiry <= now || (next.visibility.expiresAt && expiry <= new Date(next.visibility.expiresAt))) throw new Error('La nueva fecha debe ser posterior a hoy y al vencimiento actual.');
      next.visibility.history.unshift({ id: crypto.randomUUID(), date: now.toISOString(), previousExpiry: next.visibility.expiresAt, newExpiry: expiry.toISOString(), reason: mutation.reason.trim(), adminName: admin.name });
      next.visibility.expiresAt = expiry.toISOString(); next.visibility.startsAt ??= now.toISOString(); next.visibility.renewal = 'renewed';
      if (next.visibility.status === 'expired' || next.visibility.status === 'unpublished') { next.visibility.status = 'visible'; next.status = 'verified'; }
      break;
    }
    case 'restore':
      if (!next.deletion || new Date(next.deletion.recoverUntil) <= now) throw new Error('El periodo de recuperación terminó.');
      const restoredStatus = ['recovery', 'deleted'].includes(next.deletion.previousStatus) ? 'verified' : next.deletion.previousStatus; const restoredVisibility = ['recovery', 'unpublished'].includes(next.deletion.previousVisibility) ? 'visible' : next.deletion.previousVisibility;
      next.status = restoredStatus; next.visibility.status = restoredVisibility;
      if (next.visibility.status === 'visible' && (daysRemaining(next.visibility.expiresAt) ?? 0) <= 0) { next.visibility.status = 'expired'; next.status = 'expired'; }
      delete next.deletion; break;
    case 'delete-permanently':
      if (mutation.confirmation !== business.name) throw new Error('Escribe el nombre exacto del negocio para confirmar.');
      if (!next.deletion || new Date(next.deletion.recoverUntil) > now) throw new Error('La eliminación definitiva no está disponible durante el periodo de recuperación.');
      next.status = 'deleted'; next.visibility.status = 'unpublished'; break;
    case 'comment': break;
  }
  next.updatedAt = now.toISOString();
  next.audit.unshift({ id: crypto.randomUUID(), adminId: admin.id, adminName: admin.name, action: mutation.action, entityId: next.id, previousState, newState: JSON.stringify({ status: next.status, verification: next.verification.status, claim: next.claimStatus, owner: next.owner?.id, visibility: next.visibility.status, expiry: next.visibility.expiresAt }), createdAt: now.toISOString(), reason: mutation.reason.trim(), comment: mutation.comment.trim() || undefined });
  return next;
}
export async function listBusinesses(): Promise<ManagedBusiness[]> { await new Promise(resolve => setTimeout(resolve, 150)); return structuredClone(readStore()); }
export async function updateBusiness(id: string, mutation: BusinessMutation, admin: Admin): Promise<ManagedBusiness> {
  const all = readStore(); const index = all.findIndex(item => item.id === id);
  if (index < 0) throw new Error('No encontramos el negocio.');
  const updated = applyBusinessMutation(all[index], mutation, admin);
  const next = all.map(item => item.id === id ? updated : item);
  sessionStorage.setItem(storageKey, JSON.stringify(next)); cache = next;
  return structuredClone(updated);
}
