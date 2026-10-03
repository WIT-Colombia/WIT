import { useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getNotifications, getProfile, saveProfile, signOutUser, type UserProfile } from "../services/userDataService";
import { PageLayout } from "../components/PageLayout";
import { BellIcon, HeartIcon, ThumbsUpIcon } from "../components/ActionIcons";
import "./Profile.css";
import "./ProfileEnhancements.css";

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile>(getProfile);
  const navigate = useNavigate();
  const unreadNotifications = getNotifications().filter((item) => !item.read).length;

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const next = { ...profile, photo: String(reader.result) };
      setProfile(next);
      saveProfile(next);
    };
    reader.readAsDataURL(file);
  }

  return (
    <PageLayout active="home" className="profile-page">
      <div className="profile-welcome">
        <label className="profile-avatar-picker">
          {profile.photo ? <img src={profile.photo} alt="Foto de perfil" /> : <span>{profile.name.trim().charAt(0).toUpperCase() || "D"}</span>}
          <input type="file" accept="image/*" onChange={selectPhoto} />
          <em>Cambiar foto</em>
        </label>
        <div>
          <span>MI PERFIL</span>
          <h1>Hola{profile.name ? `, ${profile.name}` : ""}</h1>
        </div>
      </div>
      <section className="profile-links profile-activity-only">
        <h2>Tu actividad</h2>
        <Link to="/favorites"><span className="profile-icon--stores"><HeartIcon /></span><div><b>Tiendas guardadas</b><small>Encuentra tus favoritos</small></div><i>›</i></Link>
        <Link to="/likes"><span className="profile-icon--products"><ThumbsUpIcon /></span><div><b>Productos y servicios que te gustan</b><small>Lo que has marcado con Me gusta</small></div><i>›</i></Link>
        <Link to="/reviews"><span><span aria-hidden="true">✦</span></span><div><b>Mis opiniones</b><small>Comparte tu experiencia</small></div><i>›</i></Link>
        <Link to="/notifications"><span><BellIcon /></span><div><b>Notificaciones {unreadNotifications > 0 && <em className="profile-notification-badge">{unreadNotifications}</em>}</b><small>Mantente al día</small></div><i>›</i></Link>
        <Link to="/settings"><span><span aria-hidden="true">⚙</span></span><div><b>Ajustes</b><small>Configura tu experiencia</small></div><i>›</i></Link>
      </section>
      <section className="profile-logout-area">
        <div><b>¿Terminaste por hoy?</b><small>Puedes volver cuando quieras.</small></div>
        <button className="profile-signout" type="button" onClick={() => { signOutUser(); navigate("/home"); }}>↪&nbsp; Cerrar sesión</button>
      </section>
    </PageLayout>
  );
}
