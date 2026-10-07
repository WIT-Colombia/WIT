import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { useBusinessStore } from "../services/businessStore";
import type { Preferences } from "../types/business";

export function SettingsPage() {
  const { preferences, setPreferences, business } = useBusinessStore();
  const [confirmHide, setConfirmHide] = useState(false);
  const verificationStorageKey = `wit-negocios-demo:verification-request:${business.name}`;
  const [verificationRequested, setVerificationRequested] = useState(() => {
    try { return localStorage.getItem(verificationStorageKey) === "true"; } catch { return false; }
  });
  const toggle = (key: keyof Preferences) => setPreferences({ ...preferences, [key]: !preferences[key] });
  const businessVisibility = preferences.visibilityByBusiness?.[business.name];
  const visibilityUntil = (businessVisibility?.visibilityUntil ?? preferences.visibilityUntil) ? new Date(businessVisibility?.visibilityUntil ?? preferences.visibilityUntil!) : null;
  const visibilityActive = Boolean((businessVisibility?.profileVisible ?? preferences.profileVisible) && visibilityUntil && visibilityUntil.getTime() > Date.now());
  const saveVisibility = (profileVisible: boolean, until: string | null) => setPreferences({ ...preferences, visibilityByBusiness: { ...(preferences.visibilityByBusiness ?? {}), [business.name]: { profileVisible, visibilityUntil: until } } });
  useEffect(() => {
    if (!businessVisibility && preferences.profileVisible && !preferences.visibilityUntil) {
      saveVisibility(true, new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString());
    }
  }, []);
  const renewVisibility = () => saveVisibility(true, new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString());
  const requestVerification = () => {
    try { localStorage.setItem(verificationStorageKey, "true"); } catch { /* La solicitud queda visible en esta sesión. */ }
    setVerificationRequested(true);
  };
  return <><PageHeader eyebrow="TU ESPACIO" title="Configuración" description="Administra tus preferencias, privacidad y acceso a la cuenta." /><div className="settings-layout"><div className="content-stack"><section className="surface-card settings-section"><div className="card-heading"><div><h2>Notificaciones</h2><p>Elige los avisos que te gustaría recibir sobre tu negocio.</p></div><Link className="text-link" to="/notificaciones">Ver bandeja →</Link></div><div className="preference-list"><Preference title="Resumen por correo" detail="Actividad y novedades de tu negocio" checked={preferences.emailUpdates} onChange={() => toggle("emailUpdates")} /><Preference title="Nuevas opiniones" detail="Aviso cuando alguien publique una opinión" checked={preferences.reviewAlerts} onChange={() => toggle("reviewAlerts")} /><Preference title="Interés en productos y servicios" detail="Aviso sobre elementos que reciben más atención" checked={preferences.interestAlerts} onChange={() => toggle("interestAlerts")} /></div></section><section className="surface-card settings-section"><div className="card-heading"><div><h2>Privacidad</h2><p>Controla la visibilidad de tu información comercial.</p></div></div><div className="visibility-panel"><div><strong>Mostrar mi negocio en WIT</strong><p>{visibilityActive && visibilityUntil ? `Visible hasta el ${visibilityUntil.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}.` : "Tu tienda no está visible para las personas."}</p></div><span className={`visibility-status ${visibilityActive ? "active" : "expired"}`}>{visibilityActive ? "Visible" : "No visible"}</span><div className="visibility-actions"><button className="action-button" type="button" onClick={renewVisibility}>{visibilityActive ? "Extender 40 días" : "Hacerme visible por 40 días"}</button>{visibilityActive && <button className="outline-button visibility-hide" type="button" onClick={() => setConfirmHide(true)}>Ocultar mi negocio</button>}{confirmHide && <div className="visibility-confirm"><strong>¿Ocultar tu negocio?</strong><p>Dejará de aparecer para las personas, pero conservarás toda su información.</p><div><button className="outline-button" type="button" onClick={() => setConfirmHide(false)}>Cancelar</button><button className="danger-button" type="button" onClick={() => { saveVisibility(false, visibilityUntil?.toISOString() ?? null); setConfirmHide(false); }}>Sí, ocultar negocio</button></div></div>}</div></div><div className="settings-legal-links"><Link className="text-link" to="/legal/terms?from=ajustes">Términos y condiciones →</Link><Link className="text-link" to="/legal/privacy?from=ajustes">Política de privacidad →</Link></div></section><section className="surface-card settings-section verification-settings"><div className="card-heading"><div><h2>Verificación del negocio</h2><p>Ayuda a las personas a confiar en la información de tu tienda.</p></div><span className={`verification-badge ${business.status === "Verificado" ? "verified" : "pending"}`}>{business.status === "Verificado" ? "✓ Verificado" : "Verificación pendiente"}</span></div><div className="verification-copy"><p>Primero revisaremos los datos básicos, la ubicación, el contacto y las fotografías. No necesitas adjuntar documentos para solicitar la revisión.</p><ul><li>La tienda seguirá visible mientras está pendiente.</li><li>Si necesitamos soportes adicionales, te los pediremos por este canal.</li></ul>{business.status === "Verificado" ? <p className="verification-success" role="status">Tu negocio ya fue revisado y aparece como verificado.</p> : verificationRequested ? <p className="verification-success" role="status">Solicitud enviada. Te avisaremos cuando termine la revisión.</p> : <button className="action-button" type="button" onClick={requestVerification}>Solicitar verificación</button>}</div></section></div><aside className="content-stack"><section className="surface-card side-panel settings-security"><span className="panel-icon blue">⌑</span><h2>Seguridad</h2><p>Protege el acceso a tu cuenta y mantén tus datos bajo control.</p><Link className="outline-button inline-button" to="/recuperar">Cambiar contraseña</Link><Link className="text-link settings-recovery-link" to="/recuperar?mode=email">Recupera tu contraseña por correo →</Link></section></aside></div></>;
}

function Preference({ title, detail, checked, onChange }: { title: string; detail: string; checked: boolean; onChange: () => void }) {
  return <label className="preference-row"><span><strong>{title}</strong><small>{detail}</small></span><input type="checkbox" checked={checked} onChange={onChange} /><span className="switch-track" aria-hidden="true" /></label>;
}
