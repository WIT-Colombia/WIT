import xamukoLogo from "../../assets/XAMUKO-V1-transparent.avif";
import { Link } from "react-router-dom";
import { useBusinessStore } from "../../services/businessStore";
import { businessApi } from "../../services/businessApiClient";
import { useEffect, useState } from "react";
import { useBusinessAuth } from "../../services/businessAuthContext";

export function BusinessHeader() {
  const { account, business } = useBusinessStore();
  const { user } = useBusinessAuth();
  const [isPro, setIsPro] = useState(false);
  useEffect(() => { let active = true; if (business.source !== "real" || !business.id) { setIsPro(false); return () => { active = false; }; } businessApi.getCatalogLimits(business.id).then(limits => { if (active) setIsPro(limits.plan === "PRO"); }).catch(() => { if (active) setIsPro(false); }); return () => { active = false; }; }, [business.id, business.source]);
  const displayName = user?.displayName || (business.source === "real" ? "" : account.name);
  const initials = displayName.split(" ").map((part) => part[0]).slice(0, 2).join("");
  return <header className="business-header">
    <Link className="business-header-brand" to="/" aria-label="XAMUKO Business, inicio"><img className="xamuko-header-logo" src={xamukoLogo} alt="XAMUKO" /><span className="business-header-copy"><span className="business-header-name">BUSINESS{isPro && <em className="business-pro-badge">PRO</em>}</span><span className="business-header-tagline">Lo que necesitas, está más cerca</span></span></Link>
    <Link className="business-header-profile" to="/perfil" aria-label="Abrir mi perfil">{initials}</Link>
  </header>;
}
