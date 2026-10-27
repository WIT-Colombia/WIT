import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { FormField } from "../components/common/FormField";
import { PageHeader } from "../components/common/PageHeader";
import { useBusinessStore } from "../services/businessStore";
import { useBusinessAuth } from "../services/businessAuthContext";
import { getAvatarBlob, updateProfile, uploadAvatar } from "../services/businessAuthService";

export function ProfilePage() {
  const navigate = useNavigate();
  const { account, setAccount } = useBusinessStore();
  const { signOut, user: authUser, refresh } = useBusinessAuth();
  const [draft, setDraft] = useState(account);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [nicknameCopied, setNicknameCopied] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [avatarMessageIsError, setAvatarMessageIsError] = useState(false);
  const visibleNickname = authUser?.nickname ?? account.nickname;
  useEffect(() => {
    setDraft(account);
  }, [account]);
  useEffect(() => {
    if (profileMessage?.kind !== "success") return;
    const timeout = window.setTimeout(() => setProfileMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [profileMessage]);
  useEffect(() => { let objectUrl: string | null = null; if (!authUser?.avatarUrl) { setAvatarSrc(null); return; } if (!authUser.avatarUrl.startsWith("/api/v1/auth/me/avatar")) { setAvatarSrc(authUser.avatarUrl); return; } void getAvatarBlob(authUser.avatarUrl).then(blob => { objectUrl = URL.createObjectURL(blob); setAvatarSrc(objectUrl); }).catch(() => setAvatarSrc(null)); return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [authUser?.avatarUrl]);
  const change = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setDraft({...draft, [event.target.name]: event.target.value}); setProfileMessage(null); };
  const changeAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setAvatarMessage(null);
    setAvatarMessageIsError(false);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setAvatarMessage("Usa una imagen JPG, PNG o WebP de máximo 5 MB.");
      setAvatarMessageIsError(true);
      input.value = "";
      return;
    }
    setAvatarSaving(true);
    try {
      await uploadAvatar(file);
      void refresh().catch(() => undefined);
      setAvatarMessage("Foto de perfil actualizada.");
    } catch {
      setAvatarMessage("No pudimos guardar la foto. Inténtalo de nuevo.");
      setAvatarMessageIsError(true);
    } finally {
      setAvatarSaving(false);
      input.value = "";
    }
  };
  const copyNickname = async () => {
    if (!visibleNickname) return;
    try {
      await navigator.clipboard.writeText(visibleNickname);
      setNicknameCopied(true);
      window.setTimeout(() => setNicknameCopied(false), 1800);
    } catch {
      setNicknameCopied(false);
    }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const user = await updateProfile({ name: draft.name, ...(draft.nickname ? { nickname: draft.nickname } : {}) });
      setAccount({ ...draft, name: user.displayName, nickname: user.nickname ?? draft.nickname });
      await refresh();
      setProfileMessage({ kind: "success", text: "Tus datos personales se actualizaron correctamente." });
    } catch {
      setProfileMessage({ kind: "error", text: "No pudimos guardar los cambios. Inténtalo de nuevo." });
    } finally {
      setSavingProfile(false);
    }
  };
  return <><PageHeader eyebrow="MI CUENTA" title="Mi perfil" description="Actualiza tus datos personales y de acceso." /><div className="profile-layout"><section className="surface-card"><div className="profile-hero"><label className="account-avatar large profile-avatar-upload" aria-busy={avatarSaving}>{avatarSrc ? <img src={avatarSrc} alt="Foto de perfil" /> : account.name.split(" ").map(part => part[0]).slice(0,2).join("")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={changeAvatar} disabled={avatarSaving} aria-label="Cambiar foto de perfil" /><em>{avatarSaving ? "Guardando…" : "Cambiar foto"}</em></label><div><h2>{account.name}</h2><p>{visibleNickname || "Sin registrar"} · Cuenta personal</p>{avatarMessage && <small className={`profile-avatar-message${avatarMessageIsError ? " is-error" : ""}`} role="status">{avatarMessage}</small>}</div></div><form onSubmit={save} className="profile-form"><div className="form-grid"><FormField label="Nombre completo" name="name" value={draft.name} onChange={change} required /><label className="form-field"><span>Nickname único</span><div className="nickname-copy-field"><input type="text" name="nickname" value={visibleNickname || "Sin registrar"} readOnly aria-readonly="true" /><button type="button" className="nickname-copy-button" onClick={() => void copyNickname()} disabled={!visibleNickname}>{nicknameCopied ? "Copiado" : "Copiar"}</button></div><small>Este nickname es único y no puede repetirse.</small></label><label className="form-field"><span>Correo electrónico</span><input type="email" value={draft.email} readOnly aria-readonly="true" /><small>El correo de acceso no se puede modificar desde aquí.</small></label></div><div className="form-actions profile-save-actions"><button className="action-button" type="submit" disabled={savingProfile}>{savingProfile ? "Guardando…" : "Guardar cambios"}</button>{profileMessage && <span className={`profile-save-message${profileMessage.kind === "error" ? " is-error" : ""}`} role="status">{profileMessage.text}</span>}</div><div className="profile-account-links"><Link className="outline-button" to="/recuperar">Cambiar contraseña →</Link><Link className="outline-button" to="/legal/terms?from=perfil">Términos y condiciones →</Link></div></form><div className="profile-logout-area"><div><strong>¿Terminaste por hoy?</strong><small>Puedes volver cuando quieras.</small></div>{confirmingLogout ? <div className="profile-logout-confirm"><span>¿Cerrar sesión?</span><div><button className="profile-logout-confirm-yes" type="button" onClick={() => void signOut().then(() => navigate("/login"))}>Sí, cerrar</button><button className="profile-logout-confirm-cancel" type="button" onClick={() => setConfirmingLogout(false)}>Cancelar</button></div></div> : <button className="profile-logout" type="button" onClick={() => setConfirmingLogout(true)}>Cerrar sesión</button>}</div></section></div></>;
}
