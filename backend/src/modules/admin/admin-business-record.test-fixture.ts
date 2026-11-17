import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { prisma } from '../../config/prisma.js';
import { savePhoto } from '../business/photo-storage.js';

/** Isolated test data only. Never imported by the application or run in production. */
export async function createBusinessRecordFixture(image: Buffer) {
  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /test/i);
  const seed = randomUUID().slice(0, 8), email = `record-${seed}@example.invalid`, password = `Record-${seed}-password`;
  const users: string[] = [], businesses: string[] = [];
  let accountId = '', categoryId = '';
  const cleanup = async () => {
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await prisma.businessAnalyticsEvent.deleteMany({ where: { businessId: { in: businesses } } });
    await prisma.businessFavorite.deleteMany({ where: { businessId: { in: businesses } } });
    await prisma.businessOfferLike.deleteMany({ where: { offer: { is: { businessId: { in: businesses } } } } });
    await prisma.businessSubscription.deleteMany({ where: { businessId: { in: businesses } } });
    await prisma.businessVisibilityPeriod.deleteMany({ where: { businessId: { in: businesses } } });
    await prisma.business.deleteMany({ where: { id: { in: businesses } } });
    if (accountId) await prisma.businessAccount.delete({ where: { id: accountId } });
    if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  };
  try {
    const user = await prisma.user.create({ data: { displayName: 'Administración de prueba aislada', emailNormalized: email,
      authIdentities: { create: { provider: 'EMAIL', providerSubject: email, passwordHash: await argon2.hash(password), verifiedAt: new Date() } },
      adminRoleAssignments: { create: { role: 'SUPER_ADMIN', active: true } } } }); users.push(user.id);
    const member = await prisma.user.create({ data: { displayName: 'Colaborador de prueba', nickname: `colab${seed}` } }); users.push(member.id);
    categoryId = (await prisma.category.create({ data: { code: `record-${seed}`, translations: { create: { locale: 'es', name: 'Ferreterías de prueba' } } } })).id;
    accountId = (await prisma.businessAccount.create({ data: { name: `Cuenta de prueba ${seed}`, createdById: user.id } })).id;
    const business = await prisma.business.create({ data: { businessAccountId: accountId, createdById: user.id, categoryId,
      slug: `record-${seed}`, name: 'Establecimiento de prueba aislada', description: 'Descripción registrada para verificar la ficha administrativa. Datos exclusivos del entorno de pruebas.',
      completeness: 85, lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', verificationStatus: 'PENDING', email: 'contacto@example.invalid', phone: '+570000000000',
      location: { create: { countryCode: 'CO', cityName: 'Palmira', regionName: 'Valle del Cauca', address: 'Dirección de prueba, sin establecimiento real' } },
    } }); businesses.push(business.id);
    const other = await prisma.business.create({ data: { businessAccountId: accountId, createdById: user.id, categoryId, slug: `other-${seed}`, name: 'Otro negocio de prueba' } }); businesses.push(other.id);
    await prisma.businessMembership.createMany({ data: [{ businessId: business.id, userId: user.id, role: 'OWNER', status: 'ACTIVE' }, { businessId: business.id, userId: member.id, role: 'COLLABORATOR', status: 'ACTIVE' }] });
    await prisma.businessVisibilityPeriod.create({ data: { businessId: business.id, kind: 'INITIAL', startsAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() + 40 * 86400000) } });
    await prisma.businessSubscription.create({ data: { businessId: business.id, plan: 'PRO', status: 'ACTIVE', startsAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() + 86400000 * 30) } });
    const registered = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1, 6));
    const offers = [];
    for (let index = 0; index < 20; index++) offers.push(await prisma.businessOffer.create({ data: { businessId: business.id, categoryId,
      internalCode: `QA${String(index + 1).padStart(5, '0')}`, kind: index < 13 ? 'PRODUCT' : 'SERVICE', name: `${index < 13 ? 'Producto' : 'Servicio'} de prueba ${String(index + 1).padStart(2, '0')}`,
      description: 'Descripción de consulta del catálogo en un entorno de pruebas aislado.', priceAmount: index === 0 ? 0 : index * 15000, currency: 'COP', negotiable: index === 1,
      publicationStatus: index % 4 === 0 ? 'UNPUBLISHED' : 'PUBLISHED', active: index % 3 !== 0, createdAt: registered } }));
    const photoIds: string[] = [];
    for (let index = 0; index < 18; index++) {
      const file = await savePhoto(business.id, image, 'image/png');
      const photo = await prisma.photo.create({ data: { businessId: index < 12 ? business.id : null, offerId: index >= 12 ? offers[index - 12].id : null,
        storageKey: file.storageKey, uploadedById: user.id, altText: `Fotografía de prueba ${index + 1}`, sortOrder: index } }); photoIds.push(photo.id);
    }
    await prisma.business.update({ where: { id: business.id }, data: { coverPhotoId: photoIds[0], profilePhotoId: photoIds[1] } });
    const reviews = [];
    for (let index = 0; index < 14; index++) {
      const author = await prisma.user.create({ data: { displayName: `Autor público de prueba ${index + 1}`, nickname: `autor${seed}${index}` } }); users.push(author.id);
      reviews.push(await prisma.businessReview.create({ data: { businessId: business.id, userId: author.id, rating: index % 5 + 1, comment: `Opinión registrada de prueba ${index + 1}. Solo se utiliza para verificar consulta y paginación.`, status: index === 13 ? 'HIDDEN' : 'PUBLISHED', createdAt: registered } }));
    }
    await prisma.businessReviewReport.create({ data: { reviewId: reviews[0].id, reporterId: member.id, reason: 'OTHER', description: 'Reporte de prueba' } });
    await prisma.businessReport.create({ data: { businessId: business.id, reporterId: member.id, reason: 'OTHER', description: 'Reporte de prueba aislada' } });
    await prisma.auditLog.createMany({ data: Array.from({ length: 18 }, (_, index) => ({ actorUserId: user.id, entityType: 'BUSINESS' as const, entityId: business.id,
      action: index === 0 ? 'BUSINESS_CREATED' : 'BUSINESS_UPDATED', reason: `Actuación de prueba ${index + 1}`, comment: 'Observación de prueba aislada',
      previousState: { publicationStatus: 'UNPUBLISHED', token: 'not-a-real-secret-do-not-expose' }, newState: { publicationStatus: 'PUBLISHED' } })) });
    await prisma.businessAnalyticsEvent.createMany({ data: [{ businessId: business.id, eventType: 'BUSINESS_VIEW', createdAt: registered }, { businessId: business.id, eventType: 'BUSINESS_VIEW', createdAt: registered }, { businessId: business.id, eventType: 'PHONE_CLICK', createdAt: registered }, { businessId: business.id, eventType: 'OFFER_VIEW', offerId: offers[0].id, createdAt: registered }] });
    return { user, member, business, other, offers, photoIds, reviews, email, password, registered, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
