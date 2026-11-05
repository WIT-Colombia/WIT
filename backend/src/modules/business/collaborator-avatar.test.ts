import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { readCollaboratorAvatar, readCollaboratorRecipientAvatar, resolveCollaboratorRecipient } from './collaborator.service.js';

const actorId = 'owner-user';
const businessId = 'business-1';
const privateAvatar = 'private-avatar:user-avatars/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg';
const ownerMembership = { role: 'OWNER', status: 'ACTIVE' };

function stub(model: any, method: string, implementation: (...args: any[]) => unknown) {
  const original = model[method];
  model[method] = implementation;
  return () => { model[method] = original; };
}

async function withLookups(user: any, existing: any = null, callback: () => Promise<void>) {
  const restoreMembership = stub(prisma.businessMembership, 'findUnique', async ({ where }: any) => where.businessId_userId.userId === actorId ? ownerMembership : existing);
  const restoreUser = stub(prisma.user, 'findUnique', async () => user);
  try { await callback(); } finally { restoreMembership(); restoreUser(); }
}

test('normaliza el avatar privado de una persona con acceso sin exponer la clave', async () => {
  const user = { id: 'user-2', publicId: 'public-2', displayName: 'Danilo Jaramillo', nickname: '@danilo.jaramillo', status: 'ACTIVE', avatarUrl: privateAvatar };
  await withLookups(user, null, async () => {
    const result = await resolveCollaboratorRecipient(actorId, businessId, '@danilo.jaramillo');
    assert.equal(result.publicId, user.publicId);
    assert.match(result.avatarUrl ?? '', /\/businesses\/business-1\/collaborators\/recipient\/public-2\/avatar\?token=/);
    assert.equal(result.avatarUrl?.includes('private-avatar:'), false);
    await assert.rejects(
      readCollaboratorRecipientAvatar(actorId, businessId, user.publicId, 'invalid-preview-token'),
      (error: unknown) => error instanceof AppError && error.statusCode === 403,
    );
    await assert.rejects(
      readCollaboratorRecipientAvatar(actorId, businessId, user.publicId, new URL(`http://local${result.avatarUrl}`).searchParams.get('token') ?? ''),
      (error: unknown) => error instanceof AppError && error.statusCode === 404,
    );
  });
});

test('conserva una URL pública y no fabrica URL cuando no hay fotografía', async () => {
  await withLookups({ id: 'user-2', publicId: 'public-2', displayName: 'Publica', nickname: '@publica', avatarUrl: 'https://images.example/avatar.jpg' }, null, async () => {
    const result = await resolveCollaboratorRecipient(actorId, businessId, '@publica');
    assert.equal(result.avatarUrl, 'https://images.example/avatar.jpg');
  });
  await withLookups({ id: 'user-3', publicId: 'public-3', displayName: 'Sin Foto', nickname: '@sin.foto', avatarUrl: null }, null, async () => {
    const result = await resolveCollaboratorRecipient(actorId, businessId, '@sin.foto');
    assert.equal(result.avatarUrl, null);
  });
});

test('la ruta de miembros sólo permite fotos del negocio a su propietario', async () => {
  const restoreMembership = stub(prisma.businessMembership, 'findUnique', async () => null);
  try {
    await assert.rejects(readCollaboratorAvatar('otro-usuario', businessId, 'user-2'), (error: unknown) => error instanceof AppError && error.statusCode === 403);
  } finally { restoreMembership(); }
});

test('la ruta protegida devuelve 404 controlado si la fotografía ya no existe', async () => {
  const membership = { status: 'ACTIVE', user: { avatarUrl: privateAvatar } };
  await withLookups({ id: 'user-2', publicId: 'public-2', displayName: 'Danilo', nickname: '@danilo.jaramillo', avatarUrl: privateAvatar }, membership, async () => {
    await assert.rejects(readCollaboratorAvatar(actorId, businessId, 'user-2'), (error: unknown) => error instanceof AppError && error.statusCode === 404);
  });
});
