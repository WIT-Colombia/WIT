import xamukoLogo from "../../assets/XAMUKO-V1-transparent.png";
import { Link } from "react-router-dom";
import { useBusinessStore } from "../../services/businessStore";
import { businessApi } from "../../services/businessApiClient";
import { useEffect, useState } from "react";

export function BusinessHeader() {
  const { account, business } = useBusinessStore();
  const [isPro, setIsPro] = useState(false);
  useEffect(() => { let active = true; if (business.source !== "real" || !business.id) { setIsPro(false); return () => { active = false; }; } businessApi.getCatalogLimits(business.id).then(limits => { if (active) setIsPro(limits.plan === "PRO"); }).catch(() => { if (active) setIsPro(false); }); return () => { active = false; }; }, [business.id, business.source]);
  const initials = account.name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  return <header className="business-header">
    <Link className="business-header-brand" to="/" aria-label="XAMUKO Business, inicio"><img className="xamuko-header-logo" src={xamukoLogo} alt="XAMUKO" /><span className="business-header-name">BUSINESS{isPro && <em className="business-pro-badge">PRO</em>}</span></Link>
    <Link className="business-header-profile" to="/perfil" aria-label="Abrir mi perfil">{initials}</Link>
  </header>;
}
