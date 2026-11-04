import { appendFileSync } from 'node:fs';

const origin = 'https://admin.xamuko.com';
const api = 'https://api.xamuko.com/api/v1';
const rows = [];
async function check(name, url, init, validate) {
  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000), ...init });
    const json = await response.json().catch(() => null);
    const code = typeof json?.error?.code === 'string' ? json.error.code.replace(/[^A-Z0-9_]/g, '').slice(0, 80) : '';
    rows.push({ name, passed: validate(response, json), status: response.status, code });
  } catch {
    rows.push({ name, passed: false, status: 'network-error', code: '' });
  }
}
await check('Admin responde por HTTPS (no valida login)', origin, {}, r => r.status === 200);
await check('API health', api + '/health', {}, r => r.status === 200);
await check('CORS admite Admin y CSRF', api + '/admin/auth/password', {
  method: 'OPTIONS',
  headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-admin-csrf' },
}, r => r.status === 204 && r.headers.get('access-control-allow-origin') === origin
  && r.headers.get('access-control-allow-credentials') === 'true'
  && /x-admin-csrf/i.test(r.headers.get('access-control-allow-headers') ?? ''));
await check('CORS rechaza origen ajeno', api + '/admin/auth/password', {
  method: 'OPTIONS',
  headers: { origin: 'https://untrusted.example.test', 'access-control-request-method': 'POST' },
}, r => r.status === 403);
await check('Password publicado: cuerpo vacío devuelve INVALID_INPUT, sin sesión previa', api + '/admin/auth/password', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}',
}, (r, body) => r.status === 400 && body?.error?.code === 'INVALID_INPUT'
  && !r.headers.getSetCookie().some(cookie => cookie.startsWith('xamuko_admin_session=')));
await check('Session rechaza visitante anónimo', api + '/admin/auth/session', {}, r => r.status === 401);
await check('Panel API rechaza visitante anónimo', api + '/admin/me', {}, r => r.status === 401);

const deployment = {
  enabled: process.env.DEPLOY_ENABLED === 'true',
  roleConfigured: process.env.ROLE_CONFIGURED === 'true',
  instanceConfigured: process.env.INSTANCE_CONFIGURED === 'true',
  bucketConfigured: process.env.BUCKET_CONFIGURED === 'true',
};
console.log(JSON.stringify({ deployment, checks: rows }, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '# Diagnóstico público de XAMUKO Admin\n\n' +
    '| Comprobación | Resultado | HTTP | Código |\n|---|---|---|---|\n' +
    rows.map(row => '| ' + row.name + ' | ' + (row.passed ? 'OK' : 'FALLO') + ' | ' + row.status + ' | ' + row.code + ' |').join('\n') +
    '\n\nConfiguración de despliegue (solo presencia, sin valores de credenciales):\n\n' +
    Object.entries(deployment).map(([key, value]) => '- ' + key + ': ' + value).join('\n') +
    '\n\nNo se enviaron credenciales ni se creó una sesión. Estos controles no verifican el login real, el rol de una cuenta ni la persistencia de cookies en un navegador.\n');
}
if (rows.some(row => !row.passed)) process.exitCode = 1;
