import xamukoLogo from "../../assets/XAMUKO-V1-transparent.png";
import { Link } from "react-router-dom";
import { useBusinessStore } from "../../services/businessStore";

export function BusinessHeader() {
  const { account } = useBusinessStore();
  const initials = account.name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  return <header className="business-header">
    <Link className="business-header-brand" to="/" aria-label="XAMUKO Business, inicio"><img className="xamuko-header-logo" src={xamukoLogo} alt="XAMUKO" /><span className="business-header-name">BUSINESS</span></Link>
    <Link className="business-header-profile" to="/perfil" aria-label="Abrir mi perfil">{initials}</Link>
  </header>;
}
