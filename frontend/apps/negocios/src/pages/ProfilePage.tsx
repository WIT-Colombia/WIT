import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FormField } from "../components/common/FormField";
import { PageHeader } from "../components/common/PageHeader";
import { useBusinessStore } from "../services/businessStore";
import { useBusinessAuth } from "../services/businessAuthContext";
import { getAvatarBlob, updateProfile, uploadAvatar } from "../services/businessAuthService";

const phoneCountries = [{ code: "+57", name: "Colombia", flag: "🇨🇴", length: 10 }, { code: "+1-US", dialCode: "+1", name: "Estados Unidos", flag: "🇺🇸", length: 10 }, { code: "+1-CA", dialCode: "+1", name: "Canadá", flag: "🇨🇦", length: 10 }, { code: "+52", name: "México", flag: "🇲🇽", length: 10 }, { code: "+34", name: "España", flag: "🇪🇸", length: 9 }, { code: "+54", name: "Argentina", flag: "🇦🇷", length: 10 }, { code: "+55", name: "Brasil", flag: "🇧🇷", length: 11 }, { code: "+56", name: "Chile", flag: "🇨🇱", length: 9 }, { code: "+51", name: "Perú", flag: "🇵🇪", length: 9 }, { code: "+593", name: "Ecuador", flag: "🇪🇨", length: 9 }, { code: "+58", name: "Venezuela", flag: "🇻🇪", length: 10 }, { code: "+507", name: "Panamá", flag: "🇵🇦", length: 8 }, { code: "+506", name: "Costa Rica", flag: "🇨🇷", length: 8 }, { code: "+44", name: "Reino Unido", flag: "🇬🇧", length: 10 }, { code: "+33", name: "Francia", flag: "🇫🇷", length: 9 }, { code: "+49", name: "Alemania", flag: "🇩🇪", length: 11 }, { code: "+39", name: "Italia", flag: "🇮🇹", length: 10 }, { code: "+61", name: "Australia", flag: "🇦🇺", length: 9 }, { code: "+81", name: "Japón", flag: "🇯🇵", length: 10 }, { code: "+86", name: "China", flag: "🇨🇳", length: 11 }, { code: "+91", name: "India", flag: "🇮🇳", length: 10 }];

