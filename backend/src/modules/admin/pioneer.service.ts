import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { notifyBusinessOwners } from '../notifications/platform-notifications.service.js';
import type { AdminContext } from './admin-auth.service.js';

const MAX_PIONEERS = 20;
const auditActions = [
  'PIONEER_ASSIGNED', 'BRAND_CLAIM_APPROVED', 'BRAND_CLAIM_REJECTED',
  'BRAND_VERIFIED', 'BRAND_VERIFICATION_REJECTED',
];
function assertPioneerPermission(context: AdminContext) {
  if (!context.permissions.includes('PIONEER_MANAGE'))
    throw new AppError(403, 'ADMIN_PERMISSION_DENIED', 'No tienes permiso para gestionar Negocios Pioneros.');
}
function reasonText(value: string) {
  const text = value.trim();
  if (text.length < 12 || text.length > 500)
    throw new AppError(400, 'PIONEER_REASON_REQUIRED', 'Indica un motivo de entre 12 y 500 caracteres.');
  return text;
}
type EligibilityBusiness = {
  lifecycleStatus: string; publicationStatus: string; visibilityStatus: string;
  deletionStatus: string; businessAccount: { status: string };
};
const eligibleBusiness = (business: EligibilityBusiness) =>
  business.lifecycleStatus === 'ACTIVE' && business.publicationStatus === 'PUBLISHED' &&
  business.visibilityStatus === 'VISIBLE' && business.deletionStatus === 'NONE' &&
  business.businessAccount.status === 'ACTIVE';

