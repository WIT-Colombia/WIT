/**
 * Read-only adapter contract for the AWS Free Tier API.
 *
 * Kept transport-agnostic so the application does not require credentials at
 * build time. The production connector can supply the official SDK client
 * when the account grants freetier:GetFreeTierUsage.
 */
export type FreeTierReader = (input: { Filter?: unknown }) => Promise<{ freeTierUsages?: Array<Record<string, unknown>> }>;
export type FreeTierUsage = {
  service: string;
  usageType: string;
  actual: number;
  forecasted: number | null;
  limit: number | null;
  unit: string;
  region: string;
  freeTierType: string;
};

export function createAwsFreeTierReader(): FreeTierReader {
  const client = new FreeTierClient({});
  return async input => client.send(new GetFreeTierUsageCommand(input as any)) as Promise<{ freeTierUsages?: Array<Record<string, unknown>> }>;
}

export async function fetchFreeTierUsage(reader: FreeTierReader, service?: string): Promise<FreeTierUsage[]> {
  const output = await reader(service ? { Filter: { Dimensions: { Key: 'SERVICE', Values: [service], MatchOptions: ['CONTAINS'] } } } : {});
  return (output.freeTierUsages ?? []).map(item => ({
    service: String(item.service ?? 'Unknown AWS service'),
    usageType: String(item.usageType ?? ''),
    actual: Number(item.actualUsageAmount ?? 0),
    forecasted: item.forecastedUsageAmount == null ? null : Number(item.forecastedUsageAmount),
    limit: item.limit == null ? null : Number(item.limit),
    unit: String(item.unit ?? ''),
    region: String(item.region ?? 'global'),
    freeTierType: String(item.freeTierType ?? ''),
  }));
}

export function freeTierUnavailable(): never {
  throw Object.assign(new Error('AWS Free Tier no está configurado para lectura en este entorno.'), { code: 'AWS_FREE_TIER_NOT_CONFIGURED' });
}
import { FreeTierClient, GetFreeTierUsageCommand } from '@aws-sdk/client-freetier';

