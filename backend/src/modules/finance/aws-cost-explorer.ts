import { CostExplorerClient, GetCostAndUsageCommand, type GetCostAndUsageCommandInput, type GetCostAndUsageCommandOutput } from '@aws-sdk/client-cost-explorer';
import { prisma } from '../../config/prisma.js';

export type CostExplorerReader = (input: GetCostAndUsageCommandInput) => Promise<GetCostAndUsageCommandOutput>;
export type AwsCostLine = { service: string; date: string; unblendedUsd: number; netUnblendedUsd: number; creditsUsd: number; currency: string; provisional: boolean };

export function createAwsCostExplorerReader(): CostExplorerReader {
  const client = new CostExplorerClient({});
  return async input => client.send(new GetCostAndUsageCommand(input));
}

function amount(metric: any, key: string) { return Number(metric?.[key]?.Amount ?? 0); }

export function normalizeCostExplorer(output: GetCostAndUsageCommandOutput): AwsCostLine[] {
  const rows: AwsCostLine[] = [];
  for (const result of output.ResultsByTime ?? []) {
    const date = result.TimePeriod?.Start;
    if (!date) continue;
    for (const group of result.Groups ?? []) {
      const service = group.Keys?.[0] ?? 'Unknown AWS service';
      const unblendedUsd = amount(group.Metrics, 'UnblendedCost');
      const netUnblendedUsd = amount(group.Metrics, 'NetUnblendedCost');
      rows.push({ service, date, unblendedUsd, netUnblendedUsd, creditsUsd: Math.max(0, unblendedUsd - netUnblendedUsd), currency: group.Metrics?.UnblendedCost?.Unit ?? 'USD', provisional: true });
    }
  }
  return rows;
}

export async function fetchAwsDailyCosts(reader: CostExplorerReader, start: Date, end: Date) {
  const output = await reader({ TimePeriod: { Start: start.toISOString().slice(0, 10), End: end.toISOString().slice(0, 10) }, Granularity: 'DAILY', Metrics: ['UnblendedCost', 'NetUnblendedCost'], GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }] });
  return normalizeCostExplorer(output);
}

export async function syncAwsDailyCosts(reader: CostExplorerReader, start: Date, end: Date) {
  const lines = await fetchAwsDailyCosts(reader, start, end);
  const provider = await prisma.financialProvider.upsert({ where: { name: 'AWS' }, create: { name: 'AWS', kind: 'AWS', currency: 'USD' }, update: { kind: 'AWS' } });
  for (const line of lines) {
    const service = await prisma.financialService.upsert({ where: { providerId_name: { providerId: provider.id, name: line.service } }, create: { providerId: provider.id, name: line.service }, update: { active: true } });
    const day = new Date(`${line.date}T00:00:00.000Z`);
    await prisma.financialConsumption.upsert({ where: { providerId_externalId_periodStart_periodEnd: { providerId: provider.id, externalId: `cost-explorer:${line.date}:${line.service}`, periodStart: day, periodEnd: day } }, create: { providerId: provider.id, serviceId: service.id, externalId: `cost-explorer:${line.date}:${line.service}`, periodStart: day, periodEnd: day, amountUsd: line.unblendedUsd, amountCop: 0, creditsUsd: line.creditsUsd, dataKind: 'REAL', metadata: { source: 'AWS Cost Explorer', netUnblendedUsd: line.netUnblendedUsd, provisional: line.provisional, currency: line.currency } }, update: { serviceId: service.id, amountUsd: line.unblendedUsd, creditsUsd: line.creditsUsd, dataKind: 'REAL', metadata: { source: 'AWS Cost Explorer', netUnblendedUsd: line.netUnblendedUsd, provisional: line.provisional, currency: line.currency } } });
  }
  return { provider: provider.name, lines: lines.length, synchronizedAt: new Date().toISOString(), provisional: true };
}
