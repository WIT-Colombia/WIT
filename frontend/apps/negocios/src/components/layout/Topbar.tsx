import xamukoLogo from "../../assets/XAMUKO-V1-transparent.avif";
import { Link } from "react-router-dom";
export function Topbar() { return <header className="topbar business-header"><Link className="business-header-brand" to="/" aria-label="XAMUKO Business, inicio"><img className="xamuko-header-logo" src={xamukoLogo} alt="XAMUKO" /><span className="business-header-copy"><span className="business-header-name">BUSINESS</span></span></Link></header>; }
