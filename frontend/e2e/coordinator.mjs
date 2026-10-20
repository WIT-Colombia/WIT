import { spawn } from 'node:child_process';
import process from 'node:process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const mariadb = await import('../../backend/node_modules/mariadb/promise.js');
const DB = 'xamuko_analytics_integration_test';
const ports = [3101, 5175, 5176, 5177];
const children = [];

function npmCommand() {
  const node = process.execPath;
  const candidates = [
    process.env.npm_execpath,
    join(dirname(node), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(dirname(node), '..', 'libexec', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean);
  const script = candidates.find((candidate) => existsSync(candidate));
  if (!script) throw new Error(`No se encontró npm junto a Node (${node}). PATH=${process.env.PATH ?? ''}`);
  return { command: node, prefix: [script] };
}

function assertCwd(cwd, label) {
  if (!existsSync(cwd)) throw new Error(`cwd inexistente para ${label}: ${cwd}`);
  console.log(`Proceso ${label}: cwd=${cwd}`);
}

function spawnManaged(command, args, options, label) {
  assertCwd(options.cwd, label);
  const child = spawn(command, args, options);
  let spawnError = null;
  child.once('error', (error) => {
    spawnError = error;
    console.error(`Proceso ${label} error: ${error.message}`);
  });
  child.once('close', (code, signal) => {
    console.log(`Proceso ${label} finalizó: code=${code ?? 'null'} signal=${signal ?? 'none'}`);
  });
  child.spawnError = () => spawnError;
  return child;
}

function databaseUrl() {
  let raw = process.env.DATABASE_URL;
  if (!raw) {
    const envText = readFileSync(new URL('../../backend/.env', import.meta.url), 'utf8');
    const match = envText.match(/^DATABASE_URL\s*=\s*["']?(.+?)["']?\s*$/m);
    raw = match?.[1];
  }
  if (!raw) throw new Error('DATABASE_URL es obligatoria para E2E');
  raw = raw.trim().replace(/^['"]|['"]$/g, '');
  const url = new URL(raw);
  url.pathname = `/${DB}`;
  return url;
}

async function assertDatabase() {
  const url = databaseUrl();
  const pool = mariadb.default.createPool({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: DB, connectionLimit: 1 });
  const connection = await pool.getConnection();
  try {
    const rows = await connection.query('SELECT DATABASE() AS db');
    if (rows[0]?.db !== DB) throw new Error(`Base no autorizada: ${rows[0]?.db ?? 'null'}`);
    console.log(`E2E database: ${rows[0].db}`);
  } finally {
    connection.release();
    await pool.end();
  }
}

async function assertPortsFree() {
  for (const port of ports) {
    const occupied = await new Promise((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
      socket.setTimeout(500, () => { socket.destroy(); resolve(false); });
    });
    if (occupied) throw new Error(`Puerto temporal ocupado: ${port}. Libéralo antes de ejecutar E2E.`);
  }
}

async function waitForHttp(url, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'sin respuesta';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) { console.log(`Servicio disponible ${label}: ${url}`); return; }
      lastError = `HTTP ${response.status}`;
    } catch (error) { lastError = error instanceof Error ? error.message : String(error); }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Servicio ${label} no disponible tras 30s (${url}): ${lastError}`);
}

function start(command, args, cwd, env) {
  const child = spawnManaged(command, args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit' }, `servidor ${cwd}`);
  children.push(child);
  return child;
}

async function main() {
  await assertDatabase();
  if (process.env.E2E_ALLOW_SERVERS !== '1') throw new Error('E2E_ALLOW_SERVERS=1 es necesario para iniciar servidores temporales.');
  await assertPortsFree();
  const root = fileURLToPath(new URL('..', import.meta.url));
  const backend = fileURLToPath(new URL('../../backend', import.meta.url));
  const npm = npmCommand();
  // Development limiter applies only to this isolated temporary backend,
  // avoiding parallel E2E logins tripping the production/test cap.
  start(npm.command, [...npm.prefix, 'run', 'dev'], backend, { DATABASE_URL: databaseUrl().toString(), PORT: '3101', HOST: '127.0.0.1', NODE_ENV: 'development', AUTH_TRUSTED_ORIGINS: 'http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175,http://127.0.0.1:5176,http://127.0.0.1:5177', PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}` });
  start(npm.command, [...npm.prefix, 'run', 'dev', '--workspace=@wit/usuario'], root, { VITE_USUARIO_PORT: '5175', VITE_USUARIO_BACKEND_URL: 'http://127.0.0.1:3101', PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}` });
  start(npm.command, [...npm.prefix, 'run', 'dev', '--workspace=@wit/negocios'], root, { VITE_NEGOCIOS_PORT: '5176', VITE_BUSINESS_BACKEND_URL: 'http://127.0.0.1:3101', PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}` });
  start(npm.command, [...npm.prefix, 'run', 'dev', '--workspace=@wit/admin'], root, { VITE_ADMIN_PORT: '5177', VITE_ADMIN_BACKEND_URL: 'http://127.0.0.1:3101', PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}` });
  await waitForHttp('http://127.0.0.1:3101/api/v1/health', 'Backend');
  await waitForHttp('http://127.0.0.1:5175/', 'Usuario');
  await waitForHttp('http://127.0.0.1:5176/', 'Business');
  await waitForHttp('http://127.0.0.1:5177/', 'Admin');
  const password = process.env.ANALYTICS_TEST_PASSWORD ?? `E2E_${Date.now()}_OnlyInMemory!`;
  assertCwd(backend, 'prepare');
  const prepare = spawnManaged(process.execPath, ['--import', 'tsx', 'scripts/analytics-integration.ts', 'prepare'], { cwd: backend, env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}`, DATABASE_URL: databaseUrl().toString(), ANALYTICS_TEST_PASSWORD: password, ANALYTICS_PREPARE_EXTERNAL_SERVER: '1' }, stdio: ['ignore', 'pipe', 'inherit'] }, 'prepare');
  let prepareOutput = '';
  prepare.stdout.on('data', (chunk) => { prepareOutput += String(chunk); });
  await new Promise((resolve, reject) => prepare.on('close', (code) => code ? reject(new Error(`prepare terminó con ${code}`)) : resolve()));
  const stateLine = prepareOutput.split(/\r?\n/).map((line) => line.trim()).find((line) => line.startsWith('{') && line.includes('stateFile'));
  if (!stateLine) throw new Error('prepare no devolvió un estado utilizable');
  const state = JSON.parse(stateLine);
  const stateContents = JSON.parse(readFileSync(state.stateFile, 'utf8'));
  const playwrightArgs = process.env.E2E_PLAYWRIGHT_ARGS ? process.env.E2E_PLAYWRIGHT_ARGS.split(/\s+/).filter(Boolean) : ['test'];
  const result = spawnManaged(npm.command, [...npm.prefix, 'exec', 'playwright', '--', ...playwrightArgs], { cwd: root, env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}`, E2E_USUARIO_URL: 'http://127.0.0.1:5175', E2E_NEGOCIOS_URL: 'http://127.0.0.1:5176', E2E_ADMIN_URL: 'http://127.0.0.1:5177', E2E_BUSINESS_ID: stateContents.publicBusinessPublicId, E2E_USER_EMAIL: stateContents.email, E2E_USER_EMAIL_DESKTOP: stateContents.email, E2E_USER_EMAIL_MOBILE: stateContents.mobileEmail, E2E_EDIT_EMAIL_DESKTOP: stateContents.editDesktopEmail, E2E_EDIT_EMAIL_MOBILE: stateContents.editMobileEmail, E2E_BUSINESS_EMAIL_DESKTOP: stateContents.businessDesktopEmail, E2E_BUSINESS_EMAIL_MOBILE: stateContents.businessMobileEmail, E2E_USER_PASSWORD: password, E2E_OWNER_EMAIL: stateContents.email, E2E_OWNER_PASSWORD: password, E2E_ADMIN_EMAIL: stateContents.adminEmail ?? stateContents.email, E2E_ADMIN_PASSWORD: password }, stdio: 'inherit' }, 'playwright');
  try { await new Promise((resolve, reject) => { result.on('exit', (code) => code ? reject(new Error(`Playwright terminó con ${code}`)) : resolve()); }); }
  finally {
    if (!state?.runId) throw new Error('No se ejecuta cleanup: runId vacío.');
    const cleanup = spawnManaged(process.execPath, ['--import', 'tsx', 'scripts/analytics-integration.ts', 'cleanup', '--run-id', state.runId], { cwd: backend, env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}`, DATABASE_URL: databaseUrl().toString() }, stdio: 'inherit' }, 'cleanup');
    await new Promise((resolve) => cleanup.on('close', resolve));
  }
}

try { await main(); } finally {
  for (const child of children) child.kill('SIGTERM');
}
