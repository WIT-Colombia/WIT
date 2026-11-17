import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminDialog } from '../../components/AdminDialog';
import { Icon } from '../../components/Icon';
import { BusinessRecordPhoto } from '../../components/businesses/BusinessRecordPhoto';
import { getRecordCatalog, setRecordOfferState, type AdminOfferAction, type RecordOffer } from '../../services/adminBusinessRecord';
import { Badge, Empty, Loading, Pager, categoryName, date, label, number, useResource } from './shared';

export function offerPrice(offer: Pick<RecordOffer, 'negotiable' | 'priceAmount' | 'currency'>) {
  if (offer.negotiable || offer.priceAmount === null) return 'Precio a convenir';
  const value = Number(offer.priceAmount);
  if (!Number.isFinite(value)) return 'Precio no disponible';
  const currency = offer.currency;
  if (!currency) return value.toLocaleString('es-CO') + ' (moneda no registrada)';
  try { return new Intl.NumberFormat('es-CO', { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: currency === 'COP' ? 0 : 2 }).format(value); }
  catch { return value.toLocaleString('es-CO') + ' ' + currency; }
}

type CatalogState = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'DELETED';
type Decision = { offer: RecordOffer; action: AdminOfferAction };
const actions: Array<{ value: AdminOfferAction; label: string; icon: string }> = [
  { value: 'ACTIVATE', label: 'Activar', icon: 'check' },
  { value: 'DEACTIVATE', label: 'Desactivar', icon: 'eye-off' },
  { value: 'DELETE', label: 'Eliminar', icon: 'trash' },
];
const stateOf = (offer: RecordOffer): Exclude<CatalogState, 'ALL'> =>
  offer.deletedAt ? 'DELETED' : offer.active ? 'ACTIVE' : 'INACTIVE';
const stateText = (state: CatalogState) => ({
  ALL: 'Todos', ACTIVE: 'Activo', INACTIVE: 'Desactivado', DELETED: 'Eliminado'
})[state];

