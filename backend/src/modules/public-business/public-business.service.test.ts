import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../../shared/errors/app-error.js';
import { publicBusinessRouter } from './public-business.routes.js';
import { getPublicBusiness, getPublicPhotoContent, listPublicBusinesses, listPublicPhotos, parsePublicBusinessListInput, publicBusinessRules } from './public-business.service.js';

const publicBusiness = {
  id: 'business-id', publicId: 'public-business-id', name: 'Café público', sede: null, adultOnly: false, description: 'Descripción visible',
  email: 'commercial@example.test', phone: '+57 3000000000', whatsapp: '+57 3000000000', website: 'https://example.test', instagram: 'https://instagram.com/cafe', facebookUrl: null, xUrl: null, tiktokUrl: null,
  phonePublic: false, whatsappPublic: false, emailPublic: false,
  category: { id: 'category-id', code: 'cafeterias', translations: [{ name: 'Cafeterías', iconKey: 'coffee' }] }, secondaryCategories: [],
  location: { countryCode: 'CO', regionCode: 'VAC', regionName: 'Valle', cityName: 'Palmira', zoneName: null, address: 'Calle 1', additionalAddressInfo: null, postalCode: null, latitude: 3.539, longitude: -76.303, visibility: 'PUBLIC', timezone: 'America/Bogota' },
  coverPhoto: { id: 'cover-id', altText: 'Fachada', sortOrder: 0, isCover: true }, profilePhoto: null, photos: [{ id: 'gallery-id', altText: null, sortOrder: 0, isCover: true }],
  modalities: [{ type: 'PHYSICAL', hours: [{ dayOfWeek: 1, isClosed: false, opensAt: '08:00', closesAt: '18:00', timezone: 'America/Bogota' }] }],
  offers: [{ id: 'product-id', kind: 'PRODUCT', name: 'Café', description: null, priceAmount: '12000.00', currency: 'COP', priceText: null, negotiable: false, category: null, photos: [] }],
  createdById: 'private-owner-id', memberships: [{ userId: 'private-owner-id' }],
};

test('solo consulta establecimientos en estados públicos publicables', async () => {
  let query: any;
  const db = { business: { count: async ({ where }: any) => { query = where; return 1; }, findMany: async ({ where }: any) => { query = where; return [publicBusiness]; } } } as any;
  const result = await listPublicBusinesses({ page: 1, pageSize: 5 }, db);
  assert.deepEqual(query, { ...publicBusinessRules.PUBLIC_BUSINESS_WHERE, adultOnly: false });
  assert.deepEqual(result.pagination, { page: 1, pageSize: 5, total: 1, totalPages: 1 });
  assert.equal(result.businesses[0].publicId, publicBusiness.publicId);
  assert.equal('createdById' in result.businesses[0], false);
  assert.equal('memberships' in result.businesses[0], false);
});

test('el detalle publica contactos comerciales y protege ubicación privada y datos administrativos', async () => {
  const db = { business: { findFirst: async () => ({ ...publicBusiness, location: { ...publicBusiness.location, visibility: 'PRIVATE' } }) } } as any;
  const result = await getPublicBusiness(publicBusiness.publicId, db);
  assert.equal(result.contacts.email, publicBusiness.email);
  assert.equal(result.contacts.phone, publicBusiness.phone);
  assert.equal(result.contacts.whatsapp, publicBusiness.whatsapp);
  assert.equal(result.location?.address, null);
  assert.equal(result.location?.latitude, null);
  assert.equal(result.location?.longitude, null);
  assert.equal('createdById' in result, false);
  assert.equal('memberships' in result, false);
  assert.equal(result.products[0].name, 'Café');
  assert.deepEqual(result.services, []);
  assert.deepEqual(result.offers, []);
});

test('los indicadores antiguos no restringen los contactos comerciales públicos', async () => {
  const db = { business: { findFirst: async () => ({ ...publicBusiness, phonePublic: true, whatsappPublic: false, emailPublic: true }) } } as any;
  const result = await getPublicBusiness(publicBusiness.publicId, db);
  assert.equal(result.contacts.phone, publicBusiness.phone);
  assert.equal(result.contacts.whatsapp, publicBusiness.whatsapp);
  assert.equal(result.contacts.email, publicBusiness.email);
});

test('los negocios inexistentes, privados o eliminados responden como no encontrados', async () => {
  const db = { business: { findFirst: async () => null } } as any;
  await assert.rejects(() => getPublicBusiness('not-visible', db), (error: unknown) => error instanceof AppError && error.statusCode === 404 && error.code === 'PUBLIC_BUSINESS_NOT_FOUND');
});

test('valida la paginación pública y aplica límites seguros', () => {
  assert.deepEqual(parsePublicBusinessListInput({}), { page: 1, pageSize: 12 });
  assert.deepEqual(parsePublicBusinessListInput({ page: '3', pageSize: '50' }), { page: 3, pageSize: 50 });
  assert.throws(() => parsePublicBusinessListInput({ page: '0' }), AppError);
  assert.throws(() => parsePublicBusinessListInput({ pageSize: '51' }), AppError);
  assert.throws(() => parsePublicBusinessListInput({ page: '1.5' }), AppError);
});

