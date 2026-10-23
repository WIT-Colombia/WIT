import "./PioneerRecognition.css";

type PioneerRecognitionProps = { pioneerNumber?: number | null };

export function PioneerRecognition({ pioneerNumber }: PioneerRecognitionProps) {
  if (!Number.isInteger(pioneerNumber) || pioneerNumber! < 1 || pioneerNumber! > 20) return null;
  return <section className="pioneer-recognition" aria-label="Reconocimiento Negocio Pionero"><div className="pioneer-recognition-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v7a6 6 0 0 1-12 0V4Zm0 2H4v2a4 4 0 0 0 4 4m10-6h2v2a4 4 0 0 1-4 4M9 17l-2 5 5-2 5 2-2-5" /></svg>Pionero #{String(pioneerNumber).padStart(3, "0")}</div><div><strong>Tu marca forma parte de los primeros 20 Negocios Pioneros de XAMUKO</strong><p>Insignia permanente y prioridad orgánica en búsquedas relevantes.</p></div></section>;
}
