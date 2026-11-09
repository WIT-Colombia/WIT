import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { navigation, navigationGroups } from '../data/navigation';
import { getSession, logout, isAdminDemoMode } from '../services/adminService';
import { fetchOwnAvatar } from '../services/adminApiClient';
import { Icon } from './Icon';
import xamukoLogo from '../assets/xamuko-logo.png';

export function Layout() {
  const location = useLocation(); const navigate = useNavigate(); const admin = getSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); const [confirmLogout, setConfirmLogout] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => navigationGroups.find(group => group.id !== 'inicio' && group.items.some(item => window.location.pathname === item.path || window.location.pathname.startsWith(`${item.path}/`)))?.id ?? null);
  const toggleRef = useRef<HTMLButtonElement>(null); const sidebarRef = useRef<HTMLElement>(null);
  const verification = location.pathname.startsWith('/verifications');
  const dashboardRoute = ['/dashboard', '/summary', '/statistics'].includes(location.pathname);
  useEffect(() => { setOpen(false); setQuery(''); }, [location.pathname, location.search]);
  useEffect(() => { const activeGroup = navigationGroups.find(group => group.id !== 'inicio' && group.items.some(item => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))); setExpandedGroup(activeGroup?.id ?? null); }, [location.pathname]);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const source = admin?.avatarUrl?.trim() || null;
    setAvatarSrc(null);
    let avatarPath: string | null = null;
    try {
      const parsed = new URL(source, window.location.origin);
      if (/^\/api\/v\d+\/auth\/me\/avatar\/?$/.test(parsed.pathname)) avatarPath = `${parsed.pathname}${parsed.search}`;
    } catch { /* Keep an unparseable image URL as a direct source below. */ }
    if (source && !avatarPath) { setAvatarSrc(source); return; }
    const avatarRequest = avatarPath ? fetchOwnAvatar(avatarPath) : fetchOwnAvatar();
    void avatarRequest
      .then(blob => { if (active) { objectUrl = URL.createObjectURL(blob); setAvatarSrc(objectUrl); } })
      .catch(() => { if (active) setAvatarSrc(null); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [admin?.id, admin?.avatarUrl]);
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
  const current = navigation.find(item => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
  const results = query.trim() ? navigation.filter(item => item.label.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))) : [];
  const avatar = avatarSrc ? <img src={avatarSrc} alt="" onError={() => setAvatarSrc(null)} /> : admin?.name?.split(' ').map(part => part[0]).slice(0, 2).join('') || 'A';
  const navItem = (item: typeof navigation[number]) => <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon name={item.icon} size={18} /><span>{item.label}</span>{item.pending && <small className="nav-pending">Pendiente</small>}</NavLink>;
  return <div className={`app-shell admin-refresh ${verification ? 'verification-preserved' : ''}`}>{isAdminDemoMode && <div className="admin-demo-banner" role="status">Modo de pruebas — Sin acceso a datos reales</div>}
    <a className="skip-link" href="#main">Ir al contenido</a>
    {open && <button className="sidebar-backdrop" aria-label="Cerrar navegación" onClick={() => { setOpen(false); toggleRef.current?.focus(); }} />}
    <aside ref={sidebarRef} className={`admin-sidebar ${open ? 'is-open' : ''}`} aria-label="Navegación administrativa">
      <div className="sidebar-brand"><Link to="/dashboard" className="brand" aria-label="XAMUKO Admin, ir al inicio"><span className="xa-brand-combo"><span className="xa-brand-logo"><img src={xamukoLogo} alt="XAMUKO" /></span><span className="xa-brand-subline"><small>Lo que necesitas, está más cerca</small><span className="xa-admin-tag">ADMIN</span></span></span></Link><button className="sidebar-close icon-button" aria-label="Cerrar menú" onClick={() => { setOpen(false); toggleRef.current?.focus(); }}><Icon name="close" /></button></div>
      <nav aria-label="Menú principal" className="xa-navigation">{navigationGroups.map(group => group.id === 'inicio' ? <div className="xa-nav-section-items xa-nav-home" key={group.id}>{group.items.map(navItem)}</div> : <details className="xa-nav-section" key={group.id} open={expandedGroup === group.id}><summary onClick={event => { event.preventDefault(); setExpandedGroup(previous => previous === group.id ? null : group.id); }}><span>{group.label}</span><Icon name="chevron" size={15} /></summary><div className="xa-nav-section-items">{group.items.map(navItem)}</div></details>)}</nav>
      <div className="sidebar-footer"><div className="avatar">{avatar}</div><div><strong>{admin?.name || 'Administrador'}</strong><small>{admin?.role === 'SUPER_ADMIN' ? 'Administrador principal' : 'Administrador'}</small></div><button className="icon-button" aria-label="Cerrar sesión" onClick={() => setConfirmLogout(true)}><Icon name="logout" size={18} /></button></div>
    </aside>
    <div className="admin-main"><header className={`admin-header ${dashboardRoute ? 'dashboard-header' : ''}`}><div className="header-context"><button ref={toggleRef} className="icon-button menu-toggle" aria-label="Abrir navegación" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" /></button><span className="xa-header-breadcrumb">XAMUKO Admin <span className="breadcrumb-separator">/</span> <strong>{current?.label || 'Detalle'}</strong></span></div><div className="header-tools"><div className="global-search"><Icon name="search" size={18} /><input aria-label="Buscar secciones" placeholder="Buscar en XAMUKO Admin…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }} />{query.trim() && <div className="search-results" aria-label="Resultados de búsqueda"><small>Secciones</small>{results.map(item => <Link key={item.path} to={item.path}>{item.label}<Icon name="arrow" size={14} /></Link>)}{!results.length && <p>No encontramos una sección con ese nombre.</p>}</div>}</div>{dashboardRoute && <label className="xa-date-filter"><Icon name="clock" size={15} /><span>Mes</span><input type="month" aria-label="Filtrar actividad por mes" value={searchParams.get('month') || ''} onChange={event => { const next = new URLSearchParams(searchParams); if (event.target.value) next.set('month', event.target.value); else next.delete('month'); setSearchParams(next); }} /></label>}<Link to="/notifications" className="icon-button notification-link" aria-label="Abrir notificaciones"><Icon name="bell" /></Link><Link to="/settings" className="xa-profile-link" aria-label="Perfil del administrador"><span className="header-avatar avatar">{avatar}</span><span className="xa-profile-copy"><strong>{admin?.name || 'Administrador'}</strong><small>{admin?.role === 'SUPER_ADMIN' ? 'Administrador principal' : 'Administrador'}</small></span><Icon name="chevron" size={15} /></Link></div></header><main id="main" className="workspace" tabIndex={-1}><Outlet /></main><footer className="workspace-footer"><span>XAMUKO Admin</span><span>Los módulos pendientes se identifican dentro de cada sección.</span></footer>
    {confirmLogout && <div className="logout-popover" role="dialog" aria-label="Confirmar cierre de sesión"><div><strong>¿Cerrar sesión?</strong><p>Podrás volver a iniciar sesión cuando quieras.</p></div><div className="logout-popover-actions"><button className="secondary-button" onClick={() => setConfirmLogout(false)}>Cancelar</button><button className="danger-button" onClick={() => { void logout().then(() => navigate('/login', { replace: true })); }}>Cerrar sesión</button></div></div>}</div>
  </div>;
}
