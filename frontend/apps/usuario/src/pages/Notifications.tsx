import { useCallback, useEffect, useMemo, useState } from 'react';
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
const notifyCount = (count: number) =>
  window.dispatchEvent(new CustomEvent('xamuko-user-notifications-updated', { detail: count }));
const readableDate = (iso: string) => new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(iso));

export default function Notifications() {
  const { user, isAuthenticated } = useAuth();
  const [local, setLocal] = useState<UserNotification[]>(getNotifications);
  const [remote, setRemote] = useState<PlatformNotice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const load = useCallback(async () => {
    if (!isAuthenticated) { setRemote([]); return; }
    setLoading(true); setError('');
    try {
      const result = await listPlatformNotices();
      setRemote(result.notifications);
      notifyCount(result.unread + getNotifications().filter(item => !item.read).length);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron consultar las notificaciones.');
    } finally { setLoading(false); }
  }, [isAuthenticated, user?.id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); };
  }, [load]);
  useEffect(() => { if (!deleted) return; const t = window.setTimeout(() => setDeleted(false), 3000); return () => window.clearTimeout(t); }, [deleted]);
  const notices = useMemo<DisplayNotice[]>(() => [
    ...remote.map(item => ({
      id: item.id, title: item.title, body: item.message,
      date: readableDate(item.createdAt), read: Boolean(item.readAt), source: 'server' as const,
    })),
    ...local.map(item => ({ id: item.id, title: item.title, body: item.body, date: item.date, read: item.read, source: 'local' as const })),
  ], [local, remote]);
  const unread = notices.filter(item => !item.read).length;
  const announce = (next: PlatformNotice[], nextLocal: UserNotification[]) =>
    notifyCount(next.filter(item => !item.readAt).length + nextLocal.filter(item => !item.read).length);
  const select = async (item: DisplayNotice) => {
    if (busy) return;
    setSelectedId(item.id); setError('');
    if (item.read) return;
    if (item.source === 'local') {
      const next = markNotificationRead(item.id);
      setLocal(next); announce(remote, next);
      return;
    }
    setBusy(true);
    try {
      await readPlatformNotice(item.id);
      const next = remote.map(row => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row);
      setRemote(next); announce(next, local);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo marcar como leída.'); }
    finally { setBusy(false); }
  };
  const markAllRead = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (remote.some(item => !item.readAt)) await readAllPlatformNotices();
      const nextRemote = remote.map(item => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }));
      const nextLocal = markAllNotificationsRead();
      setRemote(nextRemote); setLocal(nextLocal); announce(nextRemote, nextLocal);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron actualizar las notificaciones.'); }
    finally { setBusy(false); }
  };
  const remove = async (item: DisplayNotice) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (item.source === 'server') await dismissPlatformNotice(item.id);
      else deleteNotification(item.id);
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
    {notices.length ? <>
      <div className="notification-list">{notices.slice(0, visibleCount).map(item =>
        <div className={'notification-item' + (item.read ? ' is-read' : '') + (selectedId === item.id ? ' is-selected' : '')} key={item.source + ':' + item.id}>
          <button type="button" className="notification-main-action" disabled={busy} onClick={() => void select(item)}>
            <span className="notification-icon"><img src="/brand/xamuko-symbol.jpg" alt="XAMUKO" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff', borderRadius: '50%' }}/></span>
            <span className="notification-copy"><b>{item.title}</b><small>{item.body}</small><time>{item.date}</time></span>
            {!item.read && <i aria-label="Sin leer"/>}
          </button>
          {selectedId === item.id && <span className="notification-actions">
            <button type="button" className="notification-delete" aria-label={'Eliminar ' + item.title} disabled={busy} onClick={event => {event.stopPropagation();setPendingDeleteId(item.id);}}>×</button>
            {pendingDeleteId === item.id && <span className="notification-delete-confirm">¿Eliminarla?
              <button type="button" disabled={busy} onClick={() => void remove(item)}>Sí</button>
              <button type="button" onClick={() => setPendingDeleteId(null)}>No</button>
            </span>}
          </span>}
        </div>,
      )}</div>
      {notices.length > 10 && <div className="notifications-pagination">
        {visibleCount < notices.length
          ? <button type="button" onClick={() => setVisibleCount(v => Math.min(v + 10, notices.length))}>Ver más notificaciones →</button>
          : <button type="button" onClick={() => { setVisibleCount(10); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Volver arriba ↑</button>}
      </div>}
    </> : !loading && <div className="user-empty-state"><h2>No tienes notificaciones</h2><p>Cuando haya novedades, aparecerán aquí.</p><Link to="/home">Ir al inicio</Link></div>}
  </PageLayout>;
}
