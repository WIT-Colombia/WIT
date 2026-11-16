import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessProductionReadiness, REQUIRED_PRODUCTION_TABLES,
  type ProductionReadinessSnapshot,
} from './production-readiness.js';

const snapshot = (): ProductionReadinessSnapshot => ({
  expectedMigrations: ['001_init', '002_zones'],
  migrationRows: [
    { migration_name: '001_init', finished_at: new Date(), rolled_back_at: null },
    { migration_name: '002_zones', finished_at: new Date(), rolled_back_at: null },
  ],
  tableNames: [...REQUIRED_PRODUCTION_TABLES],
  auditEntityColumnType: "enum('USER','BUSINESS','ZONE')",
  palmiraSeedExists: true,
});

test('production preflight accepts a complete, consistent migrated database', () => {
  const result = assessProductionReadiness(snapshot());
  assert.equal(result.ready, true);
  assert.deepEqual(result.issues, []);
});

test('production preflight blocks pending migrations (never auto-applies them)', () => {
  const input = snapshot();
  input.migrationRows.pop();
  const result = assessProductionReadiness(input);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingMigrations, ['002_zones']);
});

test('production preflight fails closed on interrupted and unexpected migration history', () => {
  const input = snapshot();
  input.migrationRows[1].finished_at = null;
  input.migrationRows.push({
    migration_name: '999_unknown',
    finished_at: new Date(),
    rolled_back_at: null,
  });
  const result = assessProductionReadiness(input);
  assert.deepEqual(result.failedMigrations, ['002_zones']);
  assert.deepEqual(result.unexpectedMigrations, ['999_unknown']);
  assert.equal(result.ready, false);
});

test('production preflight blocks missing zone tables or missing AuditLog ZONE enum', () => {
  const input = snapshot();
  input.tableNames = input.tableNames.filter(name => name !== 'ZoneLaunch');
  input.auditEntityColumnType = "enum('USER','BUSINESS')";
  const result = assessProductionReadiness(input);
  assert.equal(result.ready, false);
  assert.ok(result.missingTables.includes('ZoneLaunch'));
  assert.ok(result.issues.some(issue => issue.includes('AuditLog.entityType')));
});

test('production preflight detects missing Palmira seed and missing history', () => {
  const input = snapshot();
  input.palmiraSeedExists = false;
  input.migrationRows = [];
  const result = assessProductionReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.missingMigrations.length, 2);
  assert.ok(result.issues.some(issue => issue.includes('Palmira')));
});

test('rolled-back migration is not considered applied or an unexplained failure', () => {
  const input = snapshot();
  input.migrationRows[1].finished_at = null;
  input.migrationRows[1].rolled_back_at = new Date();
  const result = assessProductionReadiness(input);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingMigrations, ['002_zones']);
  assert.deepEqual(result.failedMigrations, []);
});