export function Catalog({ id, allowed, canModerate, canDelete, onChanged }: {
  id: string; allowed: boolean; canModerate: boolean; canDelete: boolean; onChanged: (message: string) => void;
}) {
  const [kind, setKind] = useState<'PRODUCT' | 'SERVICE'>('PRODUCT');
  const [query, setQuery] = useState(''), [q, setQ] = useState('');
  const [state, setState] = useState<CatalogState>('ALL'), [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RecordOffer | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const source = useResource(() => getRecordCatalog(id, { kind, q, state, page }), [id, kind, q, state, page], allowed);

  const openDecision = (offer: RecordOffer, action: AdminOfferAction) => {
    setSelected(null); setReason(''); setError(''); setDecision({ offer, action });
  };
  const submitDecision = async () => {
    if (!decision || busy || reason.trim().length < 12) return;
    setBusy(true); setError('');
    try {
      const result = await setRecordOfferState(id, decision.offer.id, decision.action, reason.trim());
      setDecision(null); setReason(''); source.retry(); onChanged(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo realizar el cambio. Intenta nuevamente.');
    } finally { setBusy(false); }
  };

  if (!allowed) return <Empty icon="lock" title="Catálogo de acceso restringido" message="Tu cuenta necesita permiso de consulta de catálogo para ver productos y servicios."/>;
  return <section className="bd-catalog bd-catalog-premium" aria-labelledby="bd-catalog-title">
    <header className="bd-catalog-header">
      <span className="bd-catalog-header-icon"><Icon name="box" size={25}/></span>
      <div><h2 id="bd-catalog-title">Productos y servicios</h2>
        <p>Consulta y gestión administrativa del catálogo de este establecimiento.</p></div>
    </header>
    <div className="bd-catalog-toolbar">
      <div className="bd-subtabs bd-catalog-switch" role="group" aria-label="Tipo de publicación">
        {([['PRODUCT', 'Productos'], ['SERVICE', 'Servicios']] as const).map(([value, title]) =>
          <button type="button" key={value} aria-pressed={kind === value}
            onClick={() => { setKind(value); setPage(1); }}>
            <Icon name={value === 'PRODUCT' ? 'box' : 'settings'} size={17}/>{title}
          </button>)}
      </div>
      <form className="bd-catalog-filters" onSubmit={event => { event.preventDefault(); setQ(query.trim()); setPage(1); }}>
        <label className="bd-catalog-search"><span className="bd-sr-only">Buscar por nombre o código</span>
          <Icon name="search" size={19}/>
          <input aria-label="Buscar por nombre o código" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar nombre o código..."/>
          <button type="submit" className="bd-catalog-search-button" aria-label="Buscar productos o servicios"><Icon name="search" size={17}/>Buscar</button>
        </label>
        <label className="bd-catalog-state-filter">
          <Icon name="filter" size={17}/>
          <span>Estado</span>
          <select aria-label="Estado del catálogo" value={state} onChange={event => { setState(event.target.value as CatalogState); setPage(1); }}>
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Desactivados</option>
            <option value="DELETED">Eliminados</option>
          </select>
          <Icon name="chevron" size={14}/>
        </label>
      </form>
    </div>

    <Loading {...source}/>
    {!source.loading && !source.error && source.data && <>
      <div className="bd-catalog-result-caption">
        <span>{kind === 'PRODUCT' ? 'Productos' : 'Servicios'} <strong>{number(source.data.pagination.total)}</strong></span>
        <small>{state === 'ALL' ? 'Todos los estados' : state === 'ACTIVE' ? 'Activos' : state === 'INACTIVE' ? 'Desactivados' : 'Eliminados'}</small>
      </div>
      {source.data.offers.length
        ? <div className="bd-offer-grid">
          {source.data.offers.map(offer => {
            const itemState = stateOf(offer);
            const restricted = offer.administrativeStatus !== 'NONE' && !offer.deletedAt;
            return <article className={'bd-offer bd-catalog-offer' + (itemState === 'DELETED' ? ' bd-catalog-offer--deleted' : '')} key={offer.id}>
              <button type="button" className="bd-offer-picture" aria-label={'Consultar ' + offer.name} onClick={() => setSelected(offer)}>
                <BusinessRecordPhoto id={offer.photos[0]?.id ?? null} alt={offer.photos[0]?.altText || offer.name}/>
                <span className={'bd-catalog-status bd-catalog-status--' + itemState.toLowerCase()}>{stateText(itemState)}</span>
              </button>
              <div className="bd-offer-body">
                <span className="bd-eyebrow">{offer.kind === 'PRODUCT' ? 'PRODUCTO' : 'SERVICIO'} · {offer.internalCode}</span>
                <h3>{offer.name}</h3>
                <p className="bd-clamp">{offer.description || 'Sin descripción registrada.'}</p>
                <strong className="bd-price">{offerPrice(offer)}</strong>
                <small className="bd-catalog-category"><Icon name="tag" size={13}/>{categoryName(offer.category)}</small>
                <div className="bd-badges">
                  <Badge tone={offer.publicationStatus === 'PUBLISHED' && !offer.deletedAt ? 'green' : 'neutral'}>
                    {offer.deletedAt ? 'Eliminado' : label(offer.publicationStatus)}
                  </Badge>
                  {restricted && <Badge tone="amber">{label(offer.administrativeStatus)}</Badge>}
                </div>
                <button type="button" className="bd-catalog-detail-button" onClick={() => setSelected(offer)}>
                  Ver detalle <Icon name="arrow" size={16}/>
                </button>
              </div>
              {canModerate && <div className="bd-catalog-card-actions" aria-label={'Acciones de ' + offer.name}>
                {actions.map(option => {
                  const disabled = busy || Boolean(offer.deletedAt) || restricted
                    || (option.value === 'ACTIVATE' && (offer.active || offer.publicationStatus === 'REVIEW'))
                    || (option.value === 'DEACTIVATE' && !offer.active)
                    || (option.value === 'DELETE' && !canDelete);
                  return <button key={option.value} type="button"
                    className={'bd-catalog-action bd-catalog-action--' + option.value.toLowerCase()}
                    aria-label={option.label + ' ' + offer.name}
                    title={option.value === 'DELETE' && !canDelete ? 'Solo el administrador principal puede eliminar' : undefined}
                    disabled={disabled}
                    onClick={() => openDecision(offer, option.value)}>
                    <Icon name={option.icon} size={16}/>{option.label}
                  </button>;
                })}
              </div>}
            </article>;
          })}
        </div>
        : <Empty icon="box" title={q || state !== 'ALL' ? 'Sin coincidencias para estos filtros'
          : kind === 'PRODUCT' ? 'Sin productos registrados' : 'Sin servicios registrados'}
          message="Prueba con otra búsqueda o selecciona Todos para consultar el catálogo completo."/>}
      <Pager pagination={source.data.pagination} onPage={setPage} loading={source.loading}/>
    </>}

    {selected && <AdminDialog title={selected.name} wide contextLabel="XAMUKO ADMIN · CONSULTA DEL CATÁLOGO" onClose={() => setSelected(null)}>
      <div className="bd-offer-detail">
        <BusinessRecordPhoto id={selected.photos[0]?.id ?? null} alt={selected.name} size={1600} eager/>
        <div><Badge>{selected.kind === 'PRODUCT' ? 'Producto' : 'Servicio'} · {selected.internalCode}</Badge>
          <h3>{offerPrice(selected)}</h3><p>{selected.description || 'Sin descripción registrada.'}</p>
          <dl className="bd-facts">
            <div><dt>Categoría</dt><dd>{categoryName(selected.category)}</dd></div>
            <div><dt>Estado</dt><dd>{stateText(stateOf(selected))}</dd></div>
            <div><dt>Publicación</dt><dd>{selected.deletedAt ? 'Eliminado' : label(selected.publicationStatus)}</dd></div>
            <div><dt>Control administrativo</dt><dd>{label(selected.administrativeStatus)}</dd></div>
            <div><dt>Creación</dt><dd>{date(selected.createdAt)}</dd></div>
            <div><dt>Última actualización</dt><dd>{date(selected.updatedAt)}</dd></div>
          </dl>
          {canModerate && <Link className="bd-button" to={'/content/' + selected.id}>Abrir procedimiento de moderación<Icon name="arrow" size={16}/></Link>}
        </div>
      </div>
    </AdminDialog>}

    {decision && <AdminDialog title={actions.find(option => option.value === decision.action)?.label + ' publicación'}
      contextLabel="XAMUKO ADMIN · DECISIÓN SOBRE CATÁLOGO" busy={busy}
      onClose={() => { setDecision(null); setError(''); }}>
      <div className="bd-catalog-decision">
        <p>Vas a <strong>{decision.action === 'ACTIVATE' ? 'activar' : decision.action === 'DEACTIVATE' ? 'desactivar' : 'eliminar'}</strong> el {decision.offer.kind === 'PRODUCT' ? 'producto' : 'servicio'} <strong>«{decision.offer.name}»</strong>.</p>
        {decision.action === 'DELETE' && <p className="bd-catalog-danger-note">
          Se retirará del catálogo y permanecerá registrado para auditoría. La recuperación requiere un procedimiento administrativo independiente.
        </p>}
        <label htmlFor="bd-catalog-reason">Motivo de la decisión <span>(obligatorio, mínimo 12 caracteres)</span></label>
        <textarea id="bd-catalog-reason" autoFocus value={reason}
          onChange={event => setReason(event.target.value)} maxLength={500} rows={4}
          placeholder="Explica por qué se aplica esta decisión administrativa..." disabled={busy}/>
        <small>{reason.trim().length}/500 caracteres</small>
        {error && <p className="bd-catalog-decision-error" role="alert">{error}</p>}
        <div className="bd-catalog-decision-actions">
          <button type="button" className="bd-catalog-cancel" disabled={busy} onClick={() => setDecision(null)}>Cancelar</button>
          <button type="button" className={'bd-catalog-confirm' + (decision.action === 'DELETE' ? ' bd-catalog-confirm--danger' : '')}
            disabled={busy || reason.trim().length < 12} onClick={() => void submitDecision()}>
            <Icon name={decision.action === 'DELETE' ? 'trash' : 'check'} size={17}/>
            {busy ? 'Guardando…' : 'Confirmar ' + (decision.action === 'ACTIVATE' ? 'activación' : decision.action === 'DEACTIVATE' ? 'desactivación' : 'eliminación')}
          </button>
        </div>
      </div>
    </AdminDialog>}
  </section>;
}
