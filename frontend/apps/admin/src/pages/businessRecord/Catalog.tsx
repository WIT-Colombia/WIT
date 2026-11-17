import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminDialog } from '../../components/AdminDialog';
import { Icon } from '../../components/Icon';
import { BusinessRecordPhoto } from '../../components/businesses/BusinessRecordPhoto';
import { getRecordCatalog, type RecordOffer } from '../../services/adminBusinessRecord';
import { Badge, Card, Empty, Loading, Pager, categoryName, date, label, useResource } from './shared';

export function offerPrice(offer: Pick<RecordOffer, 'negotiable' | 'priceAmount' | 'currency'>) {
  if (offer.negotiable || offer.priceAmount === null) return 'Precio a convenir';
  const value = Number(offer.priceAmount);
  if (!Number.isFinite(value)) return 'Precio no disponible';
  const currency = offer.currency;
  if (!currency) return `${value.toLocaleString('es-CO')} (moneda no registrada)`;
  try { return new Intl.NumberFormat('es-CO', { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: currency === 'COP' ? 0 : 2 }).format(value); }
  catch { return `${value.toLocaleString('es-CO')} ${currency}`; }
}
export function Catalog({ id, allowed, canModerate }: { id: string; allowed: boolean; canModerate: boolean }) {
  const [kind, setKind] = useState('PRODUCT'), [query, setQuery] = useState(''), [q, setQ] = useState(''), [status, setStatus] = useState(''), [activation, setActivation] = useState(''), [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RecordOffer | null>(null);
  const source = useResource(() => getRecordCatalog(id, { kind, q, status, activation, page }), [id, kind, q, status, activation, page], allowed);
  if (!allowed) return <Empty icon="lock" title="Catálogo de acceso restringido" message="Tu cuenta necesita permiso de consulta de catálogo para ver productos y servicios."/>;
  return <Card title="Productos y servicios" icon="box" className="bd-catalog">
    <div className="bd-subtabs" role="group" aria-label="Tipo de publicación">{[['PRODUCT', 'Productos'], ['SERVICE', 'Servicios']].map(([value, title]) => <button key={value} aria-pressed={kind === value} onClick={() => { setKind(value); setPage(1); }}>{title}</button>)}</div>
    <form className="bd-filters" onSubmit={event => { event.preventDefault(); setQ(query.trim()); setPage(1); }}>
      <label className="bd-search"><span>Buscar en el catálogo</span><div><Icon name="search" size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre o código"/><button type="submit" className="bd-button">Buscar</button></div></label>
      <label>Publicación<select aria-label="Publicación del catálogo" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">Todos los estados</option><option value="PUBLISHED">Publicados</option><option value="REVIEW">En revisión</option><option value="UNPUBLISHED">Sin publicar</option><option value="DELETED">Eliminados</option></select></label>
      <label>Activación<select aria-label="Activación del catálogo" value={activation} onChange={event => { setActivation(event.target.value); setPage(1); }}><option value="">Todos</option><option value="ACTIVE">Activos</option><option value="INACTIVE">Inactivos</option></select></label>
    </form>
    <Loading {...source}/>
    {!source.loading && !source.error && source.data && <>{source.data.offers.length ? <div className="bd-offer-grid">{source.data.offers.map(offer => <article className="bd-offer" key={offer.id}>
      <button className="bd-offer-picture" aria-label={`Consultar ${offer.name}`} onClick={() => setSelected(offer)}><BusinessRecordPhoto id={offer.photos[0]?.id ?? null} alt={offer.photos[0]?.altText || offer.name}/></button>
      <div className="bd-offer-body"><span className="bd-eyebrow">{offer.internalCode}</span><h3>{offer.name}</h3><p className="bd-clamp">{offer.description || 'Sin descripción registrada.'}</p><strong className="bd-price">{offerPrice(offer)}</strong><small>{categoryName(offer.category)}</small><div className="bd-badges"><Badge tone={offer.publicationStatus === 'PUBLISHED' && !offer.deletedAt ? 'green' : 'neutral'}>{offer.deletedAt ? 'Eliminado' : label(offer.publicationStatus)}</Badge><Badge>{offer.active ? 'Activo' : 'Inactivo'}</Badge>{offer.administrativeStatus !== 'NONE' && <Badge tone="amber">{label(offer.administrativeStatus)}</Badge>}</div><button className="bd-button bd-button--soft" onClick={() => setSelected(offer)}>Ver detalle<Icon name="arrow" size={15}/></button></div>
    </article>)}</div> : <Empty title={q || status || activation ? 'Sin coincidencias para estos filtros' : kind === 'PRODUCT' ? 'Sin productos registrados' : 'Sin servicios registrados'} message="Prueba otros filtros o consulta el otro tipo de publicación. Esta ficha es de solo lectura."/>}<Pager pagination={source.data.pagination} onPage={setPage}/></>}
    {selected && <AdminDialog title={selected.name} wide contextLabel="XAMUKO ADMIN · CONSULTA DEL CATÁLOGO" onClose={() => setSelected(null)}><div className="bd-offer-detail"><BusinessRecordPhoto id={selected.photos[0]?.id ?? null} alt={selected.name} size={1600} eager/><div><Badge>{selected.kind === 'PRODUCT' ? 'Producto' : 'Servicio'} · {selected.internalCode}</Badge><h3>{offerPrice(selected)}</h3><p>{selected.description || 'Sin descripción registrada.'}</p><dl className="bd-facts"><div><dt>Categoría</dt><dd>{categoryName(selected.category)}</dd></div><div><dt>Publicación</dt><dd>{selected.deletedAt ? 'Eliminado' : label(selected.publicationStatus)}</dd></div><div><dt>Activación</dt><dd>{selected.active ? 'Activo' : 'Inactivo'}</dd></div><div><dt>Control administrativo</dt><dd>{label(selected.administrativeStatus)}</dd></div><div><dt>Última actualización</dt><dd>{date(selected.updatedAt)}</dd></div></dl><p className="bd-note">La información comercial se consulta sin modificarla.</p>{canModerate && <Link className="bd-button" to={`/content/${selected.id}`}>Abrir procedimiento de moderación<Icon name="arrow" size={16}/></Link>}</div></div></AdminDialog>}
  </Card>;
}
