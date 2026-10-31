import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { isPhotoMissingError, photoMimeType, readPhoto } from './photo-storage.js';

const allowedPermissions = ['MANAGE_CATALOG', 'MANAGE_PROMOTIONS', 'READ_ANALYTICS', 'EDIT_BUSINESS'] as const;
type Permission = typeof allowedPermissions[number];
function normalizeNickname(value: string) {
  const normalized = value.trim().toLocaleLowerCase('en-US');
  if (!/^@?[a-z0-9._-]{3,30}$/.test(normalized)) throw new AppError(400, 'INVALID_NICKNAME', 'Escribe un nickname válido.');
  return normalized.startsWith('@') ? normalized : `@${normalized}`;
}
function validatedPermissions(values: string[]): Permission[] {
  const unique = [...new Set(values)];
  if (!unique.length) throw new AppError(400, 'PERMISSIONS_REQUIRED', 'Selecciona al menos un permiso.');
  if (unique.some(value => !(allowedPermissions as readonly string[]).includes(value))) throw new AppError(400, 'INVALID_PERMISSION', 'Uno o más permisos no son válidos.');
  return unique as Permission[];
}
async function owner(userId: string, businessId: string) {
  const m = await prisma.businessMembership.findUnique({ where: { businessId_userId: { businessId, userId } } });
  if (!m || m.role !== 'OWNER' || m.status !== 'ACTIVE') throw new AppError(403, 'OWNER_REQUIRED', 'Solo el propietario puede administrar colaboradores.');
  return m;
}
export async function listCollaborators(actorId: string, businessId: string) {
  await owner(actorId, businessId);
  const rows = await prisma.businessMembership.findMany({ where: { businessId }, include: { user: { select: { id: true, publicId: true, displayName: true, nickname: true, emailNormalized: true, avatarUrl: true, lastLoginAt: true } }, permissions: true }, orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] });
  const now = new Date();
  return rows.map(row => {
    const status = row.status === 'INVITED' && row.expiresAt && row.expiresAt <= now ? 'EXPIRED' as const : row.status;
    const canShowAvatar = status === 'ACTIVE' || status === 'SUSPENDED';
    const avatarUrl = canShowAvatar && row.user.avatarUrl?.startsWith('private-avatar:') ? `/api/v1/businesses/${businessId}/collaborators/${row.user.id}/avatar` : canShowAvatar ? row.user.avatarUrl : null;
    return { ...row, status, user: { ...row.user, avatarUrl } };
  });
}

