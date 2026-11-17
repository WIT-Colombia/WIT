import { useEffect, useRef, useState, type DependencyList, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import type { Category, Pagination } from '../../services/adminBusinessRecord';

export const number = (value: number) => value.toLocaleString('es-CO');
export const date = (value: string) => new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(value));
export const categoryName = (value: Category | null) => value?.translations.find(row => row.locale === 'es-CO')?.name ?? value?.translations.find(row => row.locale === 'es')?.name ?? value?.translations[0]?.name ?? value?.code ?? 'Sin categoría registrada';
export const labels: Record<string, string> = {
  PUBLISHED: 'Publicado', UNPUBLISHED: 'Sin publicar', REVIEW: 'En revisión', ACTIVE: 'Activo', INACTIVE: 'Desactivado', DRAFT: 'Borrador',
  HIDDEN: 'Oculto', SUSPENDED: 'Suspendido', VISIBLE: 'Visible', EXPIRED: 'Vencido', DELETED: 'Eliminado',
  NONE: 'Sin restricción', PENDING: 'Pendiente', APPROVED: 'Verificado', INFORMATION: 'Información solicitada', REJECTED: 'Rechazado',
  REMOVED: 'Retirada por moderación', REMOVED_BY_AUTHOR: 'Retirada por su autor', OWNER: 'Propietario', COLLABORATOR: 'Colaborador',
  MANAGER: 'Administrador del negocio', INVITED: 'Invitado', REVOKED: 'Revocado', ACCEPTED: 'Aceptado',
  RESOLVED: 'Resuelto', UNDER_REVIEW: 'En revisión', DISMISSED: 'Descartado', CLOSED: 'Cerrado', CANCELLED: 'Cancelado',
  OFFENSIVE: 'Contenido ofensivo', SPAM: 'Contenido no deseado', FALSE_INFORMATION: 'Información falsa', PERSONAL_DATA: 'Datos personales', OTHER: 'Otro motivo',
  RECOVERY: 'En recuperación', REQUESTED: 'Solicitado', STAFF: 'Colaborador',
};
export const label = (value: string | null | undefined) => value ? labels[value] ?? 'Estado sin traducción disponible' : 'No registrado';
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) { return <span className={`bd-badge bd-badge--${tone}`}>{children}</span>; }
export function Card({ title, icon, children, action, className = '' }: { title: string; icon: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={`bd-card ${className}`}><header className="bd-card-head"><span className="bd-card-icon"><Icon name={icon} size={19}/></span><h2>{title}</h2>{action}</header>{children}</section>;
}
export function Empty({ title, message, icon = 'box' }: { title: string; message: string; icon?: string }) { return <div className="bd-empty"><span><Icon name={icon} size={28}/></span><h3>{title}</h3><p>{message}</p></div>; }
export function Loading({ error, loading, retry }: { error: string; loading: boolean; retry: () => void }) {
  return error ? <div className="bd-error" role="alert"><strong>No pudimos consultar esta sección</strong><p>{error}</p><button className="bd-button" onClick={retry}>Reintentar</button></div>
    : loading ? <p className="bd-loading" role="status"><span/>Consultando información registrada…</p> : null;
}
export function Pager({ pagination, onPage, loading }: { pagination: Pagination; onPage: (page: number) => void; loading?: boolean }) {
  return <nav className="bd-pagination" aria-label="Páginas de resultados"><span>{number(pagination.total)} {pagination.total === 1 ? 'registro' : 'registros'}</span><div><button className="bd-button" disabled={loading || pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Anterior</button><span>Página {pagination.page} de {Math.max(1, pagination.totalPages)}</span><button className="bd-button" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)}>Siguiente</button></div></nav>;
}
export function useResource<T>(load: () => Promise<T>, dependencies: DependencyList, enabled = true) {
  const loader = useRef(load); loader.current = load;
  const [data, setData] = useState<T | null>(null), [loading, setLoading] = useState(enabled), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let alive = true; setLoading(true); setError('');
    void loader.current().then(result => { if (alive) setData(result); }).catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : 'No se pudo recuperar la información.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [...dependencies, enabled, attempt]);
  return { data, loading, error, retry: () => setAttempt(value => value + 1) };
}
