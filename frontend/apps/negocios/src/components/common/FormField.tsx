import type { ChangeEvent } from "react";

interface Props { label: string; name: string; value: string; onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void; type?: string; placeholder?: string; required?: boolean; disabled?: boolean; as?: "textarea" | "select"; options?: string[]; hint?: string; }
export function FormField({ label, name, value, onChange, type = "text", placeholder, required, disabled, as, options, hint }: Props) {
  return <label className="form-field"><span>{label}{required && <b aria-hidden="true"> *</b>}</span>{as === "textarea" ? <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} required={required} disabled={disabled} rows={4} /> : as === "select" ? <select name={name} value={value} onChange={onChange} disabled={disabled}>{options?.map(option => <option key={option}>{option}</option>)}</select> : <input name={name} value={value} onChange={onChange} type={type} placeholder={placeholder} required={required} disabled={disabled} />}{hint && <small>{hint}</small>}</label>;
}
