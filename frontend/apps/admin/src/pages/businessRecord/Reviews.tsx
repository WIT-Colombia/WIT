import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { getRecordReviews, type RecordBusiness } from '../../services/adminBusinessRecord';
import { Badge, Card, Empty, Loading, Pager, date, label, number, useResource } from './shared';

export function Reviews({ business, allowed }: { business: RecordBusiness; allowed: boolean }) {
  const [rating, setRating] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [dates, setDates] = useState({ from: '', to: '' }), [page, setPage] = useState(1);
  const source = useResource(() => getRecordReviews(business.id, { rating, ...dates, page }), [business.id, rating, dates.from, dates.to, page], allowed);
  if (!allowed) return <Empty icon="lock" title="Opiniones de acceso restringido" message="Tu cuenta necesita permiso de revisión de opiniones para consultar esta sección."/>;
  const score = business.record?.rating;
  return <Card title="Opiniones del negocio" icon="star">
    <div className="bd-rating-summary"><span><Icon name="star" size={28}/></span><div><strong>{!score ? 'Calificación no disponible' : score.value !== null ? score.value.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' / 5' : 'Sin calificaciones públicas'}</strong><p>{score ? `${number(score.count)} opiniones publicadas · Promedio actual de las calificaciones visibles.` : 'No se pudo confirmar el resumen de calificaciones.'}</p></div></div>
    <form className="bd-filters bd-review-filters" onSubmit={event => { event.preventDefault(); setDates({ from, to }); setPage(1); }}>
      <label>Puntuación<select aria-label="Puntuación" value={rating} onChange={event => { setRating(event.target.value); setPage(1); }}><option value="">Todas las puntuaciones</option>{[5, 4, 3, 2, 1].map(value => <option value={value} key={value}>{value} {value === 1 ? 'estrella' : 'estrellas'}</option>)}</select></label>
      <label>Desde<input type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)}/></label><label>Hasta<input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)}/></label><button className="bd-button" type="submit">Aplicar fechas</button>
    </form><Loading {...source}/>
    {!source.loading && !source.error && source.data && <>{source.data.reviews.length ? <div className="bd-reviews">{source.data.reviews.map(review => <article className="bd-review" key={review.id}>
      <header><span className="bd-author-avatar"><Icon name="users" size={18}/></span><div><strong>{review.user.nickname ? '@' + review.user.nickname.replace(/^@/, '') : review.user.displayName}</strong><time dateTime={review.createdAt}>{date(review.createdAt)}</time></div><Badge tone={review.status === 'PUBLISHED' ? 'green' : 'neutral'}>{label(review.status)}</Badge></header>
      <div className="bd-review-stars" aria-label={`${review.rating} de 5 estrellas`}>{[1, 2, 3, 4, 5].map(value => <span key={value} className={value <= review.rating ? 'filled' : ''}><Icon name="star" size={16}/></span>)}</div><p>{review.comment}</p>
      {review._count.reports > 0 && <details className="bd-review-reports"><summary>{number(review._count.reports)} reportes asociados</summary><p>Últimos {review.reports.length} reportes disponibles.</p>{review.reports.map(report => <p key={report.id}>{label(report.reason)} · {label(report.status)} · {date(report.createdAt)}</p>)}</details>}
    </article>)}</div> : <Empty icon="star" title="Sin opiniones para estos filtros" message="Prueba otra puntuación o intervalo para consultar las opiniones registradas."/>}<Pager pagination={source.data.pagination} onPage={setPage}/></>}
  </Card>;
}
