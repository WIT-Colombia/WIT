import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteNotification, getNotifications, markAllNotificationsRead, markNotificationRead, type UserNotification,
} from '../services/userDataService';
import {
  dismissPlatformNotice, listPlatformNotices, readAllPlatformNotices, readPlatformNotice, type PlatformNotice,
} from '../services/platformNotificationService';
import { useAuth } from '../context/AuthContext';
import { PageLayout } from '../components/PageLayout';
import './Notifications.css';

type DisplayNotice = {
  id: string; title: string; body: string; date: string; read: boolean; source: 'local' | 'server';
};
const notifyCount = (userId: string, count: number) =>
  window.dispatchEvent(new CustomEvent('xamuko-user-notifications-updated', { detail: { userId, count } }));
const readableDate = (iso: string) => new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(iso));

export default function Notifications() {
  const { user, isAuthenticated } = useAuth();
  const accountId = isAuthenticated ? user?.id ?? null : null;
  const currentAccount = useRef(accountId);
  currentAccount.current = accountId;
  const [local, setLocal] = useState<UserNotification[]>([]);
  const [remote, setRemote] = useState<PlatformNotice[]>([]);
  const [loadedAccountId, setLoadedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'Todas' | 'No leídas' | 'Leídas'>('Todas');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const load = useCallback(async () => {
    if (!accountId) { setRemote([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const result = await listPlatformNotices();
      if (currentAccount.current !== accountId) return;
      setRemote(result.notifications);
      notifyCount(accountId, result.unread + getNotifications(accountId).filter(item => !item.read).length);
    } catch (cause) {
      if (currentAccount.current === accountId)
        setError(cause instanceof Error ? cause.message : 'No se pudieron consultar las notificaciones.');
    } finally { if (currentAccount.current === accountId) setLoading(false); }
  }, [accountId]);
  useEffect(() => {
    setLoadedAccountId(accountId);
    setLocal(getNotifications(accountId));
    setRemote([]);
    setSelectedId(null);
    setPendingDeleteId(null);
    setError('');
    setVisibleCount(10);
  }, [accountId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); };
  }, [load]);
  useEffect(() => { if (!deleted) return; const t = window.setTimeout(() => setDeleted(false), 3000); return () => window.clearTimeout(t); }, [deleted]);
  // Do not render the previous user's notices while React changes sessions.
  const visibleRemote = loadedAccountId === accountId ? remote : [];
  const visibleLocal = loadedAccountId === accountId ? local : [];
  const notices = useMemo<DisplayNotice[]>(() => [
    ...visibleRemote.map(item => ({
      id: item.id, title: item.title, body: item.message,
      date: readableDate(item.createdAt), read: Boolean(item.readAt), source: 'server' as const,
    })),
    ...visibleLocal.map(item => ({ id: item.id, title: item.title, body: item.body, date: item.date, read: item.read, source: 'local' as const })),
  ].sort((a, b) => Number(b.source === "local" && b.id === "welcome") - Number(a.source === "local" && a.id === "welcome")), [visibleLocal, visibleRemote]);
  const unread = notices.filter(item => !item.read).length;
  const filteredNotices = notices.filter(item => filter === "Todas" || (filter === "No leídas" ? !item.read : item.read));
  const announce = (next: PlatformNotice[], nextLocal: UserNotification[]) => {
    if (accountId) notifyCount(accountId,
      next.filter(item => !item.readAt).length + nextLocal.filter(item => !item.read).length);
  };
  const select = async (item: DisplayNotice) => {
    if (busy || !accountId) return;
    setSelectedId(item.id); setError('');
    if (item.read) return;
    if (item.source === 'local') {
      const next = markNotificationRead(item.id, accountId);
      setLocal(next); announce(remote, next);
      return;
    }
    setBusy(true);
    try {
      await readPlatformNotice(item.id);
      if (currentAccount.current !== accountId) return;
      const next = remote.map(row => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row);
      setRemote(next); announce(next, local);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo marcar como leída.'); }
    finally { setBusy(false); }
  };
  const markAllRead = async () => {
    if (busy || !accountId) return;
    setBusy(true); setError('');
    try {
      if (remote.some(item => !item.readAt)) await readAllPlatformNotices();
      if (currentAccount.current !== accountId) return;
      const nextRemote = remote.map(item => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }));
      const nextLocal = markAllNotificationsRead(accountId);
      setRemote(nextRemote); setLocal(nextLocal); announce(nextRemote, nextLocal);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron actualizar las notificaciones.'); }
    finally { setBusy(false); }
  };
  const remove = async (item: DisplayNotice) => {
    if (busy || !accountId) return;
    setBusy(true); setError('');
    try {
      if (item.source === 'server') await dismissPlatformNotice(item.id);
      else deleteNotification(item.id, accountId);
      if (currentAccount.current !== accountId) return;
      const nextRemote = remote.filter(value => !(item.source === 'server' && value.id === item.id));
      const nextLocal = local.filter(value => !(item.source === 'local' && value.id === item.id));
      setRemote(nextRemote); setLocal(nextLocal); setPendingDeleteId(null); setSelectedId(null);
      setDeleted(true); announce(nextRemote, nextLocal);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la notificación.'); }
    finally { setBusy(false); }
  };
  return <PageLayout className="notifications-page">
    <Link className="offer-detail-back" to="/profile">← Volver al perfil</Link>
    <div className="notifications-heading">
      <div className="user-page-heading"><span>Tu actividad en XAMUKO</span><h1>Notificaciones</h1>
        <span className="notification-unread-count">{unread} {unread === 1 ? 'pendiente' : 'pendientes'} por leer</span>
        {deleted && <p className="notification-success" role="status">La notificación se eliminó correctamente.</p>}
      </div>
      {unread > 0 && <button type="button" disabled={busy} onClick={() => void markAllRead()}>Marcar todas como leídas</button>}
    </div>
    {error && <p className="notification-success" role="alert">{error} <button type="button" onClick={() => void load()}>Reintentar</button></p>}
    {loading && <p role="status">Actualizando notificaciones…</p>}
    <div className="notification-filter-bar" role="group" aria-label="Filtrar notificaciones">{(["Todas", "No leídas", "Leídas"] as const).map(value => <button key={value} type="button" className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => { setFilter(value); setVisibleCount(10); setPendingDeleteId(null); }}>{value}{value === "No leídas" && <span>{unread}</span>}</button>)}</div>
    {filteredNotices.length ? <>
      <div className="notification-list">{filteredNotices.slice(0, visibleCount).map(item =>
        <div className={'notification-item' + (item.read ? ' is-read' : '') + (selectedId === item.id ? ' is-selected' : '')} key={item.source + ':' + item.id}>
          <button type="button" className="notification-main-action" disabled={busy} onClick={() => void select(item)}>
            <span className="notification-icon notification-brand-icon"><img src="/brand/xamuko-symbol.jpg" alt="XAMUKO" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff', borderRadius: '50%' }}/></span>
            <span className="notification-copy"><b>{item.title}</b><small>{item.body}</small><time>{item.date}</time></span>
            {!item.read && <i aria-label="Sin leer"/>}
          </button>
          {<span className="notification-actions">
            <button type="button" className="notification-delete" aria-label={'Eliminar ' + item.title} disabled={busy} onClick={event => {event.stopPropagation();setPendingDeleteId(item.id);}}>×</button>
            {pendingDeleteId === item.id && <span className="notification-delete-confirm">¿Eliminar esta notificación?
              <button type="button" disabled={busy} onClick={() => void remove(item)}>Sí</button>
              <button type="button" onClick={() => setPendingDeleteId(null)}>No</button>
            </span>}
          </span>}
        </div>,
      )}</div>
      {filteredNotices.length > 10 && <div className="notifications-pagination">
        {visibleCount < filteredNotices.length
          ? <button type="button" onClick={() => setVisibleCount(v => Math.min(v + 10, filteredNotices.length))}>Ver más notificaciones →</button>
          : <button type="button" onClick={() => { setVisibleCount(10); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Volver arriba ↑</button>}
      </div>}
    </> : !loading && <div className="user-empty-state"><h2>{filter === "No leídas" ? "Todo al día" : filter === "Leídas" ? "No hay notificaciones leídas" : "No tienes notificaciones"}</h2><p>Cuando haya novedades, aparecerán aquí.</p><Link to="/home">Ir al inicio</Link></div>}
  </PageLayout>;
}
