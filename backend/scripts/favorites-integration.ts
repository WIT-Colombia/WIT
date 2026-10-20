import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import mariadb from 'mariadb';

const EXPECTED = 'xamuko_favorites_integration_test';
const protectedDbs = new Set(['xamuko_modalities_test', 'xamuko_integration_test']);
const envRaw = process.env.DATABASE_URL;
if (!envRaw) throw new Error('DATABASE_URL es obligatoria.');
const source = new URL(envRaw);
const database = decodeURIComponent(source.pathname.slice(1));
if (protectedDbs.has(database) || database !== EXPECTED) throw new Error(`Pruebas detenidas: base no autorizada (${database}).`);
const conn = await mariadb.createConnection({ host: source.hostname, port: Number(source.port || 3306), user: decodeURIComponent(source.username), password: decodeURIComponent(source.password), database: EXPECTED });
const dbRow = await conn.query('SELECT DATABASE() AS databaseName');
await conn.end();
if (String(dbRow[0]?.databaseName) !== EXPECTED) throw new Error('SELECT DATABASE() no coincide con la base aislada.');
console.log(`Base aislada confirmada: ${EXPECTED}`);

const { prisma } = await import('../src/config/prisma.js');
const API = 'http://127.0.0.1:3101/api/v1';
const ORIGIN = 'http://127.0.0.1:5174';
const prefix = `FAV_TEST_${Date.now()}_`;
const password = crypto.randomBytes(24).toString('base64url');
const emailA = `${prefix.toLowerCase()}a@example.invalid`;
const emailB = `${prefix.toLowerCase()}b@example.invalid`;
let userA = '', userB = '', businessId = '', unpublishedId = '', accountId = '', categoryId = '';
let tokenA = '', tokenB = '';
let child: ReturnType<typeof spawn> | null = null;
const failures: string[] = [];

