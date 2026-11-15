import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';

const storage = await mkdtemp(join(tmpdir(), 'xamuko-document-test-'));
process.env.ADMIN_DOCUMENT_STORAGE_BACKEND = 'local';
process.env.ADMIN_DOCUMENT_STORAGE_DIR = storage;
const { app } = await import('../../app.js');
const { prisma } = await import('../../config/prisma.js');
const { env } = await import('../../config/env.js');

test('Archivo documental: sesión real, PDF privado, papelera y auditoría (MySQL aislado)', async t => {
  assert.notEqual(env.nodeEnv, 'production');
  assert.match(new URL(env.databaseUrl!).pathname, /test/i, 'Este test solo admite una base de pruebas');
  const server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/v1/admin`;
  const origin = env.trustedOrigins[0] || 'http://localhost:5176';
  const seed = randomUUID().slice(0, 8), email = `document-${seed}@example.invalid`, password = `Document-${seed}-password`;
  const user = await prisma.user.create({ data: { displayName: 'Cuenta de prueba documental', emailNormalized: email, authIdentities: { create: { provider: 'EMAIL', providerSubject: email, passwordHash: await argon2.hash(password), verifiedAt: new Date() } }, adminRoleAssignments: { create: { role: 'SUPER_ADMIN', active: true } } } });
  let cookie = '', csrf = '', id = '';
  const request = (path: string, init: RequestInit = {}, authenticated = true) => {
    const headers = new Headers(init.headers); if (!headers.has('Origin')) headers.set('Origin', origin);
    if (authenticated) { headers.set('Cookie', cookie); headers.set('X-Admin-CSRF', csrf); }
    if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    return fetch(base + path, { ...init, headers, signal: AbortSignal.timeout(15000) });
  };
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
  const form = (content: Buffer = pdf, mime = 'application/pdf') => { const body = new FormData(); body.set('section', 'CORPORATE'); body.set('title', 'Estatutos de prueba'); body.set('description', 'Documento de prueba aislado'); body.set('file', new Blob([new Uint8Array(content)], { type: mime }), 'estatutos.pdf'); return body; };
  try {
    const login = await request('/auth/password', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
    assert.equal(login.status, 200); const payload = await login.json() as any; csrf = payload.csrfToken;
    cookie = login.headers.getSetCookie().find(line => line.startsWith('xamuko_admin_session='))!.split(';')[0];
    await t.test('finanzas admite AdminSession sin token de Usuario y rechaza visitantes', async () => {
      assert.equal((await request('/finance/summary')).status, 200);
      assert.equal((await request('/finance/summary', {}, false)).status, 401);
    });
    await t.test('deniega documentos y cargas sin sesión administrativa y sin CSRF', async () => {
      assert.equal((await request('/documents?section=CORPORATE', {}, false)).status, 401);
      assert.equal((await request('/documents', { method: 'POST', body: form() }, false)).status, 401);
      const missingCsrf = await fetch(base + '/documents', { method: 'POST', headers: { Cookie: cookie, Origin: origin }, body: form() });
      assert.equal(missingCsrf.status, 403);
      assert.equal((await request('/documents', { method: 'POST', headers: { Origin: 'https://untrusted.example' }, body: form() })).status, 403);
    });
    await t.test('rechaza contenidos no PDF y archivos demasiado grandes', async () => {
      assert.equal((await request('/documents', { method: 'POST', body: form(Buffer.from('<script>bad</script>')) })).status, 415);
      assert.equal((await request('/documents', { method: 'POST', body: form(pdf, 'text/html') })).status, 415);
      assert.equal((await request('/documents', { method: 'POST', body: form(Buffer.alloc(10 * 1024 * 1024 + 1)) })).status, 413);
    });
    await t.test('adjunta, lista y recupera el PDF sin exponer almacenamiento', async () => {
      const upload = await request('/documents', { method: 'POST', body: form() });
      assert.equal(upload.status, 201); const body = await upload.json() as any; id = body.document.id;
      assert.ok(id); assert.equal(body.document.storageKey, undefined); assert.equal(body.document.sha256, undefined);
      const list = await request('/documents?section=CORPORATE&q=Estatutos');
      assert.match(list.headers.get('cache-control')!, /no-store/);
      const rows = await list.json() as any; assert.ok(rows.documents.some((item: any) => item.id === id)); assert.ok(rows.summary.active >= 1);
      const content = await request(`/documents/${id}/content`); assert.equal(content.status, 200); assert.match(content.headers.get('content-type')!, /application\/pdf/); assert.match(content.headers.get('content-disposition')!, /attachment/);
      assert.equal(content.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(createHash('sha256').update(Buffer.from(await content.arrayBuffer())).digest('hex'), createHash('sha256').update(pdf).digest('hex'));
      assert.equal((await request(`/documents/${id}/content`, {}, false)).status, 401);
    });
    await t.test('elimina con motivo, bloquea lectura y restaura con auditoría', async () => {
      assert.equal((await request(`/documents/${id}`, { method: 'DELETE', body: JSON.stringify({ reason: 'corto' }) })).status, 400);
      assert.equal((await request(`/documents/${id}`, { method: 'DELETE', body: JSON.stringify({ reason: 'Sustituido por una versión más reciente.' }) })).status, 200);
      assert.equal((await request(`/documents/${id}/content`)).status, 404);
      const trash = await (await request('/documents?section=CORPORATE&trash=true')).json() as any;
      assert.ok(trash.documents.some((item: any) => item.id === id));
      assert.equal((await request(`/documents/${id}/restore`, { method: 'POST', body: '{}' })).status, 200);
      assert.equal((await request(`/documents/${id}/content`)).status, 200);
      const events = await prisma.auditLog.findMany({ where: { entityId: id } });
      assert.deepEqual(events.map(event => event.action).sort(), ['ADMIN_DOCUMENT_RESTORED', 'ADMIN_DOCUMENT_TRASHED', 'ADMIN_DOCUMENT_UPLOADED']);
    });
  } finally {
    await prisma.auditLog.deleteMany({ where: { actorUserId: user.id } });
    await prisma.adminDocument.deleteMany({ where: { uploadedById: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.$disconnect(); await rm(storage, { recursive: true, force: true });
  }
});
