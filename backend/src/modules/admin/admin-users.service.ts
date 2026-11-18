import { prisma } from '../../config/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';

export type AdminUserFilters = {
  q?: string; page?: number; status?: string; relation?: string; city?: string;
  provider?: string; emailVerified?: string; admin?: string; activity?: string;
  registeredFrom?: string; registeredTo?: string; lastLoginFrom?: string; lastLoginTo?: string;
  order?: string;
};
type Filters = AdminUserFilters;
type UserAction = 'SUSPEND' | 'RESTORE';

export function validateAdminUserStatusAction(action: string, reason: string): UserAction {
  if (action !== 'SUSPEND' && action !== 'RESTORE')
    throw new AppError(400, 'ADMIN_USER_ACTION_INVALID', 'La acción administrativa solicitada no existe.');
  if (reason.trim().length < 12 || reason.trim().length > 500)
    throw new AppError(400, 'ADMIN_USER_REASON_REQUIRED', 'Indica un motivo de entre 12 y 500 caracteres.');
  return action;
}
function validDate(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError(400, 'ADMIN_USER_DATE_INVALID', 'La fecha debe tener el formato AAAA-MM-DD.');
  const d = new Date(value + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value)
    throw new AppError(400, 'ADMIN_USER_DATE_INVALID', 'La fecha indicada no existe.');
  return d;
}
export function adminUsersWhere(filters: Filters, now = new Date()): Prisma.UserWhereInput {
  const q = compact(filters.q);
  const status = allowedStatuses.includes(filters.status ?? '') ? filters.status as UserStatus : undefined;
  const relation = filters.relation === 'OWNER' || filters.relation === 'COLLABORATOR' || filters.relation === 'ANY' || filters.relation === 'NONE' ? filters.relation : undefined;
  const city = filters.city?.trim();
  if (city && (city.length > 160 || /[\\u0000-\\u001f]/.test(city)))
    throw new AppError(400, 'ADMIN_USER_CITY_INVALID', 'Selecciona una ciudad válida.');
  const registeredFrom = validDate(filters.registeredFrom), registeredTo = validDate(filters.registeredTo, true);
  const lastLoginFrom = validDate(filters.lastLoginFrom), lastLoginTo = validDate(filters.lastLoginTo, true);
  if ((registeredFrom && registeredTo && registeredFrom > registeredTo) || (lastLoginFrom && lastLoginTo && lastLoginFrom > lastLoginTo))
    throw new AppError(400, 'ADMIN_USER_DATE_RANGE_INVALID', 'La fecha inicial debe ser anterior a la final.');
  const ninetyDays = new Date(now.getTime() - 90 * 86400000);
  const thirtyDays = new Date(now.getTime() - 30 * 86400000);
  const relationCondition: Prisma.UserWhereInput =
    relation === 'OWNER' ? { memberships: { some: { role: 'OWNER', status: 'ACTIVE', business: activeBusiness } } } :
    relation === 'COLLABORATOR' ? { memberships: { some: { role: 'COLLABORATOR', status: 'ACTIVE', business: activeBusiness } } } :
    relation === 'NONE' ? { memberships: { none: { status: 'ACTIVE', business: activeBusiness } }, createdBusinesses: { none: activeBusiness } } : {};
  const provider = ['EMAIL','GOOGLE','APPLE'].includes(filters.provider ?? '') ? filters.provider as 'EMAIL' | 'GOOGLE' | 'APPLE' : undefined;
  const additional: Prisma.UserWhereInput[] = [];
  // Compose the ANY quick filter with free-text search; do not overwrite its OR.
  if (relation === 'ANY') additional.push({ OR: [
    { memberships: { some: { status: 'ACTIVE', business: activeBusiness } } },
    { createdBusinesses: { some: activeBusiness } },
  ] });
  if (provider) additional.push({ authIdentities: { some: { provider } } });
  if (filters.emailVerified === 'yes') additional.push({ authIdentities: { some: { provider: 'EMAIL', verifiedAt: { not: null } } } });
  if (filters.emailVerified === 'no') additional.push({ authIdentities: { none: { provider: 'EMAIL', verifiedAt: { not: null } } } });
  if (filters.activity === 'recent30') additional.push({ lastLoginAt: { gte: thirtyDays } });
  if (filters.activity === 'dormant90') additional.push({ lastLoginAt: { lt: ninetyDays } });
  if (filters.activity === 'never') additional.push({ lastLoginAt: null });
  if (lastLoginFrom || lastLoginTo) additional.push({ lastLoginAt: { ...(lastLoginFrom ? { gte: lastLoginFrom } : {}), ...(lastLoginTo ? { lte: lastLoginTo } : {}) } });
  return {
    ...(status ? { status } : {}),
    ...(city ? { preferredLocationCity: city } : {}),
    ...(q ? { OR: [
      { displayName: { contains: q } }, { emailNormalized: { contains: q } }, { nickname: { contains: q } },
      { publicId: { contains: q } },
    ] } : {}),
    ...relationCondition,
    ...(additional.length ? { AND: additional } : {}),
    ...(filters.admin === 'yes' ? { adminRoleAssignments: { some: { active: true } } }
      : filters.admin === 'no' ? { adminRoleAssignments: { none: { active: true } } } : {}),
    ...((registeredFrom || registeredTo) ? { createdAt: { ...(registeredFrom ? { gte: registeredFrom } : {}), ...(registeredTo ? { lte: registeredTo } : {}) } } : {}),
  };
}

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
  const page = Number.isFinite(filters.page) ? Math.max(1, Math.min(100000, Math.floor(filters.page!))) : 1;
  const pageSize = 20;
  const where = adminUsersWhere(filters);
  const orderBy: Prisma.UserOrderByWithRelationInput =
    filters.order === 'oldest' ? { createdAt: 'asc' } :
    filters.order === 'name' ? { displayName: 'asc' } :
    filters.order === 'lastLogin' ? { lastLoginAt: 'desc' } : { createdAt: 'desc' };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, orderBy, skip: (page - 1) * pageSize, take: pageSize,
      select: {
        id: true, publicId: true, displayName: true, nickname: true,
        emailNormalized: true, status: true, avatarUrl: true, createdAt: true,
        lastLoginAt: true, locale: true,
        authIdentities: { select: { provider: true, verifiedAt: true } },
        memberships: { where: { status: 'ACTIVE', business: activeBusiness }, select: { role: true, businessId: true } },
        createdBusinesses: { where: activeBusiness, select: { id: true } },
        adminRoleAssignments: { where: { active: true }, select: { role: true } },
      },
    }),
  ]);
  return {
    users: users.map(({ memberships, createdBusinesses, adminRoleAssignments, authIdentities, ...user }) => ({
      ...user,
      // Never expose the internal object-storage key to the Admin frontend.
      avatarUrl: user.avatarUrl?.startsWith('private-avatar:') ? '/api/v1/admin/users/' + encodeURIComponent(user.id) + '/avatar' : null,
      ownedBusinesses: memberships.filter(item => item.role === 'OWNER').length,
      collaboratingBusinesses: memberships.filter(item => item.role === 'COLLABORATOR').length,
      createdBusinesses: createdBusinesses.length,
      isAdmin: adminRoleAssignments.length > 0,
      emailVerified: authIdentities.some(identity => identity.provider === 'EMAIL' && identity.verifiedAt !== null),
      authProviders: authIdentities.map(identity => identity.provider),
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getAdminUserOverview(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const [total, active, suspended, deleted, owners, collaborators, adminCount, active30, dormant90, neverLoggedIn, emailVerified, googleUsers, linkedBusinesses, withBusiness, locations, monthly] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.user.count({ where: { status: 'DELETED' } }),
    prisma.user.count({ where: { status: 'ACTIVE', memberships: { some: { role: 'OWNER', status: 'ACTIVE', business: activeBusiness } } } }),
    prisma.user.count({ where: { status: 'ACTIVE', memberships: { some: { role: 'COLLABORATOR', status: 'ACTIVE', business: activeBusiness } } } }),
    prisma.user.count({ where: { adminRoleAssignments: { some: { active: true } } } }),
    prisma.user.count({ where: { status: 'ACTIVE', lastLoginAt: { gte: new Date(now.getTime() - 30 * 86400000) } } }),
    prisma.user.count({ where: { status: 'ACTIVE', lastLoginAt: { lt: new Date(now.getTime() - 90 * 86400000) } } }),
    prisma.user.count({ where: { status: 'ACTIVE', lastLoginAt: null } }),
    prisma.user.count({ where: { authIdentities: { some: { provider: 'EMAIL', verifiedAt: { not: null } } } } }),
    prisma.user.count({ where: { authIdentities: { some: { provider: 'GOOGLE' } } } }),
    // Count distinct businesses, not memberships: a business can have several owners.
    prisma.business.count({ where: { ...activeBusiness, memberships: { some: { status: 'ACTIVE', user: { status: 'ACTIVE' } } } } }),
    prisma.user.count({ where: { OR: [
      { memberships: { some: { status: 'ACTIVE', business: activeBusiness } } },
      { createdBusinesses: { some: activeBusiness } },
    ] } }),
    prisma.user.findMany({
      where: { preferredLocationCity: { not: null }, status: { not: 'DELETED' } },
      select: { preferredLocationCity: true },
      distinct: ['preferredLocationCity'],
      orderBy: { preferredLocationCity: 'asc' },
      take: 200,
    }),
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
    generatedAt: now.toISOString(), total, active, suspended, deleted, owners, collaborators, adminCount, active30, dormant90, neverLoggedIn, emailVerified, googleUsers,
    linkedBusinesses, withBusiness, cities: locations.map(row => row.preferredLocationCity).filter((value): value is string => Boolean(value?.trim())), series,
    definition: 'Altas agrupadas por fecha de creación en UTC, incluyendo meses con valor cero. Estados, verificación y relaciones representan la situación actual, no su historia. Propietarios y colaboradores pueden coincidir. Negocios vinculados cuenta negocios únicos con al menos un vínculo activo a un usuario activo. Ciudades se basan en ubicación preferida declarada por los usuarios.',
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
      createdBusinessAccounts: { select: { id: true, name: true, status: true, businesses: { where: activeBusiness, select: { id: true } } } },
    },
  });
  if (!user) throw new AppError(404, 'ADMIN_USER_NOT_FOUND', 'No encontramos este usuario.');
  const [reviews, favorites, offerLikes, sessions, reports, pendingTransfers] = await Promise.all([
    prisma.businessReview.count({ where: { userId: id } }),
    prisma.businessFavorite.count({ where: { userId: id } }),
    prisma.businessOfferLike.count({ where: { userId: id } }),
    prisma.session.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.businessReport.count({ where: { reporterId: id } }),
    prisma.ownershipTransfer.count({ where: { status: 'PENDING', OR: [{ fromUserId: id }, { toUserId: id }] } }),
  ]);
  const links = businessLinks(user.memberships, user.createdBusinesses);
  const blockers = deletionBlockers({
    ownBusinesses: links.filter(item => item.role === 'OWNER' && item.membershipStatus === 'ACTIVE').length,
    createdBusinesses: user.createdBusinesses.length,
    businessAccounts: user.createdBusinessAccounts.filter(account => account.businesses.length > 0).length,
    adminRoles: user.adminRoleAssignments.length,
    pendingTransfers,
  });
  const { memberships: _m, createdBusinesses: _c, adminRoleAssignments: _a, createdBusinessAccounts: _accounts, authIdentities: _identities, ...profile } = user;
  return {
    user: { ...profile,
      avatarUrl: profile.avatarUrl?.startsWith('private-avatar:') ? '/api/v1/admin/users/' + encodeURIComponent(profile.id) + '/avatar' : null,
      authProviders: user.authIdentities, businesses: links, administrativeRoles: user.adminRoleAssignments.map(item => item.role),
      businessAccounts: user.createdBusinessAccounts.map(({ businesses: _linked, ...account }) => account),
      activity: { reviews, favorites, offerLikes, sessions, reports, pendingTransfers },
      deletion: { allowed: user.status !== 'DELETED' && blockers.length === 0, blockers },
    },
  };
}
export type UserAnalyticsPeriod = '6m' | '12m' | '24m' | '60m' | 'all';
export function getUserAnalyticsPeriod(value: string): UserAnalyticsPeriod {
  return value === '6m' || value === '12m' || value === '24m' || value === '60m' || value === 'all' ? value : '12m';
}
export async function getAdminUserAnalytics(periodInput: string, now = new Date()) {
  const period = getUserAnalyticsPeriod(periodInput);
  const first = period === 'all' ? await prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }) : null;
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstMonth = first ? new Date(Date.UTC(first.createdAt.getUTCFullYear(), first.createdAt.getUTCMonth(), 1)) : thisMonth;
  const from = period === 'all' ? firstMonth : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - Number.parseInt(period, 10) + 1, 1));
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [priorTotal, records] = await Promise.all([
    prisma.user.count({ where: { createdAt: { lt: from } } }),
    prisma.$queryRaw<Array<{ month: string; quantity: bigint }>>(Prisma.sql`
      SELECT DATE_FORMAT(u.createdAt, '%Y-%m') AS month, COUNT(*) AS quantity
      FROM \`User\` u WHERE u.createdAt >= ${from} AND u.createdAt < ${until}
      GROUP BY DATE_FORMAT(u.createdAt, '%Y-%m') ORDER BY month ASC
    `),
  ]);
  const counts = new Map(records.map(record => [record.month, Number(record.quantity)]));
  let cumulative = priorTotal;
  const series: Array<{ month: string; registrations: number; cumulative: number }> = [];
  for (let cursor = new Date(from); cursor < until; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    const month = cursor.toISOString().slice(0, 7);
    const registrations = counts.get(month) ?? 0;
    cumulative += registrations;
    series.push({ month, registrations, cumulative });
  }
  return { period, timezone: 'UTC', series,
    definition: 'Serie de altas reales por fecha de creación, agrupadas en meses UTC. Incluye meses sin altas como 0. El acumulado incluye registros anteriores al período. No representa sesiones, ingresos, clientes activos ni estados históricos. Las bajas lógicas permanecen contabilizadas como altas históricas.' };
}

