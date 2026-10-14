import type { RealBusiness } from './businessApiClient';
import type { BusinessDetails } from '../types/business';

export function toBusinessDetails(value: RealBusiness): BusinessDetails {
  const location = value.location;
  const status = value.deletionStatus === 'DELETED' ? 'Eliminado' : value.verificationStatus === 'APPROVED' ? 'Verificado' : value.verificationStatus === 'INFORMATION' ? 'Requiere confirmación' : 'Pendiente';
  return {
    id: value.id,
    publicId: value.publicId,
    businessAccountId: value.businessAccountId,
    source: 'real',
    role: value.role === 'OWNER' ? 'Propietario' : 'Colaborador',
    permissions: value.permissions,
    name: value.name,
    category: value.category ?? 'Sin categoría',
    secondaryCategories: value.secondaryCategories?.map(item => item.code) ?? [],
    description: value.description ?? '',
    city: location?.cityName ?? '',
    address: location?.address ?? '',
    additionalAddressInfo: location?.additionalAddressInfo ?? '',
    phone: value.phone ?? '',
    whatsapp: value.whatsapp ?? '',
    email: value.email ?? '',
    website: value.website ?? '',
    instagram: value.instagram ?? '',
    hours: '',
    status,
    catalog: [],
    collaborators: [],
  };
}

export function categoryCodeFromLabel(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
