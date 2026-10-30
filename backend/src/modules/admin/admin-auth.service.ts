import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { AuthenticatedRequest } from '../../shared/auth/auth-request.js';

export const adminPermissions = ['BUSINESSES_READ', 'CATALOG_READ', 'REPORTS_REVIEW', 'CONTENT_MODERATE', 'AUDIT_READ', 'ADMINS_MANAGE', 'PIONEER_MANAGE'] as const;
export type AdminPermission = typeof adminPermissions[number] | 'FINANCE_READ' | 'FINANCE_MANAGE';
export type AdminRole = 'ADMIN' | 'SUPER_ADMIN';
type Db = PrismaClient | Prisma.TransactionClient;

export type AdminContext = { userId: string; role: AdminRole; permissions: AdminPermission[] };

export async function getAdminContext(userId: string, db: Db = prisma): Promise<AdminContext | null> {
  const assignments = await db.adminRoleAssignment.findMany({ where: { userId, active: true }, orderBy: { createdAt: 'desc' } });
  if (!assignments.length) return null;
  const role: AdminRole = assignments.some(item => item.role === 'SUPER_ADMIN') ? 'SUPER_ADMIN' : 'ADMIN';
  const grants = await db.adminPermissionGrant.findMany({ where: { userId, granted: true, revokedAt: null }, select: { permission: true } });
  const financeGrants = await db.financialPermissionGrant?.findMany({ where: { userId, granted: true, revokedAt: null }, select: { permission: true } }) ?? [];
  const permissions = role === 'SUPER_ADMIN' ? [...adminPermissions, 'FINANCE_READ', 'FINANCE_MANAGE'] : [...grants.map(item => item.permission as AdminPermission), ...financeGrants.map(item => item.permission as AdminPermission)];
  return { userId, role, permissions: [...new Set(permissions)] as AdminPermission[] };
}

export function requireAdmin(_permission?: AdminPermission) {
  return (_request: any, _response: any, next: any) => {
    next(new AppError(403, 'ADMIN_SECOND_FACTOR_REQUIRED', 'El acceso administrativo requiere una sesión con segundo factor verificado.'));
  };
}

export function adminFromRequest(request: any): AdminContext {
  if (!request.admin) throw new AppError(403, 'ADMIN_ACCESS_DENIED', 'No tienes acceso administrativo.');
  return request.admin as AdminContext;
}

export async function adminSession(userId: string) {
  const context = await getAdminContext(userId);
  if (!context) throw new AppError(403, 'ADMIN_ACCESS_DENIED', 'No tienes acceso administrativo.');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, publicId: true, displayName: true, emailNormalized: true, avatarUrl: true, locale: true } });
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Autenticación requerida.');
  const privateAvatarKey = user.avatarUrl?.startsWith('private-avatar:') ? user.avatarUrl.slice('private-avatar:'.length) : null;
  const avatarVersion = privateAvatarKey?.split('/').at(-1)?.replace(/\.(jpg|png|webp)$/i, '');
  return { user: { ...user, avatarUrl: privateAvatarKey ? `/api/v1/auth/me/avatar?v=${encodeURIComponent(avatarVersion ?? privateAvatarKey)}` : user.avatarUrl }, role: context.role, permissions: context.permissions };
}

async function audit(userId: string, action: string, entityId: string, previousState: unknown, newState: unknown, reason?: string) {
  await prisma.auditLog.create({ data: { actorUserId: userId, entityType: 'ADMIN_SECURITY', entityId, action, previousState: previousState === null ? Prisma.JsonNull : previousState as Prisma.InputJsonValue, newState: newState === null ? Prisma.JsonNull : newState as Prisma.InputJsonValue, reason: reason?.trim() || null } });
}

function assertSuperAdmin(context: AdminContext) { if (context.role !== 'SUPER_ADMIN') throw new AppError(403, 'ADMIN_PERMISSION_DENIED', 'Solo SUPER_ADMIN puede gestionar administradores.'); }

