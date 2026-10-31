import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { navigation, auxiliaryNavigation } from '../data/navigation';
import { getSession, logout, restoreSession } from '../services/adminService';
import { fetchOwnAvatar } from '../services/adminApiClient';
import { Icon } from './Icon';
import xamukoLogo from '../assets/xamuko-logo.png';

export function Layout() {
  const location = useLocation(); const navigate = useNavigate(); const admin = getSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); const [confirmLogout, setConfirmLogout] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null); const [, setSessionRevision] = useState(0);
  const toggleRef = useRef<HTMLButtonElement>(null); const sidebarRef = useRef<HTMLElement>(null);
  const verification = location.pathname.startsWith('/verifications');
  const dashboardRoute = ['/dashboard', '/summary', '/statistics'].includes(location.pathname);
  useEffect(() => { setOpen(false); setQuery(''); }, [location.pathname, location.search]);
  useEffect(() => { let active = true; const synchronize = () => { if (document.visibilityState !== 'visible') return; void restoreSession().then(() => { if (active) setSessionRevision(value => value + 1); }).catch(() => {}); }; const interval = window.setInterval(synchronize, 3000); window.addEventListener('focus', synchronize); document.addEventListener('visibilitychange', synchronize); return () => { active = false; window.clearInterval(interval); window.removeEventListener('focus', synchronize); document.removeEventListener('visibilitychange', synchronize); }; }, []);
  useEffect(() => {
    let url: string | null = null;
    if (!admin?.avatarUrl) { setAvatarSrc(null); return; }
    if (!admin.avatarUrl.startsWith('/api/v1/auth/me/avatar')) { setAvatarSrc(admin.avatarUrl); return; }
    void fetchOwnAvatar(admin.avatarUrl).then(blob => { url = URL.createObjectURL(blob); setAvatarSrc(url); }).catch(() => setAvatarSrc(null));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [admin?.avatarUrl]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    sidebarRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); }
      if (event.key === 'Tab') {
        const items = sidebarRef.current?.querySelectorAll<HTMLElement>('a, button'); if (!items?.length) return;
        const first = items[0]; const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handle);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', handle); };
  }, [open]);
  const current = [...navigation, ...auxiliaryNavigation].find(item => location.pathname === item.path);
  const results = query.trim() ? [...navigation, ...auxiliaryNavigation].filter(item => item.label.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))) : [];
  const grouped = ['PLATAFORMA', 'GESTIÓN', 'SUSCRIPCIONES', 'FINANZAS', 'CONFIGURACIÓN'];
  const avatar = avatarSrc ? <img src={avatarSrc} alt="" /> : admin?.name?.split(' ').map(part => part[0]).slice(0, 2).join('') || 'A';
  const navItem = (item: typeof navigation[number]) => <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon name={item.icon} size={18} /><span>{item.label}</span></NavLink>;
  return <div className={`app-shell admin-refresh ${verification ? 'verification-preserved' : ''}`}>
    <a className="skip-link" href="#main">Ir al contenido</a>
    {open && <button className="sidebar-backdrop" aria-label="Cerrar navegación" onClick={() => { setOpen(false); toggleRef.current?.focus(); }} />}
    <aside ref={sidebarRef} className={`admin-sidebar ${open ? 'is-open' : ''}`} aria-label="Navegación administrativa">
      <div className="sidebar-brand"><Link to="/dashboard" className="brand" aria-label="XAMUKO Admin, ir al inicio"><span className="xa-brand-combo"><span className="xa-brand-logo"><img src={xamukoLogo} alt="XAMUKO" /></span><span className="xa-brand-subline"><small>Lo que necesitas, está más cerca</small><span className="xa-admin-tag">ADMIN</span></span></span></Link><button className="sidebar-close icon-button" aria-label="Cerrar menú" onClick={() => { setOpen(false); toggleRef.current?.focus(); }}><Icon name="close" /></button></div>
      <nav aria-label="Menú principal">{navItem(navigation[0])}{grouped.map(group => <div className="xa-nav-group" key={group}><p>{group}</p>{navigation.filter(item => item.group === group).map(navItem)}</div>)}<details className="xa-more-menu"><summary>Más módulos</summary>{auxiliaryNavigation.map(navItem)}</details></nav>
      <div className="sidebar-footer"><div className="avatar">{avatar}</div><div><strong>{admin?.name || 'Administrador'}</strong><small>{admin?.role === 'SUPER_ADMIN' ? 'Administrador principal' : 'Administrador'}</small></div><button className="icon-button" aria-label="Cerrar sesión" onClick={() => setConfirmLogout(true)}><Icon name="logout" size={18} /></button></div>
    </aside>
    <div className="admin-main"><header className="admin-header"><div className="header-context"><button ref={toggleRef} className="icon-button menu-toggle" aria-label="Abrir navegación" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" /></button><span className="xa-header-breadcrumb">XAMUKO Admin <span className="breadcrumb-separator">/</span> <strong>{current?.label || 'Detalle'}</strong></span></div><div className="header-tools"><div className="global-search"><Icon name="search" size={18} /><input aria-label="Buscar secciones" placeholder="Buscar secciones de Admin…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }} />{query.trim() && <div className="search-results" aria-label="Resultados de búsqueda"><small>Secciones</small>{results.map(item => <Link key={item.path} to={item.path}>{item.label}<Icon name="arrow" size={14} /></Link>)}{!results.length && <p>No encontramos una sección con ese nombre.</p>}</div>}</div>{dashboardRoute && <label className="xa-date-filter"><Icon name="clock" size={15} /><span>Actividad de</span><input type="month" aria-label="Filtrar actividad por mes" value={searchParams.get('month') || ''} onChange={event => { const next = new URLSearchParams(searchParams); if (event.target.value) next.set('month', event.target.value); else next.delete('month'); setSearchParams(next); }} /></label>}<Link to="/notifications" className="icon-button notification-link" aria-label="Abrir notificaciones"><Icon name="bell" /></Link><Link to="/settings" className="header-avatar avatar" aria-label="Perfil del administrador">{avatar}</Link></div></header><main id="main" className="workspace" tabIndex={-1}><Outlet /></main><footer className="workspace-footer"><span>XAMUKO Admin</span><span>Los módulos pendientes se identifican dentro de cada sección.</span></footer>
    {confirmLogout && <div className="logout-popover" role="dialog" aria-label="Confirmar cierre de sesión"><div><strong>¿Cerrar sesión?</strong><p>Podrás volver a iniciar sesión cuando quieras.</p></div><div className="logout-popover-actions"><button className="secondary-button" onClick={() => setConfirmLogout(false)}>Cancelar</button><button className="danger-button" onClick={() => { void logout().then(() => navigate('/login', { replace: true })); }}>Cerrar sesión</button></div></div>}</div>
  </div>;
}
