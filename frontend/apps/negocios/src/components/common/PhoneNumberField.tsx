import type { ChangeEvent } from "react";

type PhoneCountry = { code: string; dialCode?: string; name: string; flag: string; length: number };
export const phoneCountries: readonly PhoneCountry[] = [
  { code: "+57", name: "Colombia", flag: "🇨🇴", length: 10 }, { code: "+1-US", dialCode: "+1", name: "Estados Unidos", flag: "🇺🇸", length: 10 }, { code: "+1-CA", dialCode: "+1", name: "Canadá", flag: "🇨🇦", length: 10 }, { code: "+52", name: "México", flag: "🇲🇽", length: 10 }, { code: "+34", name: "España", flag: "🇪🇸", length: 9 }, { code: "+54", name: "Argentina", flag: "🇦🇷", length: 10 }, { code: "+55", name: "Brasil", flag: "🇧🇷", length: 11 }, { code: "+56", name: "Chile", flag: "🇨🇱", length: 9 }, { code: "+51", name: "Perú", flag: "🇵🇪", length: 9 }, { code: "+593", name: "Ecuador", flag: "🇪🇨", length: 9 }, { code: "+58", name: "Venezuela", flag: "🇻🇪", length: 10 }, { code: "+507", name: "Panamá", flag: "🇵🇦", length: 8 }, { code: "+506", name: "Costa Rica", flag: "🇨🇷", length: 8 }, { code: "+44", name: "Reino Unido", flag: "🇬🇧", length: 10 }, { code: "+33", name: "Francia", flag: "🇫🇷", length: 9 }, { code: "+49", name: "Alemania", flag: "🇩🇪", length: 11 }, { code: "+39", name: "Italia", flag: "🇮🇹", length: 10 }, { code: "+61", name: "Australia", flag: "🇦🇺", length: 9 }, { code: "+81", name: "Japón", flag: "🇯🇵", length: 10 }, { code: "+86", name: "China", flag: "🇨🇳", length: 11 }, { code: "+91", name: "India", flag: "🇮🇳", length: 10 },
] as const;
export type PhoneCountryCode = string;
export const phoneCountryFor = (code: string) => phoneCountries.find(item => item.code === code) ?? phoneCountries[0];
export const splitInternationalPhone = (value: string | null | undefined) => {
  const raw = value?.trim() ?? "";
  const match = raw.match(/^(\+\d+)\s*(.*)$/);
  const country = phoneCountries.find(item => (item.dialCode ?? item.code) === match?.[1]) ?? phoneCountries[0];
  return { country: country.code, number: (match?.[2] ?? raw).replace(/\D/g, "").slice(0, country.length) };
};

type PhoneNumberFieldProps = {
  label: string;
  country: PhoneCountryCode;
  number: string;
  onCountryChange: (country: PhoneCountryCode) => void;
  onNumberChange: (number: string) => void;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  lineType?: "fixed" | "mobile";
  onLineTypeChange?: (type: "fixed" | "mobile") => void;
};

export function PhoneNumberField({ label, country, number, onCountryChange, onNumberChange, disabled = false, required = false, ariaLabel, lineType, onLineTypeChange }: PhoneNumberFieldProps) {
  const selected = phoneCountryFor(country);
  const handleCountry = (event: ChangeEvent<HTMLSelectElement>) => onCountryChange(event.target.value as PhoneCountryCode);
  return <label className="form-field phone-number-field"><span>{label}</span>{onLineTypeChange && <select value={lineType ?? "mobile"} onChange={event => onLineTypeChange(event.target.value as "fixed" | "mobile")} disabled={disabled} aria-label="Tipo de línea"><option value="mobile">Celular</option><option value="fixed">Teléfono fijo</option></select>}<select value={country} onChange={handleCountry} disabled={disabled} aria-label={`País del ${ariaLabel ?? label.toLowerCase()}`}>{phoneCountries.map(item => <option key={item.code} value={item.code}>{item.flag} {item.name} ({item.dialCode ?? item.code})</option>)}</select><div className="phone-number-input"><span>{selected.dialCode ?? selected.code}</span><input type="tel" inputMode="numeric" pattern={`[0-9]{${selected.length}}`} minLength={required ? selected.length : undefined} maxLength={selected.length} value={number} required={required} disabled={disabled} onChange={event => onNumberChange(event.target.value.replace(/\D/g, "").slice(0, selected.length))} placeholder={`Número nacional (${selected.length} dígitos)`} aria-label={`Número nacional de ${ariaLabel ?? label.toLowerCase()}`} /></div><small>Selecciona el país e introduce solo el número nacional.</small></label>;
}
