import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FormField } from "../components/common/FormField";
import { PageHeader } from "../components/common/PageHeader";
import { useBusinessStore } from "../services/businessStore";
import { initialAccount } from "../data/business.mock";

const phoneCountries = [{ code: "+57", name: "Colombia", flag: "🇨🇴", length: 10 }, { code: "+58", name: "Venezuela", flag: "🇻🇪", length: 10 }, { code: "+593", name: "Ecuador", flag: "🇪🇨", length: 9 }, { code: "+51", name: "Perú", flag: "🇵🇪", length: 9 }, { code: "+52", name: "México", flag: "🇲🇽", length: 10 }, { code: "+34", name: "España", flag: "🇪🇸", length: 9 }, { code: "+1", name: "Estados Unidos", flag: "🇺🇸", length: 10 }];

export function ProfilePage() {
  const navigate = useNavigate();
  const { account, setAccount } = useBusinessStore();
  const [draft, setDraft] = useState(account);
  const [saved, setSaved] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const phoneParts = account.phone.match(/^(\+\d+)\s*(.*)$/);
  const [phoneCountry, setPhoneCountry] = useState(phoneParts?.[1] ?? "+57");
  const [phoneNumber, setPhoneNumber] = useState((phoneParts?.[2] ?? account.phone).replace(/\D/g, "").slice(-10));
  const selectedCountry = phoneCountries.find(country => country.code === phoneCountry) ?? phoneCountries[0];
  const change = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setDraft({...draft, [event.target.name]: event.target.value}); setSaved(false); };
  const save = (event: FormEvent) => { event.preventDefault(); if (phoneNumber.length !== selectedCountry.length) return; setAccount({...draft, phone: `${phoneCountry} ${phoneNumber}`}); setSaved(true); };
  return <><PageHeader eyebrow="MI CUENTA" title="Mi perfil" description="Actualiza tus datos como responsable del negocio." /><div className="profile-layout"><section className="surface-card"><div className="profile-hero"><span className="account-avatar large">{account.name.split(" ").map(part => part[0]).slice(0,2).join("")}</span><div><h2>{account.name}</h2><p>{account.role} · Cuenta de administrador</p></div></div><form onSubmit={save} className="profile-form"><div className="form-grid"><FormField label="Nombre completo" name="name" value={draft.name} onChange={change} required /><FormField label="Cargo" name="role" value={draft.role} onChange={change} /><label className="form-field"><span>Correo electrónico</span><input type="email" value={draft.email} readOnly aria-readonly="true" /><small>El correo de acceso no se puede modificar desde aquí.</small></label><label className="form-field"><span>Teléfono</span><div className="phone-composite"><select value={phoneCountry} onChange={event => { const country = phoneCountries.find(item => item.code === event.target.value) ?? phoneCountries[0]; setPhoneCountry(country.code); setPhoneNumber(""); setSaved(false); }} aria-label="País del teléfono">{phoneCountries.map(country => <option key={country.code} value={country.code}>{country.flag} {country.name} ({country.code})</option>)}</select><input type="tel" inputMode="numeric" pattern={`[0-9]{${selectedCountry.length}}`} maxLength={selectedCountry.length} value={phoneNumber} onChange={event => { setPhoneNumber(event.target.value.replace(/\D/g, "").slice(0, selectedCountry.length)); setSaved(false); }} placeholder={selectedCountry.length === 10 ? "300 123 4567" : "123 456 789"} required /></div><small>Escribe solo los {selectedCountry.length} dígitos del número, sin el código {selectedCountry.code}.</small></label></div><div className="form-actions"><button className="action-button" type="submit" disabled={phoneNumber.length !== selectedCountry.length}>Guardar perfil</button>{saved && <span className="save-message" role="status">✓ Perfil guardado</span>}</div></form><div className="profile-logout-area"><div><strong>¿Terminaste por hoy?</strong><small>Puedes volver cuando quieras.</small></div>{confirmingLogout ? <div className="profile-logout-confirm"><span>¿Cerrar sesión?</span><div><button className="profile-logout-confirm-yes" type="button" onClick={() => { setAccount(initialAccount); navigate("/login"); }}>Sí, cerrar</button><button className="profile-logout-confirm-cancel" type="button" onClick={() => setConfirmingLogout(false)}>Cancelar</button></div></div> : <button className="profile-logout" type="button" onClick={() => setConfirmingLogout(true)}>Cerrar sesión</button>}</div></section></div></>;
}
