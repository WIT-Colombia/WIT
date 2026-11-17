import type { BusinessVisibility } from './businessApiClient';

/** A valid 40-day period is not proof the business is publicly visible. */
export function homeVisibilityState(visibility: BusinessVisibility | null, withinPeriod: boolean) {
  if (!visibility) return { label: 'Consultando', variant: 'unknown', note: null, blockedByAdmin: false, hiddenByOwner: false };
  if (visibility.administrativeRestriction === 'SUSPENDED') {
    return {
      label: 'Suspendida', variant: 'suspended',
      note: 'Suspensión administrativa: tu negocio no aparece públicamente. Solo XAMUKO Admin puede levantar esta medida.',
      blockedByAdmin: true, hiddenByOwner: false,
    };
  }
  if (visibility.administrativeRestriction === 'HIDDEN') {
    return {
      label: 'Restringida', variant: 'hidden',
      note: 'Ocultamiento administrativo anterior: solicita a XAMUKO Admin que retire la restricción.',
      blockedByAdmin: true, hiddenByOwner: false,
    };
  }
  if (visibility.visibilityStatus === 'HIDDEN') {
    return {
      label: 'Oculta', variant: 'hidden',
      note: 'Tu negocio está oculto y no aparece públicamente. Puedes volver a mostrarlo desde Business.',
      blockedByAdmin: false, hiddenByOwner: true,
    };
  }
  if (visibility.visibilityStatus === 'EXPIRED' || !withinPeriod) {
    return {
      label: 'Vencida', variant: 'expired',
      note: 'La vigencia ha terminado. Renueva para volver a mostrar tu negocio.',
      blockedByAdmin: false, hiddenByOwner: false,
    };
  }
  if (visibility.publicationStatus && visibility.publicationStatus !== 'PUBLISHED') {
    return {
      label: 'Sin publicar', variant: 'unknown',
      note: 'Tu negocio todavía no está publicado. Revisa los requisitos desde Mi negocio.',
      blockedByAdmin: false, hiddenByOwner: false,
    };
  }
  if (visibility.visibilityStatus === 'VISIBLE') {
    return { label: 'Visible', variant: 'active', note: null, blockedByAdmin: false, hiddenByOwner: false };
  }
  return {
    label: 'No visible', variant: 'unknown',
    note: 'Tu negocio todavía no tiene visibilidad pública. Revisa su estado desde Mi negocio.',
    blockedByAdmin: false, hiddenByOwner: false,
  };
}
