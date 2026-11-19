import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

/** The global Admin audit and each business record read the very same AuditLog rows.
 * No duplicate event is created for the second view. */
const actionsByKind = {
  ALL: [
    'ADMIN_BUSINESS_SET_VISIBLE', 'ADMIN_BUSINESS_SET_HIDDEN',
    'ADMIN_BUSINESS_SUSPEND', 'ADMIN_BUSINESS_HIDE', 'ADMIN_BUSINESS_RESTORE',
    'BUSINESS_VISIBILITY_SET_VISIBLE', 'BUSINESS_VISIBILITY_SET_HIDDEN',
    'BUSINESS_VISIBILITY_RENEWED', 'BUSINESS_VISIBILITY_RESTORED',
    'ADMIN_BUSINESS_VERIFIED_MANUALLY', 'ADMIN_BUSINESS_UNVERIFIED_MANUALLY',
    'ADMIN_BUSINESS_PLAN_CHANGED',
  ],
  VISIBLE: ['ADMIN_BUSINESS_SET_VISIBLE', 'BUSINESS_VISIBILITY_SET_VISIBLE', 'BUSINESS_VISIBILITY_RESTORED'],
  HIDDEN: ['ADMIN_BUSINESS_SET_HIDDEN', 'ADMIN_BUSINESS_HIDE', 'BUSINESS_VISIBILITY_SET_HIDDEN'],
  SUSPENDED: ['ADMIN_BUSINESS_SUSPEND'],
  RESTORED: ['ADMIN_BUSINESS_RESTORE'],
  RENEWED: ['BUSINESS_VISIBILITY_RENEWED'],
  VERIFIED: ['ADMIN_BUSINESS_VERIFIED_MANUALLY'],
  UNVERIFIED: ['ADMIN_BUSINESS_UNVERIFIED_MANUALLY'],
  SUBSCRIPTION: ['ADMIN_BUSINESS_PLAN_CHANGED'],
} as const;

export type VisibilityAuditKind = keyof typeof actionsByKind;

function safeState(value: Prisma.JsonValue) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value)
    .filter(([key, entry]) =>
      ['visibilityStatus', 'administrativeRestriction', 'verificationStatus', 'plan'].includes(key) &&
      (entry === null || typeof entry === 'string'))) as Record<string, string | null>;
}

export async function listAdminVisibilityAudit(query: {
  page: number; kind: string; search: string;
}) {
  const page = Number.isInteger(query.page) ? Math.min(100000, Math.max(1, query.page)) : 1;
  const kind = (query.kind.trim() || 'ALL').toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(actionsByKind, kind))
    throw new AppError(400, 'ADMIN_AUDIT_FILTER_INVALID', 'Selecciona un filtro de auditoría válido.');
  const search = query.search.trim();
  if (search.length > 100)
    throw new AppError(400, 'ADMIN_AUDIT_SEARCH_TOO_LONG', 'La búsqueda no puede superar 100 caracteres.');
  const pageSize = 15;

  // AuditLog is polymorphic; resolve matching businesses without relying on a
  // relation that does not exist in the schema. The unfiltered query stays indexed.
  const matches = search
    ? await prisma.business.findMany({
        where: { OR: [{ name: { contains: search } }, { publicId: { contains: search } }] },
        select: { id: true },
      })
    : null;

  const where: Prisma.AuditLogWhereInput = {
    entityType: 'BUSINESS',
    action: { in: [...actionsByKind[kind as VisibilityAuditKind]] },
    ...(matches ? { entityId: { in: matches.map(business => business.id) } } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize, skip: (page - 1) * pageSize,
      select: {
        id: true, entityId: true, action: true, previousState: true, newState: true,
        reason: true, comment: true, createdAt: true,
        actor: { select: { displayName: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  const businesses = await prisma.business.findMany({
    where: { id: { in: [...new Set(rows.map(row => row.entityId))] } },
    select: { id: true, name: true, publicId: true },
  });
  const byId = new Map(businesses.map(business => [business.id, business]));
  return {
    entries: rows.map(row => ({
      id: row.id, entityId: row.entityId, action: row.action,
      previousState: safeState(row.previousState), newState: safeState(row.newState),
      reason: row.reason, comment: row.comment, createdAt: row.createdAt,
      actor: row.actor, business: byId.get(row.entityId) ?? null,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

/**
 * Security-access audit: expose only an explicit allowlist of fields.
 * Never return AuditLog JSON payloads, token material or user identifiers.
 */
const securityActionGroups = {
  ALL: ['ADMIN_ROLE_ASSIGNED', 'ADMIN_ROLE_REVOKED', 'ADMIN_PERMISSION_GRANTED', 'ADMIN_PERMISSION_REVOKED', 'FINANCE_PERMISSION_GRANTED', 'FINANCE_PERMISSION_REVOKED'],
  ROLE: ['ADMIN_ROLE_ASSIGNED', 'ADMIN_ROLE_REVOKED'],
  PERMISSION: ['ADMIN_PERMISSION_GRANTED', 'ADMIN_PERMISSION_REVOKED', 'FINANCE_PERMISSION_GRANTED', 'FINANCE_PERMISSION_REVOKED'],
} as const;
function safeSecurityPayload(state: Prisma.JsonValue) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
  const userId = typeof state.userId === 'string' ? state.userId : null;
  const role = state.role === 'ADMIN' || state.role === 'SUPER_ADMIN' ? state.role : null;
  const permission = typeof state.permission === 'string' &&
    ['BUSINESSES_READ', 'CATALOG_READ', 'REPORTS_REVIEW', 'CONTENT_MODERATE', 'AUDIT_READ', 'ADMINS_MANAGE', 'PIONEER_MANAGE', 'FINANCE_READ', 'FINANCE_MANAGE'].includes(state.permission)
    ? state.permission : null;
  return { userId, role, permission };
}
export async function listAdminSecurityAudit(query: { page: number; kind: string }) {
  const kind = (query.kind.trim() || 'ALL').toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(securityActionGroups, kind))
    throw new AppError(400, 'ADMIN_AUDIT_FILTER_INVALID', 'Selecciona un tipo de actuación válido.');
  const page = Number.isInteger(query.page) ? Math.max(1, Math.min(100000, query.page)) : 1;
  const pageSize = 15;
  const where: Prisma.AuditLogWhereInput = {
    entityType: 'ADMIN_SECURITY',
    action: { in: [...securityActionGroups[kind as keyof typeof securityActionGroups]] },
  };
  const [rows, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize, skip: (page - 1) * pageSize,
      select: { id: true, action: true, reason: true, createdAt: true, newState: true, previousState: true,
        actor: { select: { displayName: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  const normalized = rows.map(row => ({
    row, payload: safeSecurityPayload(row.newState) ?? safeSecurityPayload(row.previousState),
  }));
  const targets = await prisma.user.findMany({
    where: { id: { in: [...new Set(normalized.map(item => item.payload?.userId).filter((id): id is string => Boolean(id)))] } },
    select: { id: true, displayName: true },
  });
  const byId = new Map(targets.map(target => [target.id, target.displayName]));
  return {
    entries: normalized.map(({ row, payload }) => ({
      id: row.id, action: row.action, reason: row.reason, createdAt: row.createdAt,
      actor: row.actor?.displayName ?? null,
      subject: payload?.userId ? byId.get(payload.userId) ?? 'Cuenta no disponible' : 'Cuenta no disponible',
      role: payload?.role ?? null, permission: payload?.permission ?? null,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
