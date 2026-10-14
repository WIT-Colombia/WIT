import { prisma } from '../src/config/prisma.js';
import mariadb from 'mariadb';

const officialNames = [
  'Restaurantes', 'Droguerías', 'Ferreterías', 'Talleres', 'Barberías', 'Tecnología',
  'Cafeterías', 'Panaderías y reposterías', 'Supermercados y tiendas', 'Frutas y verduras',
  'Carnicerías y pescaderías', 'Salud y bienestar', 'Clínicas y consultorios', 'Ópticas',
  'Peluquerías y belleza', 'Ropa y calzado', 'Hogar y decoración', 'Construcción y remodelación',
  'Repuestos y accesorios', 'Lavanderías y tintorerías', 'Mascotas y veterinarias',
  'Papelerías y librerías', 'Educación y cursos', 'Deportes y recreación', 'Transporte y movilidad',
  'Servicios para el hogar', 'Servicios técnicos', 'Servicios profesionales', 'Floristerías y regalos',
  'Hoteles y turismo', 'Eventos y entretenimiento', 'Belleza y cuidado personal', 'Otros',
];
const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const raw = process.env.DATABASE_URL;
if (!raw) throw new Error('DATABASE_URL temporal no configurada.');
const url = new URL(raw);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname.slice(1) !== 'xamuko_modalities_test' || decodeURIComponent(url.username) !== 'xamuko_test_app') throw new Error('Destino no autorizado.');
const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1) });
const identity = await connection.query('SELECT DATABASE() AS db, CURRENT_USER() AS account');
await connection.end();
if (String(identity[0]?.db) !== 'xamuko_modalities_test' || String(identity[0]?.account) !== 'xamuko_test_app@localhost') throw new Error('Identidad MySQL no coincide.');
for (const [index, name] of officialNames.entries()) {
  const code = slug(name);
  const category = await prisma.category.upsert({ where: { code }, update: { active: true, sortOrder: index + 1 }, create: { code, active: true, sortOrder: index + 1 } });
  await prisma.categoryTranslation.upsert({ where: { categoryId_locale: { categoryId: category.id, locale: 'es-CO' } }, update: { name, iconKey: code }, create: { categoryId: category.id, locale: 'es-CO', name, iconKey: code } });
}
console.log(JSON.stringify({ count: officialNames.length, categories: officialNames.map(name => ({ name, code: slug(name) })) }));
await prisma.$disconnect();
