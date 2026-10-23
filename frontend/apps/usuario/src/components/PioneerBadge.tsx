import "./PioneerBadge.css";

type PioneerBadgeProps = { pioneerNumber?: number | null };

export function PioneerBadge({ pioneerNumber }: PioneerBadgeProps) {
  if (!Number.isInteger(pioneerNumber) || pioneerNumber! < 1 || pioneerNumber! > 20) return null;
  return <span className="pioneer-badge" aria-label={`Negocio Pionero número ${pioneerNumber}`}><span aria-hidden="true">🏅</span> Pionero #{String(pioneerNumber).padStart(3, "0")}</span>;
}
