import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import mariadb from 'mariadb';

const EXPECTED = 'xamuko_favorites_integration_test';
const PROTECTED = new Set(['xamuko_modalities_test', 'xamuko_integration_test']);
const backendDir = fileURLToPath(new URL('..', import.meta.url));
const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error('DATABASE_URL es obligatoria.');
const source = new URL(sourceUrl);
const configuredDb = decodeURIComponent(source.pathname.slice(1));
if (configuredDb !== EXPECTED || PROTECTED.has(configuredDb)) throw new Error(`Pruebas detenidas: base no autorizada (${configuredDb}).`);
const connection = await mariadb.createConnection({ host: source.hostname, port: Number(source.port || 3306), user: decodeURIComponent(source.username), password: decodeURIComponent(source.password), database: EXPECTED });
const databaseRow = await connection.query('SELECT DATABASE() AS databaseName');
await connection.end();
if (String(databaseRow[0]?.databaseName) !== EXPECTED) throw new Error('SELECT DATABASE() no coincide con la base autorizada.');
console.log(`Base aislada confirmada: ${EXPECTED}`);

const { prisma } = await import('../src/config/prisma.js');
const API = 'http://127.0.0.1:3102/api/v1';
const ORIGIN = 'http://127.0.0.1:5174';
const prefix = `LIKE_TEST_${Date.now()}_`;
const password = crypto.randomBytes(24).toString('base64url');
const emailA = `${prefix.toLowerCase()}a@example.invalid`;
const emailB = `${prefix.toLowerCase()}b@example.invalid`;
let userA = '', userB = '', businessId = '', accountId = '', categoryId = '';
const offerIds: string[] = [];
let tokenA = '', tokenB = '';
let child: ReturnType<typeof spawn> | null = null;
const failures: string[] = [];

async function request(token: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers); headers.set('Accept', 'application/json'); headers.set('Origin', ORIGIN); if (init.body) headers.set('Content-Type', 'application/json'); if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers, signal: AbortSignal.timeout(8000) });
  const text = await response.text(); let body: any = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}
