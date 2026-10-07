import { useState } from "react";
import { Link } from "react-router-dom";
import { getProfile, getSettings, saveProfile, saveSettings, type UserProfile, type UserSettings } from "../services/userDataService";
import { getSelectedLocation } from "../services/locationService";
import { PageLayout } from "../components/PageLayout";
import "./Settings.css";

const phoneCountries = [
  ["CO", "Colombia", "+57", 10], ["US", "Estados Unidos", "+1", 10], ["CA", "Canadá", "+1", 10],
  ["MX", "México", "+52", 10], ["ES", "España", "+34", 9], ["AR", "Argentina", "+54", 10],
  ["BR", "Brasil", "+55", 11], ["CL", "Chile", "+56", 9], ["PE", "Perú", "+51", 9],
  ["EC", "Ecuador", "+593", 9], ["VE", "Venezuela", "+58", 10], ["PA", "Panamá", "+507", 8],
  ["CR", "Costa Rica", "+506", 8], ["GB", "Reino Unido", "+44", 10], ["FR", "Francia", "+33", 9],
  ["DE", "Alemania", "+49", 11], ["IT", "Italia", "+39", 10], ["AU", "Australia", "+61", 9],
  ["JP", "Japón", "+81", 10], ["CN", "China", "+86", 11], ["IN", "India", "+91", 10],
] as const;
type PhoneCountryCode = typeof phoneCountries[number][0];
const countryFlags: Record<PhoneCountryCode, string> = { CO: "🇨🇴", US: "🇺🇸", CA: "🇨🇦", MX: "🇲🇽", ES: "🇪🇸", AR: "🇦🇷", BR: "🇧🇷", CL: "🇨🇱", PE: "🇵🇪", EC: "🇪🇨", VE: "🇻🇪", PA: "🇵🇦", CR: "🇨🇷", GB: "🇬🇧", FR: "🇫🇷", DE: "🇩🇪", IT: "🇮🇹", AU: "🇦🇺", JP: "🇯🇵", CN: "🇨🇳", IN: "🇮🇳" };

export default function Settings() {
  const [settings, setSettings] = useState<UserSettings>(getSettings);
  const [profile, setProfile] = useState<UserProfile>(getProfile);
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountryCode>(() => (localStorage.getItem("wit-phone-country") as PhoneCountryCode) || "CO");
  const selectedCountry = phoneCountries.find(([code]) => code === phoneCountry) ?? phoneCountries[0];
  const [phone, setPhone] = useState(() => (localStorage.getItem("wit-phone") || "3214411013").replace(/\D/g, "").slice(0, selectedCountry[3]));
  const [saved, setSaved] = useState(false);
  const provider = localStorage.getItem("wit-auth-provider") ?? "email";
  const location = getSelectedLocation();
  const city = location ? `${location.name}, ${location.context}` : "Palmira, Valle del Cauca";
  function update(key: keyof UserSettings, value: boolean) { const next = { ...settings, [key]: value }; setSettings(next); saveSettings(next); }
  function saveAccount() { saveProfile(profile); localStorage.setItem("wit-phone", phone.replace(/\D/g, "").slice(0, selectedCountry[3])); localStorage.setItem("wit-phone-country", phoneCountry); setSaved(true); window.setTimeout(() => setSaved(false), 2200); }
  return <PageLayout className="settings-page"><Link className="settings-profile-link" to="/profile">← Volver al perfil</Link><div className="user-page-heading"><h1>Ajustes</h1><p>Controla tus preferencias en este dispositivo.</p></div><div className="settings-sections"><div className="settings-primary-stack"><section className="settings-panel settings-info-panel"><div><h2>Ciudad</h2><p>{city}</p></div><Link className="settings-action" to="/location?returnTo=%2Fsettings">Cambiar ciudad →</Link></section><section className="settings-panel settings-notification-panel"><label className="settings-row"><span><b>Notificaciones</b><small>Novedades de lugares cercanos</small></span><input type="checkbox" checked={settings.nearbyUpdates} onChange={(event) => update("nearbyUpdates", event.target.checked)} aria-label="Notificaciones"/></label></section></div><section className="settings-panel settings-account-panel"><h2>Cuenta y privacidad</h2><div className="settings-account-fields"><label>Nombre<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label>Correo electrónico <small>Es el correo de tu cuenta</small><input type="email" value={profile.email} disabled /></label><label>Teléfono <small>opcional</small><div className="settings-phone-field"><select aria-label="País del teléfono" value={phoneCountry} onChange={(event) => { setPhoneCountry(event.target.value as PhoneCountryCode); setPhone(""); }}>{phoneCountries.map(([code, name, dialCode]) => <option key={code} value={code}>{countryFlags[code]} {name} ({dialCode})</option>)}</select><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, selectedCountry[3]))} inputMode="numeric" maxLength={selectedCountry[3]} pattern={`[0-9]{${selectedCountry[3]}}`} placeholder={selectedCountry[3] === 10 ? "300 123 4567" : "123 456 789"} /></div></label></div><div className="settings-account-actions"><button className="settings-save-button" type="button" onClick={saveAccount}>Guardar cambios</button>{provider === "email" ? <Link className="settings-password-link" to="/change-password">Cambiar contraseña →</Link> : <span className="settings-password-disabled">La contraseña se gestiona desde {provider === "google" ? "Google" : "Facebook"}.</span>}<Link className="settings-legal-button" to="/legal/terms?from=settings">Términos y condiciones →</Link></div>{saved && <p className="settings-saved-message" role="status">Cambios guardados.</p>}</section></div></PageLayout>;
}
