import { Badge } from '../common';
import { businessTone } from '../../utils/business';
export function BusinessBadge({ status, label }: { status: string; label: string }) { return <Badge tone={businessTone(status)}>{label}</Badge>; }
