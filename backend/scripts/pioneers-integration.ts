import { loadEnvFile } from 'node:process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import argon2 from 'argon2';
import mariadb from 'mariadb';
import { Prisma } from '../src/generated/prisma/client.js';

const DB = 'xamuko_analytics_integration_test';
const API = process.env.PIONEERS_TEST_API ?? 'http://127.0.0.1:3103/api/v1';
const ORIGIN = process.env.PIONEERS_TEST_ORIGIN ?? 'http://127.0.0.1:5180';
const runId = `PIONEER_${Date.now()}_${randomBytes(6).toString('hex')}`;
const manifestPath = `/tmp/xamuko-pioneers-${runId}.json`;

type Manifest = {
  runId: string; database: typeof DB; manifestPath: string; passwordless: true;
  ids: { users: string[]; adminRoleAssignments: string[]; accounts: string[]; businesses: string[]; memberships: string[]; brands: string[]; claims: string[]; assignments: string[]; categoryIds: string[]; subscriptionIds: string[]; locationIds: string[]; auditLogIds: string[]; authIdentityIds?: string[]; sessionIds?: string[] };
};
const ids: Manifest['ids'] = { users: [], adminRoleAssignments: [], accounts: [], businesses: [], memberships: [], brands: [], claims: [], assignments: [], categoryIds: [], subscriptionIds: [], locationIds: [], auditLogIds: [], authIdentityIds: [], sessionIds: [] };
const checks: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail = '') { checks.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` — ${detail}`}`); }
let prisma: any; let backend: ChildProcess | undefined; let adminPassword = ''; let unauthorizedPassword = '';

function manifest(): Manifest { return { runId, database: DB, manifestPath, passwordless: true, ids }; }
function persist() { writeFileSync(manifestPath, JSON.stringify(manifest(), null, 2), { mode: 0o600 }); }
function add(list: string[], id: string) { list.push(id); persist(); }
function targetUrl() { loadEnvFile('.env'); const raw = process.env.DATABASE_URL; if (!raw) throw new Error('DATABASE_URL no configurada.'); const url = new URL(raw); url.pathname = `/${DB}`; return url.toString(); }
async function verifyDatabase(url: string) { const u = new URL(url); const connection = await mariadb.createConnection({ host: u.hostname, port: Number(u.port || 3306), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: DB }); try { const rows = await connection.query('SELECT DATABASE() AS db'); if (String(rows[0]?.db) !== DB) throw new Error('La conexión no apunta a la base aislada autorizada.'); } finally { await connection.end(); } }
async function reconcileFixtureRelations() {
  if (!prisma || !ids.users.length) return;
  const assignments = ids.brands.length ? await prisma.pioneerAssignment.findMany({ where: { brandId: { in: ids.brands } }, select: { id: true, assignedById: true } }) : [];
  for (const row of assignments) { if (!ids.assignments.includes(row.id) && ids.users.includes(row.assignedById)) ids.assignments.push(row.id); }
  const identities = await prisma.authIdentity.findMany({ where: { userId: { in: ids.users } }, select: { id: true } });
  const sessions = await prisma.session.findMany({ where: { userId: { in: ids.users } }, select: { id: true } });
  for (const row of identities) { if (!ids.authIdentityIds!.includes(row.id)) ids.authIdentityIds!.push(row.id); }
  for (const row of sessions) { if (!ids.sessionIds!.includes(row.id)) ids.sessionIds!.push(row.id); }
  persist();
}

async function reconcileAuditLog() {
  if (!prisma) return;
  const entityIds = [...ids.businesses, ...ids.brands, ...ids.claims, ...ids.assignments];
  if (!entityIds.length) return;
  const rows = await prisma.auditLog.findMany({ where: { reason: { startsWith: runId }, entityId: { in: entityIds } }, select: { id: true } });
  const known = new Set(ids.auditLogIds); for (const row of rows) if (!known.has(row.id)) ids.auditLogIds.push(row.id);
  persist();
}
async function request(path: string, init: RequestInit = {}, token = '') { const headers = new Headers(init.headers); headers.set('Origin', ORIGIN); headers.set('Accept', 'application/json'); if (init.body) headers.set('Content-Type', 'application/json'); if (token) headers.set('Authorization', `Bearer ${token}`); const response = await fetch(`${API}${path}`, { ...init, headers }); let body: unknown = null; try { body = await response.json(); } catch {} await reconcileFixtureRelations(); await reconcileAuditLog(); return { response, body }; }
async function login(email: string, password = adminPassword) { const result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, rememberMe: false }) }); if (!result.response.ok || typeof (result.body as any)?.accessToken !== 'string') throw new Error(`Login HTTP ${result.response.status}`); return (result.body as any).accessToken as string; }


async function stopBackendProcess(process: ChildProcess | undefined): Promise<boolean> {
  if (!process) return true;
  if (process.exitCode !== null || process.signalCode !== null) return true;
  let settled = false;
  const waitForExit = (timeoutMs: number) => new Promise<boolean>(resolve => {
    const finish = (ok: boolean) => { if (settled) return; settled = true; clearTimeout(timer); process.removeListener('exit', onExit); process.removeListener('close', onClose); process.removeListener('error', onError); resolve(ok); };
    const onExit = () => finish(true); const onClose = () => finish(true); const onError = () => finish(false);
    const timer = setTimeout(() => finish(false), timeoutMs);
    process.once('exit', onExit); process.once('close', onClose); process.once('error', onError);
    if (process.exitCode !== null || process.signalCode !== null) finish(true);
  });
  process.kill('SIGTERM');
  if (await waitForExit(5000)) return true;
  if (process.exitCode !== null || process.signalCode !== null) return true;
  settled = false; process.kill('SIGKILL');
  if (await waitForExit(3000)) return true;
  console.error('El backend temporal no confirmó su cierre después de SIGTERM y SIGKILL.'); return false;
}

async function createFixtures() {
  const hash = await argon2.hash(adminPassword, { type: argon2.argon2id });
  const adminId = randomUUID(); add(ids.users, adminId);
  await prisma.user.create({ data: { id: adminId, displayName: `${runId} admin`, emailNormalized: `${runId.toLowerCase()}@example.invalid`, authIdentities: { create: { provider: 'EMAIL', providerSubject: `${runId.toLowerCase()}@example.invalid`, passwordHash: hash, verifiedAt: new Date() } } } });
  const roleId = randomUUID(); add(ids.adminRoleAssignments, roleId); await prisma.adminRoleAssignment.create({ data: { id: roleId, userId: adminId, role: 'SUPER_ADMIN' } });
  const categoryId = randomUUID(); add(ids.categoryIds, categoryId); await prisma.category.create({ data: { id: categoryId, code: `${runId}_category`, translations: { create: { locale: 'es-CO', name: `${runId} category` } } } });
  const accountId = randomUUID(); add(ids.accounts, accountId); await prisma.businessAccount.create({ data: { id: accountId, name: `${runId} account`, createdById: adminId } });
  const businessId = randomUUID(); add(ids.businesses, businessId); await prisma.business.create({ data: { id: businessId, businessAccountId: accountId, createdById: adminId, categoryId, name: `${runId} business`, slug: `${runId.toLowerCase()}-business`, lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', deletionStatus: 'NONE' } });
  const membershipId = randomUUID(); add(ids.memberships, membershipId); await prisma.businessMembership.create({ data: { id: membershipId, businessId, userId: adminId, role: 'OWNER', status: 'ACTIVE' } });
}
async function cleanupFromManifest(path: string) {
  const state = JSON.parse(readFileSync(path, 'utf8')) as Manifest; if (state.database !== DB) throw new Error('Manifiesto de base no autorizada.');
  const pending: string[] = []; const del = async (label: string, action: () => Promise<unknown>) => { try { await action(); } catch (error) { pending.push(`${label}: ${error instanceof Error ? error.message : String(error)}`); } };
  await del('auditLog', () => prisma.auditLog.deleteMany({ where: { id: { in: state.ids.auditLogIds } } }));
  await del('assignments', () => prisma.pioneerAssignment.deleteMany({ where: { id: { in: state.ids.assignments } } }));
  await del('sessions', () => prisma.session.deleteMany({ where: { id: { in: state.ids.sessionIds ?? [] } } }));
  await del('authIdentities', () => prisma.authIdentity.deleteMany({ where: { id: { in: state.ids.authIdentityIds ?? [] } } }));
  await del('subscriptions', () => prisma.businessSubscription.deleteMany({ where: { id: { in: state.ids.subscriptionIds ?? [] } } }));
  await del('locations', () => prisma.businessLocation.deleteMany({ where: { id: { in: state.ids.locationIds ?? [] } } }));
  await del('claims', () => prisma.businessClaim.deleteMany({ where: { id: { in: state.ids.claims } } }));
  await del('memberships', () => prisma.businessMembership.deleteMany({ where: { id: { in: state.ids.memberships } } }));
  await del('businesses', () => prisma.business.deleteMany({ where: { id: { in: state.ids.businesses } } }));
  await del('accounts', () => prisma.businessAccount.deleteMany({ where: { id: { in: state.ids.accounts } } }));
  await del('brands', () => prisma.businessBrand.deleteMany({ where: { id: { in: state.ids.brands } } }));
  await del('categories', () => prisma.category.deleteMany({ where: { id: { in: state.ids.categoryIds } } }));
  await del('adminRoles', () => prisma.adminRoleAssignment.deleteMany({ where: { id: { in: state.ids.adminRoleAssignments } } }));
  await del('users', () => prisma.user.deleteMany({ where: { id: { in: state.ids.users } } }));
  const remaining = await Promise.all([
    prisma.user.count({ where: { id: { in: state.ids.users } } }),
    prisma.adminRoleAssignment.count({ where: { id: { in: state.ids.adminRoleAssignments } } }),
    prisma.businessAccount.count({ where: { id: { in: state.ids.accounts } } }),
    prisma.business.count({ where: { id: { in: state.ids.businesses } } }),
    prisma.businessMembership.count({ where: { id: { in: state.ids.memberships } } }),
    prisma.businessBrand.count({ where: { id: { in: state.ids.brands } } }),
    prisma.businessClaim.count({ where: { id: { in: state.ids.claims } } }),
    prisma.businessSubscription.count({ where: { id: { in: state.ids.subscriptionIds ?? [] } } }),
    prisma.businessLocation.count({ where: { id: { in: state.ids.locationIds ?? [] } } }),
    prisma.pioneerAssignment.count({ where: { id: { in: state.ids.assignments } } }),
    prisma.category.count({ where: { id: { in: state.ids.categoryIds } } }),
    prisma.auditLog.count({ where: { id: { in: state.ids.auditLogIds } } }),
    prisma.authIdentity.count({ where: { id: { in: state.ids.authIdentityIds ?? [] } } }),
    prisma.session.count({ where: { id: { in: state.ids.sessionIds ?? [] } } }),
  ]);
  if (pending.length || remaining.some(Boolean)) throw new Error(`Limpieza incompleta: ${pending.join('; ')} registros restantes=${remaining.join(',')}`);
}
async function demoCreate() {
  if (readdirSync('/tmp').some(name => name.startsWith('xamuko-pioneers-') && name.endsWith('.json'))) throw new Error('Existe una demo o ejecución pendiente; limpia su manifiesto antes de crear otra.');
  if (await prisma.pioneerAssignment.count() > 0) throw new Error('La base aislada ya contiene asignaciones; se detiene para evitar duplicados.');
  const demoAdminPassword = randomBytes(24).toString('base64url');
  const demoOwnerPassword = randomBytes(24).toString('base64url');
  const adminEmail = `${runId.toLowerCase()}-admin@example.invalid`;
  const ownerEmail = `${runId.toLowerCase()}-owner@example.invalid`;
  const hashAdmin = await argon2.hash(demoAdminPassword, { type: argon2.argon2id });
  const hashOwner = await argon2.hash(demoOwnerPassword, { type: argon2.argon2id });
  const adminId = randomUUID(); add(ids.users, adminId);
  await prisma.user.create({ data: { id: adminId, displayName: `${runId} demo admin`, emailNormalized: adminEmail, authIdentities: { create: { provider: 'EMAIL', providerSubject: adminEmail, passwordHash: hashAdmin, verifiedAt: new Date() } } } });
  const ownerId = randomUUID(); add(ids.users, ownerId);
  await prisma.user.create({ data: { id: ownerId, displayName: `${runId} demo owner`, emailNormalized: ownerEmail, authIdentities: { create: { provider: 'EMAIL', providerSubject: ownerEmail, passwordHash: hashOwner, verifiedAt: new Date() } } } });
  const roleId = randomUUID(); add(ids.adminRoleAssignments, roleId); await prisma.adminRoleAssignment.create({ data: { id: roleId, userId: adminId, role: 'SUPER_ADMIN' } });
  const categoryId = randomUUID(); add(ids.categoryIds, categoryId); await prisma.category.create({ data: { id: categoryId, code: `${runId}_demo_category`, translations: { create: { locale: 'es-CO', name: `${runId} Demo` } } } });
  const accountId = randomUUID(); add(ids.accounts, accountId); await prisma.businessAccount.create({ data: { id: accountId, name: `${runId} Demo Account`, createdById: ownerId, status: 'ACTIVE' } });
  const businessId = randomUUID(); add(ids.businesses, businessId); await prisma.business.create({ data: { id: businessId, businessAccountId: accountId, createdById: ownerId, categoryId, name: `${runId} Negocio Pionero`, slug: `${runId.toLowerCase()}-demo`, description: 'Negocio ficticio para demostración de Pioneros.', lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', deletionStatus: 'NONE' } });
  const membershipId = randomUUID(); add(ids.memberships, membershipId); await prisma.businessMembership.create({ data: { id: membershipId, businessId, userId: ownerId, role: 'OWNER', status: 'ACTIVE' } });
  const locationId = randomUUID(); add(ids.locationIds, locationId); await prisma.businessLocation.create({ data: { id: locationId, businessId, countryCode: 'CO', regionCode: 'VAL', regionName: 'Valle del Cauca', cityName: 'Palmira', address: `${runId} ubicación demo`, latitude: 3.5394, longitude: -76.3036, visibility: 'PUBLIC', timezone: 'America/Bogota' } });
  const brandId = randomUUID(); add(ids.brands, brandId); await prisma.businessBrand.create({ data: { id: brandId, legalName: `${runId} Marca Pionera`, normalizedName: `${runId.toLowerCase()} marca pionera`, verification: 'VERIFIED', verifiedById: adminId, verifiedAt: new Date() } });
  await prisma.business.update({ where: { id: businessId }, data: { brandId } });
  const claimId = randomUUID(); add(ids.claims, claimId); await prisma.businessClaim.create({ data: { id: claimId, businessId, brandId, claimantId: ownerId, status: 'APPROVED', reviewedById: adminId, reviewedAt: new Date(), evidenceType: 'RUT', evidenceNote: `${runId} demo evidence` } });
  const assignmentId = randomUUID(); add(ids.assignments, assignmentId); await prisma.pioneerAssignment.create({ data: { id: assignmentId, brandId, number: 1, assignedById: adminId } });
  const auditId = randomUUID(); add(ids.auditLogIds, auditId); await prisma.auditLog.create({ data: { id: auditId, actorUserId: adminId, entityType: 'BUSINESS', entityId: brandId, action: 'PIONEER_ASSIGNED', previousState: Prisma.JsonNull, newState: { number: 1, brandId }, reason: runId } });
  persist();
  console.log(JSON.stringify({ runId, manifestPath, database: DB, urls: { usuario: 'http://127.0.0.1:5180', negocios: 'http://127.0.0.1:5181', admin: 'http://127.0.0.1:5182', backend: 'http://127.0.0.1:3103' }, credentials: { admin: { email: adminEmail, password: demoAdminPassword }, owner: { email: ownerEmail, password: demoOwnerPassword } } }));
}

function assertDemoBackendStopped() {
  try { const output = execFileSync('lsof', ['-nP', '-iTCP:3103', '-sTCP:LISTEN'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); if (output.trim()) throw new Error('El backend temporal 3103 sigue activo; deténlo antes de limpiar.'); } catch (error: any) { if (error?.status === 1) return; if (error?.message?.includes('sigue activo')) throw error; }
}

async function main() {
  const mode = process.argv[2] ?? 'help'; if (mode === 'cleanup') { const path = process.argv[3]; if (!path || !existsSync(path)) throw new Error('Uso: pioneers-integration.ts cleanup <manifest-path>'); const url = targetUrl(); await verifyDatabase(url); process.env.DATABASE_URL = url; ({ prisma } = await import('../src/config/prisma.js')); try { await cleanupFromManifest(path); console.log('Limpieza verificada.'); } finally { await prisma.$disconnect(); } return; }
  if (mode === 'demo-create') { const url = targetUrl(); await verifyDatabase(url); process.env.DATABASE_URL = url; ({ prisma } = await import('../src/config/prisma.js')); try { await demoCreate(); } finally { await prisma.$disconnect(); } return; }
  if (mode === 'demo-cleanup') { const path = process.argv[3]; if (!path || !existsSync(path)) throw new Error('Uso: pioneers-integration.ts demo-cleanup <manifest-path>'); assertDemoBackendStopped(); const url = targetUrl(); await verifyDatabase(url); process.env.DATABASE_URL = url; ({ prisma } = await import('../src/config/prisma.js')); try { await cleanupFromManifest(path); } finally { await prisma.$disconnect(); } return; }
  if (mode !== 'run') { console.log('Uso: pioneers-integration.ts run | cleanup <manifest-path> | demo-create | demo-cleanup <manifest-path>'); return; }
  const url = targetUrl(); await verifyDatabase(url); process.env.DATABASE_URL = url; ({ prisma } = await import('../src/config/prisma.js')); const existingAssignments = await prisma.pioneerAssignment.count(); if (existingAssignments > 0) throw new Error(`La base aislada ya contiene ${existingAssignments} asignaciones; se detiene sin borrar registros ajenos.`); adminPassword = randomBytes(24).toString('base64url'); persist();
  try { await createFixtures(); backend = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url, PORT: '3103', HOST: '127.0.0.1', AUTH_TRUSTED_ORIGINS: ORIGIN, NODE_ENV: 'test' }, stdio: 'inherit' }); for (let i = 0; i < 40; i++) { try { if ((await fetch('http://127.0.0.1:3103/api/v1/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); } const token = await login(`${runId.toLowerCase()}@example.invalid`);
    const unauthorizedUserId = randomUUID(); add(ids.users, unauthorizedUserId); unauthorizedPassword = randomBytes(24).toString('base64url'); const unauthorizedEmail = `${runId.toLowerCase()}-unauthorized@example.invalid`; await prisma.user.create({ data: { id: unauthorizedUserId, displayName: `${runId} unauthorized`, emailNormalized: unauthorizedEmail, authIdentities: { create: { provider: 'EMAIL', providerSubject: unauthorizedEmail, passwordHash: await argon2.hash(unauthorizedPassword, { type: argon2.argon2id }), verifiedAt: new Date() } } } });
    const unauth = await request('/admin/pioneers'); check('sin autorización rechazado', unauth.response.status === 401, `${unauth.response.status}`); const unauthorizedToken = await login(unauthorizedEmail, unauthorizedPassword); const forbidden = await request('/admin/pioneers', {}, unauthorizedToken); check('propietario sin permiso rechazado', forbidden.response.status === 403, `${forbidden.response.status}`);
    const registry = await request('/admin/pioneers', {}, token); check('permiso PIONEER_MANAGE', registry.response.status === 200 && (registry.body as any)?.max === 20, `${registry.response.status}`);
    const primary = ids.businesses[0];
    const eligible: { brandId: string; businessId: string }[] = [];
    for (let n = 1; n <= 18; n++) {
      const accountId = randomUUID(); add(ids.accounts, accountId); await prisma.businessAccount.create({ data: { id: accountId, name: `${runId} account ${n}`, createdById: ids.users[0] } });
      const businessId = randomUUID(); add(ids.businesses, businessId); await prisma.business.create({ data: { id: businessId, businessAccountId: accountId, createdById: ids.users[0], categoryId: ids.categoryIds[0], name: `${runId} eligible ${n}`, slug: `${runId.toLowerCase()}-eligible-${n}`, lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', deletionStatus: 'NONE' } });
      const membershipId = randomUUID(); add(ids.memberships, membershipId); await prisma.businessMembership.create({ data: { id: membershipId, businessId, userId: ids.users[0], role: 'OWNER', status: 'ACTIVE' } });
      const brandId = randomUUID(); add(ids.brands, brandId); await prisma.businessBrand.create({ data: { id: brandId, legalName: `${runId} legal ${n}`, normalizedName: `${runId.toLowerCase()} legal ${n}`, verification: 'VERIFIED', verifiedById: ids.users[0], verifiedAt: new Date() } });
      await prisma.business.update({ where: { id: businessId }, data: { brandId } });
      const claimId = randomUUID(); add(ids.claims, claimId); await prisma.businessClaim.create({ data: { id: claimId, businessId, brandId, claimantId: ids.users[0], status: 'APPROVED', evidenceType: 'RUT', evidenceNote: `${runId} approved evidence ${n}` } });
      eligible.push({ brandId, businessId });
    }
    const branchBrand = randomUUID(); add(ids.brands, branchBrand); await prisma.businessBrand.create({ data: { id: branchBrand, legalName: `${runId} branches`, normalizedName: `${runId.toLowerCase()} branches`, verification: 'VERIFIED', verifiedById: ids.users[0], verifiedAt: new Date() } }); const branchClaim = randomUUID(); add(ids.claims, branchClaim); await prisma.businessClaim.create({ data: { id: branchClaim, businessId: primary, brandId: branchBrand, claimantId: ids.users[0], status: 'APPROVED', evidenceType: 'RUT' } }); const secondBranchAccount = randomUUID(); add(ids.accounts, secondBranchAccount); await prisma.businessAccount.create({ data: { id: secondBranchAccount, name: `${runId} branch account`, createdById: ids.users[0], status: 'ACTIVE' } }); const secondBranch = randomUUID(); add(ids.businesses, secondBranch); await prisma.business.create({ data: { id: secondBranch, businessAccountId: secondBranchAccount, createdById: ids.users[0], categoryId: ids.categoryIds[0], name: `${runId} second branch`, slug: `${runId.toLowerCase()}-second-branch`, lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', deletionStatus: 'NONE', brandId: branchBrand } }); const secondBranchMembership = randomUUID(); add(ids.memberships, secondBranchMembership); await prisma.businessMembership.create({ data: { id: secondBranchMembership, businessId: secondBranch, userId: ids.users[0], role: 'OWNER', status: 'ACTIVE' } }); await prisma.business.update({ where: { id: primary }, data: { brandId: branchBrand } }); const branchAssignment = await request(`/admin/pioneers/brands/${branchBrand}/assign`, { method: 'POST', body: JSON.stringify({ reason: `${runId} branches` }) }, token); if ((branchAssignment.body as any)?.assignment?.id) add(ids.assignments, (branchAssignment.body as any).assignment.id); const branchDuplicate = await request(`/admin/pioneers/brands/${branchBrand}/assign`, { method: 'POST', body: JSON.stringify({ reason: `${runId} branches duplicate` }) }, token); check('sucursales comparten un cupo', branchAssignment.response.status === 201 && branchDuplicate.response.status === 409, `${branchAssignment.response.status}/${branchDuplicate.response.status}`);
    const comparableToken = `${runId} showcase`;
    await prisma.business.update({ where: { id: primary }, data: { name: comparableToken, description: comparableToken } });
    await prisma.business.update({ where: { id: secondBranch }, data: { name: comparableToken, description: comparableToken } });
    await prisma.business.update({ where: { id: eligible[0].businessId }, data: { name: comparableToken, description: comparableToken } });
    await prisma.business.update({ where: { id: eligible[1].businessId }, data: { name: comparableToken, description: comparableToken } });
    for (const [businessId, latitude, longitude] of [[primary, 4.71099, -74.07209], [secondBranch, 4.7111, -74.072], [eligible[0].businessId, 4.7112, -74.0719], [eligible[1].businessId, 4.7113, -74.0718], [eligible[2].businessId, 6.25184, -75.56359]] as const) {
      const locationId = randomUUID(); add(ids.locationIds, locationId);
      await prisma.businessLocation.create({ data: { id: locationId, businessId, countryCode: 'CO', regionCode: 'BOG', regionName: 'Bogotá D.C.', cityName: 'Bogotá', address: `${runId} address`, latitude, longitude, visibility: 'PUBLIC', timezone: 'America/Bogota' } });
    }
    const featuredSubscriptionId = randomUUID(); add(ids.subscriptionIds, featuredSubscriptionId);
    await prisma.businessSubscription.create({ data: { id: featuredSubscriptionId, businessId: secondBranch, plan: 'PRO', status: 'ACTIVE', startsAt: new Date(Date.now() - 86_400_000), expiresAt: new Date(Date.now() + 31_536_000_000), autoRenew: false } });
    const outsideBrand = eligible[2].brandId;
    const outsideAssignment = await request(`/admin/pioneers/brands/${outsideBrand}/assign`, { method: 'POST', body: JSON.stringify({ reason: `${runId} outside radius` }) }, token);
    const outsideAssignmentId = (outsideAssignment.body as any)?.assignment?.id;
    if (outsideAssignmentId) add(ids.assignments, outsideAssignmentId);
    check('fixture pionero fuera del radio', outsideAssignment.response.status === 201, `${outsideAssignment.response.status}`);
    const prioritySearch = await request(`/public/search?q=${encodeURIComponent(comparableToken)}&latitude=4.711&longitude=-74.072&radiusKm=5&businessPage=1&businessPageSize=10`);
    const priorityBusinesses = (prioritySearch.body as any)?.businesses ?? [];
    const priorityIds = priorityBusinesses.map((item: any) => item.publicId);
    const priorityNumbers = priorityBusinesses.map((item: any) => item.pioneerNumber);
    check('prioridad pionero antes de destacado y ordinario', prioritySearch.response.status === 200 && priorityNumbers.indexOf(1) < priorityNumbers.indexOf(null), `${prioritySearch.response.status}`);
    check('pionero destacado sin duplicación', prioritySearch.response.status === 200 && new Set(priorityIds).size === priorityIds.length, `duplicados=${priorityIds.length - new Set(priorityIds).size}`);
    const outsideSearch = await request(`/public/search?q=${encodeURIComponent(comparableToken)}&latitude=4.711&longitude=-74.072&radiusKm=5&businessPage=1&businessPageSize=50`);
    const outsidePublicId = (await prisma.business.findUnique({ where: { id: eligible[2].businessId }, select: { publicId: true } }))?.publicId;
    check('pionero fuera del radio excluido', outsideSearch.response.status === 200 && !(outsideSearch.body as any)?.businesses?.some((item: any) => item.publicId === outsidePublicId), `${outsideSearch.response.status}`);
    const irrelevantSearch = await request(`/public/search?q=${encodeURIComponent(`${runId} no-match`)}&businessPage=1&businessPageSize=50`);
    check('pionero irrelevante excluido', irrelevantSearch.response.status === 200 && !(irrelevantSearch.body as any)?.businesses?.some((item: any) => item.name === comparableToken), `${irrelevantSearch.response.status}`);
    const pageOne = await request(`/public/search?q=${encodeURIComponent(comparableToken)}&businessPage=1&businessPageSize=2`);
    const pageTwo = await request(`/public/search?q=${encodeURIComponent(comparableToken)}&businessPage=2&businessPageSize=2`);
    const pageOneIds = ((pageOne.body as any)?.businesses ?? []).map((item: any) => item.publicId);
    const pageTwoIds = ((pageTwo.body as any)?.businesses ?? []).map((item: any) => item.publicId);
    check('paginación estable sin duplicados', pageOne.response.status === 200 && pageTwo.response.status === 200 && pageOneIds.every((id: string) => !pageTwoIds.includes(id)), `${pageOne.response.status}/${pageTwo.response.status}`);
    const concurrentBrand = randomUUID(); add(ids.brands, concurrentBrand); const concurrentAccount = randomUUID(); add(ids.accounts, concurrentAccount); await prisma.businessAccount.create({ data: { id: concurrentAccount, name: `${runId} concurrent account`, createdById: ids.users[0], status: 'ACTIVE' } }); const concurrentBusiness = randomUUID(); add(ids.businesses, concurrentBusiness); await prisma.businessBrand.create({ data: { id: concurrentBrand, legalName: `${runId} concurrent`, normalizedName: `${runId.toLowerCase()} concurrent`, verification: 'VERIFIED', verifiedById: ids.users[0], verifiedAt: new Date() } }); await prisma.business.create({ data: { id: concurrentBusiness, businessAccountId: concurrentAccount, createdById: ids.users[0], categoryId: ids.categoryIds[0], brandId: concurrentBrand, name: `${runId} concurrent business`, slug: `${runId.toLowerCase()}-concurrent-business`, lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', deletionStatus: 'NONE' } }); const concurrentMembership = randomUUID(); add(ids.memberships, concurrentMembership); await prisma.businessMembership.create({ data: { id: concurrentMembership, businessId: concurrentBusiness, userId: ids.users[0], role: 'OWNER', status: 'ACTIVE' } }); const concurrentClaim = randomUUID(); add(ids.claims, concurrentClaim); await prisma.businessClaim.create({ data: { id: concurrentClaim, businessId: concurrentBusiness, brandId: concurrentBrand, claimantId: ids.users[0], status: 'APPROVED', evidenceType: 'RUT' } }); const concurrentEligibility = await prisma.business.findUnique({ where: { id: concurrentBusiness }, select: { lifecycleStatus: true, publicationStatus: true, visibilityStatus: true, brandId: true, businessAccount: { select: { status: true } } } }); const concurrentBrandRow = await prisma.businessBrand.findUnique({ where: { id: concurrentBrand }, select: { verification: true } }); const concurrentApprovedClaim = await prisma.businessClaim.count({ where: { businessId: concurrentBusiness, brandId: concurrentBrand, status: 'APPROVED' } }); const availableBeforeConcurrency = 20 - await prisma.pioneerAssignment.count(); check('fixture concurrencia elegible', concurrentEligibility?.lifecycleStatus === 'ACTIVE' && concurrentEligibility.publicationStatus === 'PUBLISHED' && concurrentEligibility.visibilityStatus === 'VISIBLE' && concurrentEligibility.brandId === concurrentBrand && concurrentEligibility.businessAccount.status === 'ACTIVE' && concurrentBrandRow?.verification === 'VERIFIED' && concurrentApprovedClaim === 1 && availableBeforeConcurrency > 0, `disponibles=${availableBeforeConcurrency}`); if (!concurrentEligibility || concurrentEligibility.lifecycleStatus !== 'ACTIVE' || concurrentEligibility.publicationStatus !== 'PUBLISHED' || concurrentEligibility.visibilityStatus !== 'VISIBLE' || concurrentEligibility.brandId !== concurrentBrand || concurrentEligibility.businessAccount.status !== 'ACTIVE' || concurrentBrandRow?.verification !== 'VERIFIED' || concurrentApprovedClaim !== 1 || availableBeforeConcurrency <= 0) throw new Error('Fixture de concurrencia no elegible.'); const concurrent = await Promise.all([1, 2].map(i => request(`/admin/pioneers/brands/${concurrentBrand}/assign`, { method: 'POST', body: JSON.stringify({ reason: `${runId} concurrent ${i}` }) }, token))); concurrent.forEach(result => { const id = (result.body as any)?.assignment?.id; if (id) add(ids.assignments, id); }); const concurrentSuccesses = concurrent.filter(x => x.response.status === 201); check('concurrencia controlada', concurrentSuccesses.length === 1 && concurrent.every(x => x.response.status === 201 || x.response.status === 409), concurrent.map(x => x.response.status).join(',')); if (concurrentSuccesses.length !== 1) throw new Error(`La concurrencia no consumió exactamente un cupo: ${concurrent.map(x => x.response.status).join(',')}`);
    const unassignedBusiness = await prisma.business.findUnique({ where: { id: eligible[0].businessId }, select: { publicId: true } });
    if (!unassignedBusiness?.publicId) throw new Error('Fixture sin asignación no tiene publicId.');
    const unassignedList = await request('/public/businesses?page=1&pageSize=50');
    const unassignedListed = (unassignedList.body as any)?.businesses?.find((item: any) => item.publicId === unassignedBusiness.publicId);
    const unassignedSearch = await request(`/public/search?q=${encodeURIComponent(runId)}&businessPage=1&businessPageSize=50`);
    const unassignedSearched = (unassignedSearch.body as any)?.businesses?.find((item: any) => item.publicId === unassignedBusiness.publicId);
    const unassignedDetail = await request(`/public/businesses/${encodeURIComponent(unassignedBusiness.publicId)}`);
    check('negocio sin asignación no muestra reconocimiento', unassignedList.response.status === 200 && unassignedSearch.response.status === 200 && unassignedDetail.response.status === 200 && unassignedListed?.pioneerNumber === null && unassignedSearched?.pioneerNumber === null && (unassignedDetail.body as any)?.business?.pioneerNumber === null, `${unassignedList.response.status}/${unassignedSearch.response.status}/${unassignedDetail.response.status}`);
    const assignedBeforeFill = await prisma.pioneerAssignment.count(); const remainingSlots = 20 - new Set(ids.assignments).size; check('conteo previo de cupos', remainingSlots >= 0 && remainingSlots <= eligible.length, `asignadas=${assignedBeforeFill}, disponibles=${remainingSlots}`); if (remainingSlots < 0 || remainingSlots > eligible.length) throw new Error(`Conteo de cupos incoherente: ${assignedBeforeFill} asignadas, ${eligible.length} elegibles`);
    const assignmentResults: any[] = []; for (const item of eligible.filter(item => item.brandId !== outsideBrand).slice(0, remainingSlots)) assignmentResults.push(await request(`/admin/pioneers/brands/${item.brandId}/assign`, { method: 'POST', body: JSON.stringify({ reason: `${runId} slot` }) }, token));
    assignmentResults.forEach(result => { const id = (result.body as any)?.assignment?.id; if (id) add(ids.assignments, id); });
    check('cupos restantes asignados', assignmentResults.every(x => x.response.status === 201) && new Set(assignmentResults.map(x => (x.body as any)?.assignment?.number)).size === assignmentResults.length, assignmentResults.map(x => x.response.status).join(','));
    const fullRegistry = await request('/admin/pioneers', {}, token); check('números 001–020', fullRegistry.response.status === 200 && (fullRegistry.body as any).assignments.length === 20 && new Set((fullRegistry.body as any).assignments.map((item: any) => item.number)).size === 20 && Array.from({ length: 20 }, (_, index) => index + 1).every(number => (fullRegistry.body as any).assignments.some((item: any) => item.number === number)) && (fullRegistry.body as any).available === 0, JSON.stringify(fullRegistry.body));
    const pioneerBusiness = await prisma.business.findUnique({ where: { id: primary }, select: { publicId: true } });
    if (!pioneerBusiness?.publicId) throw new Error('Fixture público sin publicId.');
    const publicList = await request('/public/businesses?page=1&pageSize=50');
    const listed = (publicList.body as any)?.businesses?.find((item: any) => item.publicId === pioneerBusiness.publicId);
    check('pioneerNumber en listado público', publicList.response.status === 200 && listed?.pioneerNumber === 1, `${publicList.response.status}`);
    const publicSearch = await request(`/public/search?q=${encodeURIComponent(runId)}&businessPage=1&businessPageSize=50`);
    const searched = (publicSearch.body as any)?.businesses?.find((item: any) => item.publicId === pioneerBusiness.publicId);
    check('pioneerNumber en búsqueda pública', publicSearch.response.status === 200 && searched?.pioneerNumber === 1, `${publicSearch.response.status}`);
    const publicDetail = await request(`/public/businesses/${encodeURIComponent(pioneerBusiness.publicId)}`);
    check('pioneerNumber en detalle público', publicDetail.response.status === 200 && (publicDetail.body as any)?.business?.pioneerNumber === 1, `${publicDetail.response.status}`);
    const businessList = await request('/businesses', {}, token);
    const authenticatedBusiness = (businessList.body as any)?.businesses?.find((item: any) => item.id === primary);
    check('pioneerNumber en Business autenticado', businessList.response.status === 200 && authenticatedBusiness?.pioneerNumber === 1, `${businessList.response.status}`);
    const extraBrand = randomUUID(); add(ids.brands, extraBrand); await prisma.businessBrand.create({ data: { id: extraBrand, legalName: `${runId} over limit`, normalizedName: `${runId.toLowerCase()} over limit`, verification: 'VERIFIED', verifiedById: ids.users[0], verifiedAt: new Date() } }); const extraAccount = randomUUID(); add(ids.accounts, extraAccount); await prisma.businessAccount.create({ data: { id: extraAccount, name: `${runId} over limit account`, createdById: ids.users[0], status: 'ACTIVE' } }); const extraBusiness = randomUUID(); add(ids.businesses, extraBusiness); await prisma.business.create({ data: { id: extraBusiness, businessAccountId: extraAccount, createdById: ids.users[0], categoryId: ids.categoryIds[0], brandId: extraBrand, name: `${runId} over limit business`, slug: `${runId.toLowerCase()}-over-limit-business`, lifecycleStatus: 'ACTIVE', publicationStatus: 'PUBLISHED', visibilityStatus: 'VISIBLE', deletionStatus: 'NONE' } }); const extraMembership = randomUUID(); add(ids.memberships, extraMembership); await prisma.businessMembership.create({ data: { id: extraMembership, businessId: extraBusiness, userId: ids.users[0], role: 'OWNER', status: 'ACTIVE' } }); const extraClaim = randomUUID(); add(ids.claims, extraClaim); await prisma.businessClaim.create({ data: { id: extraClaim, businessId: extraBusiness, brandId: extraBrand, claimantId: ids.users[0], status: 'APPROVED', evidenceType: 'RUT' } }); const assignmentsBefore21 = await prisma.pioneerAssignment.count(); const over = await request(`/admin/pioneers/brands/${extraBrand}/assign`, { method: 'POST', body: JSON.stringify({ reason: `${runId} 21` }) }, token); const assignmentsAfter21 = await prisma.pioneerAssignment.count(); const overCode = (over.body as any)?.error?.code; check('cupo 021 rechazado', over.response.status === 409 && overCode === 'PIONEER_LIMIT_REACHED' && assignmentsAfter21 === assignmentsBefore21 && assignmentsAfter21 === 20, `${over.response.status} ${overCode ?? ''} assignments=${assignmentsAfter21}`);

    const variantStatuses = [['DRAFT', 'PUBLISHED', 'VISIBLE'], ['ACTIVE', 'UNPUBLISHED', 'VISIBLE'], ['ACTIVE', 'PUBLISHED', 'HIDDEN']] as const;
    for (const [index, [lifecycleStatus, publicationStatus, visibilityStatus]] of variantStatuses.entries()) { const businessId = randomUUID(); add(ids.businesses, businessId); const accountId = randomUUID(); add(ids.accounts, accountId); await prisma.businessAccount.create({ data: { id: accountId, name: `${runId} blocked account ${index}`, createdById: ids.users[0], status: 'ACTIVE' } }); const brandId = randomUUID(); add(ids.brands, brandId); await prisma.businessBrand.create({ data: { id: brandId, legalName: `${runId} blocked brand ${index}`, normalizedName: `${runId.toLowerCase()} blocked ${index}`, verification: 'VERIFIED', verifiedById: ids.users[0], verifiedAt: new Date() } }); await prisma.business.create({ data: { id: businessId, businessAccountId: accountId, createdById: ids.users[0], categoryId: ids.categoryIds[0], brandId, name: `${runId} blocked ${index}`, slug: `${runId.toLowerCase()}-blocked-${index}`, lifecycleStatus, publicationStatus, visibilityStatus, deletionStatus: 'NONE' } }); const claimId = randomUUID(); add(ids.claims, claimId); await prisma.businessClaim.create({ data: { id: claimId, businessId, brandId, claimantId: ids.users[0], status: 'APPROVED', evidenceType: 'RUT' } }); const blocked = await request(`/admin/pioneers/brands/${brandId}/assign`, { method: 'POST', body: JSON.stringify({ reason: `${runId} blocked` }) }, token); check(`rechazar estado no elegible ${index + 1}`, blocked.response.status === 409, `${blocked.response.status}`); }
    const before = await prisma.pioneerAssignment.count(); check('límite previo consistente', before >= 1 && before <= 20, `assignments=${before}`);
    await reconcileAuditLog(); check('auditoría recuperable', ids.auditLogIds.length >= 3, `audit=${ids.auditLogIds.length}`);
    console.log(JSON.stringify({ runId, manifestPath, database: DB })); } finally {
    const backendStopped = await stopBackendProcess(backend);
    if (backendStopped && existsSync(manifestPath)) {
      try { await reconcileFixtureRelations(); await reconcileAuditLog(); await cleanupFromManifest(manifestPath); } catch (error) { console.error(error instanceof Error ? error.message : error); }
    } else if (!backendStopped) { console.error(`Limpieza diferida: el backend podría seguir escribiendo. Manifiesto: ${manifestPath}`); }
    if (existsSync(manifestPath)) console.error(`Manifiesto conservado para recuperación: ${manifestPath}`);
    else console.log('Limpieza verificada y manifiesto eliminado.');
    await prisma.$disconnect();
  }
}
void main().catch(error => { console.error(JSON.stringify({ runId, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined })); process.exitCode = 1; });