export async function listPioneerRegistry(context: AdminContext) {
  assertPioneerPermission(context);
  const [brands, assignments, pendingClaims, recentActions] = await Promise.all([
    prisma.businessBrand.findMany({
      include: {
        businesses: {
          select: { id: true, publicId: true, name: true, lifecycleStatus: true,
            publicationStatus: true, visibilityStatus: true, deletionStatus: true,
            businessAccount: { select: { status: true } },
            location: { select: { cityName: true, countryCode: true } } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
        claims: { where: { status: 'APPROVED' }, select: {
          id: true, claimantId: true, status: true, reviewedById: true, reviewedAt: true,
        } },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    }),
    prisma.pioneerAssignment.findMany({
      include: {
        brand: { select: { id: true, legalName: true, verification: true } },
        assignedBy: { select: { publicId: true, displayName: true } },
      }, orderBy: [{ number: 'asc' }, { id: 'asc' }],
    }),
    // Claims without a brand are legitimate and must not disappear from Admin.
    prisma.businessClaim.findMany({
      where: { status: 'PENDING' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true, status: true, claimantId: true, brandId: true, evidenceType: true,
        evidenceNote: true, createdAt: true, reviewedAt: true,
        claimant: { select: { displayName: true } },
        business: { select: { id: true, name: true, publicId: true, brandId: true,
          publicationStatus: true, visibilityStatus: true } },
        brand: { select: { id: true, legalName: true, verification: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { entityType: 'BUSINESS', action: { in: auditActions } },
      take: 60, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, entityId: true, action: true, reason: true, createdAt: true,
        actor: { select: { displayName: true } } },
    }),
  ]);
  const linked = new Set(assignments.map(item => item.brandId));
  const enrichedBrands = brands.map(brand => {
    const activeBusiness = brand.businesses.some(eligibleBusiness);
    const hasApprovedClaim = brand.claims.length > 0;
    return {
      ...brand,
      eligibleForPioneer: brand.verification === 'VERIFIED' &&
        hasApprovedClaim && activeBusiness && !linked.has(brand.id),
      eligibility: {
        verified: brand.verification === 'VERIFIED',
        approvedClaim: hasApprovedClaim,
        visibleBusiness: activeBusiness,
        alreadyAssigned: linked.has(brand.id),
      },
    };
  });
  return {
    max: MAX_PIONEERS, available: Math.max(0, MAX_PIONEERS - assignments.length),
    brands: enrichedBrands, assignments, pendingClaims, recentActions,
    generatedAt: new Date().toISOString(),
    definition: 'Un cupo se asigna a una marca verificada, con reclamación aprobada y al menos un negocio activo, publicado y visible. La numeración es única y permanente. Las altas de la gráfica se calculan con la fecha real de asignación, sin registros simulados.',
  };
}

export async function approveBrandClaim(context: AdminContext, claimId: string, approve: boolean, reason: string) {
  assertPioneerPermission(context);
  const note = reasonText(reason);
  return prisma.$transaction(async tx => {
    // Lock the claim to reject concurrent or repeated decisions.
    await tx.$queryRaw`SELECT id FROM BusinessClaim WHERE id = ${claimId} FOR UPDATE`;
    const claim = await tx.businessClaim.findUnique({ where: { id: claimId },
      include: { business: true, brand: true } });
    if (!claim) throw new AppError(404, 'BRAND_CLAIM_NOT_FOUND', 'No encontramos la reclamación.');
    if (claim.status !== 'PENDING')
      throw new AppError(409, 'BRAND_CLAIM_ALREADY_REVIEWED', 'La reclamación ya fue revisada.');
    let brandId = claim.brandId;
    if (approve && !brandId) {
      // Existing brand names remain unique; do not overwrite another verified identity.
      const normalizedName = claim.business.name.trim().toLocaleLowerCase('es-CO');
      const existing = await tx.businessBrand.findUnique({ where: { normalizedName },
        select: { id: true } });
      if (existing) {
        throw new AppError(409, 'BRAND_CLAIM_BRAND_CONFLICT',
          'Ya existe una marca con ese nombre. Revisa manualmente la identidad antes de aprobarla.');
      }
      const brand = await tx.businessBrand.create({
        data: { legalName: claim.business.name, normalizedName, verification: 'PENDING' },
        select: { id: true },
      });
      brandId = brand.id;
    }
    const updated = await tx.businessClaim.update({ where: { id: claim.id },
      data: { status: approve ? 'APPROVED' : 'REJECTED', brandId,
        reviewedById: context.userId, reviewedAt: new Date() } });
    if (approve && brandId)
      await tx.business.update({ where: { id: claim.businessId }, data: { brandId } });
    await tx.auditLog.create({ data: {
      actorUserId: context.userId, entityType: 'BUSINESS', entityId: claim.businessId,
      action: approve ? 'BRAND_CLAIM_APPROVED' : 'BRAND_CLAIM_REJECTED',
      previousState: { claimId, status: claim.status },
      newState: { claimId, status: updated.status, brandId }, reason: note,
    } });
    await notifyBusinessOwners(tx, claim.businessId,
      approve ? 'Reclamación de marca aprobada' : 'Reclamación de marca rechazada',
      approve ? 'Tu reclamación fue aprobada. El reconocimiento Pionero requiere verificación adicional y disponibilidad de cupos.'
        : 'Tu reclamación de marca fue rechazada por Admin. Contacta a soporte para obtener información.');
    return updated;
  });
}

export async function reviewPioneerBrand(context: AdminContext, brandId: string, approve: boolean, reason: string) {
  assertPioneerPermission(context);
  const note = reasonText(reason);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM BusinessBrand WHERE id = ${brandId} FOR UPDATE`;
    const brand = await tx.businessBrand.findUnique({ where: { id: brandId },
      include: {
        claims: { where: { status: 'APPROVED' }, select: { id: true } },
        businesses: { select: { id: true } },
        pioneer: { select: { id: true } },
      },
    });
    if (!brand) throw new AppError(404, 'PIONEER_BRAND_NOT_FOUND', 'No encontramos la marca.');
    if (brand.pioneer && !approve)
      throw new AppError(409, 'PIONEER_PERMANENT_ASSIGNMENT',
        'No puedes retirar la verificación de una marca que ya tiene un reconocimiento Pionero. Requiere revisión específica.');
    if (approve && !brand.claims.length)
      throw new AppError(409, 'PIONEER_CLAIM_REQUIRED', 'La marca necesita una reclamación aprobada antes de verificarla.');
    const desired = approve ? 'VERIFIED' : 'REJECTED';
    if (brand.verification === desired)
      throw new AppError(409, 'PIONEER_BRAND_ALREADY_REVIEWED', 'La marca ya tiene este estado.');
    const updated = await tx.businessBrand.update({ where: { id: brand.id },
      data: { verification: desired, verifiedAt: approve ? new Date() : null,
        verifiedById: approve ? context.userId : null, evidenceSummary: note } });
    await tx.auditLog.create({ data: {
      actorUserId: context.userId, entityType: 'BUSINESS', entityId: brand.id,
      action: approve ? 'BRAND_VERIFIED' : 'BRAND_VERIFICATION_REJECTED',
      previousState: { verification: brand.verification },
      newState: { verification: updated.verification, verifiedAt: updated.verifiedAt?.toISOString() ?? null },
      reason: note,
    } });
    for (const business of brand.businesses)
      await notifyBusinessOwners(tx, business.id,
        approve ? 'Marca verificada por XAMUKO' : 'Verificación de marca rechazada',
        approve ? 'La marca vinculada fue verificada. El cupo Pionero no se asigna automáticamente.'
          : 'Admin rechazó la verificación de la marca vinculada. Consulta soporte.');
    return updated;
  });
}

export async function assignPioneer(context: AdminContext, brandId: string, reason: string) {
  assertPioneerPermission(context);
  const note = reasonText(reason);
  return prisma.$transaction(async tx => {
    // Serialize assignments across different brands using the first eligible lock.
    // Unique indexes on number and brandId remain the final concurrency guarantee.
    const brand = await tx.businessBrand.findUnique({ where: { id: brandId },
      include: {
        businesses: { select: { id: true, lifecycleStatus: true, publicationStatus: true,
          visibilityStatus: true, deletionStatus: true,
          businessAccount: { select: { status: true } } } },
        claims: { where: { status: 'APPROVED' }, select: { id: true } },
      } });
    if (!brand || brand.verification !== 'VERIFIED' || brand.claims.length === 0)
      throw new AppError(409, 'PIONEER_NOT_ELIGIBLE',
        'La marca debe estar verificada y tener una reclamación aprobada.');
    if (!brand.businesses.some(eligibleBusiness))
      throw new AppError(409, 'PIONEER_NOT_ELIGIBLE',
        'La marca no tiene un negocio activo, publicado y visible.');
    if (await tx.pioneerAssignment.findUnique({ where: { brandId } }))
      throw new AppError(409, 'PIONEER_ALREADY_ASSIGNED', 'La marca ya tiene un cupo Pionero.');
    const count = await tx.pioneerAssignment.count();
    if (count >= MAX_PIONEERS)
      throw new AppError(409, 'PIONEER_LIMIT_REACHED', 'Los 20 cupos Pionero ya están asignados.');
    const last = await tx.pioneerAssignment.findFirst({ orderBy: { number: 'desc' },
      select: { number: true } });
    const number = (last?.number ?? 0) + 1;
    if (number > MAX_PIONEERS)
      throw new AppError(409, 'PIONEER_LIMIT_REACHED', 'La numeración de 20 Pioneros está completa.');
    try {
      const assignment = await tx.pioneerAssignment.create({ data: {
        brandId, number, assignedById: context.userId,
      }, include: { brand: { select: { legalName: true } } } });
      await tx.auditLog.create({ data: {
        actorUserId: context.userId, entityType: 'BUSINESS', entityId: brandId,
        action: 'PIONEER_ASSIGNED', previousState: Prisma.JsonNull,
        newState: { number, brandId }, reason: note,
      } });
      for (const business of brand.businesses)
        await notifyBusinessOwners(tx, business.id, 'Reconocimiento Negocio Pionero',
          'La marca de tu negocio recibió el reconocimiento Pionero número ' +
          String(number).padStart(3, '0') + '. Este reconocimiento tiene numeración única.');
      return assignment;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new AppError(409, 'PIONEER_ASSIGNMENT_CONFLICT',
          'Otra asignación ocupó ese número. Actualiza el registro e inténtalo nuevamente.');
      throw error;
    }
  });
}
