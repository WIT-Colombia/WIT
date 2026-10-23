import { prisma } from '../src/config/prisma.js';

const officialNames = [
  'Restaurantes', 'Droguerías', 'Ferreterías', 'Talleres', 'Barberías', 'Tecnología',
  'Cafeterías', 'Panaderías y reposterías', 'Supermercados y tiendas', 'Frutas y verduras',
  'Carnicerías y pescaderías', 'Salud y bienestar', 'Clínicas y consultorios', 'Ópticas',
  'Peluquerías y belleza', 'Ropa y calzado', 'Hogar y decoración', 'Construcción y remodelación',
  'Repuestos y accesorios', 'Lavanderías y tintorerías', 'Mascotas y veterinarias',
  'Papelerías y librerías', 'Educación y cursos', 'Deportes y recreación', 'Transporte y movilidad',
  'Servicios para el hogar', 'Servicios técnicos', 'Servicios profesionales', 'Floristerías y regalos',
  'Hoteles y turismo', 'Eventos y entretenimiento', 'Belleza y cuidado personal', 'Otros',
] as const;
const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const database = await prisma.$queryRaw<Array<{ db: string }>>`SELECT DATABASE() AS db`;
if (database[0]?.db !== 'xamuko_e2e_full_test') throw new Error('Destino no autorizado.');
for (const [index, name] of officialNames.entries()) {
  const code = slug(name);
  const category = await prisma.category.upsert({ where: { code }, update: { active: true, sortOrder: index + 1 }, create: { code, active: true, sortOrder: index + 1 } });
  await prisma.categoryTranslation.upsert({ where: { categoryId_locale: { categoryId: category.id, locale: 'es-CO' } }, update: { name, iconKey: code }, create: { categoryId: category.id, locale: 'es-CO', name, iconKey: code } });
}
console.log(JSON.stringify({ database: database[0]?.db, count: officialNames.length }));
await prisma.$disconnect();
