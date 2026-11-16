import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteNotification, getNotifications, markAllNotificationsRead, markNotificationRead, type UserNotification,
} from '../services/userDataService';
import {
  dismissPlatformNotice, listPlatformNotices, readAllPlatformNotices, readPlatformNotice, loadNoticeArtwork, type PlatformNotice,
} from '../services/platformNotificationService';
import { useAuth } from '../context/AuthContext';
import { PageLayout } from '../components/PageLayout';
import './Notifications.css';

type DisplayNotice = {
  id: string; title: string; body: string; date: string; read: boolean; source: 'local' | 'server'; sourceType?: string;
};
const notifyCount = (userId: string, count: number) =>
  window.dispatchEvent(new CustomEvent('xamuko-user-notifications-updated', { detail: { userId, count } }));
const readableDate = (iso: string) => new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(iso));


const businessArtworkSourceTypes = new Set([
  'BUSINESS_VISIBILITY', 'BUSINESS_RECOVERY', 'BUSINESS_DELETED',
  'COLLABORATION_INVITED', 'COLLABORATION_ACCESS', 'COLLABORATION_PERMISSIONS',
  'COLLABORATION_EXPIRED', 'OWNERSHIP_TRANSFER', 'REVIEW_RESPONSE',
]);

/** Photos are fetched with recipient authentication; a vector icon remains the fallback. */
function PersonalNoticeImage({ notice, kind }: { notice: DisplayNotice; kind: string }) {
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    if (notice.source !== 'server' || !notice.sourceType || !businessArtworkSourceTypes.has(notice.sourceType)) {
      setPhoto(null);
      return;
    }
    let active = true;
    let url: string | null = null;
    void loadNoticeArtwork(notice.id).then(blob => {
      if (!blob.type.startsWith('image/')) return;
      url = URL.createObjectURL(blob);
      if (active) setPhoto(url);
      else URL.revokeObjectURL(url);
    }).catch(() => { if (active) setPhoto(null); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [notice.id, notice.source, notice.sourceType]);

  return <span className={'notification-icon notification-icon-' + kind} aria-hidden="true">
    {photo ? <img className="notification-entity-photo" src={photo} alt=""/> : kind === 'welcome' || kind === 'system' ?
      <img src="/brand/xamuko-symbol.jpg" alt=""/> :
      kind === 'review' ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.7 8.7 0 0 1-4.5-1.2L3 20l1.2-5A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg> :
      kind === 'business' || kind === 'collaboration' || kind === 'transfer' ?
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h18l-2-6H5l-2 6ZM5 10v10h14V10M9 20v-6h6v6"/></svg> :
      kind === 'account' ?
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg> :
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>}
  </span>;
}

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
      date: readableDate(item.createdAt), read: Boolean(item.readAt), source: 'server' as const, sourceType: item.sourceType,
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
  const toDelete = notices.find(item => item.source + ':' + item.id === pendingDeleteId);
  return <PageLayout className="notifications-page">
    <Link className="offer-detail-back" to="/profile">← Volver al perfil</Link>
    <header className="notifications-heading">
      <div className="notifications-heading-main">
        <span className="notifications-heading-icon" aria-hidden="true">
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
        </span>
        <div className="user-page-heading">
          <span>TU ACTIVIDAD EN XAMUKO</span>
          <h1>Notificaciones</h1>
          <p className="notification-unread-count" aria-live="polite">{unread} {unread === 1 ? 'pendiente' : 'pendientes'} por leer</p>
        </div>
      </div>
      {unread > 0 && <button className="notifications-mark-all" type="button" disabled={busy} onClick={() => void markAllRead()}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>
        Marcar todas como leídas
      </button>}
    </header>
    {deleted && <p className="notification-success" role="status">La notificación se eliminó correctamente.</p>}
    {error && <div className="notification-error" role="alert">{error} <button type="button" onClick={() => void load()}>Reintentar</button></div>}
    {loading && <p className="notification-loading" role="status">Actualizando notificaciones…</p>}
    <div className="notification-filter-bar" role="group" aria-label="Filtrar notificaciones">
      {(["Todas", "No leídas", "Leídas"] as const).map(value =>
        <button key={value} type="button" className={filter === value ? "active" : ""} aria-pressed={filter === value}
          onClick={() => { setFilter(value); setVisibleCount(10); setPendingDeleteId(null); }}>
          {value}{value === "No leídas" && <span>{unread}</span>}
        </button>)}
    </div>
    {filteredNotices.length ? <>
      <section className="notification-list" aria-label="Tus notificaciones">
        {filteredNotices.slice(0, visibleCount).map(item => {
          const welcome = item.source === 'local' && item.id === 'welcome';
          const manageBusiness = item.sourceType === 'BUSINESS_VISIBILITY' || item.sourceType === 'BUSINESS_RECOVERY' ||
            item.sourceType === 'COLLABORATION_INVITED' || item.sourceType === 'COLLABORATION_PERMISSIONS' ||
            item.sourceType === 'OWNERSHIP_TRANSFER' && /proponen|vence mañana|solicitud para transferir/i.test(item.title);
          const title = item.title.toLocaleLowerCase('es-CO');
          const kind = welcome ? 'welcome' :
            item.sourceType?.startsWith('COLLABORATION') ? 'collaboration' :
            item.sourceType === 'OWNERSHIP_TRANSFER' ? 'transfer' :
            item.sourceType === 'VERIFICATION' || item.sourceType?.includes('REPORT') ? 'system' :
            title.includes('opini') || title.includes('reseña') ? 'review' :
            title.includes('negocio') || title.includes('favorito') ? 'business' :
            title.includes('cuenta') || title.includes('seguridad') ? 'account' : 'general';
          return <article className={'notification-item' + (item.read ? ' is-read' : ' is-unread') + (selectedId === item.id ? ' is-selected' : '') + (manageBusiness ? ' has-business-action' : '')} key={item.source + ':' + item.id}>
            <button type="button" className="notification-main-action" disabled={busy} onClick={() => void select(item)}
              aria-label={item.title + '. ' + (item.read ? 'Leída' : 'Sin leer') + '. Abrir notificación'}>
              <PersonalNoticeImage notice={item} kind={kind}/>
              <span className="notification-copy">
                <span className="notification-copy-heading"><b>{item.title}</b>{!item.read && <span className="notification-unread-dot" aria-label="Sin leer"/>}</span>
                <span className="notification-description">{item.body}</span>
                <span className="notification-meta"><span>{kind === 'collaboration' || kind === 'transfer' || item.sourceType === 'REVIEW_RESPONSE' ? 'Actividad del negocio' : 'Equipo XAMUKO'}</span><time>{item.date}</time></span>
              </span>
            </button>
            {manageBusiness && <a className="notification-business-action" href={item.sourceType === 'COLLABORATION_INVITED' || item.sourceType === 'OWNERSHIP_TRANSFER' ? 'https://business.xamuko.com/notificaciones' : 'https://business.xamuko.com/mis-negocios'} target="_blank" rel="noopener noreferrer">{item.sourceType === 'COLLABORATION_INVITED' || item.sourceType === 'OWNERSHIP_TRANSFER' ? 'Responder en XAMUKO Business' : 'Gestionar en XAMUKO Business'} <span aria-hidden="true">↗</span></a>}
            <button type="button" className="notification-delete" disabled={busy}
              title="Eliminar notificación" aria-label={'Eliminar ' + item.title}
              onClick={() => setPendingDeleteId(item.source + ':' + item.id)}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg>
            </button>
          </article>;
        })}
      </section>
      {visibleCount < filteredNotices.length && <div className="notifications-pagination">
        <button type="button" onClick={() => setVisibleCount(v => Math.min(v + 10, filteredNotices.length))}>Ver más notificaciones <span aria-hidden="true">→</span></button>
      </div>}
    </> : !loading && <div className="user-empty-state"><h2>{filter === "No leídas" ? "Todo al día" : filter === "Leídas" ? "No hay notificaciones leídas" : "No tienes notificaciones"}</h2><p>Cuando haya novedades, aparecerán aquí.</p><button type="button" onClick={() => { setFilter("Todas"); setVisibleCount(10); }}>Ver todas</button></div>}
    {toDelete && <div className="notification-confirm-backdrop" role="presentation" onClick={() => setPendingDeleteId(null)}>
      <div className="notification-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="notification-confirm-title" aria-describedby="notification-confirm-description" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') setPendingDeleteId(null); }}>
        <span className="notification-confirm-symbol" aria-hidden="true">!</span>
        <h2 id="notification-confirm-title">¿Eliminar notificación?</h2>
        <p id="notification-confirm-description">Se eliminará de tu bandeja. Esta acción no se puede deshacer.</p>
        <div className="notification-confirm-actions">
          <button type="button" disabled={busy} onClick={() => setPendingDeleteId(null)}>Cancelar</button>
          <button type="button" className="notification-confirm-danger" disabled={busy} onClick={() => void remove(toDelete)}>{busy ? 'Eliminando…' : 'Eliminar'}</button>
        </div>
      </div>
    </div>}
  </PageLayout>;
}
