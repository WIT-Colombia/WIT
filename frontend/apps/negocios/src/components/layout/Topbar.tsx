import { Link } from "react-router-dom";
export function Topbar() { return <header className="topbar business-header"><Link className="business-header-brand" to="/inicio" aria-label="XAMUKO Business, inicio"><img className="xamuko-header-logo" src="/brand/xamuko-lockup.png" alt="XAMUKO" width="2170" height="725" /><span className="business-header-name">BUSINESS</span></Link></header>; }