export async function getAdminUserHistory(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new AppError(404, 'ADMIN_USER_NOT_FOUND', 'No encontramos este usuario.');
  const entries = await prisma.auditLog.findMany({
    where: { entityType: 'USER', entityId: userId }, orderBy: { createdAt: 'desc' }, take: 80,
    select: { id: true, action: true, reason: true, comment: true, createdAt: true, actor: { select: { displayName: true } } },
  });
  return { history: entries };
}

/** A reversible account decision. Suspension locks both Usuario and Business,
 * revokes active sessions, and preserves all business/catalogue records. */
export function validateAdminUserSessionReason(reason: string) {
  const valid = reason.trim();
  if (valid.length < 12 || valid.length > 500)
    throw new AppError(400, 'ADMIN_USER_REASON_REQUIRED', 'Indica un motivo de entre 12 y 500 caracteres.');
  return valid;
}

/** Revoke current sessions without suspending or changing the user's records. */
export async function revokeAdminUserSessions(userId: string, actorId: string, reasonText: string) {
  const reason = validateAdminUserSessionReason(reasonText);
  if (actorId === userId) throw new AppError(403, 'ADMIN_USER_SELF_MODIFICATION', 'No puedes cerrar tu propia sesión desde esta acción.');
  return prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({
      where: { id: userId }, select: { id: true, status: true, adminRoleAssignments: { where: { active: true }, select: { id: true } } },
    });
    if (!user) throw new AppError(404, 'ADMIN_USER_NOT_FOUND', 'No encontramos este usuario.');
    if (user.status === 'DELETED') throw new AppError(409, 'ADMIN_USER_DELETED', 'No puedes modificar una cuenta eliminada.');
    if (user.adminRoleAssignments.length) throw new AppError(403, 'ADMIN_USER_ROLE_PROTECTED', 'Las cuentas administrativas deben gestionarse desde Administradores.');
    const now = new Date();
    const [sessions, adminSessions] = await Promise.all([
      tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
      tx.adminSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    await tx.auditLog.create({
      data: {
        actorUserId: actorId, entityType: 'USER', entityId: userId, action: 'ADMIN_USER_SESSIONS_REVOKED',
        previousState: { activeSessionsClosed: sessions.count + adminSessions.count },
        newState: { activeSessions: 0 }, reason,
      },
    });
    await tx.platformNotification.create({
      data: {
        userId, sourceType: 'ACCOUNT_SECURITY', sourceId: userId,
        title: 'Se cerraron tus sesiones de XAMUKO',
        message: 'Por seguridad, un administrador cerró las sesiones de tu cuenta. Si necesitas aclaraciones, comunícate con soporte.',
      },
    });
    return { id: userId, sessionsRevoked: sessions.count + adminSessions.count,
      message: 'Sesiones cerradas en Usuarios y Business. La cuenta mantiene su estado y sus datos.' };
  });
}

