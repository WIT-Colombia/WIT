import type { RealBusiness } from './businessApiClient';
import type { BusinessDetails } from '../types/business';

export function toBusinessDetails(value: RealBusiness): BusinessDetails {
  const location = value.location;
  const status = value.deletionStatus === 'DELETED' || value.deletionStatus === 'RECOVERY' ? 'Eliminado' : value.verificationStatus === 'APPROVED' ? 'Verificado' : value.verificationStatus === 'INFORMATION' ? 'Requiere confirmación' : 'Pendiente';
  return {
    id: value.id,
    publicId: value.publicId,
    businessAccountId: value.businessAccountId,
    source: 'real',
    role: value.role === 'OWNER' ? 'Propietario' : 'Colaborador',
    permissions: value.permissions,
    name: value.name,
    sede: value.sede ?? '',
    category: value.category ?? 'Sin categoría',
    secondaryCategories: value.secondaryCategories?.map(item => item.code) ?? [],
    description: value.description ?? '',
    city: location?.cityName ?? '',
    address: location?.address ?? '',
    additionalAddressInfo: location?.additionalAddressInfo ?? '',
    latitude: location?.latitude ? Number(location.latitude) : undefined,
    longitude: location?.longitude ? Number(location.longitude) : undefined,
    locationVisibility: location?.visibility ?? undefined,
    phone: value.phone ?? '',
    whatsapp: value.whatsapp ?? '',
    email: value.email ?? '',
    website: value.website ?? '',
    instagram: value.instagram ?? '',
    hours: '',
    deletionStatus: value.deletionStatus === 'RECOVERY' || value.deletionStatus === 'DELETED' ? value.deletionStatus : 'NONE',
    verificationStatus: value.verificationStatus,
    status,
    catalog: [],
    collaborators: [],
    images: value.photos?.map(photo => photo.url) ?? [],
    coverImage: value.photos?.find(photo => photo.isCover)?.url ?? value.photos?.[0]?.url ?? "",
    photos: value.photos ?? [],
  };
}

export function categoryCodeFromLabel(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Formats a category only for visible text; API codes and stored values remain unchanged. */
export function formatCategoryName(value: string) {
  return value ? `${value.charAt(0).toLocaleUpperCase('es-CO')}${value.slice(1)}` : value;
}

export function visibleBusinessStatus(value: { deletionStatus?: string; verificationStatus?: string; status?: string }) {
  if (value.deletionStatus === 'RECOVERY') return 'Eliminado' as const;
  if (value.deletionStatus === 'DELETED') return 'Eliminado' as const;
  if (value.deletionStatus === 'NONE' && value.verificationStatus === 'APPROVED') return 'Verificado' as const;
  // Compatibilidad con registros locales creados antes de persistir los campos crudos.
  if (value.deletionStatus == null && value.status === 'Eliminado') return 'Eliminado' as const;
  if (value.deletionStatus == null && value.verificationStatus == null && value.status === 'Verificado') return 'Verificado' as const;
  return null;
}
