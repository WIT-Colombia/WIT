import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { app } from '../../app.js';
let server: ReturnType<typeof app.listen>; let base = '';
before(async () => { server = app.listen(0); await new Promise<void>(resolve => server.once('listening', () => resolve())); const address = server.address(); if (!address || typeof address === 'string') throw new Error('No se pudo iniciar el harness HTTP.'); base = 'http://127.0.0.1:' + address.port; });
after(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
async function request(path: string, init: RequestInit = {}) { return fetch(base + path, { ...init, redirect: 'manual', headers: { accept: 'application/json', ...(init.headers ?? {}) } }); }
test('rechaza activación sin código independiente', async () => { const response = await request('/api/v1/admin/auth/passkey/activation/options'); assert.equal(response.status, 403); assert.equal((await response.json() as any).error.code, 'ADMIN_ACTIVATION_AUTH_REQUIRED'); });
test('rechaza código de activación incorrecto sin revelar el valor', async () => { const response = await request('/api/v1/admin/auth/passkey/activation/options', { headers: { 'x-admin-activation-code': 'incorrecto' } }); assert.notEqual(response.status, 200); const body = await response.text(); assert.equal(body.includes('incorrecto'), false); });
test('rechaza registro WebAuthn sin autorización temporal', async () => { const response = await request('/api/v1/admin/auth/passkey/activation/verify', { method: 'POST', body: JSON.stringify({}), headers: { 'content-type': 'application/json' } }); assert.equal(response.status, 401); });
test('rechaza JWT normal en una ruta Admin', async () => { const response = await request('/api/v1/admin/me', { headers: { authorization: 'Bearer test.jwt.token' } }); assert.equal(response.status, 401); });
test('rechaza acceso Admin sin AdminSession y sin segundo factor', async () => { const response = await request('/api/v1/admin/me'); assert.equal(response.status, 401); });