export async function listAdministrators(context: AdminContext) {
  if (!context.permissions.includes('ADMINS_MANAGE')) throw new AppError(403, 'ADMIN_PERMISSION_DENIED', 'No tienes permisos para gestionar administradores.');
  const users = await prisma.user.findMany({ where: { adminRoleAssignments: { some: {} } }, select: { id: true, publicId: true, displayName: true, emailNormalized: true, status: true, adminRoleAssignments: { select: { id: true, role: true, active: true, assignedById: true, createdAt: true, revokedAt: true } }, adminPermissionGrants: { where: { revokedAt: null }, select: { permission: true, granted: true } } }, orderBy: { displayName: 'asc' } });
  return users;
}

export async function assignRole(context: AdminContext, targetUserId: string, role: AdminRole, reason: string) {
  assertSuperAdmin(context);
  if (targetUserId === context.userId) throw new AppError(409, 'ADMIN_SELF_ESCALATION', 'No puedes asignarte o modificar tu propio rol.');
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, status: true } });
  if (!target || target.status !== 'ACTIVE') throw new AppError(404, 'USER_NOT_FOUND', 'No encontramos una cuenta activa con ese identificador.');
  const assignment = await prisma.adminRoleAssignment.upsert({ where: { userId_role: { userId: targetUserId, role } }, create: { userId: targetUserId, role, assignedById: context.userId }, update: { active: true, revokedAt: null, assignedById: context.userId } });
  await audit(context.userId, 'ADMIN_ROLE_ASSIGNED', assignment.id, null, { userId: targetUserId, role }, reason);
  return assignment;
}

export async function revokeRole(context: AdminContext, targetUserId: string, role: AdminRole, reason: string) {
  assertSuperAdmin(context);
  if (targetUserId === context.userId) throw new AppError(409, 'ADMIN_SELF_ESCALATION', 'No puedes revocarte tu propio acceso.');
  const assignment = await prisma.adminRoleAssignment.findUnique({ where: { userId_role: { userId: targetUserId, role } } });
  if (!assignment || !assignment.active) throw new AppError(404, 'ADMIN_ROLE_NOT_FOUND', 'El rol administrativo no está activo.');
  const updated = await prisma.adminRoleAssignment.update({ where: { id: assignment.id }, data: { active: false, revokedAt: new Date() } });
  await audit(context.userId, 'ADMIN_ROLE_REVOKED', updated.id, { userId: targetUserId, role, active: true }, { userId: targetUserId, role, active: false }, reason);
  return updated;
}

export async function setPermission(context: AdminContext, targetUserId: string, permission: AdminPermission, granted: boolean, reason: string) {
  assertSuperAdmin(context);
  if (targetUserId === context.userId) throw new AppError(409, 'ADMIN_SELF_ESCALATION', 'No puedes cambiar tus propios permisos.');
  if (permission === 'FINANCE_READ' || permission === 'FINANCE_MANAGE') {
    const grant = await prisma.financialPermissionGrant.upsert({ where: { userId_permission: { userId: targetUserId, permission } }, create: { userId: targetUserId, permission, granted, grantedById: context.userId, revokedAt: granted ? null : new Date() }, update: { granted, revokedAt: granted ? null : new Date(), grantedById: context.userId } });
    await audit(context.userId, granted ? 'FINANCE_PERMISSION_GRANTED' : 'FINANCE_PERMISSION_REVOKED', grant.id, null, { userId: targetUserId, permission, granted }, reason);
    return grant;
  }
  const grant = await prisma.adminPermissionGrant.upsert({ where: { userId_permission: { userId: targetUserId, permission } }, create: { userId: targetUserId, permission, granted, grantedById: context.userId, revokedAt: granted ? null : new Date() }, update: { granted, revokedAt: granted ? null : new Date(), grantedById: context.userId } });
  await audit(context.userId, granted ? 'ADMIN_PERMISSION_GRANTED' : 'ADMIN_PERMISSION_REVOKED', grant.id, null, { userId: targetUserId, permission, granted }, reason);
  return grant;
}
