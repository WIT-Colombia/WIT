import crypto from 'node:crypto';
import argon2 from 'argon2';
import mariadb from 'mariadb';
import { Prisma } from '../src/generated/prisma/client.js';
import { prisma } from '../src/config/prisma.js';

const API = process.env.XAMUKO_TEST_API_URL ?? 'http://127.0.0.1:3000/api/v1';
const PREFIX = `XAMUKO_TEST_${Date.now()}_`;
const origin = process.env.XAMUKO_TEST_ORIGIN ?? 'http://127.0.0.1:5174';
const password = crypto.randomBytes(24).toString('base64url');
const email = `${PREFIX.toLowerCase()}owner@example.invalid`;
const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
let cookie = '';
let accessToken = '';
let userId = '';
let collaboratorId = '';
let collaboratorToken = '';
let collaboratorEmail = '';
let collaboratorPassword = '';
let businessId = '';
let physicalId = '';
let virtualId = '';
let deliveryId = '';

function pass(name: string, detail?: string) { results.push({ name, ok: true, detail }); console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`); }
function fail(name: string, error: unknown) { const detail = error instanceof Error ? error.message : String(error); results.push({ name, ok: false, detail }); console.error(`FAIL ${name} — ${detail}`); }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (cookie) headers.set('Cookie', cookie);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const setCookies = typeof headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  if (setCookies.length) cookie = setCookies.map((value) => value.split(';', 1)[0]).join('; ');
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}

async function verifyIsolatedDatabase() {
  const raw = process.env.DATABASE_URL;
  assert(raw, 'DATABASE_URL temporal no está configurada.');
  const url = new URL(raw);
  assert(url.hostname === '127.0.0.1' || url.hostname === 'localhost', 'La base no apunta a localhost.');
  assert(url.pathname.slice(1) === 'xamuko_modalities_test', 'La base no es xamuko_modalities_test.');
  assert(decodeURIComponent(url.username) === 'xamuko_test_app', 'El usuario de base no es xamuko_test_app.');
  const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1) });
  const rows = await connection.query('SELECT DATABASE() AS db, CURRENT_USER() AS account');
  await connection.end();
  assert(String(rows[0]?.db) === 'xamuko_modalities_test', 'SELECT DATABASE() no coincide.');
  assert(String(rows[0]?.account) === 'xamuko_test_app@localhost', 'CURRENT_USER() no coincide.');
  pass('aislamiento MySQL', 'xamuko_modalities_test / xamuko_test_app@localhost');
}

async function prepareUser() {
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.create({ data: { displayName: `${PREFIX}Owner`, emailNormalized: email, authIdentities: { create: { provider: 'EMAIL', providerSubject: email, passwordHash: hash, verifiedAt: new Date() } } } });
  userId = user.id;
}

async function checkHealthAndAuth() {
  const health = await request('/health');
  assert(health.response.status === 200 && health.body?.status === 'ok', `health respondió ${health.response.status}.`);
  pass('health HTTP 200');
  const noAuth = await fetch(`${API}/businesses`);
  assert(noAuth.status === 401, `sin autenticación respondió ${noAuth.status}.`);
  pass('sin autenticación rechazado', '401');
  const login = await request('/auth/login', { method: 'POST', headers: { Origin: origin }, body: JSON.stringify({ email, password, rememberMe: false }) });
  assert(login.response.status === 200 && typeof login.body?.accessToken === 'string', `login respondió ${login.response.status}.`);
  accessToken = login.body.accessToken;
  pass('login HTTP real', '200');
  const claims = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8')) as { sid?: string };
  assert(claims.sid, 'El access token no contiene sessionId.');
  const session = await prisma.session.findUnique({ where: { id: claims.sid } });
  assert(session?.userId === userId, 'La sesión HTTP no existe en la base aislada.');
  pass('sesión HTTP vinculada a MySQL aislado');
  const me = await request('/auth/me');
  assert(me.response.status === 200 && me.body?.user?.emailVerified === true, `me respondió ${me.response.status}.`);
  pass('me HTTP real', '200');
}

async function businessFlow() {
  const categories = await request('/business-categories');
  assert(categories.response.status === 200 && Array.isArray(categories.body?.categories), `categorías respondió ${categories.response.status}.`);
  const category = categories.body.categories[0];
  assert(category?.id || category?.code, 'La base no tiene una categoría activa para la prueba.');
  pass('categorías HTTP real', '200');
  const payload = { name: `${PREFIX}Negocio`, categoryId: category.id, description: 'Negocio temporal de integración', countryCode: 'CO', regionCode: '76', regionName: 'Valle del Cauca', cityName: 'Palmira', address: 'Calle de prueba 1', phone: '+57 3000000000', whatsapp: '+57 3000000000' };
  const created = await request('/businesses', { method: 'POST', headers: { Origin: origin }, body: JSON.stringify(payload) });
  assert(created.response.status === 201 && created.body?.business?.id, `creación respondió ${created.response.status}.`);
  businessId = created.body.business.id;
  pass('creación de negocio HTTP + MySQL', '201');
  const stored = await prisma.business.findUnique({ where: { id: businessId }, include: { businessAccount: true, memberships: true, location: true } });
  assert(stored?.createdById === userId && stored.memberships.some((item) => item.userId === userId && item.role === 'OWNER' && item.status === 'ACTIVE') && stored.location?.cityName === 'Palmira', 'La persistencia o la membresía OWNER no coincide.');
  pass('BusinessAccount, Business, OWNER y BusinessLocation persistidos');
  const listed = await request('/businesses');
  assert(listed.response.status === 200 && listed.body.businesses.some((item: any) => item.id === businessId), `listado respondió ${listed.response.status}.`);
  pass('listado de negocios', '200');
  const detail = await request(`/businesses/${businessId}`);
  assert(detail.response.status === 200 && detail.body.business.id === businessId, `detalle respondió ${detail.response.status}.`);
  pass('detalle de negocio', '200');
  const edited = await request(`/businesses/${businessId}`, { method: 'PATCH', headers: { Origin: origin }, body: JSON.stringify({ name: `${PREFIX}Negocio Editado`, cityName: 'Cali' }) });
  assert(edited.response.status === 200 && edited.body.business.name.endsWith('Editado'), `edición respondió ${edited.response.status}.`);
  const persisted = await prisma.business.findUnique({ where: { id: businessId }, include: { location: true } });
  assert(persisted?.name.endsWith('Editado') && persisted.location?.cityName === 'Cali', 'La edición no persistió.');
  pass('edición y persistencia de negocio', '200');
  const socialNetworks = await request(`/businesses/${businessId}`, { method: 'PATCH', headers: { Origin: origin }, body: JSON.stringify({ facebookUrl: 'https://facebook.com/xamuko', instagram: 'https://instagram.com/xamuko', xUrl: 'https://x.com/xamuko', tiktokUrl: 'https://tiktok.com/@xamuko' }) });
  assert(socialNetworks.response.status === 200 && socialNetworks.body?.business?.facebookUrl === 'https://facebook.com/xamuko' && socialNetworks.body?.business?.tiktokUrl === 'https://tiktok.com/@xamuko', `redes sociales respondió ${socialNetworks.response.status}.`);
  const storedSocialNetworks = await prisma.business.findUnique({ where: { id: businessId }, select: { facebookUrl: true, instagram: true, xUrl: true, tiktokUrl: true } });
  assert(storedSocialNetworks?.facebookUrl === 'https://facebook.com/xamuko' && storedSocialNetworks.instagram === 'https://instagram.com/xamuko' && storedSocialNetworks.xUrl === 'https://x.com/xamuko' && storedSocialNetworks.tiktokUrl === 'https://tiktok.com/@xamuko', 'Las redes sociales no se persistieron correctamente.');
  const clearedSocialNetworks = await request(`/businesses/${businessId}`, { method: 'PATCH', headers: { Origin: origin }, body: JSON.stringify({ facebookUrl: null, instagram: null, xUrl: null, tiktokUrl: null }) });
  assert(clearedSocialNetworks.response.status === 200, `eliminación de redes sociales respondió ${clearedSocialNetworks.response.status}.`);
  const clearedSocialValues = await prisma.business.findUnique({ where: { id: businessId }, select: { facebookUrl: true, instagram: true, xUrl: true, tiktokUrl: true } });
  assert(clearedSocialValues?.facebookUrl === null && clearedSocialValues.instagram === null && clearedSocialValues.xUrl === null && clearedSocialValues.tiktokUrl === null, 'Las redes sociales no se eliminaron correctamente.');
  pass('redes sociales creadas, recuperadas y eliminadas en MySQL', '200');
  const invalidOwner = await request('/businesses', { method: 'POST', headers: { Origin: origin }, body: JSON.stringify({ ...payload, ownerId: '00000000-0000-0000-0000-000000000000' }) });
  assert(invalidOwner.response.status === 400, `ownerId arbitrario respondió ${invalidOwner.response.status}.`);
  pass('ownerId arbitrario rechazado', '400');
  const audit = await prisma.auditLog.count({ where: { actorUserId: userId, entityId: businessId, entityType: 'BUSINESS' } });
  assert(audit >= 2, 'No se encontraron auditorías de creación y edición.');
  pass('auditorías de negocio persistidas', String(audit));
}

async function prepareCollaborator() {
  collaboratorEmail = `${PREFIX.toLowerCase()}collaborator@example.invalid`;
  collaboratorPassword = crypto.randomBytes(24).toString('base64url');
  const hash = await argon2.hash(collaboratorPassword, { type: argon2.argon2id });
  const collaborator = await prisma.user.create({ data: { displayName: `${PREFIX}Collaborator`, emailNormalized: collaboratorEmail, authIdentities: { create: { provider: 'EMAIL', providerSubject: collaboratorEmail, passwordHash: hash, verifiedAt: new Date() } } } });
  collaboratorId = collaborator.id;
  await prisma.businessMembership.create({ data: { businessId, userId: collaboratorId, role: 'COLLABORATOR', status: 'ACTIVE', acceptedAt: new Date(), permissions: { create: { permission: 'READ_REVIEWS', allowed: true } } } });
  const ownerCookie = cookie;
  const login = await request('/auth/login', { method: 'POST', headers: { Origin: origin }, body: JSON.stringify({ email: collaboratorEmail, password: collaboratorPassword, rememberMe: false }) });
  cookie = ownerCookie;
  assert(login.response.status === 200 && typeof login.body?.accessToken === 'string', `login colaborador respondió ${login.response.status}.`);
  collaboratorToken = login.body.accessToken;
  pass('colaborador temporal autenticado');
}

async function modalitiesFlow() {
  const create = async (type: string) => { const result = await request(`/businesses/${businessId}/modalities`, { method: 'POST', headers: { Origin: origin }, body: JSON.stringify({ type }) }); assert(result.response.status === 201, `${type} respondió ${result.response.status}.`); return result.body.modality; };
  const list = await request(`/businesses/${businessId}/modalities`); assert(list.response.status === 200, `listado de modalidades respondió ${list.response.status}.`); pass('listado de modalidades', '200');
  const physical = await create('PHYSICAL'); physicalId = physical.id; const virtual = await create('VIRTUAL'); virtualId = virtual.id; const delivery = await create('DELIVERY'); deliveryId = delivery.id; pass('modalidades física, virtual y domicilio creadas', '201');
  const contact = await request(`/businesses/${businessId}/modalities/${physicalId}/contact`, { method: 'PUT', headers: { Origin: origin }, body: JSON.stringify({ phone: '+57 3000000000' }) }); assert(contact.response.status === 200, `contacto respondió ${contact.response.status}.`); pass('contacto de modalidad', '200');
  const hours = await request(`/businesses/${businessId}/modalities/${physicalId}/hours`, { method: 'PUT', headers: { Origin: origin }, body: JSON.stringify({ hours: [{ dayOfWeek: 1, isClosed: false, opensAt: '08:00', closesAt: '18:00', timezone: 'America/Bogota' }] }) }); assert(hours.response.status === 200, `horarios respondió ${hours.response.status}.`); pass('horarios de modalidad', '200');
  const deniedVirtual = await request(`/businesses/${businessId}/modalities/${virtualId}/activate`, { method: 'POST', headers: { Origin: origin } }); assert(deniedVirtual.response.status === 422, `virtual activable respondió ${deniedVirtual.response.status}.`); pass('virtual sin cobertura rechazada', '422');
  const deniedDelivery = await request(`/businesses/${businessId}/modalities/${deliveryId}/activate`, { method: 'POST', headers: { Origin: origin } }); assert(deniedDelivery.response.status === 422, `domicilio activable respondió ${deniedDelivery.response.status}.`); pass('domicilio sin cobertura rechazado', '422');
  await prisma.businessLocation.update({ where: { businessId }, data: { visibility: 'PUBLIC' } });
  const active = await request(`/businesses/${businessId}/modalities/${physicalId}/activate`, { method: 'POST', headers: { Origin: origin } }); assert(active.response.status === 200, `activación física respondió ${active.response.status}.`); pass('modalidad física activada', '200');
  const paused = await request(`/businesses/${businessId}/modalities/${physicalId}/pause`, { method: 'POST', headers: { Origin: origin } }); assert(paused.response.status === 200, `pausa respondió ${paused.response.status}.`); const reactivated = await request(`/businesses/${businessId}/modalities/${physicalId}/reactivate`, { method: 'POST', headers: { Origin: origin } }); assert(reactivated.response.status === 200, `reactivación respondió ${reactivated.response.status}.`); const retired = await request(`/businesses/${businessId}/modalities/${physicalId}/retire`, { method: 'POST', headers: { Origin: origin } }); assert(retired.response.status === 200, `retiro respondió ${retired.response.status}.`); pass('pausa, reactivación y retiro', '200');
}

async function securityFlow() {
  const invalid = await fetch(`${API}/businesses`, { headers: { Authorization: 'Bearer invalid' } }); assert(invalid.status === 401, `token inválido respondió ${invalid.status}.`); pass('token inválido rechazado', '401');
  const collaboratorRead = await fetch(`${API}/businesses/${businessId}`, { headers: { Authorization: `Bearer ${collaboratorToken}` } }); assert(collaboratorRead.status === 200, `colaborador activo respondió ${collaboratorRead.status}.`); const collaboratorWrite = await fetch(`${API}/businesses/${businessId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${collaboratorToken}`, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ description: 'no autorizado' }) }); assert(collaboratorWrite.status === 403, `colaborador sin permiso respondió ${collaboratorWrite.status}.`); pass('colaborador activo y sin permiso de edición', '200/403');
  const untrusted = await request(`/businesses/${businessId}`, { method: 'PATCH', headers: { Origin: 'https://evil.example' }, body: JSON.stringify({ description: 'no debe cambiar' }) }); assert(untrusted.response.status === 403, `origen no autorizado respondió ${untrusted.response.status}.`); pass('origen no autorizado rechazado', '403');
  await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } }); const suspended = await request(`/businesses/${businessId}`); assert(suspended.response.status === 401, `usuario suspendido respondió ${suspended.response.status}.`); await prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } }); pass('usuario suspendido rechazado', '401');
  await prisma.businessMembership.update({ where: { businessId_userId: { businessId, userId } }, data: { status: 'REVOKED', revokedAt: new Date() } }); const ownerRevoked = await request(`/businesses/${businessId}`); assert(ownerRevoked.response.status === 404, `membresía revocada respondió ${ownerRevoked.response.status}.`); await prisma.businessMembership.update({ where: { businessId_userId: { businessId, userId } }, data: { status: 'ACTIVE', revokedAt: null } }); pass('membresía revocada rechazada', '404');
  const logout = await request('/auth/logout', { method: 'POST', headers: { Origin: origin } }); assert(logout.response.status === 204, `logout respondió ${logout.response.status}.`); const oldToken = accessToken; accessToken = oldToken; const revoked = await request(`/businesses/${businessId}`); assert(revoked.response.status === 401, `sesión revocada respondió ${revoked.response.status}.`); pass('sesión revocada rechazada', '401');
}

async function cleanup() {
  if (!userId) return;
  try {
    await prisma.$transaction(async (tx) => {
      const businesses = await tx.business.findMany({ where: { createdById: userId }, select: { id: true, businessAccountId: true } });
      const businessIds = businesses.map((item) => item.id);
      if (businessIds.length) await tx.auditLog.deleteMany({ where: { entityId: { in: businessIds } } });
      await tx.business.deleteMany({ where: { createdById: userId } });
      await tx.businessAccount.deleteMany({ where: { createdById: userId } });
      await tx.auditLog.deleteMany({ where: { actorUserId: userId } });
      await tx.user.delete({ where: { id: userId } });
      if (collaboratorId) await tx.user.delete({ where: { id: collaboratorId } });
    });
    pass('limpieza selectiva', PREFIX);
  } catch (error) { fail('limpieza selectiva', error); }
}

async function main() {
  if (process.argv.includes('--help')) { console.log('Ejecuta con DATABASE_URL temporal hacia xamuko_modalities_test y el backend en XAMUKO_TEST_API_URL opcional.'); return; }
  try {
    await verifyIsolatedDatabase();
    const health = await fetch(`${API}/health`); assert(health.status === 200, `backend no responde health: ${health.status}.`); pass('backend HTTP disponible', String(health.status));
    await prepareUser();
    await checkHealthAndAuth();
    await businessFlow();
    await prepareCollaborator();
    await modalitiesFlow();
    await securityFlow();
  } catch (error) { fail('ejecución de integración', error); }
  finally { await cleanup(); await prisma.$disconnect(); }
  const failed = results.filter((item) => !item.ok);
  console.log(`RESUMEN PASS=${results.length - failed.length} FAIL=${failed.length} PREFIX=${PREFIX}`);
  if (failed.length) process.exitCode = 1;
}

void main();
