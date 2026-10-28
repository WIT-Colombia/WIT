import type { Page, Route } from 'playwright/test';

/** In-memory API fixtures for protected-screen visual checks. Nothing is persisted. */
const businessId = 'fixture-business-001';
const fixtureUser = { id: 'fixture-user-001', publicId: 'fixture-owner', displayName: 'Laura Martínez', nickname: '@laura.martinez', emailNormalized: 'laura.fixture@xamuko.test', avatarUrl: null, locale: 'es-CO', status: 'ACTIVE', emailVerified: true, authProviders: ['PASSWORD'] };
const fixtureBusiness = {
  id: businessId, publicId: 'panaderia-fixture', businessAccountId: fixtureUser.id, name: 'Panadería Patico (prueba)', pioneerNumber: 42,
  sede: 'Sede principal', adultOnly: false, slug: 'panaderia-patico-prueba', description: 'Pan fresco y café para la comunidad.', category: 'Panadería', categoryId: 'bakery', secondaryCategories: [],
  email: 'contacto@fixture.xamuko.test', website: null, instagram: null, facebookUrl: null, xUrl: null, tiktokUrl: null, phone: '+576001234567', whatsapp: '+576001234567', phonePublic: true, whatsappPublic: true, emailPublic: true,
  coverPhotoId: null, profilePhotoId: null, coverImagePosition: { x: 50, y: 50 }, profileImagePosition: { x: 50, y: 50 }, completeness: 100,
  lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', verificationStatus: 'APPROVED', deletionStatus: 'NONE', publicationReadiness: { ready: true, blockers: [] }, role: 'OWNER', permissions: ['EDIT_BUSINESS', 'MANAGE_CATALOG', 'MANAGE_PROMOTIONS', 'READ_ANALYTICS'],
  location: { countryCode: 'CO', regionCode: '76', regionName: 'Valle del Cauca', cityName: 'Cali', zoneName: 'San Fernando', address: 'Calle 10 # 20-30', additionalAddressInfo: null, postalCode: null, latitude: '3.43722', longitude: '-76.5225', visibility: 'PUBLIC' }, modalities: [], photos: [], coverPhoto: null, profilePhoto: null,
};
const offers = [
  { id: 'fixture-product-001', businessId, internalCode: 'PAN-001', kind: 'PRODUCT', name: 'Pan de bono artesanal', description: 'Recién horneado.', category: 'Panadería', priceAmount: '4500', currency: 'COP', priceText: '$4.500', negotiable: false, active: true, adultOnly: false, publicationStatus: 'PUBLISHED', photos: [] },
  { id: 'fixture-service-001', businessId, internalCode: 'SER-001', kind: 'SERVICE', name: 'Pedidos para recoger', description: 'Reserva y recoge en tienda.', category: 'Pedidos', priceAmount: null, currency: 'COP', priceText: 'A convenir', negotiable: true, active: true, adultOnly: false, publicationStatus: 'PUBLISHED', photos: [] },
];
const stats = { period: 'month', timezone: 'America/Bogota', window: { start: '2026-10-01T00:00:00.000Z', end: '2026-10-28T23:59:59.999Z' }, access: { referralCount: 260, referralGoal: 250, nextLevel: 'DIAMOND', nextLevelMinimum: 500, unlockedReferralStatistics: 12, referralsUnlocked: true, proUnlocked: true }, metrics: { businessViews: 124, searchAppearances: 312, whatsappClicks: 27, phoneClicks: 16, directionsClicks: 21, currentFavorites: 38 }, previous: null, trends: { businessViews: [], searchAppearances: [], whatsappClicks: [], phoneClicks: [], directionsClicks: [] }, referral: { offerLikes: 41, reviewsCount: 18, averageRating: 4.5, ratingCount: 18 }, pro: { contactRate: 0.22, interactionRate: 0.34, navigationRate: 0.17, hourlyActivity: [{ label: '12:00', value: 24 }], weekdayActivity: [{ label: 'Lun', value: 18 }], promotionViews: 33, mostViewedPromotions: [], ratingEvolution: [{ label: 'Oct', value: 4.5 }], favoriteAcquisitions: [{ label: 'Oct', value: 8 }], uniqueVisitors: 92, repeatVisitors: 21, visitOrigins: [{ label: 'Búsqueda', value: 55 }, { label: 'Mapa', value: 24 }], keywords: [{ label: 'pan', value: 32 }], averagePosition: 3.2, categoryPerformance: [{ label: 'Panadería', value: 87 }], featuredPerformance: { views: 44, interactions: 12, interactionRate: 0.27 } }, rankings: { offerLikes: [], leastLikedOffers: [], mostViewedPromotions: [] } };
const reviews = { reviews: [{ id: 'fixture-review-001', businessId, userId: 'fixture-reviewer', author: 'Camila Rojas', rating: 5, comment: 'Excelente atención.', createdAt: '2026-10-10T12:00:00.000Z', updatedAt: '2026-10-10T12:00:00.000Z', response: null }], pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 }, summary: { average: 5, total: 1, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 1 } } };
const admin = { user: { id: 'fixture-admin-001', publicId: 'fixture-admin', displayName: 'Admin de pruebas', emailNormalized: 'admin.fixture@xamuko.test', avatarUrl: null, locale: 'es-CO' }, role: 'SUPER_ADMIN', permissions: ['BUSINESSES_READ', 'CATALOG_READ', 'REPORTS_REVIEW', 'CONTENT_MODERATE', 'AUDIT_READ', 'ADMINS_MANAGE', 'PIONEER_MANAGE'] };

