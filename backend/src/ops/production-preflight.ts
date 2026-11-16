import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../config/prisma.js';
import {
  assessProductionReadiness, type MigrationRow,
} from './production-readiness.js';

/**
 * Read-only production preflight. Run from the backend release directory with
 * its authorised production EnvironmentFile. Never apply migrations here.
 */
async function main() {
  const expectedMigrations = readdirSync(resolve('prisma/migrations'), {
    withFileTypes: true,
  }).filter(entry => entry.isDirectory()).map(entry => entry.name);
  if (!expectedMigrations.length) throw new Error('El paquete no incluye migraciones Prisma.');
  const [migrationRows, tables, auditTypes] = await Promise.all([
    prisma.$queryRaw<MigrationRow[]>`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
    `,
    prisma.$queryRaw<Array<{ TABLE_NAME: string }>>`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          'ZoneLaunch', 'ZoneLaunchAlert', 'PlatformNotification',
          'Category', 'Business', 'BusinessOffer', 'AuditLog'
        )
    `,
    prisma.$queryRaw<Array<{ COLUMN_TYPE: string }>>`
      SELECT COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'AuditLog'
        AND COLUMN_NAME = 'entityType'
    `,
  ]);
  const palmiraTableExists = tables.some(table => table.TABLE_NAME.toLowerCase() === 'zonelaunch');
  const palmira = palmiraTableExists
    ? await prisma.$queryRaw<Array<{ code: string }>>`
        SELECT code FROM ZoneLaunch
        WHERE scope = 'MUNICIPALITY' AND code = '76520'
        LIMIT 1
      `
    : [];
  const report = assessProductionReadiness({
    expectedMigrations,
    migrationRows,
    tableNames: tables.map(row => row.TABLE_NAME),
    auditEntityColumnType: auditTypes[0]?.COLUMN_TYPE ?? null,
    palmiraSeedExists: palmira.length > 0,
  });
  console.log('XAMUKO · Comprobación de esquema de solo lectura');
  console.log('Migraciones incluidas:', expectedMigrations.length);
  console.log('Migraciones aplicadas:', migrationRows.filter(row =>
    row.finished_at !== null && row.rolled_back_at === null).length);
  if (!report.ready) {
    for (const issue of report.issues) console.error('BLOQUEO:', issue);
    console.error('No se realizaron cambios en la base de datos.');
    process.exitCode = 1;
    return;
  }
  // Exercise the exact SQL used by Admin → Categorías, without loading user data.
  await prisma.$queryRaw<Array<{ categoryId: string; kind: string; total: bigint }>>`
    SELECT COALESCE(o.categoryId, b.categoryId) AS categoryId, o.kind,
      COUNT(*) AS total
    FROM BusinessOffer AS o
    INNER JOIN Business AS b ON b.id = o.businessId
    WHERE o.deletedAt IS NULL
    GROUP BY COALESCE(o.categoryId, b.categoryId), o.kind
    LIMIT 1
  `;
  // A real Prisma Client read catches mismatches between generated models
  // and the database before the release is selected by the load balancer.
  await prisma.zoneLaunch.findFirst({ select: { code: true, state: true } });
  await prisma.zoneLaunchAlert.findFirst({ select: { id: true } });
  console.log('APTO: esquema Prisma, Zonas y conteos de Categorías verificados en modo lectura.');
}

try {
  await main();
} catch (error) {
  // Do not log connection strings or driver details to CI/operational logs.
  const code = error && typeof error === 'object' && 'code' in error &&
    typeof error.code === 'string' ? error.code : 'PREFLIGHT_ERROR';
  console.error('BLOQUEO: No se pudo completar la comprobación de base de datos (' + code + ').');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