export async function setAdminUserStatus(userId: string, actorId: string, actionText: string, reasonText: string) {
  const action = validateAdminUserStatusAction(actionText, reasonText);
  const reason = reasonText.trim();
  if (actorId === userId) throw new AppError(403, 'ADMIN_USER_SELF_MODIFICATION', 'No puedes modificar tu propia cuenta desde Admin.');
  return prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, displayName: true, adminRoleAssignments: { where: { active: true }, select: { role: true } } },
    });
    if (!user) throw new AppError(404, 'ADMIN_USER_NOT_FOUND', 'No encontramos este usuario.');
    if (user.adminRoleAssignments.length)
      throw new AppError(403, 'ADMIN_USER_ROLE_PROTECTED', 'No puedes suspender ni reactivar cuentas administrativas desde esta sección.');
    if (user.status === 'DELETED')
      throw new AppError(409, 'ADMIN_USER_DELETED', 'La cuenta eliminada no puede reactivarse desde esta sección.');
    const before = action === 'SUSPEND' ? 'ACTIVE' : 'SUSPENDED';
    const after = action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE';
    if (user.status !== before)
      throw new AppError(409, 'ADMIN_USER_STATE_CONFLICT', 'El estado actual no permite esta acción. Actualiza la ficha.');
    const updated = await tx.user.updateMany({ where: { id: userId, status: before, adminRoleAssignments: { none: { active: true } } }, data: { status: after } });
    if (updated.count !== 1)
      throw new AppError(409, 'ADMIN_USER_CONCURRENT_CHANGE', 'La cuenta cambió de estado. Actualiza e inténtalo nuevamente.');
    const now = new Date();
    if (action === 'SUSPEND') {
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.adminSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: actorId, entityType: 'USER', entityId: userId,
        action: action === 'SUSPEND' ? 'ADMIN_USER_SUSPENDED' : 'ADMIN_USER_RESTORED',
        previousState: { status: user.status }, newState: { status: after },
        reason,
      },
    });
    await tx.platformNotification.create({
      data: {
        userId, sourceType: 'ACCOUNT_STATUS', sourceId: userId,
        title: action === 'SUSPEND' ? 'Tu cuenta fue suspendida por XAMUKO' : 'Tu cuenta fue reactivada por XAMUKO',
        message: action === 'SUSPEND'
          ? 'El acceso a XAMUKO Usuarios y Business está suspendido temporalmente. Contacta a soporte para solicitar la revisión.'
          : 'Se levantó la suspensión de tu cuenta. Puedes volver a iniciar sesión en XAMUKO.',
      },
    });
    return { id: userId, status: after, message: action === 'SUSPEND'
      ? 'Cuenta suspendida en Usuarios y Business; sesiones revocadas. Se conservan los datos de negocios.'
      : 'Cuenta reactivada; la persona debe iniciar sesión nuevamente.' };
  });
}

