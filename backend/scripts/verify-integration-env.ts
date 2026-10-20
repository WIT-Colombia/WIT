import mariadb from 'mariadb';

const EXPECTED_DATABASE = 'xamuko_integration_test';
const raw = process.env.DATABASE_URL;
if (!raw) throw new Error('DATABASE_URL es obligatoria para las pruebas de integración.');
const url = new URL(raw);
const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
if (database !== EXPECTED_DATABASE) throw new Error(`Pruebas detenidas: la base configurada es "${database}", se requiere "${EXPECTED_DATABASE}".`);
if (database === 'xamuko_modalities_test') throw new Error('Pruebas detenidas: nunca se permite usar xamuko_modalities_test.');
const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database });
try {
  const rows = await connection.query('SELECT DATABASE() AS databaseName');
  if (String(rows[0]?.databaseName) !== EXPECTED_DATABASE) throw new Error('La conexión no apunta a la base de integración esperada.');
  console.log(`Entorno de integración verificado: ${EXPECTED_DATABASE}`);
} finally { await connection.end(); }
