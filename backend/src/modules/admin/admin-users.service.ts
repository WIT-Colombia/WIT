import { prisma } from '../../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';

type Filters = { q?: string; page?: number; status?: string; relation?: string };
type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
const allowedStatuses = ['ACTIVE', 'SUSPENDED', 'DELETED'];
const compact = (value: string | undefined, max = 100) => (value ?? '').trim().slice(0, max);
const activeBusiness = { deletionStatus: { not: 'DELETED' as const } };
const businessBrief = {
  id: true, publicId: true, name: true, publicationStatus: true,
  visibilityStatus: true, createdAt: true, deletionStatus: true,
  location: { select: { cityName: true, countryCode: true } },
  category: { select: { code: true, translations: { select: { locale: true, name: true } } } },
} as const;
const categoryName = (category: { code: string; translations: Array<{ locale: string; name: string }> }) =>
  category.translations.find(t => t.locale === 'es-CO')?.name ??
  category.translations.find(t => t.locale === 'es')?.name ??
  category.translations[0]?.name ?? category.code;
function businessLinks(
  memberships: Array<{ businessId: string; role: string; status: string; acceptedAt: Date | null; business: any }>,
  created: Array<any>,
) {
  const records = new Map<string, {
    id: string; publicId: string; name: string; category: string; city: string | null;
    publicationStatus: string; visibilityStatus: string; role: 'OWNER' | 'COLLABORATOR' | 'CREATOR';
    membershipStatus: string; acceptedAt: string | null; createdAt: string;
  }>();
  for (const item of created) {
    records.set(item.id, {
      id: item.id, publicId: item.publicId, name: item.name, category: categoryName(item.category),
      city: item.location?.cityName ?? null, publicationStatus: item.publicationStatus,
      visibilityStatus: item.visibilityStatus, role: 'CREATOR', membershipStatus: 'NO_MEMBERSHIP',
      acceptedAt: null, createdAt: item.createdAt.toISOString(),
    });
  }
  for (const member of memberships) {
    if (member.business.deletionStatus === 'DELETED') continue;
    const item = member.business;
    records.set(item.id, {
      id: item.id, publicId: item.publicId, name: item.name, category: categoryName(item.category),
      city: item.location?.cityName ?? null, publicationStatus: item.publicationStatus,
      visibilityStatus: item.visibilityStatus, role: member.role === 'OWNER' ? 'OWNER' : 'COLLABORATOR',
      membershipStatus: member.status, acceptedAt: member.acceptedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    });
  }
  return [...records.values()].sort((a, b) =>
    (a.membershipStatus === 'ACTIVE' ? 0 : 1) - (b.membershipStatus === 'ACTIVE' ? 0 : 1) || a.name.localeCompare(b.name, 'es'));
}

export async function listAdminUsersExtended(filters: Filters) {
  const q = compact(filters.q);
  const status = allowedStatuses.includes(filters.status ?? '') ? filters.status as UserStatus : undefined;
  const relation = filters.relation === 'OWNER' || filters.relation === 'COLLABORATOR' || filters.relation === 'NONE' ? filters.relation : undefined;
  const page = Number.isFinite(filters.page) ? Math.max(1, Math.min(100000, Math.floor(filters.page!))) : 1;
  const pageSize = 20;
  const relationCondition: Prisma.UserWhereInput =
    relation === 'OWNER' ? { memberships: { some: { role: 'OWNER', status: 'ACTIVE', business: activeBusiness } } } :
    relation === 'COLLABORATOR' ? { memberships: { some: { role: 'COLLABORATOR', status: 'ACTIVE', business: activeBusiness } } } :
    relation === 'NONE' ? { memberships: { none: { status: 'ACTIVE', business: activeBusiness } }, createdBusinesses: { none: activeBusiness } } : {};
  const where: Prisma.UserWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ displayName: { contains: q } }, { emailNormalized: { contains: q } }, { nickname: { contains: q } }] } : {}),
    ...relationCondition,
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      select: {
        id: true, publicId: true, displayName: true, nickname: true,
        emailNormalized: true, status: true, avatarUrl: true, createdAt: true,
        lastLoginAt: true, locale: true,
        memberships: { where: { status: 'ACTIVE', business: activeBusiness }, select: { role: true, businessId: true } },
        createdBusinesses: { where: activeBusiness, select: { id: true } },
        adminRoleAssignments: { where: { active: true }, select: { role: true } },
      },
    }),
  ]);
  return {
    users: users.map(({ memberships, createdBusinesses, adminRoleAssignments, ...user }) => ({
      ...user,
      ownedBusinesses: memberships.filter(item => item.role === 'OWNER').length,
      collaboratingBusinesses: memberships.filter(item => item.role === 'COLLABORATOR').length,
      createdBusinesses: createdBusinesses.length,
      isAdmin: adminRoleAssignments.length > 0,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getAdminUserOverview(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const [total, active, suspended, deleted, owners, collaborators, adminCount, monthly] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.user.count({ where: { status: 'DELETED' } }),
    prisma.user.count({ where: { status: 'ACTIVE', memberships: { some: { role: 'OWNER', status: 'ACTIVE', business: activeBusiness } } } }),
    prisma.user.count({ where: { status: 'ACTIVE', memberships: { some: { role: 'COLLABORATOR', status: 'ACTIVE', business: activeBusiness } } } }),
    prisma.user.count({ where: { adminRoleAssignments: { some: { active: true } } } }),
    prisma.$queryRaw<Array<{ month: string; quantity: bigint }>>(Prisma.sql`
      SELECT DATE_FORMAT(u.createdAt, '%Y-%m') AS month, COUNT(*) AS quantity
      FROM \`User\` u WHERE u.createdAt >= ${start} AND u.createdAt < ${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))}
      GROUP BY DATE_FORMAT(u.createdAt, '%Y-%m') ORDER BY month ASC
    `),
  ]);
  const grouped = new Map(monthly.map(row => [row.month, Number(row.quantity)]));
  const series = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    return { month: d.toISOString().slice(0, 7), registrations: grouped.get(d.toISOString().slice(0, 7)) ?? 0 };
  });
  return {
    generatedAt: now.toISOString(), total, active, suspended, deleted, owners, collaborators, adminCount, series,
    definition: 'Altas agrupadas por fecha de creación. Los estados y las relaciones corresponden a su situación actual. Propietarios y colaboradores pueden coincidir en la misma cuenta.',
  };
}