export function deletionBlockers(input: { ownBusinesses: number; createdBusinesses: number; businessAccounts: number; adminRoles: number; pendingTransfers?: number }) {
  return [
    ...(input.ownBusinesses ? ['Tiene negocios con membresía de propietario vigente.'] : []),
    ...(input.createdBusinesses ? ['Figura como creador de negocios existentes.'] : []),
    ...(input.businessAccounts ? ['Tiene cuentas de negocio asociadas a su identidad.'] : []),
    ...(input.adminRoles ? ['Tiene un rol administrativo activo.'] : []),
    ...(input.pendingTransfers ? ['Tiene transferencias de propiedad pendientes.'] : []),
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
    const [owners, created, accounts, adminRoles, pendingTransfers] = await Promise.all([
      tx.businessMembership.count({ where: { userId, role: 'OWNER', status: 'ACTIVE', business: activeBusiness } }),
      tx.business.count({ where: { createdById: userId, ...activeBusiness } }),
      tx.businessAccount.count({ where: { createdById: userId, businesses: { some: activeBusiness } } }),
      tx.adminRoleAssignment.count({ where: { userId, active: true } }),
      tx.ownershipTransfer.count({ where: { status: 'PENDING', OR: [{ fromUserId: userId }, { toUserId: userId }] } }),
    ]);
    const blockers = deletionBlockers({ ownBusinesses: owners, createdBusinesses: created, businessAccounts: accounts, adminRoles, pendingTransfers });
    if (blockers.length) throw new AppError(409, 'ADMIN_USER_DEPENDENCIES', blockers.join(' '));
    const now = new Date();
    // Empty / historically deleted Business accounts must not keep the user active.
    await tx.businessAccount.updateMany({ where: { createdById: userId, businesses: { none: activeBusiness } }, data: { status: 'CLOSED' } });
    await tx.user.update({ where: { id: userId }, data: { status: 'DELETED' } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.adminSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.businessMembership.updateMany({ where: { userId, role: 'COLLABORATOR', status: { in: ['INVITED', 'ACTIVE', 'SUSPENDED'] } }, data: { status: 'REVOKED', revokedAt: now } });
    await tx.auditLog.create({
      data: { actorUserId: actorId, entityType: 'USER', entityId: userId, action: 'ADMIN_USER_DEACTIVATED',
        previousState: { status: user.status, displayName: user.displayName, emailNormalized: user.emailNormalized },
        newState: { status: 'DELETED' }, reason: justification },
    });
    return { id: userId, status: 'DELETED' as const, message: 'Cuenta desactivada en XAMUKO Usuarios y Business; sesiones revocadas y cuentas Business sin negocios activos cerradas. Se conservó la trazabilidad.' };
  });
}
