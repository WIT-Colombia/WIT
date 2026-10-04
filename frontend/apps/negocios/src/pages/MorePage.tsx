import { Link } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";

const links = [["Servicios", "Gestiona lo que ofreces", "/servicios", "◇"], ["Opiniones", "Conoce a tus clientes", "/opiniones", "☆"], ["Estadísticas", "Revisa el interés en tu negocio", "/estadisticas", "↗"], ["Notificaciones", "Mantente al día", "/notificaciones", "♧"], ["Mi perfil", "Tus datos de cuenta", "/perfil", "◯"], ["Configuración", "Preferencias y privacidad", "/configuracion", "⚙"]];
export function MorePage() { return <><PageHeader eyebrow="EXPLORA WIT" title="Más opciones" description="Todo lo que necesitas para gestionar tu negocio." /><div className="more-grid">{links.map(([title,description,to,icon]) => <Link to={to} className="more-link surface-card" key={to}><span>{icon}</span><div><strong>{title}</strong><small>{description}</small></div><b>→</b></Link>)}</div></>; }
