import type { CatalogItem, CatalogKind } from '../types/business';
import type { RealOffer } from './businessApiClient';

export function toCatalogItem(value: RealOffer): CatalogItem {
  return { id: value.id, kind: value.kind === 'PRODUCT' ? 'product' : 'service', name: value.name, category: '', description: value.description ?? '', price: value.priceText ?? value.priceAmount ?? '', image: value.photos?.[0]?.url ?? (value.kind === 'PRODUCT' ? '📦' : '✨'), active: value.active, interest: 0, adultOnly: value.adultOnly };
}

export function toOfferInput(item: CatalogItem, kind: CatalogKind) {
  return { kind: kind === 'product' ? 'PRODUCT' as const : 'SERVICE' as const, name: item.name, description: item.description || null, priceText: item.price || null, negotiable: Boolean(item.priceNegotiable), active: item.active, adultOnly: Boolean(item.adultOnly), publicationStatus: 'UNPUBLISHED' as const };
}