function check(value: unknown, message: string) { if (!value) throw new Error(message); }
async function waitHealth() { for (let i = 0; i < 40; i++) { try { if ((await fetch(`${API}/health`, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 250)); } throw new Error('Backend temporal no respondió.'); }
async function startBackend() { if (!existsSync(process.execPath)) throw new Error(`No existe ${process.execPath}.`); child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], { cwd: backendDir, env: { ...process.env, NODE_ENV: 'test', PORT: '3102', HOST: '127.0.0.1', AUTH_TRUSTED_ORIGINS: ORIGIN }, stdio: 'inherit' }); child.once('error', (error) => console.error(`Backend temporal: ${error.message}`)); await waitHealth(); }
async function createUser(email: string, name: string) { const hash = await argon2.hash(password, { type: argon2.argon2id }); const user = await prisma.user.create({ data: { displayName: name, emailNormalized: email, authIdentities: { create: { provider: 'EMAIL', providerSubject: email, passwordHash: hash, verifiedAt: new Date() } } } }); return user.id; }
async function login(email: string) { const result = await request('', '/auth/login', { method: 'POST', body: JSON.stringify({ email, password, rememberMe: false }) }); check(result.response.ok && typeof result.body?.accessToken === 'string', `Login falló HTTP ${result.response.status}`); return result.body.accessToken as string; }
async function scenario(name: string, task: () => Promise<void>) { try { await task(); console.log(`PASS ${name}`); } catch (error) { failures.push(name); console.error(`FAIL ${name}:`, error instanceof Error ? error.message : error); } }
async function setup() {
  userA = await createUser(emailA, `${prefix} A`); userB = await createUser(emailB, `${prefix} B`); tokenA = await login(emailA); tokenB = await login(emailB);
  const category = await prisma.category.create({ data: { code: `like-test-${Date.now()}`, translations: { create: { locale: 'es-CO', name: `${prefix} Categoría` } } } }); categoryId = category.id;
  const created = await request(tokenA, '/businesses', { method: 'POST', body: JSON.stringify({ name: `${prefix} Negocio`, categoryId, countryCode: 'CO', regionCode: '76', regionName: 'Valle del Cauca', cityName: 'Palmira', address: 'Calle de prueba 1' }) }); check(created.response.status === 201, `Negocio no creado HTTP ${created.response.status}`); businessId = created.body.business.id;
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { businessAccountId: true } }); accountId = business?.businessAccountId ?? '';
  await prisma.business.update({ where: { id: businessId }, data: { lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', deletionStatus: 'NONE' } });
  for (const kind of ['PRODUCT', 'SERVICE'] as const) { const offer = await prisma.businessOffer.create({ data: { businessId, categoryId, kind, name: `${prefix} ${kind}`, description: 'Prueba de Me gusta', active: true, publicationStatus: 'PUBLISHED', currency: 'COP' } }); offerIds.push(offer.id); }
}
async function run() {
  await startBackend(); await setup(); const [productId, serviceId] = offerIds;
  await scenario('rechaza solicitud sin autenticación', async () => { const result = await request('', `/offers/${productId}/like`); check(result.response.status === 401, `HTTP ${result.response.status}`); });
  await scenario('POST exige origen confiable', async () => { const headers = new Headers({ Origin: 'http://evil.invalid', Authorization: `Bearer ${tokenA}` }); const result = await fetch(`${API}/offers/${productId}/like`, { method: 'POST', headers }); check(result.status === 403, `HTTP ${result.status}`); });
  await scenario('Usuario A marca producto y persiste en MySQL', async () => { const result = await request(tokenA, `/offers/${productId}/like`, { method: 'POST' }); check(result.response.status === 201 && result.body.like.liked && result.body.like.count === 1, 'respuesta inválida'); const count = await prisma.businessOfferLike.count({ where: { offerId: productId } }); check(count === 1, `persistencia ${count}`); });
  await scenario('duplicado de A no crea otra fila', async () => { await request(tokenA, `/offers/${productId}/like`, { method: 'POST' }); const count = await prisma.businessOfferLike.count({ where: { offerId: productId } }); check(count === 1, `duplicados ${count}`); });
  await scenario('Usuario B incrementa el contador a 2', async () => { const result = await request(tokenB, `/offers/${productId}/like`, { method: 'POST' }); check(result.body.like.count === 2, `contador ${result.body.like.count}`); });
  await scenario('A retira su Me gusta y el contador baja a 1', async () => { const result = await request(tokenA, `/offers/${productId}/like`, { method: 'DELETE' }); check(result.response.ok && result.body.like.count === 1 && !result.body.like.liked, 'eliminación inválida'); });
  await scenario('DELETE repetido es idempotente y no afecta a B', async () => { await request(tokenA, `/offers/${productId}/like`, { method: 'DELETE' }); const result = await request(tokenB, `/offers/${productId}/like`); check(result.body.like.liked && result.body.like.count === 1, 'se afectó el Me gusta de B'); });
  await scenario('servicio mantiene contador independiente', async () => { const result = await request(tokenA, `/offers/${serviceId}/like`, { method: 'POST' }); check(result.body.like.count === 1, `contador servicio ${result.body.like.count}`); });
  await scenario('consulta por lotes devuelve estados y conteos', async () => { const result = await request(tokenB, `/offers/likes?offerIds=${productId},${serviceId},${productId}`); const rows = result.body.likes; check(result.response.ok && rows.length === 2 && rows.find((row: any) => row.offerId === productId)?.liked, 'lote incorrecto'); });
  await scenario('publicación no disponible es rechazada', async () => { await prisma.businessOffer.update({ where: { id: serviceId }, data: { active: false } }); const result = await request(tokenA, `/offers/${serviceId}/like`, { method: 'POST' }); check(result.response.status === 404, `HTTP ${result.response.status}`); });
  await scenario('A obtiene únicamente sus publicaciones marcadas', async () => { await prisma.businessOffer.update({ where: { id: serviceId }, data: { active: true } }); const result = await request(tokenA, '/offers/likes/mine?page=1&pageSize=20'); check(result.response.ok && result.body.items.length === 1 && result.body.items[0].offerId === serviceId, 'A recibió publicaciones ajenas o incompletas'); });
  await scenario('B obtiene únicamente sus publicaciones marcadas', async () => { const extra = await prisma.businessOffer.create({ data: { businessId, categoryId, kind: 'PRODUCT', name: `${prefix} Orden`, active: true, publicationStatus: 'PUBLISHED', currency: 'COP' } }); offerIds.push(extra.id); const liked = await request(tokenB, `/offers/${extra.id}/like`, { method: 'POST' }); check(liked.response.status === 201, 'no se pudo preparar el orden'); const result = await request(tokenB, '/offers/likes/mine?page=1&pageSize=20'); check(result.response.ok && result.body.items.length === 2 && result.body.items.some((item: any) => item.offerId === productId), 'B recibió publicaciones ajenas o incompletas'); check(new Date(result.body.items[0].likedAt) >= new Date(result.body.items[1].likedAt), 'orden incorrecto'); });
  await scenario('paginación consecutiva sin duplicados', async () => { const first = await request(tokenB, '/offers/likes/mine?page=1&pageSize=1'); const second = await request(tokenB, '/offers/likes/mine?page=2&pageSize=1'); check(first.body.items.length === 1 && second.body.items.length === 1 && first.body.items[0].offerId !== second.body.items[0].offerId && first.body.pagination.total === 2, 'paginación incorrecta'); });
  await scenario('inactivas, eliminadas y no publicadas se excluyen', async () => { const states = [{ active: false, publicationStatus: 'PUBLISHED' as const }, { active: true, publicationStatus: 'PUBLISHED' as const, deletedAt: new Date() }, { active: true, publicationStatus: 'UNPUBLISHED' as const }]; const hidden: string[] = []; for (const [index, data] of states.entries()) { const offer = await prisma.businessOffer.create({ data: { businessId, categoryId, kind: 'PRODUCT', name: `${prefix} Oculta ${index}`, active: data.active, publicationStatus: data.publicationStatus, deletedAt: data.deletedAt, currency: 'COP' } }); hidden.push(offer.id); offerIds.push(offer.id); await prisma.businessOfferLike.create({ data: { userId: userA, offerId: offer.id } }); } const result = await request(tokenA, '/offers/likes/mine'); check(result.response.ok && result.body.items.every((item: any) => !hidden.includes(item.offerId)), 'apareció una publicación no disponible'); });
  await scenario('contadores coinciden con MySQL', async () => { const result = await request(tokenB, '/offers/likes/mine'); const count = await prisma.businessOfferLike.count({ where: { userId: userB, offerId: productId } }); const product = result.body.items.find((item: any) => item.offerId === productId); check(product?.likeCount === count && count === 1, 'contador inconsistente'); });
  await scenario('retirar Me gusta elimina del listado', async () => { const result = await request(tokenA, `/offers/${serviceId}/like`, { method: 'DELETE' }); const list = await request(tokenA, '/offers/likes/mine'); check(result.response.ok && list.body.items.length === 0, 'publicación aún listada'); });
  await scenario('listado sin autenticación es rechazado', async () => { const result = await request('', '/offers/likes/mine'); check(result.response.status === 401, `HTTP ${result.response.status}`); });
  if (failures.length) throw new Error(`Fallaron: ${failures.join(', ')}`);
  console.log(`PASS BusinessOfferLike integration (${18 - failures.length}/18)`);
}
async function cleanup() { try { if (offerIds.length) await prisma.businessOfferLike.deleteMany({ where: { offerId: { in: offerIds } } }); if (offerIds.length) await prisma.businessOffer.deleteMany({ where: { id: { in: offerIds } } }); if (businessId) await prisma.business.delete({ where: { id: businessId } }); if (accountId) await prisma.businessAccount.deleteMany({ where: { id: accountId } }); if (categoryId) await prisma.category.delete({ where: { id: categoryId } }); const users = [userA, userB].filter(Boolean); if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } }); console.log('Limpieza BusinessOfferLike completada.'); } finally { if (child && !child.killed) child.kill('SIGTERM'); await prisma.$disconnect(); } }
try { await run(); } finally { await cleanup(); }
