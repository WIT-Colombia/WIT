import xamukoLogo from "../../assets/XAMUKO-V1-transparent.webp";
import xamukoLogo320 from "../../assets/XAMUKO-V1-transparent-320.webp";
import xamukoLogo640 from "../../assets/XAMUKO-V1-transparent-640.webp";
import xamukoLogo960 from "../../assets/XAMUKO-V1-transparent-960.webp";
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
  const logoSources = `${xamukoLogo320} 320w, ${xamukoLogo640} 640w, ${xamukoLogo960} 960w, ${xamukoLogo} 2170w`;
  return <header className="business-header">
    <Link className="business-header-brand" to="/inicio" aria-label="XAMUKO Business, inicio"><span className="xamuko-header-artwork"><img className="xamuko-header-logo" src={xamukoLogo} srcSet={logoSources} sizes="(max-width: 760px) 150px, 190px" alt="XAMUKO" /><img className="xamuko-header-logo xamuko-header-wordmark" src={xamukoLogo} srcSet={logoSources} sizes="(max-width: 760px) 150px, 190px" alt="" aria-hidden="true" /></span><span className="business-header-name">BUSINESS{isPro && <em className="business-pro-badge">PRO</em>}</span></Link>
    <Link className="business-header-profile" to="/perfil" aria-label="Abrir mi perfil">{initials}</Link>
  </header>;
}