function json(route: Route, body: unknown, status = 200) { return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }); }

export async function installLocalApiMocks(page: Page): Promise<void> {
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (path === '/auth/refresh') return json(route, { user: fixtureUser, accessToken: 'fixture-access-token' });
    if (path === '/auth/me' && route.request().method() === 'GET') return json(route, { user: fixtureUser });
    if (path === '/admin/me') return json(route, { admin });
    if (path === '/businesses') return json(route, { businesses: [fixtureBusiness] });
    if (path === `/businesses/${businessId}`) return json(route, { business: fixtureBusiness });
    if (path.includes('/offers') && path.endsWith('/likes')) return json(route, { offers: offers.map(offer => ({ offerId: offer.id, likeCount: offer.kind === 'PRODUCT' ? 18 : 11 })) });
    if (path.includes('/offers')) return json(route, { offers });
    if (path.includes('/analytics/offer-views')) return json(route, { period: 'month', timezone: stats.timezone, window: stats.window, offers: [{ offerId: offers[0].id, name: offers[0].name, kind: 'PRODUCT', value: 44 }, { offerId: offers[1].id, name: offers[1].name, kind: 'SERVICE', value: 22 }], productOffers: [{ offerId: offers[0].id, name: offers[0].name, kind: 'PRODUCT', value: 44 }], serviceOffers: [{ offerId: offers[1].id, name: offers[1].name, kind: 'SERVICE', value: 22 }] });
    if (path.includes('/analytics')) return json(route, stats);
    if (path.includes('/reviews')) return json(route, reviews);
    if (path === '/notifications') return json(route, { notifications: [] });
    if (path.includes('/catalog-limits')) return json(route, { level: 'PLATINUM', plan: 'PRO', products: { used: 1, limit: null, available: null, unlimited: true }, services: { used: 1, limit: null, available: null, unlimited: true } });
    if (path.includes('/favorites/count')) return json(route, { count: 38 });
    if (path.includes('/modalities')) return json(route, { modalities: [] });
    if (path.includes('/business-categories')) return json(route, { categories: [] });
    if (path.startsWith('/admin/reviews')) return json(route, { reviews: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    if (path.startsWith('/admin/review-reports')) return json(route, { reports: [] });
    if (path.startsWith('/admin/verifications')) return json(route, { requests: [] });
    if (path.startsWith('/admin/pioneers')) return json(route, { max: 1000, available: 998, brands: [], assignments: [] });
    return json(route, {});
  });
}

export const fixtureBusinessId = businessId;
