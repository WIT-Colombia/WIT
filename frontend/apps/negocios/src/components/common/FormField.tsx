import type { ChangeEvent } from "react";

interface Props { label: string; name: string; value: string; onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void; type?: string; placeholder?: string; required?: boolean; as?: "textarea" | "select"; options?: string[]; hint?: string; }
export function FormField({ label, name, value, onChange, type = "text", placeholder, required, as, options, hint }: Props) {
  return <label className="form-field"><span>{label}{required && <b aria-hidden="true"> *</b>}</span>{as === "textarea" ? <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} required={required} rows={4} /> : as === "select" ? <select name={name} value={value} onChange={onChange}>{options?.map(option => <option key={option}>{option}</option>)}</select> : <input name={name} value={value} onChange={onChange} type={type} placeholder={placeholder} required={required} />}{hint && <small>{hint}</small>}</label>;
}
