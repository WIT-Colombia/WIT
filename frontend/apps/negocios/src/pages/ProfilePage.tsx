import { PHOTO_INPUT_ACCEPT } from "@wit/utils";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { FormField } from "../components/common/FormField";
import "./ProfilePage.css";
import { useBusinessStore } from "../services/businessStore";
import { useBusinessAuth } from "../services/businessAuthContext";
import { getAvatarBlob, updateProfile, uploadAvatar } from "../services/businessAuthService";

type ProfileIconName = "profile" | "user" | "shield" | "camera" | "save" | "copy" | "lock" | "file" | "privacy" | "logout" | "arrow";

function ProfileIcon({ name }: { name: ProfileIconName }) {
  const paths: Record<ProfileIconName, string> = {
    profile: "M20 21v-2a7 7 0 0 0-14 0v2M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM3 21h18",
    user: "M20 21v-2a7 7 0 0 0-14 0v2M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    shield: "M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Zm-4 9 3 3 5-5",
    camera: "M4 7h3l2-3h6l2 3h3v13H4V7Zm8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    save: "M4 3h14l3 3v15H3V3h1Zm3 0v7h10V3M7 21v-8h10v8",
    copy: "M8 8h12v13H8V8ZM4 16H3V3h13v1",
    lock: "M5 11h14v10H5V11Zm3 0V8a4 4 0 1 1 8 0v3",
    file: "M6 3h8l5 5v13H6V3Zm8 0v6h5M9 13h7M9 17h7",
    privacy: "M12 3 3 7v5c0 5 4 8 9 10 5-2 9-5 9-10V7l-9-4ZM9 12l2 2 4-4",
    logout: "M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7",
    arrow: "M5 12h14m-6-6 6 6-6 6",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

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
  const visibleNickname = authUser?.nickname ?? "";
  const hasPasswordOnly = (authUser?.authProviders.includes("EMAIL") && !authUser?.authProviders.includes("GOOGLE")) ?? false;
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
    setAvatarSaving(true);
    try {
      await uploadAvatar(file);
      try {
        await refresh();
        setAvatarMessage("Foto de perfil actualizada.");
      } catch {
        setAvatarMessage("Foto guardada. Actualiza la página para visualizarla.");
      }
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : "No pudimos guardar la foto. Inténtalo de nuevo.");
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
  return <div className="business-profile-page">
    <header className="business-profile-heading">
      <span className="business-profile-eyebrow">MI CUENTA</span>
      <div className="business-profile-heading-main">
        <span className="business-profile-heading-icon"><ProfileIcon name="profile" /></span>
        <div><h1>Mi perfil</h1><p>Administra tus datos personales y las opciones de acceso a XAMUKO Business.</p></div>
      </div>
    </header>

    <section className="profile-identity-card" aria-label="Información de tu cuenta">
      <div className="profile-hero">
        <label className="account-avatar large profile-avatar-upload" aria-busy={avatarSaving}>
          {avatarSrc ? <img src={avatarSrc} alt="Foto de perfil" /> : account.name.split(" ").map(part => part[0]).slice(0,2).join("")}
          <input type="file" accept={PHOTO_INPUT_ACCEPT} onChange={changeAvatar} disabled={avatarSaving} aria-label="Cambiar foto de perfil" />
          <em>{avatarSaving ? "Guardando…" : "Cambiar foto"}</em>
        </label>
        <div className="profile-identity-copy">
          <span className="profile-identity-label">CUENTA PERSONAL</span>
          <h2>{account.name}</h2>
          <p>{visibleNickname || "Nickname sin registrar"}</p>
          {avatarMessage && <small className={"profile-avatar-message" + (avatarMessageIsError ? " is-error" : "")} role="status">{avatarMessage}</small>}
        </div>
      </div>
      <div className="profile-identity-note"><ProfileIcon name="camera" /><span>Selecciona tu foto para actualizar la imagen de tu cuenta.</span></div>
    </section>

    <div className="profile-layout">
      <section className="surface-card profile-info-card" aria-labelledby="profile-info-title">
        <div className="profile-card-heading">
          <span className="profile-card-icon"><ProfileIcon name="user" /></span>
          <div><span className="profile-card-eyebrow">INFORMACIÓN PERSONAL</span><h2 id="profile-info-title">Datos de tu cuenta</h2><p>Revisa y actualiza los datos disponibles de tu perfil.</p></div>
        </div>
        <form onSubmit={save} className="profile-form">
          <div className="form-grid">
            <FormField label="Nombre completo" name="name" value={draft.name} onChange={change} required />
            <label className="form-field">
              <span>Nickname único</span>
              <div className="nickname-copy-field">
                <input type="text" name="nickname" value={visibleNickname || "Sin registrar"} readOnly aria-readonly="true" />
                <button type="button" className="nickname-copy-button" onClick={() => void copyNickname()} disabled={!visibleNickname}><ProfileIcon name="copy" />{nicknameCopied ? "Copiado" : "Copiar"}</button>
              </div>
              <small>Tu identificador personal es único y no se puede modificar aquí.</small>
            </label>
            <label className="form-field profile-email-field">
              <span>Correo electrónico</span>
              <input type="email" value={draft.email} readOnly aria-readonly="true" />
              <small>El correo de acceso no se puede modificar desde aquí.</small>
            </label>
          </div>
          <div className="form-actions profile-save-actions">
            <button className="action-button" type="submit" disabled={savingProfile}><ProfileIcon name="save" />{savingProfile ? "Guardando…" : "Guardar cambios"}</button>
            {profileMessage && <span className={"profile-save-message" + (profileMessage.kind === "error" ? " is-error" : "")} role="status">{profileMessage.text}</span>}
          </div>
        </form>
      </section>

      <aside className="profile-side-stack">
        <section className="surface-card profile-access-card" aria-labelledby="profile-access-title">
          <div className="profile-card-heading">
            <span className="profile-card-icon"><ProfileIcon name="shield" /></span>
            <div><span className="profile-card-eyebrow">PRIVACIDAD Y ACCESO</span><h2 id="profile-access-title">Seguridad de tu cuenta</h2><p>Consulta tus opciones de acceso y documentos legales.</p></div>
          </div>
          <nav className="profile-account-links" aria-label="Opciones de cuenta">
            {hasPasswordOnly && <Link to="/recuperar"><span className="profile-account-link-icon"><ProfileIcon name="lock" /></span><span>Cambiar contraseña</span><ProfileIcon name="arrow" /></Link>}
            <Link to="/legal/terms?from=perfil"><span className="profile-account-link-icon"><ProfileIcon name="file" /></span><span>Términos y condiciones</span><ProfileIcon name="arrow" /></Link>
            <Link to="/legal/privacy?from=perfil"><span className="profile-account-link-icon"><ProfileIcon name="privacy" /></span><span>Política de privacidad</span><ProfileIcon name="arrow" /></Link>
          </nav>
        </section>
        <section className="profile-logout-area" aria-label="Cerrar sesión">
          <div className="profile-logout-copy">
            <span className="profile-logout-icon"><ProfileIcon name="logout" /></span>
            <div><strong>Cerrar sesión</strong><small>Finaliza tu sesión de forma segura.</small></div>
          </div>
          {confirmingLogout ? <div className="profile-logout-confirm">
            <span>¿Confirmas que deseas cerrar sesión?</span>
            <div><button className="profile-logout-confirm-yes" type="button" onClick={() => void signOut().then(() => navigate("/login"))}>Sí, cerrar</button><button className="profile-logout-confirm-cancel" type="button" onClick={() => setConfirmingLogout(false)}>Cancelar</button></div>
          </div> : <button className="profile-logout" type="button" onClick={() => setConfirmingLogout(true)}>Cerrar sesión</button>}
        </section>
      </aside>
    </div>
  </div>;
}
