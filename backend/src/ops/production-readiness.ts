export type MigrationRow = {
  migration_name: string;
  finished_at: Date | string | null;
  rolled_back_at: Date | string | null;
};
export type ProductionReadinessSnapshot = {
  expectedMigrations: string[];
  migrationRows: MigrationRow[];
  tableNames: string[];
  auditEntityColumnType: string | null;
  palmiraSeedExists: boolean;
};
export type ProductionReadinessReport = {
  ready: boolean;
  missingMigrations: string[];
  failedMigrations: string[];
  unexpectedMigrations: string[];
  missingTables: string[];
  issues: string[];
};
export const REQUIRED_PRODUCTION_TABLES = [
  'ZoneLaunch', 'ZoneLaunchAlert', 'PlatformNotification', 'Category',
  'Business', 'BusinessOffer', 'AuditLog',
] as const;

/**
 * Pure, read-only assessment. This function never mutates a database,
 * resolves a failed migration, or assumes that a successful health check
 * means that production's schema matches the release.
 */
export function assessProductionReadiness(
  snapshot: ProductionReadinessSnapshot,
): ProductionReadinessReport {
  const rows = snapshot.migrationRows;
  const applied = new Set(rows.filter(row => row.finished_at !== null &&
    row.rolled_back_at === null).map(row => row.migration_name));
  const missingMigrations = snapshot.expectedMigrations
    .filter(name => !applied.has(name)).sort();
  const failedMigrations = rows
    .filter(row => row.finished_at === null && row.rolled_back_at === null)
    .map(row => row.migration_name).sort();
  const expected = new Set(snapshot.expectedMigrations);
  const unexpectedMigrations = [...applied].filter(name => !expected.has(name)).sort();
  const found = new Set(snapshot.tableNames.map(name => name.toLowerCase()));
  const missingTables = REQUIRED_PRODUCTION_TABLES
    .filter(name => !found.has(name.toLowerCase()));
  const issues: string[] = [];
  if (missingMigrations.length) {
    issues.push(`Migraciones pendientes: ${missingMigrations.join(', ')}`);
  }
  if (failedMigrations.length) {
    issues.push(`Migraciones incompletas: ${failedMigrations.join(', ')}`);
  }
  if (unexpectedMigrations.length) {
    issues.push(`Migraciones aplicadas no presentes en el paquete: ${unexpectedMigrations.join(', ')}`);
  }
  if (missingTables.length) {
    issues.push(`Tablas necesarias ausentes: ${missingTables.join(', ')}`);
  }
  if (!snapshot.auditEntityColumnType || !/['"]ZONE['"]/.test(snapshot.auditEntityColumnType)) {
    issues.push('AuditLog.entityType no admite ZONE.');
  }
  if (!snapshot.palmiraSeedExists) {
    issues.push('Falta el registro territorial inicial de Palmira (76520).');
  }
  return {
    ready: issues.length === 0,
    missingMigrations, failedMigrations, unexpectedMigrations, missingTables, issues,
  };
}
