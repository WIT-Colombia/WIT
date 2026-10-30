import './verify-integration-env.js';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import { prisma } from '../src/config/prisma.js';

const API = process.env.XAMUKO_TEST_API_URL ?? 'http://127.0.0.1:3100/api/v1';
const ORIGIN = process.env.XAMUKO_TEST_ORIGIN ?? 'http://127.0.0.1:5174';
const prefix = `PRO_TEST_${Date.now()}_`;
const email = `${prefix.toLowerCase()}@example.invalid`;
const password = crypto.randomBytes(24).toString('base64url');
let userId = '';
let businessA = '';
let businessB = '';
let businessAccountIds: string[] = [];
let token = '';
let categoryId = '';
let createdCategoryId = '';
const scenarioFailures: string[] = [];
let spawned: ReturnType<typeof spawn> | null = null;
let spawnError: Error | null = null;
let backendClosed = false;
const REQUEST_TIMEOUT_MS = 10_000;
const backendDirectory = fileURLToPath(new URL('..', import.meta.url));

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Origin', ORIGIN);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const text = await response.text();
  let body: any = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function waitForBackend() { for (let i = 0; i < 30; i += 1) { if (spawnError) throw new Error(`No se pudo iniciar el Backend temporal: ${spawnError.message}`); if (backendClosed) throw new Error('El Backend temporal terminó antes de responder.'); try { const response = await fetch(`${API}/health`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }); if (response.ok) return; } catch {} await new Promise(resolve => setTimeout(resolve, 250)); } throw new Error(`Backend temporal no respondió en ${API}.`); }