export async function readCollaboratorAvatar(actorId: string, businessId: string, targetUserId: string) {
  await owner(actorId, businessId);
  const membership = await prisma.businessMembership.findUnique({ where: { businessId_userId: { businessId, userId: targetUserId } }, select: { status: true, user: { select: { avatarUrl: true } } } });
  const storageKey = membership?.status === 'ACTIVE' && membership.user.avatarUrl?.startsWith('private-avatar:') ? membership.user.avatarUrl.slice('private-avatar:'.length) : null;
  if (!storageKey || !/^user-avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(storageKey)) throw new AppError(404, 'AVATAR_NOT_FOUND', 'No encontramos la foto.');
  try { return { content: await readPhoto(storageKey), mimeType: photoMimeType(storageKey) }; }
  catch (error) { if (isPhotoMissingError(error)) throw new AppError(404, 'AVATAR_NOT_FOUND', 'No encontramos la foto.'); throw new AppError(503, 'PHOTO_STORAGE_UNAVAILABLE', 'No se pudo leer la foto.'); }
}
async function findCollaboratorRecipient(actorId: string, businessId: string, identifier: string) {
  await owner(actorId, businessId);
  const nickname = normalizeNickname(identifier);
  const recipient = await prisma.user.findUnique({ where: { nickname }, select: { id: true, publicId: true, displayName: true, nickname: true, avatarUrl: true } });
  if (!recipient) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado.');
  if (recipient.id === actorId) throw new AppError(400, 'SELF_INVITATION', 'No puedes invitarte a ti mismo.');
  const existing = await prisma.businessMembership.findUnique({ where: { businessId_userId: { businessId, userId: recipient.id } } });
  if (existing?.status === 'ACTIVE' || existing?.status === 'SUSPENDED') throw new AppError(409, 'ALREADY_MEMBER', 'Esta persona ya tiene acceso.');
  if (existing?.status === 'INVITED' && existing.expiresAt && existing.expiresAt > new Date()) throw new AppError(409, 'INVITATION_EXISTS', 'Ya existe una invitación pendiente.');
  return recipient;
}
export async function resolveCollaboratorRecipient(actorId: string, businessId: string, identifier: string) {
  const { id: _id, ...publicRecipient } = await findCollaboratorRecipient(actorId, businessId, identifier);
  return publicRecipient;
}
export async function inviteCollaborator(actorId: string, businessId: string, identifier: string, requestedPermissions: string[]) {
  const permissions = validatedPermissions(requestedPermissions);
  const recipient = await findCollaboratorRecipient(actorId, businessId, identifier);
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
  if (!business) throw new AppError(404, 'BUSINESS_NOT_FOUND', 'No encontramos ese negocio.');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const membership = await prisma.$transaction(async tx => {
    const existing = await tx.businessMembership.findUnique({ where: { businessId_userId: { businessId, userId: recipient.id } } });
    if (existing?.status === 'ACTIVE' || existing?.status === 'SUSPENDED') throw new AppError(409, 'ALREADY_MEMBER', 'Esta persona ya tiene acceso.');
    if (existing?.status === 'INVITED' && existing.expiresAt && existing.expiresAt > new Date()) throw new AppError(409, 'INVITATION_EXISTS', 'Ya existe una invitación pendiente.');
    const m = existing ? await tx.businessMembership.update({ where: { id: existing.id }, data: { role: 'COLLABORATOR', status: 'INVITED', invitedAt: new Date(), acceptedAt: null, revokedAt: null, expiresAt } }) : await tx.businessMembership.create({ data: { businessId, userId: recipient.id, role: 'COLLABORATOR', status: 'INVITED', expiresAt } });
    await tx.businessMembershipPermission.deleteMany({ where: { membershipId: m.id } });
    await tx.businessMembershipPermission.createMany({ data: permissions.map(permission => ({ membershipId: m.id, permission, allowed: true })) });
    await tx.businessNotification.updateMany({ where: { membershipId: m.id, type: 'COLLABORATION_INVITATION', readAt: null }, data: { readAt: new Date() } });
    await tx.businessNotification.create({ data: { userId: recipient.id, businessId, membershipId: m.id, type: 'COLLABORATION_INVITATION', title: 'Invitación para colaborar', message: `${business.name} te ha invitado a colaborar en su establecimiento.` } });
    await tx.auditLog.create({ data: { actorUserId: actorId, entityType: 'MEMBERSHIP', entityId: m.id, action: 'COLLABORATOR_INVITED', newState: { businessId, recipientUserId: recipient.id, status: 'INVITED', expiresAt: expiresAt.toISOString(), permissions } } });
    return m;
  });
  return membership;
}
async function respond(actorId: string, membershipId: string, status: 'ACTIVE'|'REJECTED') {
  const membership = await prisma.businessMembership.findUnique({ where: { id: membershipId }, include: { user: { select: { displayName: true } }, business: { select: { name: true, memberships: { where: { role: 'OWNER', status: 'ACTIVE' }, select: { userId: true }, take: 1 } } } } });
  if (!membership || membership.userId !== actorId) throw new AppError(404, 'INVITATION_UNAVAILABLE', 'La invitación no está disponible.');
  if (membership.status !== 'INVITED') throw new AppError(409, 'INVITATION_ALREADY_RESOLVED', 'La invitación ya fue procesada.');
  if (!membership.expiresAt || membership.expiresAt <= new Date()) throw new AppError(410, 'INVITATION_EXPIRED', 'La invitación ha vencido.');
  const ownerUserId = membership.business.memberships[0]?.userId;
  if (!ownerUserId) throw new AppError(409, 'BUSINESS_OWNER_NOT_FOUND', 'No fue posible identificar al propietario del negocio.');
  const now = new Date();
  return prisma.$transaction(async tx => {
    const result = await tx.businessMembership.updateMany({ where: { id: membership.id, userId: actorId, status: 'INVITED', expiresAt: { gt: now } }, data: { status, acceptedAt: status === 'ACTIVE' ? now : null, expiresAt: null } });
    if (result.count !== 1) throw new AppError(409, 'INVITATION_ALREADY_RESOLVED', 'La invitación ya fue procesada.');
    await tx.businessNotification.updateMany({ where: { membershipId: membership.id, userId: actorId, type: 'COLLABORATION_INVITATION', readAt: null }, data: { readAt: now } });
    await tx.businessNotification.create({ data: { userId: ownerUserId, businessId: membership.businessId, membershipId: membership.id, type: 'COLLABORATION_UPDATE', title: status === 'ACTIVE' ? 'Invitación aceptada' : 'Invitación rechazada', message: `${membership.user.displayName} ${status === 'ACTIVE' ? 'aceptó' : 'rechazó'} tu invitación para colaborar en ${membership.business.name}.` } });
    await tx.auditLog.create({ data: { actorUserId: actorId, entityType: 'MEMBERSHIP', entityId: membership.id, action: status === 'ACTIVE' ? 'INVITATION_ACCEPTED' : 'INVITATION_REJECTED', previousState: { status: 'INVITED' }, newState: { status, businessId: membership.businessId } } });
    return tx.businessMembership.findUniqueOrThrow({ where: { id: membership.id }, include: { permissions: true } });
  });
}
export const acceptInvitation = (userId: string, id: string) => respond(userId, id, 'ACTIVE');
export const rejectInvitation = (userId: string, id: string) => respond(userId, id, 'REJECTED');
async function changeByOwner(userId: string, id: string, status: 'ACTIVE'|'SUSPENDED'|'REVOKED', action: string, allowedCurrent: Array<'ACTIVE'|'SUSPENDED'>) {
  const m = await prisma.businessMembership.findUnique({ where: { id }, include: { business: { select: { name: true } } } }); if (!m) throw new AppError(404, 'MEMBERSHIP_NOT_FOUND', 'Membresía no encontrada.');
  await owner(userId, m.businessId); if (m.role === 'OWNER') throw new AppError(400, 'OWNER_PROTECTED', 'El propietario no se puede modificar.');
  if (!allowedCurrent.includes(m.status as 'ACTIVE'|'SUSPENDED')) throw new AppError(409, 'MEMBERSHIP_STATE_INVALID', 'La membresía no se encuentra en un estado válido para esta acción.');
  return prisma.$transaction(async tx => {
    const changed = await tx.businessMembership.updateMany({ where: { id, status: { in: allowedCurrent } }, data: { status, expiresAt: null, revokedAt: status === 'REVOKED' ? new Date() : null } });
    if (changed.count !== 1) throw new AppError(409, 'MEMBERSHIP_STATE_INVALID', 'La membresía cambió de estado. Actualiza la página e inténtalo nuevamente.');
    const title = status === 'SUSPENDED' ? 'Acceso suspendido' : status === 'ACTIVE' ? 'Acceso reactivado' : 'Acceso revocado';
    const description = status === 'SUSPENDED' ? 'El propietario suspendió temporalmente tu acceso' : status === 'ACTIVE' ? 'El propietario reactivó tu acceso' : 'El propietario revocó tu acceso';
    await tx.businessNotification.create({ data: { userId: m.userId, businessId: m.businessId, membershipId: id, type: 'COLLABORATION_UPDATE', title, message: `${description} a ${m.business.name}.` } });
    await tx.auditLog.create({ data: { actorUserId: userId, entityType: 'MEMBERSHIP', entityId: id, action, previousState: { status: m.status }, newState: { status, businessId: m.businessId } } });
    return tx.businessMembership.findUniqueOrThrow({ where: { id }, include: { permissions: true } });
  });
}
export const suspendCollaborator = (userId: string, id: string) => changeByOwner(userId, id, 'SUSPENDED', 'COLLABORATOR_SUSPENDED', ['ACTIVE']);
export const reactivateCollaborator = (userId: string, id: string) => changeByOwner(userId, id, 'ACTIVE', 'COLLABORATOR_REACTIVATED', ['SUSPENDED']);
export const revokeCollaborator = (userId: string, id: string) => changeByOwner(userId, id, 'REVOKED', 'COLLABORATOR_REVOKED', ['ACTIVE', 'SUSPENDED']);
export async function cancelInvitation(userId: string, id: string) {
  const membership = await prisma.businessMembership.findUnique({ where: { id } });
  if (!membership) throw new AppError(404, 'MEMBERSHIP_NOT_FOUND', 'Membresía no encontrada.');
  await owner(userId, membership.businessId);
  if (membership.role === 'OWNER') throw new AppError(400, 'OWNER_PROTECTED', 'El propietario no se puede modificar.');
  if (membership.status !== 'INVITED') throw new AppError(409, 'INVITATION_ALREADY_RESOLVED', 'La invitación ya fue procesada.');
  const now = new Date();
  return prisma.$transaction(async tx => {
    const updated = await tx.businessMembership.update({ where: { id }, data: { status: 'REVOKED', expiresAt: null, revokedAt: now } });
    await tx.businessNotification.updateMany({ where: { membershipId: id, type: 'COLLABORATION_INVITATION', readAt: null }, data: { readAt: now } });
    const business = await tx.business.findUniqueOrThrow({ where: { id: membership.businessId }, select: { name: true } });
    await tx.businessNotification.create({ data: { userId: membership.userId, businessId: membership.businessId, membershipId: id, type: 'COLLABORATION_UPDATE', title: 'Invitación cancelada', message: `El propietario canceló tu invitación para colaborar en ${business.name}.` } });
    await tx.auditLog.create({ data: { actorUserId: userId, entityType: 'MEMBERSHIP', entityId: id, action: 'INVITATION_CANCELLED', previousState: { status: membership.status }, newState: { status: 'REVOKED', businessId: membership.businessId } } });
    return updated;
  });
}
export async function leaveBusiness(userId: string, businessId: string) {
  const membership = await prisma.businessMembership.findUnique({ where: { businessId_userId: { businessId, userId } }, include: { user: { select: { displayName: true } }, business: { select: { name: true, memberships: { where: { role: 'OWNER', status: 'ACTIVE' }, select: { userId: true }, take: 1 } } } } });
  if (!membership || membership.role === 'OWNER') throw new AppError(403, 'OWNER_PROTECTED', 'El propietario no puede abandonar el negocio.');
  if (membership.status !== 'ACTIVE') throw new AppError(409, 'MEMBERSHIP_STATE_INVALID', 'Solo un colaborador activo puede abandonar el negocio.');
  return prisma.$transaction(async tx => {
    const now = new Date();
    const changed = await tx.businessMembership.updateMany({ where: { id: membership.id, userId, role: 'COLLABORATOR', status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: now } });
    if (changed.count !== 1) throw new AppError(409, 'MEMBERSHIP_STATE_INVALID', 'La membresía cambió de estado.');
    await tx.businessMembershipPermission.deleteMany({ where: { membershipId: membership.id } });
    const ownerUserId = membership.business.memberships[0]?.userId;
    if (ownerUserId) await tx.businessNotification.create({ data: { userId: ownerUserId, businessId, membershipId: membership.id, type: 'COLLABORATION_UPDATE', title: 'Colaborador retirado', message: `${membership.user.displayName} dejó de colaborar en ${membership.business.name}.` } });
    await tx.auditLog.create({ data: { actorUserId: userId, entityType: 'MEMBERSHIP', entityId: membership.id, action: 'COLLABORATOR_LEFT', previousState: { status: 'ACTIVE' }, newState: { status: 'REVOKED', businessId } } });
    return tx.businessMembership.findUniqueOrThrow({ where: { id: membership.id } });
  });
}
export async function setPermissions(userId: string, id: string, values: string[]) {
  const permissions = validatedPermissions(values);
  const membership = await prisma.businessMembership.findUnique({ where: { id }, include: { permissions: true, business: { select: { name: true } } } });
  if (!membership) throw new AppError(404, 'MEMBERSHIP_NOT_FOUND', 'Membresía no encontrada.');
  await owner(userId, membership.businessId);
  if (membership.role === 'OWNER') throw new AppError(400, 'OWNER_PROTECTED', 'El propietario conserva todos los permisos.');
  const previousPermissions = membership.permissions.filter(item => item.allowed).map(item => item.permission).sort();
  const nextPermissions = [...permissions].sort();
  const changed = previousPermissions.length !== nextPermissions.length || previousPermissions.some((permission, index) => permission !== nextPermissions[index]);
  await prisma.$transaction(async tx => {
    await tx.businessMembershipPermission.deleteMany({ where: { membershipId: id } });
    await tx.businessMembershipPermission.createMany({ data: permissions.map(permission => ({ membershipId: id, permission, allowed: true })) });
    if (changed) {
      const labels: Record<Permission, string> = { MANAGE_CATALOG: 'Productos y servicios', MANAGE_PROMOTIONS: 'Promociones', READ_ANALYTICS: 'Estadísticas', EDIT_BUSINESS: 'Información del negocio' };
      const permissionText = permissions.map(permission => labels[permission]).join(', ');
      await tx.businessNotification.create({ data: { userId: membership.userId, businessId: membership.businessId, membershipId: id, type: 'COLLABORATION_UPDATE', title: 'Permisos actualizados', message: `El propietario actualizó tus permisos en ${membership.business.name}: ${permissionText}.` } });
    }
    await tx.auditLog.create({ data: { actorUserId: userId, entityType: 'MEMBERSHIP', entityId: id, action: 'COLLABORATOR_PERMISSIONS_UPDATED', previousState: { businessId: membership.businessId, permissions: previousPermissions }, newState: { businessId: membership.businessId, permissions } } });
  });
  return { ok: true };
}
export async function listNotifications(userId: string) {
  const rows = await prisma.businessNotification.findMany({
    where: { userId },
    include: {
      business: { select: { id: true, name: true, profilePhoto: { select: { id: true } }, memberships: { where: { role: 'OWNER', status: 'ACTIVE' }, select: { user: { select: { displayName: true } } }, take: 1 } } },
      membership: { select: { id: true, status: true, expiresAt: true, permissions: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const now = new Date();
  return rows.map(row => ({
    ...row,
    business: { ...row.business, profilePhoto: row.business.profilePhoto ? { url: `/api/v1/businesses/${row.business.id}/photos/${row.business.profilePhoto.id}/content` } : null },
    ...(row.membership?.status === 'INVITED' && row.membership.expiresAt && row.membership.expiresAt <= now
      ? { membership: { ...row.membership, status: 'EXPIRED' as const } }
      : {}),
  }));
}
export async function markNotificationRead(userId: string,id:string) { const notification=await prisma.businessNotification.findFirst({where:{id,userId},select:{id:true,readAt:true}});if(!notification)throw new AppError(404,'NOTIFICATION_NOT_FOUND','Notificación no encontrada.');if(!notification.readAt)await prisma.businessNotification.update({where:{id},data:{readAt:new Date()}});return {ok:true}; }
