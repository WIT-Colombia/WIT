import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { navigation, navigationGroups } from '../data/navigation';
import { getSession, logout, restoreSession } from '../services/adminService';
import { fetchOwnAvatar } from '../services/adminApiClient';
import { Icon } from './Icon';
import xamukoLogo from '../assets/xamuko-logo.webp';
import xamukoLogo320 from '../assets/xamuko-logo-320.webp';
import xamukoLogo640 from '../assets/xamuko-logo-640.webp';
import xamukoLogo960 from '../assets/xamuko-logo-960.webp';

const groupIcons: Record<string, string> = { plataforma: 'store', crecimiento: 'crown', finanzas: 'database', tecnologia: 'server', soporte: 'headphones', juridica: 'scales', configuracion: 'shield' };
const sidebarIcons: Record<string, string> = { '/content': 'image', '/reports': 'chart', '/pioneers': 'award' };
const activeGroupFor = (pathname: string) => navigationGroups.find(group => group.id !== 'inicio' && group.items.some(item => pathname === item.path || pathname.startsWith(`${item.path}/`)))?.id ?? (['/dashboard', '/summary', '/statistics'].includes(pathname) ? 'plataforma' : null);

export function Layout() {
  const location = useLocation(); const navigate = useNavigate();
  const [admin, setAdmin] = useState(getSession);
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); const [confirmLogout, setConfirmLogout] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => activeGroupFor(location.pathname));
  const toggleRef = useRef<HTMLButtonElement>(null); const sidebarRef = useRef<HTMLElement>(null);
  const logoutRef = useRef<HTMLButtonElement>(null); const dialogRef = useRef<HTMLDivElement>(null);
  const sessionRefreshRef = useRef<ReturnType<typeof restoreSession> | null>(null);
  const verification = location.pathname.startsWith('/verifications');
  const dashboardRoute = ['/dashboard', '/summary', '/statistics'].includes(location.pathname);
  const businessesRoute = location.pathname === '/businesses';
  useEffect(() => { setOpen(false); setQuery(''); }, [location.pathname, location.search]);
  useEffect(() => { setExpandedGroup(activeGroupFor(location.pathname)); }, [location.pathname]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const resize = () => { setMobile(media.matches); setOpen(false); };
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);
  // A profile photo may change in another XAMUKO app while Admin stays mounted.
  // Reuse the session and authenticated avatar services when returning to this tab.
  useEffect(() => {
    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || refreshing || confirmLogout) return;
      refreshing = true;
      const request = restoreSession();
      sessionRefreshRef.current = request;
      try {
        const session = await request;
        if (!active) return;
        if (!session) { navigate('/login', { replace: true }); return; }
        setAdmin(session); setAvatarVersion(value => value + 1);
      } catch { /* Keep the current profile on a transient network failure. */ }
      finally { refreshing = false; if (sessionRefreshRef.current === request) sessionRefreshRef.current = null; }
    };
    const interval = window.setInterval(() => { void refresh(); }, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [navigate, confirmLogout]);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const source = admin?.avatarUrl?.trim() || null;
    let avatarPath: string | null = null;
    if (source) {
      try {
        const parsed = new URL(source, window.location.origin);
        if (/^\/api\/v\d+\/auth\/me\/avatar\/?$/.test(parsed.pathname)) avatarPath = `${parsed.pathname}${parsed.search}`;
      } catch { /* Keep an unparseable image URL as a direct source below. */ }
    }
    if (source && !avatarPath) { setAvatarSrc(source); return; }
    const avatarRequest = avatarPath ? fetchOwnAvatar(avatarPath) : fetchOwnAvatar();
    void avatarRequest
      .then(blob => { if (active) { objectUrl = URL.createObjectURL(blob); setAvatarSrc(objectUrl); } })
      .catch(() => { if (active) setAvatarSrc(null); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [admin?.id, admin?.avatarUrl, avatarVersion]);
  useEffect(() => {
    if (!open || !mobile) return;
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    sidebarRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handle = (event: KeyboardEvent) => {
      if (dialogRef.current) return;
      if (event.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); }
      if (event.key === 'Tab') {
        const items = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a, button, summary') ?? []).filter(item => item.getClientRects().length > 0); if (!items.length) return;
        const first = items[0]; const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handle);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', handle); toggleRef.current?.focus(); };
  }, [open, mobile]);
  useEffect(() => {
    if (!confirmLogout) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !dialogRef.current?.querySelector('button:disabled')) { event.preventDefault(); setConfirmLogout(false); }
      if (event.key === 'Tab') {
        const items = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!items?.length) { event.preventDefault(); return; }
        const first = items[0]; const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handle);
    return () => { document.removeEventListener('keydown', handle); previous?.focus(); };
  }, [confirmLogout]);
  const closeSidebar = () => { setOpen(false); toggleRef.current?.focus(); };
  const signOut = async () => {
    if (loggingOut) return;
    const retrying = Boolean(logoutError);
    setLoggingOut(true); setLogoutError('');
    try {
      // Finish any profile refresh before invalidation so an older response cannot
      // repopulate the existing in-memory session after logout has completed.
      await sessionRefreshRef.current?.catch(() => null);
      if (retrying) await restoreSession();
      await logout(); navigate('/login', { replace: true });
    }
    catch { setLogoutError('No se pudo cerrar la sesión. Inténtalo de nuevo.'); setLoggingOut(false); }
  };
  const current = navigation.find(item => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
  const results = query.trim() ? navigation.filter(item => item.label.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))) : [];
  const avatar = avatarSrc ? <img src={avatarSrc} alt="" onError={() => setAvatarSrc(null)} /> : admin?.name?.split(' ').map(part => part[0]).slice(0, 2).join('') || 'A';
  const navItem = (item: typeof navigation[number]) => <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon name={sidebarIcons[item.path] || item.icon} size={20} /><span>{item.label}</span>{item.pending && <small className="nav-pending">Pendiente</small>}</NavLink>;
  return <div className={`app-shell admin-refresh ${verification ? 'verification-preserved' : ''} ${businessesRoute ? 'businesses-layout' : ''}`}>
    <a className="skip-link" href="#main">Ir al contenido</a>
    {open && mobile && <button className="sidebar-backdrop" aria-label="Cerrar navegación" tabIndex={-1} onClick={closeSidebar} />}
    <aside id="admin-navigation" ref={sidebarRef} className={`admin-sidebar ${open ? 'is-open' : ''}`} aria-label="Navegación administrativa" inert={(mobile && !open) || confirmLogout}>
      <div className="sidebar-brand"><Link to="/dashboard" className="brand" aria-label="XAMUKO Admin, ir al inicio"><span className="xa-brand-combo"><span className="xa-brand-logo"><img src={xamukoLogo} srcSet={`${xamukoLogo320} 320w, ${xamukoLogo640} 640w, ${xamukoLogo960} 960w, ${xamukoLogo} 2170w`} sizes="160px" alt="XAMUKO" /></span><span className="xa-admin-tag">ADMIN</span></span></Link><button className="sidebar-close icon-button" aria-label="Cerrar menú" onClick={closeSidebar}><Icon name="close" /></button></div>
      <nav aria-label="Menú principal" className="xa-navigation">{navigationGroups.map(group => group.id === 'inicio' ? <div className="xa-nav-section-items xa-nav-home" key={group.id}>{group.items.map(navItem)}</div> : <details className="xa-nav-section" key={group.id} open={expandedGroup === group.id}><summary aria-expanded={expandedGroup === group.id} aria-controls={`nav-${group.id}`} onClick={event => { event.preventDefault(); setExpandedGroup(previous => previous === group.id ? null : group.id); }}><span className="xa-group-icon"><Icon name={groupIcons[group.id]} size={20} /></span><span className="xa-group-label">{group.label}</span>{group.id === 'soporte' && group.items.every(item => item.pending) && <small className="nav-pending">Pendiente</small>}<span className="xa-group-chevron"><Icon name="chevron" size={13} /></span></summary><div id={`nav-${group.id}`} className="xa-nav-section-items">{group.items.map(navItem)}</div></details>)}</nav>
      <div className="sidebar-footer"><div className="avatar">{avatar}</div><div className="sidebar-profile-copy"><strong title={admin?.name}>{admin?.name}</strong><small>{admin?.role === 'SUPER_ADMIN' ? 'Administrador principal' : admin?.role === 'ADMIN' ? 'Administrador' : admin?.role}</small></div><button ref={logoutRef} className="icon-button" aria-label="Cerrar sesión" onClick={() => { setLogoutError(''); setConfirmLogout(true); }}><Icon name="logout" size={21} /></button></div>
    </aside>
    <div className="admin-main" inert={(mobile && open) || confirmLogout}><header className={`admin-header ${dashboardRoute ? 'dashboard-header' : ''}`}><div className="header-context"><button ref={toggleRef} className="icon-button menu-toggle" aria-label="Abrir navegación" aria-controls="admin-navigation" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" /></button><span className="xa-header-breadcrumb">XAMUKO Admin <span className="breadcrumb-separator">/</span> <strong>{current?.label || 'Detalle'}</strong></span></div><div className="header-tools"><div className="global-search"><Icon name="search" size={18} /><input aria-label="Buscar secciones" placeholder="Buscar en XAMUKO Admin…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }} />{query.trim() && <div className="search-results" aria-label="Resultados de búsqueda"><small>Secciones</small>{results.map(item => <Link key={item.path} to={item.path}>{item.label}<Icon name="arrow" size={14} /></Link>)}{!results.length && <p>No encontramos una sección con ese nombre.</p>}</div>}</div>{dashboardRoute && <label className="xa-date-filter"><Icon name="clock" size={15} /><span>Mes</span><input type="month" aria-label="Filtrar actividad por mes" value={searchParams.get('month') || ''} onChange={event => { const next = new URLSearchParams(searchParams); if (event.target.value) next.set('month', event.target.value); else next.delete('month'); setSearchParams(next); }} /></label>}<Link to="/notifications" className="icon-button notification-link" aria-label="Abrir notificaciones"><Icon name="bell" /></Link><Link to="/settings" className="xa-profile-link" aria-label="Perfil del administrador"><span className="header-avatar avatar">{avatar}</span><span className="xa-profile-copy"><strong>{admin?.name || 'Administrador'}</strong><small>{admin?.role === 'SUPER_ADMIN' ? 'Administrador principal' : 'Administrador'}</small></span></Link></div></header><main id="main" className="workspace" tabIndex={-1}><Outlet /></main><footer className="workspace-footer"><span>XAMUKO Admin</span><span>Los módulos pendientes se identifican dentro de cada sección.</span></footer></div>
    {confirmLogout && <div ref={dialogRef} className="logout-popover" role="dialog" aria-modal="true" aria-label="Confirmar cierre de sesión" aria-describedby="logout-description"><div><strong>¿Cerrar sesión?</strong><p id="logout-description">Podrás volver a iniciar sesión cuando quieras.</p>{logoutError && <p role="alert">{logoutError}</p>}</div><div className="logout-popover-actions"><button className="secondary-button" disabled={loggingOut} onClick={() => setConfirmLogout(false)}>Cancelar</button><button className="danger-button" disabled={loggingOut} onClick={() => { void signOut(); }}>{loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</button></div></div>}
  </div>;
}