async function startBackendIfNeeded() {
  try { if ((await fetch(`${API}/health`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })).ok) return; } catch {}
  console.log(`Backend temporal: execPath=${process.execPath}`);
  console.log(`Backend temporal: cwd=${backendDirectory}`);
  if (!existsSync(process.execPath)) throw new Error(`La ruta de Node.js no existe: ${process.execPath}`);
  if (!existsSync(backendDirectory)) throw new Error(`El directorio Backend no existe: ${backendDirectory}`);
  const entrypoint = `${backendDirectory}/src/server.ts`;
  if (!existsSync(entrypoint)) throw new Error(`El archivo de entrada no existe: ${entrypoint}`);
  const trustedOrigins = [ORIGIN, 'http://127.0.0.1:5173', 'http://localhost:5173', 'http://localhost:5174'].filter((value, index, values) => values.indexOf(value) === index).join(',');
  spawned = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], { cwd: backendDirectory, env: { ...process.env, NODE_ENV: 'test', PORT: '3100', HOST: '127.0.0.1', AUTH_TRUSTED_ORIGINS: trustedOrigins }, stdio: 'inherit' });
  spawned.once('error', error => { spawnError = error; });
  spawned.once('close', () => { backendClosed = true; });
  await waitForBackend();
}
async function setup() {
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.create({ data: { displayName: `${prefix}Owner`, emailNormalized: email, authIdentities: { create: { provider: 'EMAIL', providerSubject: email, passwordHash: hash, verifiedAt: new Date() } } } });
  userId = user.id;
  const login = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, rememberMe: false }) });
  if (!login.response.ok || typeof login.body?.accessToken !== 'string') {
    const serverMessage = typeof login.body?.error?.message === 'string' ? login.body.error.message : 'Respuesta sin mensaje público.';
    throw new Error(`Autenticación de integración falló (HTTP ${login.response.status}): ${serverMessage}`);
  }
  token = login.body.accessToken;
  const categories = await request('/business-categories');
  if (categories.response.ok && categories.body?.categories?.[0]?.id) categoryId = categories.body.categories[0].id;
  else {
    const category = await prisma.category.create({ data: { code: `pro-test-${Date.now()}-category`, translations: { create: { locale: 'es-CO', name: `${prefix} Categoría` } } } });
    categoryId = category.id; createdCategoryId = category.id;
  }
  const payload = { name: `${prefix}A`, categoryId, countryCode: 'CO', regionCode: '76', regionName: 'Valle del Cauca', cityName: 'Palmira', address: 'Calle de integración 1' };
  const first = await request('/businesses', { method: 'POST', body: JSON.stringify(payload) }); if (first.response.status !== 201) throw new Error(`No se creó el establecimiento A: HTTP ${first.response.status} — ${first.body?.error?.message ?? 'sin mensaje público'}`); businessA = first.body.business.id;
  const second = await request('/businesses', { method: 'POST', body: JSON.stringify({ ...payload, name: `${prefix}B` }) }); if (second.response.status !== 201) throw new Error(`No se creó el establecimiento B: HTTP ${second.response.status} — ${second.body?.error?.message ?? 'sin mensaje público'}`); businessB = second.body.business.id;
  const accounts = await prisma.business.findMany({ where: { id: { in: [businessA, businessB] } }, select: { businessAccountId: true } }); businessAccountIds = accounts.map(item => item.businessAccountId);
}
async function offer(kind: 'PRODUCT' | 'SERVICE', businessId = businessA) { return request(`/businesses/${businessId}/offers`, { method: 'POST', body: JSON.stringify({ kind, name: `${prefix}${kind}`, description: 'Prueba de integración', priceAmount: '1000', currency: 'COP', negotiable: false, active: true, adultOnly: false, publicationStatus: 'PUBLISHED' }) }); }
async function scenario(name: string, task: () => Promise<void>) { try { await task(); console.log(`PASS ${name}`); } catch (error) { scenarioFailures.push(name); console.error(`FAIL ${name}:`, error instanceof Error ? error.message : error); } }
async function run() {
  await startBackendIfNeeded(); await setup();
  const initial = await request(`/businesses/${businessA}/catalog-limits`); check(initial.response.ok && initial.body.plan === 'BASIC', `El plan inicial no es BASIC: ${initial.body?.plan ?? 'sin plan'}.`);
  for (let i = 0; i < 20; i += 1) check((await offer('PRODUCT')).response.status === 201, 'Falló una creación dentro del límite.');
  check((await offer('PRODUCT')).response.status === 409, 'No se rechazó el producto fuera de cuota.');
  const subscription = await prisma.businessSubscription.create({ data: { businessId: businessA, plan: 'PRO', status: 'ACTIVE', startsAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 3_600_000), autoRenew: true, specialActivation: false } });
  const pro = await request(`/businesses/${businessA}/catalog-limits`); check(pro.body.plan === 'PRO' && pro.body.products.unlimited, 'Pro vigente no devolvió capacidad ilimitada.'); check((await offer('PRODUCT')).response.status === 201, 'Pro vigente bloqueó una creación.');
  await prisma.businessSubscription.update({ where: { id: subscription.id }, data: { status: 'EXPIRED' } });
  const expired = await request(`/businesses/${businessA}/catalog-limits`); check(expired.body.plan === 'BASIC' && expired.body.products.used >= 21, 'El vencimiento no recuperó el límite ni conservó ofertas.');
  const secondLimits = await request(`/businesses/${businessB}/catalog-limits`); check(secondLimits.body.plan === 'BASIC' && secondLimits.body.products.used === 0, 'Los establecimientos no son independientes.');
  for (let i = 0; i < 19; i += 1) check((await offer('SERVICE')).response.status === 201, 'Falló la preparación del último cupo.');
  const concurrent = await Promise.all([offer('SERVICE'), offer('SERVICE')]); const concurrentStatuses = concurrent.map(item => item.response.status).sort(); check(concurrentStatuses[0] === 201 && concurrentStatuses[1] === 409, `La concurrencia no respetó el último cupo: ${concurrentStatuses.join(',')}.`);
  const finalLimits = await request(`/businesses/${businessA}/catalog-limits`); check(finalLimits.body.services.used === 20, `El total final de servicios no es 20: ${finalLimits.body.services.used}.`);
  await scenario('Pro revocado pierde beneficios', async () => { const row = await prisma.businessSubscription.create({ data: { businessId: businessB, plan: 'PRO', status: 'REVOKED', startsAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 3600000), autoRenew: true, specialActivation: false, revokedAt: new Date() } }); const result = await request(`/businesses/${businessB}/catalog-limits`); check(result.body.plan === 'BASIC' && !result.body.products.unlimited, 'Pro revocado fue tratado como ilimitado.'); await prisma.businessSubscription.delete({ where: { id: row.id } }); });
  await scenario('Pro pendiente no concede beneficios', async () => { const row = await prisma.businessSubscription.create({ data: { businessId: businessB, plan: 'PRO', status: 'PENDING', startsAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 3600000), autoRenew: true, specialActivation: false } }); const result = await request(`/businesses/${businessB}/catalog-limits`); check(result.body.plan === 'BASIC', 'Pro pendiente fue tratado como activo.'); await prisma.businessSubscription.delete({ where: { id: row.id } }); });
  await scenario('Activación especial sin vencimiento concede ilimitados', async () => { const row = await prisma.businessSubscription.create({ data: { businessId: businessB, plan: 'PRO', status: 'ACTIVE', startsAt: new Date(Date.now() - 1000), expiresAt: null, specialActivation: true, autoRenew: false } }); const result = await request(`/businesses/${businessB}/catalog-limits`); check(result.body.plan === 'PRO' && result.body.products.unlimited, 'La activación especial no fue ilimitada.'); await prisma.businessSubscription.delete({ where: { id: row.id } }); });
  await scenario('El Backend ignora indicadores Pro falsificados', async () => { const result = await request(`/businesses/${businessB}/catalog-limits`, { method: 'GET', headers: { 'X-Business-Plan': 'PRO', 'X-Pro-Active': 'true' } }); check(result.body.plan !== 'PRO', 'El Backend aceptó un indicador del cliente.'); });
  await scenario('Editar, desactivar y eliminar publicación', async () => { const created = await offer('PRODUCT', businessB); check(created.response.status === 201, 'No se creó la publicación de operaciones.'); const id = created.body.offer.id; const edited = await request(`/businesses/${businessB}/offers/${id}`, { method: 'PATCH', body: JSON.stringify({ name: `${prefix}EDITADA` }) }); check(edited.response.ok, 'No se pudo editar la publicación.'); const paused = await request(`/businesses/${businessB}/offers/${id}`, { method: 'PATCH', body: JSON.stringify({ active: false }) }); check(paused.response.ok, 'No se pudo desactivar la publicación.'); const removed = await request(`/businesses/${businessB}/offers/${id}`, { method: 'DELETE' }); check(removed.response.status === 204, `No se pudo eliminar la publicación: HTTP ${removed.response.status} — ${typeof removed.body === 'string' ? removed.body : removed.body?.error?.message ?? 'sin mensaje público'}.`); const limits = await request(`/businesses/${businessB}/catalog-limits`); check(limits.body.products.used === 0, 'La publicación eliminada siguió contando.'); });
  if (scenarioFailures.length) throw new Error(`Fallaron escenarios: ${scenarioFailures.join(', ')}`);
  console.log('PASS Business Pro integration: límites, Pro, vencimiento, independencia, concurrencia y operaciones HTTP.');
}
async function cleanup() { console.log('Limpieza: iniciando.'); let cleanupError: unknown = null; try { const ids = [businessA, businessB].filter(Boolean); if (ids.length) { await prisma.businessSubscription.deleteMany({ where: { businessId: { in: ids } } }); await prisma.businessOffer.deleteMany({ where: { businessId: { in: ids } } }); await prisma.business.deleteMany({ where: { id: { in: ids } } }); } if (businessAccountIds.length) await prisma.businessAccount.deleteMany({ where: { id: { in: businessAccountIds } } }); if (createdCategoryId) await prisma.category.delete({ where: { id: createdCategoryId } }); if (userId) { await prisma.adminRoleAssignment.deleteMany({ where: { assignedById: userId } }); await prisma.user.delete({ where: { id: userId } }); } console.log('Limpieza completada.'); } catch (error) { cleanupError = error; console.error('Limpieza incompleta:', error); } finally { if (spawned && !spawned.killed && !backendClosed) { spawned.kill('SIGTERM'); await new Promise<void>(resolve => { const timer = setTimeout(resolve, 5000); timer.unref(); spawned?.once('close', () => { clearTimeout(timer); resolve(); }); }); } await prisma.$disconnect(); console.log('Backend detenido y Prisma desconectado.'); } return cleanupError; }
async function main() { let testsPassed = false; try { console.log('Entorno verificado.'); await run(); testsPassed = true; console.log('Pruebas aprobadas.'); } catch (error) { console.error('Pruebas fallidas:', error); process.exitCode = 1; } finally { const cleanupError = await cleanup(); if (cleanupError && testsPassed) process.exitCode = 1; } }
void main();
