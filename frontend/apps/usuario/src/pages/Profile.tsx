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
  const unreadNotifications = getNotifications().filter((item) => !item.read).length;
  const { selection } = useLocationContext();
  const selectedLocation = selection?.locality ?? null;
  const accountAvatar = useAccountAvatar(user?.avatarUrl);

  useEffect(() => {
    if (!user) return;
    setProfile(() => ({ ...getProfile(user.id), name: user.displayName, email: user.emailNormalized ?? "" }));
  }, [user]);
  useEffect(() => { const savedPhoto = profile.photo; if (!user || user.avatarUrl || !savedPhoto?.startsWith("data:image/")) return; void fetch(savedPhoto).then(response => response.blob()).then(blob => uploadAvatar(new File([blob], "perfil.jpg", { type: blob.type || "image/jpeg" }))).then(() => reloadUser()).catch(() => {}); }, [profile.photo, reloadUser, user]);

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => { const next = { ...profile, photo: String(reader.result) }; void uploadAvatar(file).then(() => { saveProfile(next, user?.id); setProfile(next); void reloadUser(); }).catch(() => {}); };
    reader.readAsDataURL(file);
  }

  return (
    <PageLayout active="home" className="profile-page">
      <EmailVerificationNotice />
      <div className="profile-welcome">
        <label className="profile-avatar-picker">
          {accountAvatar || profile.photo ? <img src={accountAvatar ?? profile.photo} alt="Foto de perfil" /> : <span>{profile.name.trim().charAt(0).toUpperCase() || "D"}</span>}
          <input type="file" accept="image/*" onChange={selectPhoto} />
          <em>Cambiar foto</em>
        </label>
        <div>
          <span>MI PERFIL</span>
          <h1>Hola{profile.name ? `, ${profile.name}` : ""}</h1>
          <p className="profile-location-label">{selectedLocation ? `${selectedLocation.name}, ${selectedLocation.context}` : selection?.mode === "automatic" ? "Ubicación actual" : "Zona no seleccionada"}</p>
        </div>
      </div>
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
