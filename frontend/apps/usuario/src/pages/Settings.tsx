import { useState } from "react";
import { Link } from "react-router-dom";
import { getSettings, saveSettings, type UserSettings } from "../services/userDataService";
import { getSelectedLocation } from "../services/locationService";
import { PageLayout } from "../components/PageLayout";
import "./Settings.css";

const settingCopy: { key: keyof UserSettings; title: string; description: string }[] = [
  { key: "nearbyUpdates", title: "Novedades de lugares cercanos", description: "Avisos de muestra cuando haya más opciones en tu zona." },
  { key: "availabilityUpdates", title: "Cambios de disponibilidad", description: "Información local sobre horarios y negocios abiertos." },
  { key: "reducedMotion", title: "Reducir movimiento", description: "Limita las animaciones de la interfaz." },
];

export default function Settings() {
  const [settings, setSettings] = useState<UserSettings>(getSettings);
  const location = getSelectedLocation();
  const locationName = location ? `${location.name}, ${location.context}` : "Palmira, Valle del Cauca";
  function update(key: keyof UserSettings, value: boolean) { const next = { ...settings, [key]: value }; setSettings(next); saveSettings(next); }
  return <PageLayout className="settings-page"><div className="user-page-heading"><span>PERSONALIZA WIT</span><h1>Ajustes</h1><p>Controla algunas preferencias de esta experiencia en este dispositivo.</p></div><div className="settings-sections"><section className="settings-panel settings-info-panel"><div><h2>Tu ubicación</h2><p>Estás explorando en <b>{locationName}</b>.</p></div><Link className="settings-action" to="/location">Cambiar ubicación <span>→</span></Link></section><section className="settings-panel"><h2>Preferencias</h2>{settingCopy.map((item) => <label className="settings-row" key={item.key}><span><b>{item.title}</b><small>{item.description}</small></span><input type="checkbox" checked={settings[item.key]} onChange={(event) => update(item.key, event.target.checked)} aria-label={item.title}/></label>)}<p>Las notificaciones son ejemplos locales. No se envían avisos reales.</p></section><section className="settings-panel settings-info-panel"><div><h2>Cuenta y privacidad</h2><p>Tu perfil, actividad y preferencias de muestra se guardan en este dispositivo. No se envían a un servidor.</p></div><Link className="settings-action" to="/profile">Ver información de cuenta <span>→</span></Link></section></div><Link className="settings-profile-link" to="/profile">← Volver a tu perfil</Link></PageLayout>;
}
