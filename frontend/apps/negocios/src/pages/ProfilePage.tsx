import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FormField } from "../components/common/FormField";
import { PageHeader } from "../components/common/PageHeader";
import { useBusinessStore } from "../services/businessStore";
import { initialAccount } from "../data/business.mock";

export function ProfilePage() {
  const navigate = useNavigate();
  const { account, setAccount } = useBusinessStore();
  const [draft, setDraft] = useState(account);
  const [saved, setSaved] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const change = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setDraft({...draft, [event.target.name]: event.target.value}); setSaved(false); };
  const save = (event: FormEvent) => { event.preventDefault(); setAccount(draft); setSaved(true); };
  return <><PageHeader eyebrow="MI CUENTA" title="Mi perfil" description="Actualiza tus datos como responsable del negocio." /><div className="profile-layout"><section className="surface-card"><div className="profile-hero"><span className="account-avatar large">{account.name.split(" ").map(part => part[0]).slice(0,2).join("")}</span><div><h2>{account.name}</h2><p>{account.role} · WIT Negocios</p></div></div><form onSubmit={save} className="profile-form"><div className="form-grid"><FormField label="Nombre completo" name="name" value={draft.name} onChange={change} required /><FormField label="Cargo" name="role" value={draft.role} onChange={change} /><FormField label="Correo electrónico" name="email" type="email" value={draft.email} onChange={change} required /><FormField label="Teléfono" name="phone" type="tel" value={draft.phone} onChange={change} /></div><div className="form-actions"><button className="action-button" type="submit">Guardar perfil</button>{saved && <span className="save-message" role="status">✓ Perfil guardado</span>}</div></form><div className="profile-logout-area"><div><strong>¿Terminaste por hoy?</strong><small>Puedes volver cuando quieras.</small></div>{confirmingLogout ? <div className="profile-logout-confirm"><span>¿Cerrar sesión?</span><div><button className="profile-logout-confirm-yes" type="button" onClick={() => { setAccount(initialAccount); navigate("/login"); }}>Sí, cerrar</button><button className="profile-logout-confirm-cancel" type="button" onClick={() => setConfirmingLogout(false)}>Cancelar</button></div></div> : <button className="profile-logout" type="button" onClick={() => setConfirmingLogout(true)}>Cerrar sesión</button>}</div></section><aside className="surface-card side-panel"><span className="panel-icon blue">⌑</span><h2>Acceso y seguridad</h2><p>Gestiona aquí los datos de acceso y la seguridad de tu cuenta.</p></aside></div></>;
}
