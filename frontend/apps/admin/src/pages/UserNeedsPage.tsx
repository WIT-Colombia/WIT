import { useState } from 'react';
import './UserNeedsPage.css';
type Status = 'Todos' | 'Pendiente' | 'En revisión' | 'Atendida' | 'Descartada';
const statuses: Status[] = ['Todos', 'Pendiente', 'En revisión', 'Atendida', 'Descartada'];
export function UserNeedsPage() {
 const [search,setSearch]=useState('');
 const [status,setStatus]=useState<Status>('Todos');
 return <section className="user-needs-page" aria-labelledby="user-needs-title">
 <header className="page-heading"><div><p className="eyebrow">ATENCIÓN Y SOPORTE</p><h1 id="user-needs-title">Necesidades de usuarios</h1><p>Solicitudes de «Cuéntanos qué necesitas» en Xamuko Usuarios.</p></div><span className="user-needs-pending">Integración pendiente</span></header>
 <div className="user-needs-overview"><div><span>Fuente de información</span><strong>API de necesidades</strong><small>Sin conexión por ahora</small></div><div><span>Registros disponibles</span><strong>—</strong><small>Datos no consultados</small></div><div><span>Gestión de solicitudes</span><strong>Próximamente</strong><small>Requiere backend</small></div></div>
 <div className="user-needs-toolbar"><label className="user-needs-search">Buscar solicitudes<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Usuario, necesidad, ciudad o categoría"/></label><label className="user-needs-filter">Estado<select value={status} onChange={event=>setStatus(event.target.value as Status)}>{statuses.map(value=><option key={value}>{value}</option>)}</select></label></div>
 <div className="user-needs-table-wrap"><table><thead><tr><th>Radicado</th><th>Fecha</th><th>Usuario</th><th>Necesidad</th><th>Categoría</th><th>Ciudad o zona</th><th>Estado</th><th>Detalle</th></tr></thead><tbody><tr><td colSpan={8}><div className="user-needs-empty"><span aria-hidden="true">✉</span><h2>La bandeja aún no está conectada</h2><p>Cuando se habilite la API, aquí aparecerán las solicitudes reales de los usuarios. No se presentan registros ficticios.</p>{(search || status!=='Todos') && <p>Filtros preparados: {search || 'Sin texto'} · {status}</p>}</div></td></tr></tbody></table></div>
 <p className="user-needs-note">Pendiente: integración de datos, radicados, detalle, estados e historial de gestión. Esta pantalla todavía no guarda ni modifica solicitudes.</p>
 </section>;
}
