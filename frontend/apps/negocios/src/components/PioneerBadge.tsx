type PioneerBadgeProps = { pioneerNumber?: number | null };

export function PioneerBadge({ pioneerNumber }: PioneerBadgeProps) {
  if (!Number.isInteger(pioneerNumber) || pioneerNumber! < 1 || pioneerNumber! > 20) return null;
  const number = String(pioneerNumber).padStart(3, "0");
  return <span className="business-pioneer-badge" aria-label={`Pionero número ${number}`}>
    <svg className="business-pioneer-medal" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 2h5l3 7-3.4 3L4 2Z" fill="#6D54CD"/>
      <path d="M20 2h-5l-3 7 3.4 3L20 2Z" fill="#9A78F0"/>
      <circle cx="12" cy="15" r="6.5" fill="#F8C85B" stroke="#D39D2B" strokeWidth="1.2"/>
      <path d="m12 11.4 1.1 2.2 2.4.35-1.75 1.7.42 2.4L12 16.9l-2.17 1.15.42-2.4-1.75-1.7 2.4-.35L12 11.4Z" fill="#AA7424"/>
    </svg>
    <span className="business-pioneer-text">Pionero #{number}</span>
  </span>;
}
