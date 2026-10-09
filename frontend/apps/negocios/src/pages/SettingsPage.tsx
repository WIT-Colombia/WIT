import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { useBusinessStore } from "../services/businessStore";
import type { Preferences } from "../types/business";
import { addBusinessVisibilityPeriod, BUSINESS_VISIBILITY_DAYS } from "../services/visibilityPolicy";

export function SettingsPage() {
  const { preferences, setPreferences, business, businesses, setBusinesses, setBusiness, account, notifications, setNotifications } = useBusinessStore();
  const [confirmHide, setConfirmHide] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [transferError, setTransferError] = useState("");
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
      saveVisibility(true, addBusinessVisibilityPeriod().toISOString());
    }
  }, []);
  const renewVisibility = () => saveVisibility(true, addBusinessVisibilityPeriod().toISOString());
  const requestVerification = () => {
    try { localStorage.setItem(verificationStorageKey, "true"); } catch { /* La solicitud queda visible en esta sesión. */ }
    setVerificationRequested(true);
  };
  const requestTransfer = (event: React.FormEvent) => {
    event.preventDefault();
    const target = transferTarget.trim();
    if (business.role !== "Propietario") return;
    if (!/^@?[a-zA-Z0-9._-]{3,30}$/.test(target) || target.toLowerCase() === account.nickname.toLowerCase()) {
      setTransferError("Escribe el nickname de otra cuenta registrada en WIT.");
      return;
    }
    setTransferError("");
    setConfirmTransfer(true);
  };
  const transferOwnership = () => {
    const target = transferTarget.trim();
    const targetNickname = target.includes("@") ? target.toLowerCase() : `@${target.toLowerCase().replace(/\s+/g, ".")}`;
    const updated = { ...business, ownerNickname: targetNickname, role: "Colaborador" as const };
    setBusinesses(businesses.map(item => item === business ? updated : item));
    setBusiness(updated);
    setNotifications([...notifications, { id: `ownership-${Date.now()}`, title: "Propiedad del negocio actualizada", description: `La propiedad de ${business.name} fue transferida a ${target}.`, date: "Ahora", type: "security" as const, read: false, createdAt: new Date().toISOString(), businessName: business.name, businessId: business.name }]);
    setTransferTarget("");
    setConfirmTransfer(false);
  };
  return <><PageHeader eyebrow="TU ESPACIO" title="Configuración" description="Administra tus preferencias, privacidad y acceso a la cuenta." /><div className="settings-layout"><div className="content-stack"><section className="surface-card settings-section"><div className="card-heading"><div><h2>Notificaciones</h2><p>Elige los avisos que te gustaría recibir sobre tu negocio.</p></div><Link className="text-link" to="/notificaciones">Ver bandeja →</Link></div><div className="preference-list"><Preference title="Resumen por correo" detail="Actividad y novedades de tu negocio" checked={preferences.emailUpdates} onChange={() => toggle("emailUpdates")} /><Preference title="Nuevas opiniones" detail="Aviso cuando alguien publique una opinión" checked={preferences.reviewAlerts} onChange={() => toggle("reviewAlerts")} /><Preference title="Interés en productos y servicios" detail="Aviso sobre elementos que reciben más atención" checked={preferences.interestAlerts} onChange={() => toggle("interestAlerts")} /></div></section><section className="surface-card settings-section"><div className="card-heading"><div><h2>Privacidad</h2><p>Controla la visibilidad de tu información comercial.</p></div></div><div className="visibility-panel"><div><strong>Mostrar mi negocio en WIT</strong><p>{visibilityActive && visibilityUntil ? `Visible hasta el ${visibilityUntil.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}.` : "Tu tienda no está visible para las personas."}</p></div><span className={`visibility-status ${visibilityActive ? "active" : "expired"}`}>{visibilityActive ? "Visible" : "No visible"}</span><div className="visibility-actions"><button className="action-button" type="button" onClick={renewVisibility}>{visibilityActive ? `Renovar por ${BUSINESS_VISIBILITY_DAYS} días desde hoy` : `Hacer visible durante ${BUSINESS_VISIBILITY_DAYS} días`}</button><small className="visibility-renew-note">Al hacer clic, los {BUSINESS_VISIBILITY_DAYS} días empiezan a contar desde hoy.</small>{visibilityActive && <button className="outline-button visibility-hide" type="button" onClick={() => setConfirmHide(true)}>Ocultar mi negocio</button>}{confirmHide && <div className="visibility-confirm"><strong>¿Ocultar tu negocio?</strong><p>Dejará de aparecer para las personas, pero conservarás toda su información.</p><div><button className="outline-button" type="button" onClick={() => setConfirmHide(false)}>Cancelar</button><button className="danger-button" type="button" onClick={() => { saveVisibility(false, visibilityUntil?.toISOString() ?? null); setConfirmHide(false); }}>Sí, ocultar negocio</button></div></div>}</div></div><div className="settings-legal-links"><Link className="text-link" to="/legal/terms?from=ajustes">Términos y condiciones →</Link><Link className="text-link" to="/legal/privacy?from=ajustes">Política de privacidad →</Link></div></section><section className="surface-card settings-section verification-settings"><div className="card-heading"><div><h2>Verificación del negocio</h2><p>Ayuda a las personas a confiar en la información de tu tienda.</p></div><span className={`verification-badge ${business.status === "Verificado" ? "verified" : "pending"}`}>{business.status === "Verificado" ? "✓ Verificado" : "Verificación pendiente"}</span></div><div className="verification-copy"><p>Primero revisaremos los datos básicos, la ubicación, el contacto y las fotografías. No necesitas adjuntar documentos para solicitar la revisión.</p><ul><li>La tienda seguirá visible mientras está pendiente.</li><li>Si necesitamos soportes adicionales, te los pediremos por este canal.</li></ul>{business.status === "Verificado" ? <p className="verification-success" role="status">Tu negocio ya fue revisado y aparece como verificado.</p> : verificationRequested ? <p className="verification-success" role="status">Solicitud enviada. Te avisaremos cuando termine la revisión.</p> : <button className="action-button" type="button" onClick={requestVerification}>Solicitar verificación</button>}</div></section>{business.role === "Propietario" && business.status !== "Eliminado" && <section className="surface-card settings-section ownership-settings"><div className="ownership-heading"><span className="ownership-icon" aria-hidden="true">⇄</span><div><h2>Transferir propiedad</h2><p>Entrega el control legal y administrativo de este establecimiento a otra cuenta de WIT.</p></div></div><form className="ownership-form" onSubmit={requestTransfer}><label className="form-field"><span>Nickname del nuevo propietario</span><input value={transferTarget} onChange={event => { setTransferTarget(event.target.value); setTransferError(""); }} placeholder="Ej. @laura.gomez" autoComplete="off" pattern="@?[a-zA-Z0-9._-]{3,30}" required /><small>La persona debe tener una cuenta registrada en WIT.</small>{transferError && <em className="form-error">{transferError}</em>}</label><button className="outline-button ownership-submit" type="submit">Transferir propiedad</button></form>{confirmTransfer && <div className="ownership-confirm"><strong>¿Confirmas transferir la propiedad?</strong><p>Dejarás de ser propietario de {business.name}. Tu cargo pasará a Colaborador y conservarás los permisos operativos.</p><div><button className="outline-button" type="button" onClick={() => setConfirmTransfer(false)}>Cancelar</button><button className="danger-button" type="button" onClick={transferOwnership}>Sí, transferir propiedad</button></div></div>}</section>}</div><aside className="content-stack"><section className="surface-card side-panel settings-security"><span className="panel-icon blue">⌑</span><h2>Seguridad</h2><p>Protege el acceso a tu cuenta y mantén tus datos bajo control.</p><Link className="outline-button inline-button" to="/recuperar?from=ajustes">Cambiar contraseña</Link><Link className="text-link settings-recovery-link" to="/recuperar?mode=email&from=ajustes">Recupera tu contraseña por correo →</Link></section></aside></div></>;
}

function Preference({ title, detail, checked, onChange }: { title: string; detail: string; checked: boolean; onChange: () => void }) {
  return <label className="preference-row"><span><strong>{title}</strong><small>{detail}</small></span><input type="checkbox" checked={checked} onChange={onChange} /><span className="switch-track" aria-hidden="true" /></label>;
}