export async function getAdminUserProfile(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, publicId: true, displayName: true, nickname: true, emailNormalized: true,
      status: true, avatarUrl: true, locale: true, createdAt: true, updatedAt: true,
      lastLoginAt: true, preferredLocationCity: true, preferredLocationRegion: true,
      preferredLocationCountry: true,
      authIdentities: { select: { provider: true, verifiedAt: true, createdAt: true } },
      adminRoleAssignments: { where: { active: true }, select: { role: true } },
      memberships: {
        select: {
          businessId: true, role: true, status: true, acceptedAt: true,
          business: { select: businessBrief },
        },
      },
      createdBusinesses: { where: activeBusiness, select: businessBrief },
      createdBusinessAccounts: { select: { id: true, name: true, status: true } },
    },
  });
  if (!user) throw new AppError(404, 'ADMIN_USER_NOT_FOUND', 'No encontramos este usuario.');
  const [reviews, favorites, offerLikes, sessions, reports] = await Promise.all([
    prisma.businessReview.count({ where: { userId: id } }),
    prisma.businessFavorite.count({ where: { userId: id } }),
    prisma.businessOfferLike.count({ where: { userId: id } }),
    prisma.session.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.businessReport.count({ where: { reporterId: id } }),
  ]);
  const links = businessLinks(user.memberships, user.createdBusinesses);
  const blockers = deletionBlockers({
    ownBusinesses: links.filter(item => item.role === 'OWNER' && item.membershipStatus === 'ACTIVE').length,
    createdBusinesses: user.createdBusinesses.length,
    businessAccounts: user.createdBusinessAccounts.length,
    adminRoles: user.adminRoleAssignments.length,
  });
  const { memberships: _m, createdBusinesses: _c, adminRoleAssignments: _a, createdBusinessAccounts: _accounts, ...profile } = user;
  return {
    user: { ...profile, authProviders: user.authIdentities, businesses: links, administrativeRoles: user.adminRoleAssignments.map(item => item.role),
      businessAccounts: user.createdBusinessAccounts,
      activity: { reviews, favorites, offerLikes, sessions, reports },
      deletion: { allowed: user.status !== 'DELETED' && blockers.length === 0, blockers },
    },
  };
}
export function deletionBlockers(input: { ownBusinesses: number; createdBusinesses: number; businessAccounts: number; adminRoles: number }) {
  return [
    ...(input.ownBusinesses ? ['Tiene negocios con membresía de propietario vigente.'] : []),
    ...(input.createdBusinesses ? ['Figura como creador de negocios existentes.'] : []),
    ...(input.businessAccounts ? ['Tiene cuentas de negocio asociadas a su identidad.'] : []),
    ...(input.adminRoles ? ['Tiene un rol administrativo activo.'] : []),
  ];
}

export async function deactivateAdminUser(userId: string, actorId: string, reason: string) {
  const justification = reason.trim();
  if (justification.length < 12 || justification.length > 500)
    throw new AppError(400, 'ADMIN_USER_REASON_REQUIRED', 'Indica un motivo de entre 12 y 500 caracteres.');
  if (actorId === userId) throw new AppError(403, 'ADMIN_USER_SELF_DELETE', 'No puedes eliminar tu propia cuenta desde Admin.');
  return prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, status: true, displayName: true, emailNormalized: true } });
    if (!user) throw new AppError(404, 'ADMIN_USER_NOT_FOUND', 'No encontramos este usuario.');
    if (user.status === 'DELETED') throw new AppError(409, 'ADMIN_USER_ALREADY_DELETED', 'La cuenta ya está eliminada.');
    const [owners, created, accounts, adminRoles] = await Promise.all([
      tx.businessMembership.count({ where: { userId, role: 'OWNER', status: 'ACTIVE', business: activeBusiness } }),
      tx.business.count({ where: { createdById: userId, ...activeBusiness } }),
      tx.businessAccount.count({ where: { createdById: userId } }),
      tx.adminRoleAssignment.count({ where: { userId, active: true } }),
    ]);
    const blockers = deletionBlockers({ ownBusinesses: owners, createdBusinesses: created, businessAccounts: accounts, adminRoles });
    if (blockers.length) throw new AppError(409, 'ADMIN_USER_DEPENDENCIES', blockers.join(' '));
    const now = new Date();
    await tx.user.update({ where: { id: userId }, data: { status: 'DELETED' } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.adminSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.businessMembership.updateMany({ where: { userId, role: 'COLLABORATOR', status: { in: ['INVITED', 'ACTIVE', 'SUSPENDED'] } }, data: { status: 'REVOKED', revokedAt: now } });
    await tx.auditLog.create({
      data: { actorUserId: actorId, entityType: 'USER', entityId: userId, action: 'ADMIN_USER_DEACTIVATED',
        previousState: { status: user.status, displayName: user.displayName, emailNormalized: user.emailNormalized },
        newState: { status: 'DELETED' }, reason: justification },
    });
    return { id: userId, status: 'DELETED' as const, message: 'Baja administrativa realizada. Se conservaron los registros históricos y la trazabilidad.' };
  });
}
