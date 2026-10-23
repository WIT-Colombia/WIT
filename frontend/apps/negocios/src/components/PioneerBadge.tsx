type PioneerBadgeProps = { pioneerNumber?: number | null };

export function PioneerBadge({ pioneerNumber }: PioneerBadgeProps) {
  if (!Number.isInteger(pioneerNumber) || pioneerNumber! < 1 || pioneerNumber! > 20) return null;
  const number = String(pioneerNumber).padStart(3, "0");
  return <span className="business-pioneer-badge" aria-label={`Pionero número ${number}`}><span aria-hidden="true">🏅</span> Pionero #{number}</span>;
}