async function request(token: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers); headers.set('Accept', 'application/json'); headers.set('Origin', ORIGIN); if (init.body) headers.set('Content-Type', 'application/json'); if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers, signal: AbortSignal.timeout(8000) }); const text = await response.text(); let body: any = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; } return { response, body };
}
function check(value: unknown, message: string) { if (!value) throw new Error(message); }
async function waitHealth() { for (let i = 0; i < 40; i++) { try { if ((await fetch(`${API}/health`, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('Backend temporal no respondió.'); }
async function startBackend() { if (existsSync(process.execPath)) { child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, NODE_ENV: 'test', PORT: '3101', HOST: '127.0.0.1', AUTH_TRUSTED_ORIGINS: ORIGIN }, stdio: 'inherit' }); child.once('error', error => { throw error; }); await waitHealth(); } }
async function createUser(email: string, name: string) { const hash = await argon2.hash(password, { type: argon2.argon2id }); const user = await prisma.user.create({ data: { displayName: name, emailNormalized: email, authIdentities: { create: { provider: 'EMAIL', providerSubject: email, passwordHash: hash, verifiedAt: new Date() } } } }); return user.id; }
async function login(email: string) { const result = await request('', '/auth/login', { method: 'POST', body: JSON.stringify({ email, password, rememberMe: false }) }); check(result.response.ok && typeof result.body?.accessToken === 'string', `Login falló HTTP ${result.response.status}`); return result.body.accessToken as string; }
async function scenario(name: string, task: () => Promise<void>) { try { await task(); console.log(`PASS ${name}`); } catch (error) { failures.push(name); console.error(`FAIL ${name}:`, error instanceof Error ? error.message : error); } }
async function setup() { userA = await createUser(emailA, `${prefix} A`); userB = await createUser(emailB, `${prefix} B`); tokenA = await login(emailA); tokenB = await login(emailB); const category = await prisma.category.create({ data: { code: `fav-test-${Date.now()}`, translations: { create: { locale: 'es-CO', name: `${prefix} Categoría` } } } }); categoryId = category.id; const created = await request(tokenA, '/businesses', { method: 'POST', body: JSON.stringify({ name: `${prefix} Negocio`, categoryId, countryCode: 'CO', regionCode: '76', regionName: 'Valle del Cauca', cityName: 'Palmira', address: 'Calle de prueba 1' }) }); check(created.response.status === 201, `Negocio no creado HTTP ${created.response.status}`); businessId = created.body.business.id; const row = await prisma.business.findUnique({ where: { id: businessId }, select: { businessAccountId: true } }); accountId = row?.businessAccountId ?? ''; }
async function run() { await startBackend(); await setup(); await scenario('usuario no autenticado', async () => { const result = await request('', `/businesses/${businessId}/favorite`, { method: 'POST' }); check(result.response.status === 401, `HTTP ${result.response.status}`); }); await scenario('guardar establecimiento publicado', async () => { const result = await request(tokenA, `/businesses/${businessId}/favorite`, { method: 'POST' }); check(result.response.status === 201 && result.body.favorite.saved, `HTTP ${result.response.status}`); }); await scenario('guardar dos veces sin duplicar', async () => { const result = await request(tokenA, `/businesses/${businessId}/favorite`, { method: 'POST' }); check(result.response.status === 201, `HTTP ${result.response.status}`); const rows = await prisma.businessFavorite.count({ where: { userId: userA, businessId } }); check(rows === 1, `duplicados: ${rows}`); }); await scenario('listar favoritos e IDs de A', async () => { const list = await request(tokenA, '/favorites'); const ids = await request(tokenA, '/favorites/ids'); check(list.response.ok && ids.response.ok && ids.body.businessIds.length === 1 && ids.body.businessIds[0] === businessId, 'respuesta incompleta'); }); await scenario('aislamiento entre usuarios', async () => { const result = await request(tokenB, '/favorites/ids'); check(result.response.ok && result.body.businessIds.length === 0, 'B vio favoritos de A'); }); await scenario('B guarda el mismo negocio', async () => { const result = await request(tokenB, `/businesses/${businessId}/favorite`, { method: 'POST' }); check(result.response.status === 201, `HTTP ${result.response.status}`); }); await scenario('eliminar A no afecta a B', async () => { const removed = await request(tokenA, `/businesses/${businessId}/favorite`, { method: 'DELETE' }); const ids = await request(tokenB, '/favorites/ids'); check(removed.response.ok && ids.body.businessIds.includes(businessId), 'eliminó el favorito de B'); }); await scenario('eliminar dos veces es seguro', async () => { const result = await request(tokenA, `/businesses/${businessId}/favorite`, { method: 'DELETE' }); check(result.response.ok, `HTTP ${result.response.status}`); }); await scenario('negocio inexistente rechazado', async () => { const result = await request(tokenA, '/businesses/not-found/favorite', { method: 'POST' }); check(result.response.status === 404, `HTTP ${result.response.status}`); }); await scenario('negocio no publicado rechazado', async () => { const created = await request(tokenA, '/businesses', { method: 'POST', body: JSON.stringify({ name: `${prefix} Privado`, categoryId, countryCode: 'CO', regionCode: '76', regionName: 'Valle del Cauca', cityName: 'Palmira', address: 'Calle privada de prueba' }) }); check(created.response.status === 201, `No se creó el negocio de prueba HTTP ${created.response.status}`); unpublishedId = created.body.business.id; await prisma.business.update({ where: { id: unpublishedId }, data: { lifecycleStatus: 'DRAFT', publicationStatus: 'UNPUBLISHED', visibilityStatus: 'REVIEW' } }); const result = await request(tokenA, `/businesses/${unpublishedId}/favorite`, { method: 'POST' }); check(result.response.status === 404, `HTTP ${result.response.status}`); }); if (failures.length) throw new Error(`Fallaron: ${failures.join(', ')}`); console.log('PASS Favoritos: aislamiento, idempotencia y disponibilidad.'); }
async function cleanup() { try { for (const id of [businessId, unpublishedId].filter(Boolean)) { await prisma.businessFavorite.deleteMany({ where: { businessId: id } }); await prisma.business.delete({ where: { id } }); } if (accountId) await prisma.businessAccount.deleteMany({ where: { id: accountId } }); await prisma.businessAccount.deleteMany({ where: { createdById: { in: [userA, userB].filter(Boolean) } } }); if (categoryId) await prisma.category.delete({ where: { id: categoryId } }); for (const id of [userA, userB].filter(Boolean)) await prisma.user.delete({ where: { id } }); console.log('Limpieza completada.'); } finally { if (child && !child.killed) child.kill('SIGTERM'); await prisma.$disconnect(); } }
try { await run(); } finally { await cleanup(); }
