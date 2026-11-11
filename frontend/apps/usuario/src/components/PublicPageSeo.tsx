import { PageMetadata } from '@wit/ui';
import { getAuthPageMetadata, metadataTags } from '@wit/utils';
import { businessMetadata, type PublicSeoBusiness } from '../../../../packages/utils/src/publicSeo';
import type { Business, Product, Service } from '../data/mockData';

export function PublicBusinessSeo({ business, excluded = false }: { business: Business | null; excluded?: boolean }) {
  const record: PublicSeoBusiness | null = business ? {
    publicId: business.id, name: business.name, description: business.description,
    category: { name: business.category === 'Sin categoría' ? '' : business.category },
    location: { cityName: business.city, regionName: business.regionName, address: business.address !== business.city && business.address !== 'Ubicación no pública' ? business.address : undefined, visibility: business.coordinatesVerified ? 'PUBLIC' : undefined, latitude: business.coordinates?.lat, longitude: business.coordinates?.lng },
    contacts: { phone: business.phone, website: business.website },
    coverPhoto: business.image ? { url: business.image } : undefined,
    modalities: [{ hours: (business.weeklyHours ?? []).flatMap(hour => {
      const dayOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].indexOf(hour.day);
      const match = hour.hours.match(/^(\d{2}:\d{2}) – (\d{2}:\d{2})$/);
      return dayOfWeek >= 0 && match ? [{ dayOfWeek, isClosed: hour.isClosed, opensAt: match[1], closesAt: match[2] }] : [];
    }) }],
  } : null;
  const metadata = record ? businessMetadata(record, excluded) : { ...getAuthPageMetadata('usuario', 'login'), title: 'Consulta de negocio | XAMUKO', structuredData: {} };
  return <PageMetadata {...metadata} tags={metadataTags(metadata)} />;
}

// Independent offer routes currently scan the catalog and may initially show
// demonstration records. Keep noindex until a direct public lookup/SSR exists.
export function PublicOfferSeo({ verified }: { verified: { offer: Product | Service; business: Business; kind: 'product' | 'service' } | null }) {
  let metadata = { ...getAuthPageMetadata('usuario', 'login'), title: 'Productos y servicios | XAMUKO', structuredData: {} };
  if (verified) {
    const { offer, business, kind } = verified;
    const canonical = `https://user.xamuko.com/${kind}/${encodeURIComponent(offer.id)}`;
    metadata = { ...metadata, title: `${offer.name} | ${business.name} | XAMUKO`, description: (offer.description || `Consulta ${offer.name} en ${business.name}${business.city ? `, ${business.city}` : ''}.`).slice(0, 160), canonical };
  }
  return <PageMetadata {...metadata} tags={metadataTags(metadata)} />;
}
