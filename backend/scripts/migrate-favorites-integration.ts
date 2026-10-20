import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mariadb from 'mariadb';

const EXPECTED_DATABASE = 'xamuko_favorites_integration_test';
const PROTECTED_DATABASES = new Set(['xamuko_modalities_test', 'xamuko_integration_test']);
const backendDir = fileURLToPath(new URL('..', import.meta.url));

function databaseFromEnvFile(contents: string) {
  const line = contents.split(/\r?\n/).find((item) => /^\s*DATABASE_URL\s*=/.test(item));
  if (!line) throw new Error('backend/.env no contiene DATABASE_URL.');
  const raw = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (PROTECTED_DATABASES.has(database)) console.log(`Base de origen detectada: ${database} (solo se sustituirá en memoria).`);
  return { url, database };
}

function isolatedUrl(source: URL) {
  const target = new URL(source.toString());
  target.pathname = `/${EXPECTED_DATABASE}`;
  return target;
}

async function verify(url: URL) {
  const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: EXPECTED_DATABASE });
  try {
    const rows = await connection.query('SELECT DATABASE() AS databaseName');
    if (String(rows[0]?.databaseName) !== EXPECTED_DATABASE) throw new Error('La conexión no apunta a la base temporal esperada.');
    console.log(`Conexión verificada exclusivamente: ${EXPECTED_DATABASE}`);
  } finally { await connection.end(); }
}

async function main() {
  const envFile = await readFile(new URL('../.env', import.meta.url), 'utf8');
  const source = databaseFromEnvFile(envFile);
  const target = isolatedUrl(source.url);
  if (decodeURIComponent(target.pathname.slice(1)) !== EXPECTED_DATABASE) throw new Error('Destino de migración inválido.');
  await verify(target);
  const prismaCli = `${backendDir}/node_modules/prisma/build/index.js`;
  if (!existsSync(prismaCli)) throw new Error(`No se encontró Prisma CLI en ${prismaCli}.`);
  console.log('Verificaciones superadas. Migración preparada, no ejecutada.');
  if (process.env.XAMUKO_APPLY_MIGRATIONS !== '1') return;
  console.log('Ejecutando migrate deploy únicamente sobre la base temporal autorizada.');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [prismaCli, 'migrate', 'deploy'], { cwd: backendDir, env: { ...process.env, DATABASE_URL: target.toString() }, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Prisma terminó con código ${code ?? 'desconocido'}.`)));
  });
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Falló la preparación segura.'); process.exitCode = 1; });
