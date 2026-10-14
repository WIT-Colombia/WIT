import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccessToken } from '../auth/tokens.js';
import { prisma } from '../../config/prisma.js';
import { requireAuth } from './require-auth.js';
import { AppError } from '../errors/app-error.js';

function request(authorization?: string) {
  const headers: Record<string, string> = authorization ? { authorization } : {};
  const read = (name: string) => headers[name.toLowerCase()] ?? headers[name];
  return { header: read, get: read } as any;
}

async function token(userId = 'user-1', sessionId = 'session-1') {
  return createAccessToken({ userId, sessionId });
}

async function runWithDatabase(session: any, user: any, authorization: string) {
  const sessionFind = (prisma.session as any).findUnique;
  const userFind = (prisma.user as any).findUnique;
  (prisma.session as any).findUnique = async () => session;
  (prisma.user as any).findUnique = async () => user;
  try {
    let received: unknown;
    let continued = false;
    await requireAuth(request(authorization), {} as any, (error) => { received = error; continued = !error; });
    return { received, continued };
  } finally {
    (prisma.session as any).findUnique = sessionFind;
    (prisma.user as any).findUnique = userFind;
  }
}

const activeUser = { status: 'ACTIVE', authIdentities: [{ verifiedAt: new Date() }] };
const validSession = { userId: 'user-1', revokedAt: null, expiresAt: new Date(Date.now() + 60_000) };

test('sesión inexistente se rechaza con 401', async () => {
  const result = await runWithDatabase(null, activeUser, `Bearer ${await token()}`);
  assert.equal(result.continued, false);
  assert.equal((result.received as AppError).statusCode, 401);
});

test('sesión revocada se rechaza con 401', async () => {
  const result = await runWithDatabase({ ...validSession, revokedAt: new Date() }, activeUser, `Bearer ${await token()}`);
  assert.equal((result.received as AppError).statusCode, 401);
});

test('sesión expirada se rechaza con 401', async () => {
  const result = await runWithDatabase({ ...validSession, expiresAt: new Date(Date.now() - 1_000) }, activeUser, `Bearer ${await token()}`);
  assert.equal((result.received as AppError).statusCode, 401);
});

test('sesión perteneciente a otro usuario se rechaza con 401', async () => {
  const result = await runWithDatabase({ ...validSession, userId: 'other-user' }, activeUser, `Bearer ${await token()}`);
  assert.equal((result.received as AppError).statusCode, 401);
});

test('usuario suspendido se rechaza con 401', async () => {
  const result = await runWithDatabase(validSession, { ...activeUser, status: 'SUSPENDED' }, `Bearer ${await token()}`);
  assert.equal((result.received as AppError).statusCode, 401);
});

test('sesión válida permite continuar', async () => {
  const result = await runWithDatabase(validSession, activeUser, `Bearer ${await token()}`);
  assert.equal(result.received, undefined);
  assert.equal(result.continued, true);
});
