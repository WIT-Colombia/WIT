import type { ManagedBusiness } from '../types/business';
import { businessStatusLabels, claimLabels, daysRemaining, visibilityLabels } from '../services/businessService';
export const plainDate = (value?: string) => value ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date(value)) : 'Sin definir';
export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const businessTone = (status: string) => ['verified', 'visible', 'approved'].includes(status) ? 'success' : ['rejected', 'deleted', 'noncompliant'].includes(status) ? 'alta' : ['pending', 'review', 'expired', 'recovery', 'information'].includes(status) ? 'media' : 'normal';
export const businessInitials = (name: string) => name.split(' ').slice(0, 2).map(word => word[0]).join('');
export function filterBusinesses(items: ManagedBusiness[], params: URLSearchParams) {
  const query = normalize(params.get('q') || '');
  const selected = items.filter(item => {
    const days = daysRemaining(item.visibility.expiresAt);
    const visibility = params.get('visibility');
    return normalize(`${item.name} ${item.owner?.name || ''} ${item.claimant?.name || ''} ${item.phone}`).includes(query)
      && (!params.get('status') || item.status === params.get('status'))
      && (!params.get('claim') || item.claimStatus === params.get('claim'))
      && (!params.get('category') || item.category === params.get('category'))
      && (!params.get('country') || item.location.country === params.get('country'))
      && (!params.get('city') || item.location.city === params.get('city'))
      && (!visibility || (visibility === 'expiring' ? item.visibility.status === 'visible' && days !== null && days > 0 && days <= 7 : item.visibility.status === visibility));
  });
  const sort = params.get('sort') || 'updated';
  return selected.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'es') : sort === 'created' ? b.createdAt.localeCompare(a.createdAt) : sort === 'expiry' ? (a.visibility.expiresAt || '9999').localeCompare(b.visibility.expiresAt || '9999') : b.updatedAt.localeCompare(a.updatedAt));
}
export function readableAuditState(value: string) {
  try { const state = JSON.parse(value); return [businessStatusLabels[state.status as keyof typeof businessStatusLabels], visibilityLabels[state.visibility as keyof typeof visibilityLabels], state.verification ? `Verificación: ${({ none: 'Sin solicitud', pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', information: 'Información solicitada' } as Record<string, string>)[state.verification] || state.verification}` : undefined, state.claim ? claimLabels[state.claim as keyof typeof claimLabels] : undefined, state.expiry ? `Vence ${plainDate(state.expiry)}` : undefined].filter(Boolean).join(' · '); } catch { return businessStatusLabels[value as keyof typeof businessStatusLabels] || value; }
}
export const actionLabels = { approve: 'Aprobar verificación', reject: 'Rechazar verificación', 'request-info': 'Solicitar información', escalate: 'Escalar a revisión', 'resolve-review': 'Resolver discrepancia', hide: 'Ocultar publicación', publish: 'Reactivar publicación', extend: 'Extender vigencia', restore: 'Restaurar negocio', 'delete-business': 'Eliminar negocio', 'delete-permanently': 'Eliminar definitivamente', comment: 'Añadir comentario interno' };
