import { describe, expect, it } from 'vitest';
import { comparableFreeTierPercent } from './AwsFreeTierPanel';

describe('AWS Free Tier panel', () => {
  it('calcula porcentaje solo con límite válido', () => expect(comparableFreeTierPercent({ service:'EC2', usageType:'hours', actual:12, forecasted:20, limit:750, unit:'Hrs', region:'us-east-2', freeTierType:'Always Free' })).toBeCloseTo(1.6));
  it('no calcula porcentaje cuando falta límite', () => expect(comparableFreeTierPercent({ service:'EC2', usageType:'hours', actual:12, forecasted:null, limit:null, unit:'Hrs', region:'us-east-2', freeTierType:'Always Free' })).toBeNull());
});
