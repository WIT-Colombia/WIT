import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAwsDailyCosts, normalizeCostExplorer } from './aws-cost-explorer.js';

const response = { ResultsByTime: [{ TimePeriod: { Start: '2026-10-28', End: '2026-10-29' }, Groups: [{ Keys: ['Amazon Elastic Compute Cloud - Compute'], Metrics: { UnblendedCost: { Amount: '2.50', Unit: 'USD' }, NetUnblendedCost: { Amount: '2.00', Unit: 'USD' } } }, { Keys: ['Amazon Relational Database Service'], Metrics: { UnblendedCost: { Amount: '1.25', Unit: 'USD' }, NetUnblendedCost: { Amount: '1.25', Unit: 'USD' } } }] }] } as any;

test('normaliza servicios, créditos y costos netos sin reasignar nombres', () => {
  assert.deepEqual(normalizeCostExplorer(response), [
    { service: 'Amazon Elastic Compute Cloud - Compute', date: '2026-10-28', unblendedUsd: 2.5, netUnblendedUsd: 2, creditsUsd: 0.5, currency: 'USD', provisional: true },
    { service: 'Amazon Relational Database Service', date: '2026-10-28', unblendedUsd: 1.25, netUnblendedUsd: 1.25, creditsUsd: 0, currency: 'USD', provisional: true },
  ]);
});

test('consulta diaria agrupada por servicio con una sola llamada', async () => {
  const calls: any[] = [];
  const rows = await fetchAwsDailyCosts(async input => { calls.push(input); return response; }, new Date('2026-10-28T00:00:00Z'), new Date('2026-10-29T00:00:00Z'));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].Metrics, ['UnblendedCost', 'NetUnblendedCost']);
  assert.equal(calls[0].GroupBy[0].Key, 'SERVICE');
  assert.equal(rows.length, 2);
});
