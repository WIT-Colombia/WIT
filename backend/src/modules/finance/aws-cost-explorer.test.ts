import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAwsDailyCosts, normalizeCostExplorer, reconcileAwsBilling, validateAwsPeriod } from './aws-cost-explorer.js';
import { fetchFreeTierUsage } from './aws-free-tier.js';

const response = { ResultsByTime: [{ TimePeriod: { Start: '2026-10-28', End: '2026-10-29' }, Groups: [{ Keys: ['Amazon Elastic Compute Cloud - Compute'], Metrics: { UnblendedCost: { Amount: '2.50', Unit: 'USD' }, NetUnblendedCost: { Amount: '2.00', Unit: 'USD' } } }, { Keys: ['Amazon Relational Database Service'], Metrics: { UnblendedCost: { Amount: '1.25', Unit: 'USD' }, NetUnblendedCost: { Amount: '1.25', Unit: 'USD' } } }] }] } as any;

test('normaliza servicios, créditos y costos netos sin reasignar nombres', () => {
  assert.deepEqual(normalizeCostExplorer(response), [
    { service: 'Amazon Elastic Compute Cloud - Compute', date: '2026-10-28', unblendedUsd: 2.5, netUnblendedUsd: 2, metricDifferenceUsd: 0.5, currency: 'USD', provisional: true },
    { service: 'Amazon Relational Database Service', date: '2026-10-28', unblendedUsd: 1.25, netUnblendedUsd: 1.25, metricDifferenceUsd: 0, currency: 'USD', provisional: true },
  ]);
});

test('rechaza periodos inválidos o excesivos', () => {
  assert.throws(() => validateAwsPeriod(new Date('2026-10-29'), new Date('2026-10-28')));
  assert.throws(() => validateAwsPeriod(new Date('2026-01-01'), new Date('2026-02-02')));
});

test('consulta diaria agrupada por servicio con una sola llamada', async () => {
  const calls: any[] = [];
  const rows = await fetchAwsDailyCosts(async input => { calls.push(input); return response; }, new Date('2026-10-28T00:00:00Z'), new Date('2026-10-29T00:00:00Z'));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].Metrics, ['UnblendedCost', 'NetUnblendedCost']);
  assert.equal(calls[0].GroupBy[0].Key, 'SERVICE');
  assert.equal(rows.length, 2);
});

test('mantiene separadas las fuentes de facturación y deja como desconocidos los datos no disponibles', () => {
  const result = reconcileAwsBilling([
    { service: 'EC2', date: '2026-10-28', unblendedUsd: 0.34, netUnblendedUsd: 0, metricDifferenceUsd: 0.34, currency: 'USD', provisional: true },
  ], '2026-10-29T12:00:00.000Z');
  assert.equal(result.costExplorer.unblendedUsd, 0.34);
  assert.equal(result.costExplorer.netUnblendedUsd, 0);
  assert.equal(result.projectEstimate, null);
  assert.equal(result.promotionalCredits, null);
  assert.equal(result.amountDue, null);
  assert.match(result.notes.join(' '), /no se clasifica automáticamente/i);
});

test('no interpreta una respuesta vacía como ausencia confirmada de consumo', () => {
  const result = reconcileAwsBilling([], null);
  assert.equal(result.costExplorer.unblendedUsd, 0);
  assert.equal(result.costExplorer.lastUpdatedAt, null);
  assert.equal(result.costExplorer.provisional, false);
  assert.match(result.notes.join(' '), /no proporciona/i);
});

test('normaliza Free Tier sin convertirlo en crédito monetario', async () => {
  const calls: any[] = [];
  const rows = await fetchFreeTierUsage(async input => { calls.push(input); return { freeTierUsages: [{ service: 'Amazon EC2', usageType: 'BoxUsage:freetier.micro', actualUsageAmount: 12, forecastedUsageAmount: 20, limit: 750, unit: 'Hrs', region: 'us-east-2', freeTierType: 'Always Free' }] }; }, 'EC2');
  assert.equal(calls.length, 1);
  assert.equal(rows[0].actual, 12);
  assert.equal(rows[0].forecasted, 20);
  assert.equal(rows[0].limit, 750);
});
