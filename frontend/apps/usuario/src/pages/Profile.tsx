import { useEffect, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getNotifications, getProfile, saveProfile, type UserProfile } from "../services/userDataService";
import { uploadAvatar } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { PageLayout } from "../components/PageLayout";
import { BellIcon, HeartIcon, ReviewIcon, ThumbsUpIcon } from "../components/ActionIcons";
import { EmailVerificationNotice } from "../components/EmailVerificationNotice";
import { useLocationContext } from "../context/LocationContext";
import { useAccountAvatar } from "../hooks/useAccountAvatar";
import "./Profile.css";
import "./ProfileEnhancements.css";

export default function Profile() {
  const { logout, user, reloadUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(() => getProfile(user?.id));
  const navigate = useNavigate();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);
  const unreadNotifications = getNotifications().filter((item) => !item.read).length;
  const { selection } = useLocationContext();
  const selectedLocation = selection?.locality ?? null;
  const accountAvatar = useAccountAvatar(user?.avatarUrl);

  useEffect(() => {
    if (!user) return;
    setProfile(() => ({ ...getProfile(user.id), name: user.displayName, email: user.emailNormalized ?? "" }));
  }, [user]);
  useEffect(() => { const savedPhoto = profile.photo; if (!user || user.avatarUrl || !savedPhoto?.startsWith("data:image/")) return; void fetch(savedPhoto).then(response => response.blob()).then(blob => uploadAvatar(new File([blob], "perfil.jpg", { type: blob.type || "image/jpeg" }))).then(() => reloadUser()).catch(() => setAvatarError("No se pudo recuperar la foto anterior. Selecciona una imagen JPG, PNG o WebP.")); }, [profile.photo, reloadUser, user]);

  async function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      input.value = "";
      setAvatarNotice(null);
      setAvatarError("Usa una imagen JPG, PNG o WebP de máximo 5 MB.");
      return;
    }
    setAvatarSaving(true);
    setAvatarError(null);
    setAvatarNotice(null);
    try {
      await uploadAvatar(file);
      // The upload already succeeded. A subsequent profile refresh must not
      // be presented as a storage failure (notably on mobile Safari).
      const next = { ...profile, photo: undefined };
      setProfile(next);
      try { saveProfile(next, user?.id); } catch { /* Local cache is optional; the avatar is stored on the server. */ }
      try {
        await reloadUser();
        setAvatarNotice("Foto de perfil actualizada.");
      } catch {
        setAvatarNotice("Foto guardada. Recarga la página si todavía no ves el cambio.");
      }
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "No se pudo guardar la foto de perfil.");
    } finally {
      // Keep the selected File available until the upload finishes on iOS.
      input.value = "";
      setAvatarSaving(false);
    }
  }

  return (
    <PageLayout active="home" className="profile-page">
      <EmailVerificationNotice />
      <div className="profile-welcome">
        <label className="profile-avatar-picker" aria-busy={avatarSaving}>
          {accountAvatar || profile.photo ? <img src={accountAvatar ?? profile.photo} alt="Foto de perfil" /> : <span>{profile.name.trim().charAt(0).toUpperCase() || "D"}</span>}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} disabled={avatarSaving} />
          <em>{avatarSaving ? "Guardando…" : "Cambiar foto"}</em>
        </label>
        <div>
          <span>MI PERFIL</span>
          <h1>Hola{profile.name ? `, ${profile.name}` : ""}</h1>
          <p className="profile-location-label">{selectedLocation ? `${selectedLocation.name}, ${selectedLocation.context}` : selection?.mode === "automatic" ? "Ubicación actual" : "Zona no seleccionada"}</p>
        </div>
      </div>
      {avatarError && <p className="profile-avatar-error" role="alert">{avatarError}</p>}
      {avatarNotice && <p className="profile-avatar-notice" role="status">{avatarNotice}</p>}
      {user && !user.emailVerified && <p className="profile-verification-status" role="status">Correo pendiente de verificación</p>}
      <section className="profile-links profile-activity-only">
        <h2>Tu actividad</h2>
        <Link to="/favorites"><span className="profile-icon--stores"><HeartIcon /></span><div><b>Favoritos</b><small>Lugares que guardaste</small></div><i>›</i></Link>
        <Link to="/likes"><span className="profile-icon--products"><ThumbsUpIcon /></span><div><b>Productos y servicios que te gustan</b><small>Lo que has marcado con Me gusta</small></div><i>›</i></Link>
        <Link to="/reviews"><span className="profile-icon--reviews"><ReviewIcon /></span><div><b>Mis opiniones</b><small>Comparte tu experiencia</small></div><i>›</i></Link>
        <Link to="/notifications"><span><BellIcon /></span><div><b>Notificaciones {unreadNotifications > 0 && <em className="profile-notification-badge">{unreadNotifications}</em>}</b><small>Mantente al día</small></div><i>›</i></Link>
        <Link to="/settings"><span className="profile-icon--settings"><span aria-hidden="true">⚙</span></span><div><b>Ajustes</b><small>Configura tu experiencia</small></div><i>›</i></Link>
      </section>
      <section className="profile-logout-area">
        <div><b>¿Terminaste por hoy?</b><small>Puedes volver cuando quieras.</small></div>
        {confirmingLogout ? <div className="profile-signout-confirm"><span>¿Cerrar sesión?</span><div><button type="button" onClick={async () => { await logout(); navigate("/home"); }}>Sí, cerrar</button><button type="button" onClick={() => setConfirmingLogout(false)}>Cancelar</button></div></div> : <button className="profile-signout" type="button" onClick={() => setConfirmingLogout(true)}>Cerrar sesión</button>}
      </section>
    </PageLayout>
  );
}