test('las rutas públicas no requieren autenticación', () => {
  const routes = (publicBusinessRouter as any).stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  assert.deepEqual(routes, [
    'GET /businesses',
    'GET /search',
    'GET /businesses/:publicId/products',
    'GET /businesses/:publicId/services',
    'GET /businesses/:publicId/photos',
    'GET /businesses/:publicId/photos/:photoId/content',
    'GET /businesses/:publicId/offers',
    'GET /businesses/:publicId/promotions',
    'GET /businesses/:businessId/reviews',
    'GET /businesses/:publicId',
  ]);
  const handlers = (publicBusinessRouter as any).stack.flatMap((layer: any) => layer.route?.stack ?? []).map((layer: any) => layer.handle.name);
  assert.equal(handlers.includes('requireAuth'), false);
});

test('el contenido de fotos solo acepta galería, portada, perfil u oferta publicada del negocio público', async () => {
  let photoQuery: any;
  const db = {
    business: { findFirst: async () => ({ id: publicBusiness.id }) },
    photo: { findFirst: async ({ where }: any) => { photoQuery = where; return null; } },
  } as any;

  await assert.rejects(
    () => getPublicPhotoContent(publicBusiness.publicId, 'not-public', db),
    (error: unknown) => error instanceof AppError && error.code === 'PUBLIC_PHOTO_NOT_FOUND',
  );
  assert.deepEqual(photoQuery.OR, [
    { businessId: publicBusiness.id, isGallery: true },
    { coverForBusiness: { id: publicBusiness.id } },
    { profileForBusiness: { id: publicBusiness.id } },
    { offer: { businessId: publicBusiness.id, active: true, deletedAt: null, publicationStatus: 'PUBLISHED', adultOnly: false } },
  ]);
});

test('el listado de fotografías públicas incluye galería, portada y perfil del negocio', async () => {
  let photoQuery: any;
  const db = {
    business: { findFirst: async () => ({ id: publicBusiness.id }) },
    photo: { findMany: async ({ where }: any) => { photoQuery = where; return []; } },
  } as any;
  await listPublicPhotos(publicBusiness.publicId, db);
  assert.deepEqual(photoQuery.OR, [
    { businessId: publicBusiness.id, isGallery: true },
    { coverForBusiness: { id: publicBusiness.id } },
    { profileForBusiness: { id: publicBusiness.id } },
  ]);
});


test('los contactos vacíos no se sustituyen por datos personales del propietario', async () => {
  const db = { business: { findFirst: async () => ({
    ...publicBusiness,
    email: null, phone: '   ', whatsapp: '',
    createdBy: { email: 'owner-private@example.test', phone: '+57 3111111111' },
    businessAccount: { createdBy: { email: 'login-private@example.test' } },
  }) } } as any;
  const result = await getPublicBusiness(publicBusiness.publicId, db);
  assert.equal(result.contacts.email, null);
  assert.equal(result.contacts.phone, null);
  assert.equal(result.contacts.whatsapp, null);
  assert.equal('createdBy' in result, false);
  assert.equal('businessAccount' in result, false);
  assert.equal(JSON.stringify(result).includes('owner-private@example.test'), false);
  assert.equal(JSON.stringify(result).includes('login-private@example.test'), false);
});

test('visitantes no reciben negocios ni catálogo clasificado como ADULT_18', async () => {
  let businessQuery: any;
  const db = {
    business: {
      count: async ({ where }: any) => { businessQuery = where; return 0; },
      findMany: async () => [],
      findFirst: async () => null,
    },
    businessOffer: { findMany: async () => [] },
  } as any;
  await listPublicBusinesses({ page: 1, pageSize: 12 }, db);
  assert.equal(businessQuery.adultOnly, false);
  await assert.rejects(() => getPublicBusiness('adult-business', db), (error: unknown) => error instanceof AppError && error.code === 'PUBLIC_BUSINESS_NOT_FOUND');
});

test('un negocio general conserva productos generales y oculta productos ADULT_18 para visitantes', async () => {
  const db = {
    business: { findFirst: async () => ({ ...publicBusiness, offers: [
      { ...publicBusiness.offers[0], adultOnly: false },
      { ...publicBusiness.offers[0], id: 'adult-product-id', name: 'Contenido restringido', adultOnly: true },
    ] }) },
  } as any;
  const result = await getPublicBusiness(publicBusiness.publicId, db);
  assert.deepEqual(result.products.map((item: { id: string }) => item.id), ['product-id']);
});

test('la preferencia persistida permite ver contenido ADULT_18 sin convertirla en verificación de edad', async () => {
  const db = {
    user: { findUnique: async () => ({ status: 'ACTIVE', adultContentEnabled: true, adultContentAcceptedAt: new Date(), adultContentRevokedAt: null }) },
    business: { findFirst: async () => ({ ...publicBusiness, adultOnly: false, offers: [
      { ...publicBusiness.offers[0], adultOnly: false },
      { ...publicBusiness.offers[0], id: 'adult-product-id', name: 'Contenido restringido', adultOnly: true },
    ] }) },
  } as any;
  const result = await getPublicBusiness(publicBusiness.publicId, db, { userId: 'verified-user' });
  assert.deepEqual(result.products.map((item: { id: string }) => item.id), ['product-id', 'adult-product-id']);
});
