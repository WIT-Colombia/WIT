import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../../shared/errors/app-error.js';
import { publicBusinessRouter } from './public-business.routes.js';
import { getPublicBusiness, getPublicPhotoContent, listPublicBusinesses, listPublicPhotos, parsePublicBusinessListInput, parseUniversalSearchInput, publicBusinessRules, searchPublicUniversal } from './public-business.service.js';

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
  assert.deepEqual(
    { ...query, OR: undefined },
    { ...publicBusinessRules.PUBLIC_BUSINESS_WHERE, adultOnly: false, OR: undefined }
  );
  assert.deepEqual(query.OR[0], { visibilityPeriods: { none: {} } });
  assert.ok(query.OR[1].visibilityPeriods.some.startsAt.lte instanceof Date);
  assert.ok(query.OR[1].visibilityPeriods.some.expiresAt.gt instanceof Date);
  assert.deepEqual(result.pagination, { page: 1, pageSize: 5, total: 1, totalPages: 1 });
  assert.equal(result.businesses[0].publicId, publicBusiness.publicId);
  assert.equal('createdById' in result.businesses[0], false);
  assert.equal('memberships' in result.businesses[0], false);
});

test('el listado y la búsqueda pública incluyen las modalidades comerciales activas', async () => {
  const virtual = { ...publicBusiness, publicId: 'virtual-business', name: 'Pastelería virtual', modalities: [{ type: 'VIRTUAL' }] };
  const delivery = { ...publicBusiness, publicId: 'delivery-business', name: 'Reparto a domicilio', modalities: [{ type: 'DELIVERY' }] };
  let listSelect: any;
  const listDb = {
    business: {
      count: async () => 2,
      findMany: async ({ select }: any) => { listSelect = select; return [virtual, delivery]; },
    },
  } as any;
  const listed = await listPublicBusinesses({ page: 1, pageSize: 5 }, listDb);
  assert.deepEqual(listSelect.modalities.where, { status: 'ACTIVE' });
  assert.deepEqual(listed.businesses.map(item => item.modalities), [
    [{ type: 'VIRTUAL' }], [{ type: 'DELIVERY' }],
  ]);

  let searchSelect: any;
  const searchDb = {
    business: { findMany: async ({ select }: any) => { searchSelect = select; return [virtual, delivery]; } },
    businessOffer: { findMany: async () => [] },
  } as any;
  const searched = await searchPublicUniversal(parseUniversalSearchInput({}), searchDb);
  assert.deepEqual(searchSelect.modalities.where, { status: 'ACTIVE' });
  // Search ranks/sorts businesses independently of insertion order.
  assert.deepEqual(searched.businesses.map(item => item.modalities[0]?.type).sort(), ['DELIVERY', 'VIRTUAL']);
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

test('la búsqueda universal respeta q, radio geográfico y paginación tras filtrar', async () => {
  const near = { ...publicBusiness, publicId: 'near', name: 'Café cercano', brand: { pioneer: null }, subscriptions: [] };
  const far = {
    ...near, publicId: 'far', name: 'Café lejano',
    location: { ...publicBusiness.location, latitude: 3.92, longitude: -76.303 },
  };
  const privateLocation = {
    ...near, publicId: 'private', name: 'Café reservado',
    location: { ...publicBusiness.location, visibility: 'PRIVATE' },
  };
  const makeOffer = (business: typeof near, kind: 'PRODUCT' | 'SERVICE') => ({
    ...publicBusiness.offers[0],
    id: `${business.publicId}-${kind.toLowerCase()}`,
    name: kind === 'PRODUCT' ? 'Café de origen' : 'Servicio de café',
    kind, category: publicBusiness.category, promotions: [], photos: [],
    business: {
      publicId: business.publicId, name: business.name,
      description: business.description, category: business.category, location: business.location,
    },
  });
  const db = {
    business: { findMany: async () => [near, far, privateLocation] },
    businessOffer: {
      findMany: async ({ where }: any) => [near, far, privateLocation].map(business => makeOffer(business, where.kind)),
    },
  } as any;

  const withRadius = await searchPublicUniversal(parseUniversalSearchInput({
    q: '  CAFÉ  ', latitude: '3.539', longitude: '-76.303', radiusKm: '5',
    businessPageSize: '1', productPageSize: '1', servicePageSize: '1',
  }), db);
  assert.deepEqual(withRadius.businesses.map(item => item.publicId), ['near']);
  assert.deepEqual(withRadius.products.map(item => item.business.publicId), ['near']);
  assert.deepEqual(withRadius.services.map(item => item.business.publicId), ['near']);
  assert.equal(withRadius.pagination.businesses.total, 1);
  assert.equal(withRadius.pagination.products.total, 1);
  assert.equal(withRadius.pagination.services.total, 1);
  assert.equal(withRadius.pagination.businesses.totalPages, 1);

  const noRadius = await searchPublicUniversal(parseUniversalSearchInput({
    q: 'café', latitude: '3.539', longitude: '-76.303', businessPage: '2',
    businessPageSize: '1', productPageSize: '1', servicePageSize: '1',
  }), db);
  assert.equal(noRadius.pagination.businesses.total, 3);
  assert.equal(noRadius.pagination.businesses.totalPages, 3);
  assert.equal(noRadius.businesses.length, 1);
  assert.equal(noRadius.pagination.businesses.page, 2);
});

test('scope virtual exige modalidad VIRTUAL ACTIVE para negocios, productos y servicios', async () => {
  const virtualBusiness = {
    ...publicBusiness, publicId: 'virtual-001', name: 'Panadería Online',
    subscriptions: [], brand: { pioneer: null },
  };
  const physicalBusiness = { ...virtualBusiness, publicId: 'local-001', name: 'Panadería Local' };
  const queriedBusinessWhere: any[] = [];
  const queriedOfferWhere: any[] = [];
  const makeOffer = (business: typeof virtualBusiness, kind: 'PRODUCT' | 'SERVICE') => ({
    ...publicBusiness.offers[0],
    id: `${business.publicId}-${kind}`, kind, name: kind === 'PRODUCT' ? 'Pan' : 'Reparto',
    description: null, category: publicBusiness.category, photos: [], promotions: [],
    business: {
      publicId: business.publicId, name: business.name, description: business.description,
      category: business.category, location: business.location,
    },
  });
  const db = {
    business: { findMany: async ({ where }: any) => {
      queriedBusinessWhere.push(where);
      return where.modalities?.some?.status === 'ACTIVE' && where.modalities.some.type === 'VIRTUAL'
        ? [virtualBusiness] : [virtualBusiness, physicalBusiness];
    } },
    businessOffer: { findMany: async ({ where }: any) => {
      queriedOfferWhere.push(where);
      const source = where.business.modalities?.some?.type === 'VIRTUAL' ? [virtualBusiness] : [virtualBusiness, physicalBusiness];
      return source.map(business => makeOffer(business, where.kind));
    } },
  } as any;
  const query = parseUniversalSearchInput({ scope: 'virtual' });
  const result = await searchPublicUniversal(query, db);
  assert.equal(queriedBusinessWhere[0].modalities.some.type, 'VIRTUAL');
  assert.equal(queriedBusinessWhere[0].modalities.some.status, 'ACTIVE');
  assert.equal(queriedOfferWhere.length, 2);
  for (const offerWhere of queriedOfferWhere) {
    assert.equal(offerWhere.business.modalities.some.type, 'VIRTUAL');
    assert.equal(offerWhere.business.modalities.some.status, 'ACTIVE');
  }
  assert.deepEqual(result.businesses.map(x => x.publicId), ['virtual-001']);
  assert.deepEqual(result.products.map(x => x.business.publicId), ['virtual-001']);
  assert.deepEqual(result.services.map(x => x.business.publicId), ['virtual-001']);
  assert.equal(result.pagination.businesses.total, 1);
  assert.equal(result.pagination.products.total, 1);
  assert.equal(result.pagination.services.total, 1);
});


test('Virtual: todos los destacados preceden a pioneros y negocios cercanos sin importar distancia ni página', async () => {
  const pro = {
    plan: 'PRO', status: 'ACTIVE',
    startsAt: new Date('2020-01-01T00:00:00.000Z'),
    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    revokedAt: null, specialActivation: false,
  };
  const business = (id: string, name: string, latitude: number, featured = false, pioneer = false) => ({
    ...publicBusiness, publicId: id, name,
    location: { ...publicBusiness.location, latitude, longitude: -76.303 },
    subscriptions: featured ? [pro] : [],
    brand: { pioneer: pioneer ? { number: 1 } : null },
  });
  const source = [
    business('pioneer-nearby', 'Pionero cercano', 3.539, false, true),
    business('free-nearby', 'Gratis cercano', 3.539),
    business('pro-four', 'Destacado cuatro', 12, true),
    business('pro-two', 'Destacado dos', 11, true),
    business('pro-three', 'Destacado tres', 10, true),
    business('pro-one', 'Destacado uno', 9, true),
  ];
  const db = {
    business: { findMany: async ({ where }: any) => {
      assert.deepEqual(where.modalities, { some: { type: 'VIRTUAL', status: 'ACTIVE' } });
      return source;
    } },
    businessOffer: { findMany: async () => [] },
  } as any;

  const first = await searchPublicUniversal(parseUniversalSearchInput({
    scope: 'virtual', latitude: '3.539', longitude: '-76.303',
    radiusKm: '1', businessPageSize: '3',
  }), db);
  const second = await searchPublicUniversal(parseUniversalSearchInput({
    scope: 'virtual', latitude: '3.539', longitude: '-76.303',
    radiusKm: '1', businessPageSize: '3', businessPage: '2',
  }), db);
  assert.equal(first.pagination.businesses.total, 6);
  assert.equal(first.pagination.businesses.totalPages, 2);
  assert.deepEqual(
    [...first.businesses, ...second.businesses].map(item => item.publicId),
    ['pro-four', 'pro-two', 'pro-three', 'pro-one', 'free-nearby', 'pioneer-nearby'],
  );
  assert.equal(first.businesses.every(item => item.isFeatured), true);
  assert.equal(second.businesses[0].isFeatured, true);
  assert.equal(second.businesses[1].isFeatured, false);
});

test('Virtual: productos y servicios se ordenan por precio efectivo antes de paginar; sin precio van al final', async () => {
  const owner = {
    ...publicBusiness, publicId: 'online-store', name: 'Tienda virtual',
    subscriptions: [], brand: { pioneer: null },
  };
  const offer = (kind: 'PRODUCT' | 'SERVICE', id: string, name: string, amount: string | null, sale?: string) => ({
    ...publicBusiness.offers[0],
    id, kind, name, description: null,
    priceAmount: amount, currency: 'COP', priceText: amount === null ? 'A convenir' : null,
    category: publicBusiness.category, photos: [],
    promotions: sale ? [{
      type: 'OFFER', originalPrice: amount, promotionalPrice: sale,
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      endsAt: new Date('2099-01-01T00:00:00.000Z'),
      photos: [], id: 'sale-' + id, conditions: null,
    }] : [],
    business: {
      publicId: owner.publicId, name: owner.name,
      description: owner.description, category: owner.category, location: owner.location,
    },
  });
  const source = [
    offer('PRODUCT', 'expensive', 'Caro', '10000'),
    offer('PRODUCT', 'without-price', 'Sin precio', null),
    offer('PRODUCT', 'discount', 'Descuento vigente', '20000', '2000'),
    offer('PRODUCT', 'cheap', 'Barato', '1000'),
  ];
  const services = [
    offer('SERVICE', 'service-no-price', 'Cotización', null),
    offer('SERVICE', 'service-expensive', 'Caro', '70000'),
    offer('SERVICE', 'service-cheap', 'Barato', '900'),
  ];
  const db = {
    business: { findMany: async () => [owner] },
    businessOffer: { findMany: async ({ where }: any) => {
      assert.equal(where.business.modalities.some.type, 'VIRTUAL');
      assert.equal(where.business.modalities.some.status, 'ACTIVE');
      return where.kind === 'PRODUCT' ? source : services;
    } },
  } as any;
  const first = await searchPublicUniversal(parseUniversalSearchInput({
    scope: 'virtual', productPageSize: '2', servicePageSize: '2',
  }), db);
  const second = await searchPublicUniversal(parseUniversalSearchInput({
    scope: 'virtual', productPage: '2', productPageSize: '2',
    servicePage: '2', servicePageSize: '2',
  }), db);
  assert.deepEqual(
    [...first.products, ...second.products].map(item => item.id),
    ['cheap', 'discount', 'expensive', 'without-price'],
  );
  assert.deepEqual(
    [...first.services, ...second.services].map(item => item.id),
    ['service-cheap', 'service-expensive', 'service-no-price'],
  );
  assert.equal(first.products[1].price.amount, '2000');
  assert.equal(first.pagination.products.total, 4);
  assert.equal(first.pagination.products.totalPages, 2);
  assert.equal(first.pagination.services.total, 3);
  assert.equal(first.pagination.services.totalPages, 2);
});

test('scope ciudad limita las tres pestañas por municipio y departamento sin requerir GPS', async () => {
  const makeBusiness = (publicId: string, cityName: string, regionName: string) => ({
    ...publicBusiness,
    publicId, name: 'Panadería', subscriptions: [], brand: { pioneer: null },
    location: { ...publicBusiness.location, cityName, regionName },
  });
  const palmira = makeBusiness('palmira', 'Palmira', 'Valle del Cauca');
  const cali = makeBusiness('cali', 'Cali', 'Valle del Cauca');
  const palmiraOther = makeBusiness('palmira-otro', 'Palmira', 'Otro departamento');
  const collection = [palmira, cali, palmiraOther];
  const makeOffer = (business: typeof palmira, kind: 'PRODUCT' | 'SERVICE') => ({
    ...publicBusiness.offers[0],
    id: `${business.publicId}-${kind}`, kind, name: 'Pan casero',
    description: null, category: publicBusiness.category, photos: [], promotions: [],
    business: { publicId: business.publicId, name: business.name, description: business.description,
      category: business.category, location: business.location },
  });
  const db = {
    business: { findMany: async () => collection },
    businessOffer: { findMany: async ({ where }: any) => collection.map(business => makeOffer(business, where.kind)) },
  } as any;
  const query = parseUniversalSearchInput({ scope: 'city', city: 'PALMIRA', region: 'Valle del Cauca' });
  const result = await searchPublicUniversal(query, db);
  assert.deepEqual(result.businesses.map(x => x.publicId), ['palmira']);
  assert.deepEqual(result.products.map(x => x.business.publicId), ['palmira']);
  assert.deepEqual(result.services.map(x => x.business.publicId), ['palmira']);
  assert.equal(result.pagination.businesses.total, 1);
  assert.equal(result.pagination.products.total, 1);
  assert.equal(result.pagination.services.total, 1);
});

test('el scope valida los parámetros y Sin límite mantiene la búsqueda general', () => {
  assert.equal(parseUniversalSearchInput({ q: 'pan' }).scope, undefined);
  assert.equal(parseUniversalSearchInput({ scope: 'virtual' }).scope, 'virtual');
  assert.equal(parseUniversalSearchInput({ scope: 'city', city: 'Palmira', region: 'Valle del Cauca' }).city, 'Palmira');
  assert.throws(() => parseUniversalSearchInput({ scope: 'city' }), AppError);
  assert.throws(() => parseUniversalSearchInput({ scope: 'falso' }), AppError);
});

test('el radio solo admite distancias válidas, sin cambiar la búsqueda general por defecto', () => {
  assert.equal(parseUniversalSearchInput({ q: 'motos' }).query, 'motos');
  assert.equal(parseUniversalSearchInput({ q: 'motos' }).radiusKm, undefined);
  assert.throws(() => parseUniversalSearchInput({ radiusKm: '-5' }), AppError);
  assert.throws(() => parseUniversalSearchInput({ radiusKm: '501' }), AppError);
});
