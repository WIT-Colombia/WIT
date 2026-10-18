import { prisma } from '../src/config/prisma.js';

const userId = process.env.ADMIN_BOOTSTRAP_USER_ID?.trim();
const confirmation = process.env.ADMIN_BOOTSTRAP_CONFIRM;
if (!userId || confirmation !== 'I_UNDERSTAND') {
  throw new Error('Requiere ADMIN_BOOTSTRAP_USER_ID y ADMIN_BOOTSTRAP_CONFIRM=I_UNDERSTAND. No se asignó ningún rol.');
}

const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true, displayName: true } });
if (!user || user.status !== 'ACTIVE') throw new Error('La cuenta indicada no existe o no está activa.');

await prisma.$transaction(async (tx) => {
  const assignment = await tx.adminRoleAssignment.upsert({ where: { userId_role: { userId, role: 'SUPER_ADMIN' } }, create: { userId, role: 'SUPER_ADMIN', active: true }, update: { active: true, revokedAt: null } });
  await tx.auditLog.create({ data: { entityType: 'ADMIN_SECURITY', entityId: assignment.id, action: 'ADMIN_BOOTSTRAPPED', previousState: null, newState: { userId, role: 'SUPER_ADMIN' }, reason: 'Asignación inicial controlada por el entorno de despliegue.' } });
});
console.log(`SUPER_ADMIN asignado a la cuenta ${user.displayName} (${user.id}).`);
await prisma.$disconnect();