export function ProfilePage() {
  const navigate = useNavigate();
  const { account, setAccount } = useBusinessStore();
  const { signOut, user: authUser, refresh } = useBusinessAuth();
  const [draft, setDraft] = useState(account);
  const [saved, setSaved] = useState(false);
  const [nicknameCopied, setNicknameCopied] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [avatarMessageIsError, setAvatarMessageIsError] = useState(false);
  const visibleNickname = authUser?.nickname ?? account.nickname;
  const phoneParts = account.phone.match(/^(\+\d+)\s*(.*)$/);
  const [phoneCountry, setPhoneCountry] = useState(phoneParts?.[1] ?? "+57");
  const [phoneNumber, setPhoneNumber] = useState((phoneParts?.[2] ?? account.phone).replace(/\D/g, "").slice(-10));
  const selectedCountry = phoneCountries.find(country => country.code === phoneCountry) ?? phoneCountries[0];
  useEffect(() => {
    setDraft(account);
    const nextParts = account.phone.match(/^(\+\d+)\s*(.*)$/);
    setPhoneCountry(nextParts?.[1] ?? "+57");
    setPhoneNumber((nextParts?.[2] ?? account.phone).replace(/\D/g, "").slice(-10));
  }, [account]);
  useEffect(() => { let objectUrl: string | null = null; if (!authUser?.avatarUrl) { setAvatarSrc(null); return; } if (!authUser.avatarUrl.startsWith("/api/v1/auth/me/avatar")) { setAvatarSrc(authUser.avatarUrl); return; } void getAvatarBlob(authUser.avatarUrl).then(blob => { objectUrl = URL.createObjectURL(blob); setAvatarSrc(objectUrl); }).catch(() => setAvatarSrc(null)); return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [authUser?.avatarUrl]);
  const change = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setDraft({...draft, [event.target.name]: event.target.value}); setSaved(false); };
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
      await refresh();
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
  const save = (event: FormEvent) => { event.preventDefault(); if (![0, selectedCountry.length].includes(phoneNumber.length)) return; void updateProfile({ name: draft.name, ...(draft.nickname ? { nickname: draft.nickname } : {}) }).then(user => { setAccount({...draft, name: user.displayName, nickname: user.nickname ?? draft.nickname, phone: phoneNumber ? `${selectedCountry.dialCode ?? phoneCountry} ${phoneNumber}` : draft.phone}); setSaved(true); }); };
  return <><PageHeader eyebrow="MI CUENTA" title="Mi perfil" description="Actualiza tus datos personales y de acceso." /><div className="profile-layout"><section className="surface-card"><div className="profile-hero"><label className="account-avatar large profile-avatar-upload" aria-busy={avatarSaving}>{avatarSrc ? <img src={avatarSrc} alt="Foto de perfil" /> : account.name.split(" ").map(part => part[0]).slice(0,2).join("")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={changeAvatar} disabled={avatarSaving} aria-label="Cambiar foto de perfil" /><em>{avatarSaving ? "Guardando…" : "Cambiar foto"}</em></label><div><h2>{account.name}</h2><p>{visibleNickname || "Sin registrar"} · Cuenta personal</p>{avatarMessage && <small className={`profile-avatar-message${avatarMessageIsError ? " is-error" : ""}`} role="status">{avatarMessage}</small>}</div></div><form onSubmit={save} className="profile-form"><div className="form-grid"><FormField label="Nombre completo" name="name" value={draft.name} onChange={change} required /><label className="form-field"><span>Nickname único</span><div className="nickname-copy-field"><input type="text" name="nickname" value={visibleNickname || "Sin registrar"} readOnly aria-readonly="true" /><button type="button" className="nickname-copy-button" onClick={() => void copyNickname()} disabled={!visibleNickname}>{nicknameCopied ? "Copiado" : "Copiar"}</button></div><small>Este nickname es único y no puede repetirse.</small></label><label className="form-field"><span>Correo electrónico</span><input type="email" value={draft.email} readOnly aria-readonly="true" /><small>El correo de acceso no se puede modificar desde aquí.</small></label><label className="form-field"><span>Teléfono</span><div className="phone-composite"><select value={phoneCountry} onChange={event => { const country = phoneCountries.find(item => item.code === event.target.value) ?? phoneCountries[0]; setPhoneCountry(country.code); setPhoneNumber(""); setSaved(false); }} aria-label="País del teléfono">{phoneCountries.map(country => <option key={country.code} value={country.code}>{country.flag} {country.name} ({country.dialCode ?? country.code})</option>)}</select><input type="tel" inputMode="numeric" pattern={`[0-9]{${selectedCountry.length}}`} maxLength={selectedCountry.length} value={phoneNumber} onChange={event => { setPhoneNumber(event.target.value.replace(/\D/g, "").slice(0, selectedCountry.length)); setSaved(false); }} placeholder={selectedCountry.length === 10 ? "300 123 4567" : "123 456 789"} /></div><small>{phoneNumber ? `Escribe solo los ${selectedCountry.length} dígitos del número.` : "Sin registrar"}</small></label></div><div className="form-actions"><button className="action-button" type="submit" disabled={![0, selectedCountry.length].includes(phoneNumber.length)}>Guardar perfil</button>{saved && <span className="save-message" role="status">✓ Perfil guardado</span>}</div></form><div className="profile-logout-area"><div><strong>¿Terminaste por hoy?</strong><small>Puedes volver cuando quieras.</small></div>{confirmingLogout ? <div className="profile-logout-confirm"><span>¿Cerrar sesión?</span><div><button className="profile-logout-confirm-yes" type="button" onClick={() => void signOut().then(() => navigate("/login"))}>Sí, cerrar</button><button className="profile-logout-confirm-cancel" type="button" onClick={() => setConfirmingLogout(false)}>Cancelar</button></div></div> : <button className="profile-logout" type="button" onClick={() => setConfirmingLogout(true)}>Cerrar sesión</button>}</div></section></div></>;
}
